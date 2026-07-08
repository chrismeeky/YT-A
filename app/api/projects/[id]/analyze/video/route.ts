import { NextRequest, NextResponse } from 'next/server';
import { getVideoTranscript, getThumbnailBase64 } from '@/lib/youtube';
import { analyzeVideo } from '@/lib/claude';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';
import type { ChannelVideo } from '@/lib/types';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await request.json()) as {
    video: ChannelVideo;
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

  try {
    const [transcript, thumbnail] = await Promise.all([
      getVideoTranscript(body.video.id),
      getThumbnailBase64(body.video.id),
    ]);

    const { result, inputTokens, outputTokens } = await analyzeVideo(
      llm, body.video, transcript, thumbnail.data, body.claudeModel,
    );

    // Capture transcript sections for voice bible + full transcript for synthesis
    if (transcript) {
      const len = transcript.length;
      result.fullTranscript    = transcript.trim();
      result.transcriptHook    = transcript.slice(0, Math.min(len, 800)).trim();
      const bodyStart          = Math.floor(len * 0.15);
      result.transcriptExcerpt = transcript.slice(bodyStart, Math.min(len, bodyStart + 1500)).trim();
      const climaxStart        = Math.floor(len * 0.60);
      result.transcriptClimax  = transcript.slice(climaxStart, Math.min(len, climaxStart + 1200)).trim();
      result.transcriptOutro   = transcript.slice(Math.max(0, len - 600)).trim();
    }

    const { cost: videoCost, api: videoApi } = calcLLMCost(llm.provider, inputTokens, outputTokens);
    void trackUsage({
      operation: 'analyze',
      api: videoApi,
      project_id: params.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: videoCost,
    });

    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
