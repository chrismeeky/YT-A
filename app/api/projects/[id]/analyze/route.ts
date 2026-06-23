import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getVideoTranscript, getThumbnailBase64 } from '@/lib/youtube';
import { analyzeVideo, synthesizeChannelInsights } from '@/lib/claude';
import { sseEmit } from '@/lib/sse';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';
import type { ChannelVideo, Analysis } from '@/lib/types';

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as {
    videos: ChannelVideo[];
    channelUrl: string;
    analysisName: string;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
    userId?: string;
  };

  const { videos, channelUrl, analysisName } = body;

  if (!videos?.length || videos.length > 10) {
    return NextResponse.json({ error: 'Select between 1 and 10 videos' }, { status: 400 });
  }

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: object) => sseEmit(controller, encoder, payload);
      try {
        const videoAnalyses = [];
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          const label = `"${video.title.length > 50 ? video.title.slice(0, 50) + '…' : video.title}"`;

          emit({ message: `Fetching transcript for ${label}…` });
          const [transcript, thumbnail] = await Promise.all([
            getVideoTranscript(video.id),
            getThumbnailBase64(video.id),
          ]);

          const providerLabel = llm.provider === 'grok' ? 'Grok' : 'Claude';
          emit({ message: `Analysing video ${i + 1} of ${videos.length} with ${providerLabel}…` });
          const { result: analysis, inputTokens, outputTokens } = await analyzeVideo(llm, video, transcript, thumbnail.data);

          if (transcript) {
            const len = transcript.length;
            analysis.fullTranscript    = transcript.trim();
            analysis.transcriptHook    = transcript.slice(0, Math.min(len, 800)).trim();
            const bodyStart            = Math.floor(len * 0.15);
            analysis.transcriptExcerpt = transcript.slice(bodyStart, Math.min(len, bodyStart + 1500)).trim();
            const climaxStart          = Math.floor(len * 0.60);
            analysis.transcriptClimax  = transcript.slice(climaxStart, Math.min(len, climaxStart + 1200)).trim();
            analysis.transcriptOutro   = transcript.slice(Math.max(0, len - 600)).trim();
          }

          videoAnalyses.push(analysis);
          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;
        }

        emit({ message: 'Synthesising channel insights…' });
        const { result: channelInsights, inputTokens: ci, outputTokens: co } = await synthesizeChannelInsights(llm, videoAnalyses);
        totalInputTokens += ci;
        totalOutputTokens += co;

        emit({ message: 'Saving analysis…' });
        const analysis: Analysis = {
          id: uuid(),
          name: analysisName || `Analysis ${new Date().toLocaleDateString()}`,
          projectId: params.id,
          createdAt: new Date().toISOString(),
          channelUrl,
          channelName: videos[0]?.channelName || '',
          videoAnalyses,
          channelInsights,
        };

        const { cost: analyzeCost, api: analyzeApi } = calcLLMCost(llm.provider, totalInputTokens, totalOutputTokens);
        void trackUsage({
          operation: 'analyze',
          api: analyzeApi,
          project_id: params.id,
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          estimated_cost_usd: analyzeCost,
        });

        emit({ done: true, result: analysis });
      } catch (err: unknown) {
        emit({ error: err instanceof Error ? err.message : 'Analysis failed' });
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
