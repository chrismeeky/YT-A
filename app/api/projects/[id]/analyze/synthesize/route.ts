import { NextRequest, NextResponse } from 'next/server';
import { synthesizeChannelInsights } from '@/lib/claude';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';
import type { VideoAnalysis } from '@/lib/types';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    videoAnalyses: VideoAnalysis[];
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

  if (!body.videoAnalyses?.length) {
    return NextResponse.json({ error: 'No video analyses provided' }, { status: 400 });
  }

  try {
    const { result, inputTokens, outputTokens } = await synthesizeChannelInsights(
      llm, body.videoAnalyses, body.claudeModel,
    );

    const { cost: synthCost, api: synthApi } = calcLLMCost(llm.provider, inputTokens, outputTokens);
    void trackUsage({
      operation: 'analyze',
      api: synthApi,
      project_id: params.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: synthCost,
    });

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Synthesis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
