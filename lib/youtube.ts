import type { ChannelVideo } from './types';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

const execFileAsync = promisify(execFile);

const YT = 'https://www.googleapis.com/youtube/v3';

// ─── Public API ────────────────────────────────────────────────────────────

export interface ChannelVideosPage {
  videos: ChannelVideo[];
  nextPageToken?: string;
  uploadsPlaylistId: string;
}

export async function getChannelVideos(
  channelUrl: string,
  pageSize = 20,
  apiKey?: string,
  pageToken?: string,
  uploadsPlaylistId?: string,
): Promise<ChannelVideosPage> {
  if (!apiKey) throw new Error('YouTube API key is required. Add it in Settings.');

  let uploadsId = uploadsPlaylistId;
  if (!uploadsId) {
    const channelId = await resolveChannelId(channelUrl.trim(), apiKey);
    uploadsId = await getUploadsPlaylistId(channelId, apiKey);
  }

  const { items, nextPageToken } = await fetchPlaylistPage(uploadsId, Math.min(pageSize, 50), apiKey, pageToken);
  const details = await fetchVideoDetails(items.map(i => i.videoId), apiKey);

  const videos = items.map(item => {
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

  return { videos, nextPageToken, uploadsPlaylistId: uploadsId };
}

// Transcript fetch via yt-dlp (falls back to empty string on failure).
export async function getVideoTranscript(videoId: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const outTemplate = path.join(tmpDir, `yt_transcript_${videoId}`);
  const vttPath = `${outTemplate}.en.vtt`;

  try {
    await execFileAsync('yt-dlp', [
      '--write-auto-sub',
      '--skip-download',
      '--sub-format', 'vtt',
      '--output', outTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ], { timeout: 60000 });

    const raw = await fs.readFile(vttPath, 'utf-8');
    await fs.unlink(vttPath).catch(() => {});
    return parseVtt(raw);
  } catch {
    return '';
  }
}

function parseVtt(content: string): string {
  const lines = content
    .replace(/WEBVTT[\s\S]*?\n\n/, '')
    .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> [^\n]+\n/g, '')
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
    .replace(/<[^>]+>/g, '')
    .split('\n');

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      unique.push(trimmed);
    }
  }
  return unique.join(' ').replace(/\s+/g, ' ').trim();
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

async function fetchPlaylistPage(
  playlistId: string,
  pageSize: number,
  apiKey: string,
  pageToken?: string,
): Promise<{ items: PlaylistItem[]; nextPageToken?: string }> {
  let url = `${YT}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${pageSize}&key=${apiKey}`;
  if (pageToken) url += `&pageToken=${pageToken}`;

  const res  = await fetch(url);
  const data = await res.json() as {
    error?: { message: string };
    nextPageToken?: string;
    items?: { snippet: { resourceId: { videoId: string }; title: string; description: string; channelTitle: string; publishedAt: string } }[];
  };
  if (!res.ok) throw new Error(data.error?.message ?? 'Failed to get playlist items');

  const items: PlaylistItem[] = [];
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

  return { items, nextPageToken: data.nextPageToken };
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
