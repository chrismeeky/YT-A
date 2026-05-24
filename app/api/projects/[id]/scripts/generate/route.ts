import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { generateScript } from '@/lib/claude';
import { sseEmit } from '@/lib/sse';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import { getUserIdFromRequest } from '@/lib/supabase';
import type { Script, Scene, ScriptSettings, Analysis, DirectorSegment, DirectorAsset } from '@/lib/types';

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
    videoLength?: number;
    wpm?: number;
    anthropicApiKey?: string;
    directorMode?: boolean;
    assetMixOverride?: Record<string, number>;
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

        let generated: Awaited<ReturnType<typeof generateScript>>['result'];
        let inputTokens: number;
        let outputTokens: number;
        try {
          ({ result: generated, inputTokens, outputTokens } = await generateScript(
            anthropicApiKey,
            body.analysis,
            scriptSettings,
            body.topic,
            body.targetAudience        ?? '',
            body.additionalInstructions ?? '',
            directorMode,
            body.assetMixOverride,
          ));
        } finally {
          clearInterval(keepalive);
        }

        emit({ message: `Parsing ${generated.scenes.length} scenes…` });

        const scenes: Scene[] = generated.scenes.map(s => {
          // Director mode: build narration from segments and attach directorSegments
          if (directorMode && Array.isArray(s.segments) && s.segments.length > 0) {
            const narration = s.segments.map(seg => seg.text).join(' ');

            const directorSegments: DirectorSegment[] = s.segments.map(seg => ({
              id: uuid(),
              narrationExcerpt: seg.text,
              durationSeconds: seg.durationSeconds,
              assets: (seg.assets ?? []).map((a): DirectorAsset => ({
                id: uuid(),
                rank: a.rank,
                type: a.type as DirectorAsset['type'],
                rationale: a.note,
                searchQuery: a.searchQuery ?? undefined,
                prompts: [],
                totalDuration: seg.durationSeconds,
                generated: false,
                slot: a.slot ?? undefined,
                narrationSlice: a.narrationSlice ?? undefined,
              })),
            }));

            return {
              id: uuid(),
              number: s.number,
              title: s.title,
              narration,
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
              directorSegments,
            };
          }

          // Regular mode
          return {
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
          };
        });

        const script: Script = {
          id: uuid(),
          projectId: params.id,
          analysisId: body.analysis.id,
          title: generated.title,
          topic: body.topic,
          targetAudience:         body.targetAudience         ?? '',
          additionalInstructions: body.additionalInstructions ?? '',
          thumbnailConcept: generated.thumbnailConcept,
          createdAt:  new Date().toISOString(),
          updatedAt:  new Date().toISOString(),
          settings:   scriptSettings,
          scenes,
          savedToDisk: false,
          directorMode,
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
