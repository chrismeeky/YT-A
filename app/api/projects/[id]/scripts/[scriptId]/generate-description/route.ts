import { NextRequest, NextResponse } from 'next/server';
import { generateYoutubeDescription } from '@/lib/claude';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';

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
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }

  try {
    const { description, inputTokens, outputTokens } = await generateYoutubeDescription(
      anthropicApiKey,
      body.title,
      body.fullScript,
      body.channelStyle,
    );

    void trackUsage({
      operation: 'generate-description',
      api: 'anthropic',
      project_id: params.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: calcAnthropicCost(inputTokens, outputTokens),
    });

    return NextResponse.json({ description });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Description generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
