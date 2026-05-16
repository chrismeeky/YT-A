import { NextRequest, NextResponse } from 'next/server';
import { synthesizeChannelInsights } from '@/lib/claude';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import type { VideoAnalysis } from '@/lib/types';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    videoAnalyses: VideoAnalysis[];
    anthropicApiKey?: string;
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }

  if (!body.videoAnalyses?.length) {
    return NextResponse.json({ error: 'No video analyses provided' }, { status: 400 });
  }

  try {
    const { result, inputTokens, outputTokens } = await synthesizeChannelInsights(
      anthropicApiKey, body.videoAnalyses,
    );

    void trackUsage({
      operation: 'analyze',
      api: 'anthropic',
      project_id: params.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: calcAnthropicCost(inputTokens, outputTokens),
    });

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Synthesis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
