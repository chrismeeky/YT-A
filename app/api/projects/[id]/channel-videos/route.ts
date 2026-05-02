import { NextRequest, NextResponse } from 'next/server';
import { getChannelVideos } from '@/lib/youtube';
import { getSettings } from '@/lib/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  void params;
  const { channelUrl } = (await request.json()) as { channelUrl: string };

  if (!channelUrl?.trim()) {
    return NextResponse.json({ error: 'channelUrl is required' }, { status: 400 });
  }

  const settings = getSettings();
  if (!settings.youtubeApiKey) {
    return NextResponse.json(
      { error: 'YouTube API key is not configured. Add it in Settings.' },
      { status: 400 },
    );
  }

  try {
    const videos = await getChannelVideos(channelUrl.trim(), 20, settings.youtubeApiKey);
    return NextResponse.json(videos);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch channel videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
