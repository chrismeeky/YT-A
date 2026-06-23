import { NextRequest, NextResponse } from 'next/server';
import { generateYoutubeDescription } from '@/lib/claude';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string } },
) {
  const body = (await request.json()) as {
    title: string;
    fullScript: string;
    channelStyle?: string;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
  };

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  try {
    const { description, inputTokens, outputTokens } = await generateYoutubeDescription(
      llm,
      body.title,
      body.fullScript,
      body.channelStyle,
    );

    const { cost: descCost, api: descApi } = calcLLMCost(llm.provider, inputTokens, outputTokens);
    void trackUsage({
      operation: 'generate-description',
      api: descApi,
      project_id: params.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: descCost,
    });

    return NextResponse.json({ description });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Description generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
