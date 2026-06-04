import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { generateScript, refineScriptVoice, sanitizeDirectorSegment } from '@/lib/claude';
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
    detailLevel?: string;
    videoLength?: number;
    wpm?: number;
    anthropicApiKey?: string;
    directorMode?: boolean;
    skipPass2?: boolean;
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
  const skipPass2 = body.skipPass2 ?? false;
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
            false, // Pass 1 always writes plain narration; director segmentation is done in Pass 2
          ));
        } finally {
          clearInterval(keepalive);
        }

        emit({ message: `Parsing ${generated.scenes.length} scenes…` });

        // Pass 1 always produces plain narration scenes; director segments are built in Pass 2
        const scenes: Scene[] = generated.scenes.map(s => ({
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

        // ── Pass 2: voice refinement ─────────────────────────────────────────
        let pass2InputTokens = 0;
        let pass2OutputTokens = 0;
        if (!skipPass2) try {
          emit({ message: directorMode ? 'Script drafted. Refining voice and generating director segments…' : 'Script drafted. Refining voice to match channel…' });

          const refineKeepalive = setInterval(() => {
            try { emit({ message: 'Still refining voice…' }); } catch { /* stream closed */ }
          }, 15_000);

          let refined: Awaited<ReturnType<typeof refineScriptVoice>>;
          try {
            refined = await refineScriptVoice(
              anthropicApiKey,
              body.topic,
              body.analysis,
              scenes,
              scriptSettings,
              directorMode,
              body.assetMixOverride,
            );
          } finally {
            clearInterval(refineKeepalive);
          }

          if (refined) {
            pass2InputTokens  = refined.inputTokens;
            pass2OutputTokens = refined.outputTokens;

            const refinedMap = new Map(refined.result.map(r => [r.number, r]));

            for (const scene of scenes) {
              const r = refinedMap.get(scene.number);
              if (!r) continue;

              if (directorMode && r.segments?.length) {
                // Director mode: Pass 2 owns all segmentation — build DirectorSegments from scratch
                scene.directorSegments = r.segments.map(seg => sanitizeDirectorSegment({
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
                scene.narration = r.segments.map(s => s.text).join(' ');
              } else if (!directorMode && r.narration) {
                scene.narration = r.narration;
              }
            }
          }
        } catch (refineErr) {
          throw refineErr;
        }
        // ── end Pass 2 ───────────────────────────────────────────────────────

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
          input_tokens: inputTokens + pass2InputTokens,
          output_tokens: outputTokens + pass2OutputTokens,
          estimated_cost_usd: calcAnthropicCost(inputTokens + pass2InputTokens, outputTokens + pass2OutputTokens),
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
