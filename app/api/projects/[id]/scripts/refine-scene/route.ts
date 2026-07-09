import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { refineSceneVoice, sanitizeDirectorSegment } from '@/lib/claude';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';
import { getUserIdFromRequest } from '@/lib/supabase';
import type { Analysis, Scene, ScriptSettings, DirectorSegment, DirectorAsset } from '@/lib/types';
import type { DirectorScriptSegment } from '@/lib/claude';

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json() as {
    targetScene: Scene;
    allScenes: Scene[];
    analysis: Analysis;
    topic: string;
    settings: ScriptSettings;
    directorMode?: boolean;
    assetMixOverride?: Record<string, number>;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
    claudeModel?: string;
  };

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  const userId = await getUserIdFromRequest(request);

  try {
    const refined = await refineSceneVoice(
      llm,
      body.topic,
      body.analysis,
      body.targetScene,
      body.allScenes,
      body.settings,
      body.directorMode ?? false,
      body.assetMixOverride,
      body.claudeModel,
    );

    if (!refined) {
      return NextResponse.json({ error: 'No voice material available for refinement.' }, { status: 400 });
    }

    const { cost: refineCost, api: refineApi } = calcLLMCost(llm.provider, refined.inputTokens, refined.outputTokens);
    void trackUsage({
      operation: 'refine-scene',
      api: refineApi,
      project_id: params.id,
      user_id: userId,
      input_tokens: refined.inputTokens,
      output_tokens: refined.outputTokens,
      estimated_cost_usd: refineCost,
    });

    const r = refined.result;

    // Director mode: build complete DirectorSegment[] ready for the client to set directly
    if (body.directorMode && r.segments?.length) {
      const directorSegments: DirectorSegment[] = r.segments.map((seg: DirectorScriptSegment) =>
        sanitizeDirectorSegment({
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
        })
      );
      const narration = r.segments.map((s: DirectorScriptSegment) => s.text).join(' ');
      return NextResponse.json({ number: r.number, narration, directorSegments });
    }

    return NextResponse.json({ number: r.number, narration: r.narration });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scene refinement failed' },
      { status: 500 }
    );
  }
}
