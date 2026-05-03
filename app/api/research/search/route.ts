import { NextRequest, NextResponse } from 'next/server';
import { resolveKeyWithFallback } from '@/lib/beta';
import { trackUsage, keyFingerprint } from '@/lib/usage';
import type { ResearchChannel } from '@/lib/types';

const YT = 'https://www.googleapis.com/youtube/v3';

export async function POST(request: NextRequest) {
  const { query, youtubeApiKey, pageToken, maxResults = 20, regionCode } = (await request.json()) as {
    query: string;
    youtubeApiKey: string;
    pageToken?: string;
    maxResults?: number;
    regionCode?: string;
  };

  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }
  const resolvedYoutubeKey = resolveKeyWithFallback(youtubeApiKey, 'NEXT_PUBLIC_YOUTUBE_API_KEY');
  if (!resolvedYoutubeKey) {
    return NextResponse.json({ error: 'YouTube API key is required. Add it in Settings.' }, { status: 400 });
  }

  try {
    // Search for channels — 100 units
    let searchUrl = `${YT}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${Math.min(maxResults, 25)}&key=${resolvedYoutubeKey}`;
    if (pageToken) searchUrl += `&pageToken=${pageToken}`;
    if (regionCode) searchUrl += `&regionCode=${encodeURIComponent(regionCode)}`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as {
      error?: { message: string };
      nextPageToken?: string;
      items?: { id: { channelId: string } }[];
    };
    if (!searchRes.ok) throw new Error((searchData.error?.message ?? 'Search failed').replace(/<[^>]*>/g, ''));

    const channelIds = (searchData.items ?? []).map(i => i.id.channelId).filter(Boolean);
    if (channelIds.length === 0) {
      return NextResponse.json({ channels: [], nextPageToken: undefined });
    }

    // Fetch channel details — 1 unit
    const detailRes = await fetch(
      `${YT}/channels?part=snippet,statistics,contentDetails&id=${channelIds.join(',')}&key=${resolvedYoutubeKey}`,
    );
    const detailData = await detailRes.json() as {
      error?: { message: string };
      items?: ChannelItem[];
    };
    if (!detailRes.ok) throw new Error(detailData.error?.message ?? 'Failed to fetch channel details');

    const channels: ResearchChannel[] = (detailData.items ?? []).map(item => {
      const stats = item.statistics ?? {};
      const subs = parseInt(stats.subscriberCount ?? '0', 10);
      const totalViews = parseInt(stats.viewCount ?? '0', 10);
      const videoCount = parseInt(stats.videoCount ?? '0', 10);
      const avgRecentViews = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
      const outlierScore = subs > 0 ? avgRecentViews / subs : 0;

      return {
        id: item.id,
        title: item.snippet?.title ?? '',
        description: item.snippet?.description ?? '',
        thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
        customUrl: item.snippet?.customUrl ?? '',
        country: item.snippet?.country ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
        subscriberCount: subs,
        viewCount: totalViews,
        videoCount,
        uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? '',
        outlierScore,
        avgRecentViews,
        recentVideos: [],
      } satisfies ResearchChannel;
    });

    // search.list (100) + channels.list (1) = 101 quota units
    void trackUsage({ operation: 'research-search', api: 'youtube', quota_units: 101, key_fingerprint: keyFingerprint(resolvedYoutubeKey) });
    return NextResponse.json({ channels, nextPageToken: searchData.nextPageToken });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface ChannelItem {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    customUrl?: string;
    country?: string;
    publishedAt?: string;
    thumbnails?: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}
