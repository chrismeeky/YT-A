import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getVideoTranscript, getThumbnailBase64 } from '@/lib/youtube';
import { analyzeVideo, synthesizeChannelInsights } from '@/lib/claude';
import { sseEmit } from '@/lib/sse';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
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
    userId?: string;
  };

  const { videos, channelUrl, analysisName } = body;

  if (!videos?.length || videos.length > 3) {
    return NextResponse.json({ error: 'Select between 1 and 3 videos' }, { status: 400 });
  }

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required. Add it in Settings.' }, { status: 400 });
  }

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

          emit({ message: `Analysing video ${i + 1} of ${videos.length} with Claude…` });
          const { result: analysis, inputTokens, outputTokens } = await analyzeVideo(anthropicApiKey, video, transcript, thumbnail.data);
          videoAnalyses.push(analysis);
          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;
        }

        emit({ message: 'Synthesising channel insights…' });
        const { result: channelInsights, inputTokens: ci, outputTokens: co } = await synthesizeChannelInsights(anthropicApiKey, videoAnalyses);
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

        void trackUsage({
          operation: 'analyze',
          api: 'anthropic',
          project_id: params.id,
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
          estimated_cost_usd: calcAnthropicCost(totalInputTokens, totalOutputTokens),
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
