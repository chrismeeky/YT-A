import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ChannelVideo } from './types';

const execFileAsync = promisify(execFile);

async function ytdlp(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', args, { maxBuffer: 50 * 1024 * 1024 });
    return stdout;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      throw new Error('yt-dlp is not installed. Install it with: brew install yt-dlp');
    }
    throw err;
  }
}

export async function getChannelVideos(channelUrl: string, maxVideos = 20): Promise<ChannelVideo[]> {
  const stdout = await ytdlp([
    '--flat-playlist',
    '--dump-json',
    '--playlist-end', String(maxVideos),
    '--no-warnings',
    channelUrl,
  ]);

  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.map(line => {
    const d = JSON.parse(line);
    const videoId = d.id as string;
    const thumbnail =
      `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    return {
      id: videoId,
      title: (d.title as string) || 'Untitled',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail,
      duration: formatDuration(d.duration as number | null),
      viewCount: (d.view_count as number) || 0,
      uploadDate: formatDate(d.upload_date as string | null),
      description: (d.description as string) || '',
      channelName: (d.channel as string) || (d.uploader as string) || '',
    } satisfies ChannelVideo;
  });
}

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
  videoId: string
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
      const base64 = Buffer.from(buffer).toString('base64');
      return { data: base64, mediaType: 'image/jpeg' };
    } catch {
      continue;
    }
  }
  return { data: '', mediaType: 'image/jpeg' };
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'N/A';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(uploadDate: string | null): string {
  if (!uploadDate || uploadDate.length !== 8) return '';
  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`;
}
