import { NextRequest, NextResponse } from 'next/server';
import { resolveKeyWithFallback } from '@/lib/beta';
import { trackUsage, keyFingerprint } from '@/lib/usage';
import type { ResearchChannel, ResearchVideo } from '@/lib/types';

const YT = 'https://www.googleapis.com/youtube/v3';

export async function POST(request: NextRequest) {
  const { channelId, uploadsPlaylistId, youtubeApiKey, videoLimit } = (await request.json()) as {
    channelId: string;
    uploadsPlaylistId?: string;
    youtubeApiKey: string;
    videoLimit?: number;
  };
  const clampedLimit = Math.max(5, videoLimit ?? 15);

  if (!channelId?.trim()) {
    return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
  }
  const resolvedYoutubeKey = resolveKeyWithFallback(youtubeApiKey, 'NEXT_PUBLIC_YOUTUBE_API_KEY');
  if (!resolvedYoutubeKey) {
    return NextResponse.json({ error: 'YouTube API key is required.' }, { status: 400 });
  }

  try {
    // Fetch full channel details — 1 unit
    const chanRes = await fetch(
      `${YT}/channels?part=snippet,statistics,contentDetails,brandingSettings&id=${channelId}&key=${resolvedYoutubeKey}`,
    );
    const chanData = await chanRes.json() as {
      error?: { message: string };
      items?: ChannelItem[];
    };
    if (!chanRes.ok) throw new Error(chanData.error?.message ?? 'Failed to fetch channel');

    const item = chanData.items?.[0];
    if (!item) throw new Error('Channel not found');

    const stats = item.statistics ?? {};
    const subs = parseInt(stats.subscriberCount ?? '0', 10);
    const uploadsId = uploadsPlaylistId ?? (item.contentDetails?.relatedPlaylists?.uploads ?? '');

    // Fetch videos from uploads playlist with pagination (YouTube max 50/page)
    const recentVideos: ResearchVideo[] = [];
    let quotaUnits = 1; // channels.list already counted
    if (uploadsId) {
      let remaining = clampedLimit;
      let pageToken: string | undefined;

      while (remaining > 0) {
        const pageSize = Math.min(remaining, 50);
        const plUrl = new URL(`${YT}/playlistItems`);
        plUrl.searchParams.set('part', 'snippet');
        plUrl.searchParams.set('playlistId', uploadsId);
        plUrl.searchParams.set('maxResults', String(pageSize));
        plUrl.searchParams.set('key', resolvedYoutubeKey);
        if (pageToken) plUrl.searchParams.set('pageToken', pageToken);

        const plRes = await fetch(plUrl.toString());
        const plData = await plRes.json() as {
          error?: { message: string };
          nextPageToken?: string;
          items?: { snippet: { resourceId: { videoId: string }; title: string; publishedAt: string } }[];
        };
        quotaUnits++;

        if (!plRes.ok || !plData.items?.length) break;

        const videoIds = plData.items.map(i => i.snippet.resourceId.videoId).filter(Boolean);

        const vidRes = await fetch(
          `${YT}/videos?part=statistics,contentDetails&id=${videoIds.join(',')}&key=${resolvedYoutubeKey}`,
        );
        const vidData = await vidRes.json() as {
          items?: {
            id: string;
            statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
            contentDetails?: { duration?: string };
          }[];
        };
        quotaUnits++;

        const vidMap = new Map((vidData.items ?? []).map(v => [v.id, v]));

        for (const pl of plData.items) {
          const vid = vidMap.get(pl.snippet.resourceId.videoId);
          recentVideos.push({
            id: pl.snippet.resourceId.videoId,
            title: pl.snippet.title ?? '',
            thumbnail: `https://img.youtube.com/vi/${pl.snippet.resourceId.videoId}/mqdefault.jpg`,
            publishedAt: pl.snippet.publishedAt ?? '',
            viewCount: parseInt(vid?.statistics?.viewCount ?? '0', 10),
            likeCount: parseInt(vid?.statistics?.likeCount ?? '0', 10),
            commentCount: parseInt(vid?.statistics?.commentCount ?? '0', 10),
            duration: parseIsoDuration(vid?.contentDetails?.duration ?? ''),
          });
        }

        remaining -= plData.items.length;
        pageToken = plData.nextPageToken;
        if (!pageToken) break;
      }
    }

    // Always compute avg from first 15 videos for a consistent benchmark
    const baseSample = recentVideos.slice(0, 15);
    const avgRecentViews = baseSample.length > 0
      ? Math.round(baseSample.reduce((s, v) => s + v.viewCount, 0) / baseSample.length)
      : 0;
    const outlierScore = subs > 0 ? avgRecentViews / subs : 0;

    const channel: ResearchChannel = {
      id: item.id,
      title: item.snippet?.title ?? '',
      description: item.snippet?.description ?? '',
      thumbnail: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? '',
      customUrl: item.snippet?.customUrl ?? '',
      country: item.snippet?.country ?? '',
      publishedAt: item.snippet?.publishedAt ?? '',
      subscriberCount: subs,
      viewCount: parseInt(stats.viewCount ?? '0', 10),
      videoCount: parseInt(stats.videoCount ?? '0', 10),
      uploadsPlaylistId: uploadsId,
      outlierScore,
      avgRecentViews,
      recentVideos,
    };

    void trackUsage({ operation: 'research-channel', api: 'youtube', quota_units: quotaUnits, key_fingerprint: keyFingerprint(resolvedYoutubeKey) });
    return NextResponse.json({ channel });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch channel details';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseIsoDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 'N/A';
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
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
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}
