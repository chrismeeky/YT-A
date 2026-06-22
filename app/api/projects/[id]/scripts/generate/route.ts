import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { generateScript, extractVoicePrinciples } from '@/lib/claude';
import { sseEmit } from '@/lib/sse';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import { getUserIdFromRequest } from '@/lib/supabase';
import type { Script, Scene, ScriptSettings, Analysis, DirectorAsset, DirectorSegment } from '@/lib/types';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as {
    analysis: Analysis;
    topic: string;
    targetAudience?: string;
    additionalInstructions?: string;
    detailLevel?: string;
    videoLength?: number;
    wpm?: number;
    anthropicApiKey?: string;
    directorMode?: boolean;
    assetMixOverride?: Record<string, number>;
    blueprintTranscriptIds?: string[];
    useChannelStrategy?: boolean;
  };
  const userId = await getUserIdFromRequest(request);

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required. Add it in Settings.' }, { status: 400 });
  }

  if (!body.analysis?.id) {
    return NextResponse.json({ error: 'Analysis object required.' }, { status: 400 });
  }

  const directorMode = body.directorMode ?? false;
  const videoLength = body.videoLength ?? 5;
  const wpm        = body.wpm        ?? 150;
  const targetWordCount = Math.round(videoLength * wpm);
  const scriptSettings: ScriptSettings = { videoLength, wpm, targetWordCount };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: object) => sseEmit(controller, encoder, payload);
      try {
        emit({ message: `Building prompt from channel analysis…` });

        const modeLabel = directorMode ? ' with director segments' : '';
        emit({ message: `Generating ~${targetWordCount.toLocaleString()} word script${modeLabel} with Claude… (this may take up to 90 seconds)` });

        const keepalive = setInterval(() => {
          try { emit({ message: 'Still generating…' }); } catch { /* stream closed */ }
        }, 15_000);

        // Resolve blueprint transcript text from the analysis's video analyses.
        // Fall back to stitched partial excerpts if fullTranscript is missing (older analyses).
        const blueprintTranscripts = (body.blueprintTranscriptIds ?? [])
          .map(id => {
            const v = body.analysis.videoAnalyses.find(v => v.videoId === id);
            if (!v) return null;
            return v.fullTranscript
              || [v.transcriptHook, v.transcriptExcerpt, v.transcriptClimax, v.transcriptOutro]
                   .filter(Boolean).join('\n\n') || null;
          })
          .filter((t): t is string => !!t);

        // Extract generative voice principles from transcripts before generation.
        // This converts raw transcripts into craft mechanisms Claude applies freshly,
        // rather than patterns it copies literally.
        let voicePrinciples: string | undefined;
        if (blueprintTranscripts.length) {
          emit({ message: 'Extracting author voice principles…' });
          voicePrinciples = await extractVoicePrinciples(anthropicApiKey, blueprintTranscripts);
        }

        let generated: Awaited<ReturnType<typeof generateScript>>['result'];
        let inputTokens: number;
        let outputTokens: number;
        try {
          const instructionParts = [
            body.additionalInstructions,
            body.detailLevel ? `Story detail level — ${body.detailLevel}` : null,
          ].filter(Boolean);
          ({ result: generated, inputTokens, outputTokens } = await generateScript(
            anthropicApiKey,
            body.analysis,
            scriptSettings,
            body.topic,
            body.targetAudience ?? '',
            instructionParts.join('\n\n'),
            directorMode,
            body.assetMixOverride,
            blueprintTranscripts.length ? blueprintTranscripts : undefined,
            body.useChannelStrategy ?? true,
            voicePrinciples,
          ));
        } finally {
          clearInterval(keepalive);
        }

        // Director mode: parse flat scriptSlices; regular mode: parse scenes array
        let scenes: Scene[] = [];
        let scriptSlices: DirectorSegment[] | undefined;

        if (directorMode && generated.scriptSlices?.length) {
          emit({ message: `Parsing ${generated.scriptSlices.length} visual slices…` });
          scriptSlices = generated.scriptSlices.map(s => ({
            id: uuid(),
            narrationExcerpt: s.narrationExcerpt,
            durationSeconds: s.durationSeconds,
            assets: (s.assets ?? []).map((a): DirectorAsset => ({
              id: uuid(),
              rank: a.rank,
              type: a.type as DirectorAsset['type'],
              rationale: a.note,
              searchQuery: a.searchQuery ?? undefined,
              prompts: [],
              totalDuration: s.durationSeconds,
              generated: false,
            })),
          }));
        } else if (generated.scenes?.length) {
          emit({ message: `Parsing ${generated.scenes.length} scenes…` });
          scenes = generated.scenes.map(s => ({
            id: uuid(),
            number: s.number,
            title: s.title,
            narration: s.narration ?? '',
            sceneDescription: s.sceneDescription,
            estimatedDurationSeconds: s.estimatedDurationSeconds,
            wordCount: s.wordCount,
            includeImagePrompt: true,
            includeVideoPrompt: true,
            includeStockUrl: false,
            includeStockPhotos: false,
            includeRealImages: false,
            includeStockVideos: false,
            mediaFiles: [],
          }));
        }

        const script: Script = {
          id: uuid(),
          projectId: params.id,
          analysisId: body.analysis.id,
          title: generated.title,
          topic: body.topic,
          targetAudience:         body.targetAudience         ?? '',
          additionalInstructions: body.additionalInstructions ?? '',
          thumbnailConcept: generated.thumbnailConcept,
          fullScript: generated.fullScript,
          scriptSlices,
          createdAt:  new Date().toISOString(),
          updatedAt:  new Date().toISOString(),
          settings:   scriptSettings,
          scenes,
          savedToDisk: false,
          directorMode,
          blueprintTranscriptIds: body.blueprintTranscriptIds,
        };

        void trackUsage({
          operation: 'generate-script',
          api: 'anthropic',
          project_id: params.id,
          user_id: userId,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: calcAnthropicCost(inputTokens, outputTokens),
        });

        emit({ done: true, result: script });
      } catch (err: unknown) {
        emit({ error: err instanceof Error ? err.message : 'Script generation failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
