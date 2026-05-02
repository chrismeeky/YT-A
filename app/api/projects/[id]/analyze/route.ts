import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getVideoTranscript, getThumbnailBase64 } from '@/lib/youtube';
import { analyzeVideo, synthesizeChannelInsights } from '@/lib/claude';
import { sseEmit } from '@/lib/sse';
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
  };

  const { videos, channelUrl, analysisName } = body;

  if (!videos?.length || videos.length > 3) {
    return NextResponse.json({ error: 'Select between 1 and 3 videos' }, { status: 400 });
  }

  const anthropicApiKey = body.anthropicApiKey?.trim() ?? '';
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required. Add it in Settings.' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (payload: object) => sseEmit(controller, encoder, payload);
      try {
        const videoAnalyses = [];

        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          const label = `"${video.title.length > 50 ? video.title.slice(0, 50) + '…' : video.title}"`;

          emit({ message: `Fetching transcript for ${label}…` });
          const [transcript, thumbnail] = await Promise.all([
            getVideoTranscript(video.id),
            getThumbnailBase64(video.id),
          ]);

          emit({ message: `Analysing video ${i + 1} of ${videos.length} with Claude…` });
          const analysis = await analyzeVideo(anthropicApiKey, video, transcript, thumbnail.data);
          videoAnalyses.push(analysis);
        }

        emit({ message: 'Synthesising channel insights…' });
        const channelInsights = await synthesizeChannelInsights(anthropicApiKey, videoAnalyses);

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
