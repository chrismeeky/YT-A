import { NextRequest, NextResponse } from 'next/server';
import { getVideoTranscript, getThumbnailBase64 } from '@/lib/youtube';
import { analyzeVideo } from '@/lib/claude';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import type { ChannelVideo } from '@/lib/types';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    video: ChannelVideo;
    anthropicApiKey?: string;
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }

  try {
    const [transcript, thumbnail] = await Promise.all([
      getVideoTranscript(body.video.id),
      getThumbnailBase64(body.video.id),
    ]);

    const { result, inputTokens, outputTokens } = await analyzeVideo(
      anthropicApiKey, body.video, transcript, thumbnail.data,
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
    const message = err instanceof Error ? err.message : 'Video analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
