import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { sliceScript } from '@/lib/claude';
import { llmComplete } from '@/lib/llm';
import { sseEmit } from '@/lib/sse';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';
import { getUserIdFromRequest } from '@/lib/supabase';
import type { Script, Scene, ScriptSettings, Analysis, DirectorAsset, DirectorSegment } from '@/lib/types';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as {
    fullScript: string;
    analysis: Analysis;
    videoLength?: number;
    wpm?: number;
    assetMixOverride?: Record<string, number>;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
    claudeModel?: string;
    title?: string;
  };

  const userId = await getUserIdFromRequest(request);

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  if (!body.analysis?.id) {
    return NextResponse.json({ error: 'Analysis object required.' }, { status: 400 });
  }

  if (!body.fullScript?.trim()) {
    return NextResponse.json({ error: 'fullScript is required.' }, { status: 400 });
  }

  const wpm = body.wpm ?? 150;
  const actualWordCount = body.fullScript.trim().split(/\s+/).filter(Boolean).length;
  const videoLength = body.videoLength ?? Math.max(1, Math.round(actualWordCount / wpm));
  const targetWordCount = actualWordCount;
  const scriptSettings: ScriptSettings = { videoLength, wpm, targetWordCount };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: object) => sseEmit(controller, encoder, payload);
      try {
        const providerLabel = llm.provider === 'grok' ? 'Grok' : 'Claude';
        emit({ message: `Slicing script into director segments with ${providerLabel}… (this may take up to 60 seconds)` });

        const keepalive = setInterval(() => {
          try { emit({ message: 'Still slicing…' }); } catch { /* stream closed */ }
        }, 15_000);

        let generated: Awaited<ReturnType<typeof sliceScript>>['result'];
        let inputTokens: number;
        let outputTokens: number;
        try {
          ({ result: generated, inputTokens, outputTokens } = await sliceScript(
            llm,
            body.fullScript,
            scriptSettings,
            body.analysis,
            body.assetMixOverride,
            body.claudeModel,
          ));
        } finally {
          clearInterval(keepalive);
        }

        // Generate a title from the first ~300 words of the script
        emit({ message: 'Generating title…' });
        let generatedTitle = body.title || '';
        if (!generatedTitle) {
          try {
            const excerpt = body.fullScript.trim().split(/\s+/).slice(0, 300).join(' ');
            const titleRes = await llmComplete(llm, {
              claudeModel: 'claude-haiku-4-5-20251001',
              maxTokens: 60,
              grokReasoningEffort: 'none',
              system: 'You generate concise YouTube video titles. Respond with ONLY the title — no quotes, no punctuation at the end, no explanation.',
              messages: [{ role: 'user', content: `Based on the opening of this script, write a compelling YouTube title (max 10 words):\n\n${excerpt}` }],
            });
            generatedTitle = titleRes.text.trim().replace(/^["']|["']$/g, '');
          } catch {
            generatedTitle = 'Imported Script';
          }
        }

        const scenes: Scene[] = [];
        let scriptSlices: DirectorSegment[] | undefined;

        if (generated.scriptSlices?.length) {
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
        }

        const script: Script = {
          id: uuid(),
          projectId: params.id,
          analysisId: body.analysis.id,
          title: generatedTitle,
          topic: generatedTitle,
          imported: true,
          targetAudience: '',
          additionalInstructions: '',
          thumbnailConcept: '',
          fullScript: body.fullScript,
          scriptSlices,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          settings: scriptSettings,
          scenes,
          savedToDisk: false,
          llmProvider: llm.provider,
          directorMode: true,
        };

        const { cost: scriptCost, api: scriptApi } = calcLLMCost(llm.provider, inputTokens, outputTokens);
        void trackUsage({
          operation: 'slice-script',
          api: scriptApi,
          project_id: params.id,
          user_id: userId,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          estimated_cost_usd: scriptCost,
        });

        emit({ done: true, result: script });
      } catch (err: unknown) {
        emit({ error: err instanceof Error ? err.message : 'Script slicing failed' });
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
