import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getSettings, saveAnalysis } from '@/lib/storage';
import { getVideoTranscript, getThumbnailBase64 } from '@/lib/youtube';
import { analyzeVideo, synthesizeChannelInsights } from '@/lib/claude';
import type { ChannelVideo, Analysis } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as {
    videos: ChannelVideo[];
    channelUrl: string;
    analysisName: string;
    // Client-provided key; falls back to server settings.json for local dev
    anthropicApiKey?: string;
  };

  const { videos, channelUrl, analysisName } = body;

  if (!videos?.length || videos.length > 3) {
    return NextResponse.json({ error: 'Select between 1 and 3 videos' }, { status: 400 });
  }

  const anthropicApiKey = body.anthropicApiKey?.trim() || getSettings().anthropicApiKey;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured. Add it in Settings.' }, { status: 400 });
  }

  const videoAnalyses = [];

  for (const video of videos) {
    const [transcript, thumbnail] = await Promise.all([
      getVideoTranscript(video.id),
      getThumbnailBase64(video.id),
    ]);

    const analysis = await analyzeVideo(anthropicApiKey, video, transcript, thumbnail.data);
    videoAnalyses.push(analysis);
  }

  const channelInsights = await synthesizeChannelInsights(anthropicApiKey, videoAnalyses);

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

  saveAnalysis(params.id, analysis);
  return NextResponse.json(analysis, { status: 201 });
}
