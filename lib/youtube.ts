import type { ChannelVideo } from './types';

const YT = 'https://www.googleapis.com/youtube/v3';

// ─── Public API ────────────────────────────────────────────────────────────

export async function getChannelVideos(
  channelUrl: string,
  maxVideos = 20,
  apiKey?: string,
): Promise<ChannelVideo[]> {
  if (!apiKey) throw new Error('YouTube API key is required. Add it in Settings.');

  const channelId = await resolveChannelId(channelUrl.trim(), apiKey);
  const uploadsId = await getUploadsPlaylistId(channelId, apiKey);
  const items     = await fetchPlaylistItems(uploadsId, maxVideos, apiKey);
  const details   = await fetchVideoDetails(items.map(i => i.videoId), apiKey);

  return items.map(item => {
    const d = details.find(x => x.id === item.videoId);
    return {
      id:          item.videoId,
      title:       item.title,
      url:         `https://www.youtube.com/watch?v=${item.videoId}`,
      thumbnail:   `https://img.youtube.com/vi/${item.videoId}/maxresdefault.jpg`,
      duration:    d?.duration  ?? 'N/A',
      viewCount:   d?.viewCount ?? 0,
      uploadDate:  item.publishedAt.slice(0, 10),
      description: item.description,
      channelName: item.channelTitle,
    } satisfies ChannelVideo;
  });
}

// Transcript and thumbnail fetches are plain HTTP — no API key needed.
export async function getVideoTranscript(videoId: string): Promise<string> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await response.text();

    const match = html.match(/"captionTracks":\[([^\]]*)\]/);
    if (!match) return '';

    const raw = match[1].replace(/\\"/g, '"').replace(/\\u0026/g, '&');
    const baseUrlMatch = raw.match(/"baseUrl":"([^"]+)"/);
    if (!baseUrlMatch) return '';

    const captionResponse = await fetch(`${baseUrlMatch[1]}&fmt=json3`);
    if (!captionResponse.ok) return '';

    const captionData = (await captionResponse.json()) as {
      events?: { segs?: { utf8?: string }[] }[];
    };

    const text = captionData.events
      ?.filter(e => e.segs)
      .map(e => e.segs!.map(s => s.utf8 ?? '').join(''))
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return text || '';
  } catch {
    return '';
  }
}

export async function getThumbnailBase64(
  videoId: string,
): Promise<{ data: string; mediaType: 'image/jpeg' | 'image/webp' }> {
  const urls = [
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      return { data: Buffer.from(buffer).toString('base64'), mediaType: 'image/jpeg' };
    } catch {
      continue;
    }
  }
  return { data: '', mediaType: 'image/jpeg' };
}

// ─── Channel resolution ────────────────────────────────────────────────────

async function resolveChannelId(url: string, apiKey: string): Promise<string> {
  // /channel/UCxxxxxxx  — ID is in the URL
  const byId = url.match(/\/channel\/(UC[\w-]+)/);
  if (byId) return byId[1];

  // /@handle
  const byHandle = url.match(/\/@([\w.-]+)/);
  if (byHandle) {
    return ytChannelsQuery(`forHandle=@${byHandle[1]}`, apiKey);
  }

  // /user/name  (legacy)
  const byUser = url.match(/\/user\/([\w-]+)/);
  if (byUser) {
    return ytChannelsQuery(`forUsername=${byUser[1]}`, apiKey);
  }

  // /c/name or bare channel name — try forHandle as last resort
  const byCustom = url.match(/\/c\/([\w.-]+)/);
  if (byCustom) {
    return ytChannelsQuery(`forHandle=@${byCustom[1]}`, apiKey);
  }

  throw new Error(
    'Could not parse channel URL. Use https://www.youtube.com/@channelname',
  );
}

async function ytChannelsQuery(queryParam: string, apiKey: string): Promise<string> {
  const res  = await fetch(`${YT}/channels?part=id&${queryParam}&key=${apiKey}`);
  const data = await res.json() as { error?: { message: string }; items?: { id: string }[] };
  if (!res.ok) throw new Error(data.error?.message ?? 'Failed to resolve channel');
  const id = data.items?.[0]?.id;
  if (!id) throw new Error('Channel not found. Check the URL and that your YouTube API key is valid.');
  return id;
}

// ─── Playlist helpers ──────────────────────────────────────────────────────

async function getUploadsPlaylistId(channelId: string, apiKey: string): Promise<string> {
  const res  = await fetch(`${YT}/channels?part=contentDetails&id=${channelId}&key=${apiKey}`);
  const data = await res.json() as {
    error?: { message: string };
    items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
  };
  if (!res.ok) throw new Error(data.error?.message ?? 'Failed to get channel details');
  const id = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!id) throw new Error('Could not find uploads playlist for this channel');
  return id;
}

interface PlaylistItem {
  videoId:      string;
  title:        string;
  description:  string;
  channelTitle: string;
  publishedAt:  string;
}

async function fetchPlaylistItems(
  playlistId: string,
  maxResults: number,
  apiKey: string,
): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;

  while (items.length < maxResults) {
    const batch = Math.min(50, maxResults - items.length);
    let url = `${YT}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${batch}&key=${apiKey}`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const res  = await fetch(url);
    const data = await res.json() as {
      error?: { message: string };
      nextPageToken?: string;
      items?: { snippet: { resourceId: { videoId: string }; title: string; description: string; channelTitle: string; publishedAt: string } }[];
    };
    if (!res.ok) throw new Error(data.error?.message ?? 'Failed to get playlist items');

    for (const item of data.items ?? []) {
      const s = item.snippet;
      if (s?.resourceId?.videoId) {
        items.push({
          videoId:      s.resourceId.videoId,
          title:        s.title        ?? 'Untitled',
          description:  s.description  ?? '',
          channelTitle: s.channelTitle ?? '',
          publishedAt:  s.publishedAt  ?? new Date().toISOString(),
        });
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return items;
}

// ─── Video details (duration + view count) ────────────────────────────────

interface VideoDetail {
  id:        string;
  duration:  string;
  viewCount: number;
}

async function fetchVideoDetails(videoIds: string[], apiKey: string): Promise<VideoDetail[]> {
  const details: VideoDetail[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const ids = videoIds.slice(i, i + 50).join(',');
    const res  = await fetch(`${YT}/videos?part=contentDetails,statistics&id=${ids}&key=${apiKey}`);
    const data = await res.json() as {
      error?: { message: string };
      items?: { id: string; contentDetails: { duration: string }; statistics: { viewCount: string } }[];
    };
    if (!res.ok) throw new Error(data.error?.message ?? 'Failed to get video details');
    for (const item of data.items ?? []) {
      details.push({
        id:        item.id,
        duration:  parseIsoDuration(item.contentDetails?.duration ?? ''),
        viewCount: parseInt(item.statistics?.viewCount ?? '0', 10),
      });
    }
  }
  return details;
}

function parseIsoDuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 'N/A';
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s   = parseInt(m[3] ?? '0', 10);
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${min}:${String(s).padStart(2, '0')}`;
}
