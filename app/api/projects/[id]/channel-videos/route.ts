import { NextRequest, NextResponse } from 'next/server';
import { getChannelVideos } from '@/lib/youtube';
import { resolveKeyWithFallback } from '@/lib/beta';
import { trackUsage, keyFingerprint } from '@/lib/usage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  void params;
  const { channelUrl, youtubeApiKey, pageToken, uploadsPlaylistId } = (await request.json()) as {
    channelUrl: string;
    youtubeApiKey?: string;
    pageToken?: string;
    uploadsPlaylistId?: string;
  };

  if (!channelUrl?.trim()) {
    return NextResponse.json({ error: 'channelUrl is required' }, { status: 400 });
  }

  const apiKey = resolveKeyWithFallback(youtubeApiKey, 'NEXT_PUBLIC_YOUTUBE_API_KEY');
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API key is required. Add it in Settings.' },
      { status: 400 },
    );
  }

  try {
    const result = await getChannelVideos(channelUrl.trim(), 20, apiKey, pageToken, uploadsPlaylistId);
    // channels.list (1) + playlistItems.list (1) + optional channel resolve (1) ≈ 3 units
    void trackUsage({ operation: 'channel-videos', api: 'youtube', project_id: params.id, quota_units: 3, key_fingerprint: keyFingerprint(apiKey) });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch channel videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
