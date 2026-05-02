import { NextRequest, NextResponse } from 'next/server';
import { getChannelVideos } from '@/lib/youtube';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  void params; // projectId not needed here — channel videos are fetched live
  const { channelUrl } = (await request.json()) as { channelUrl: string };

  if (!channelUrl?.trim()) {
    return NextResponse.json({ error: 'channelUrl is required' }, { status: 400 });
  }

  try {
    const videos = await getChannelVideos(channelUrl.trim(), 20);
    return NextResponse.json(videos);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch channel videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
