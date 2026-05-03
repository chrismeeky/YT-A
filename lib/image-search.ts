import type { StockPhoto, RealImage, StockVideo } from './types';

export async function searchPexels(
  query: string,
  apiKey: string,
  count = 6
): Promise<StockPhoto[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: apiKey } }
  );
  if (!res.ok) throw new Error(`Pexels photos API error ${res.status}: ${res.statusText}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.photos ?? []).map((p: any) => ({
    id: String(p.id),
    thumb: p.src.medium,
    full: p.src.large2x,
    pageUrl: p.url,
    photographer: p.photographer,
    alt: p.alt || query,
  }));
}

export async function searchDuckDuckGo(
  query: string,
  count = 6
): Promise<RealImage[]> {
  const pageRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    }
  );
  if (!pageRes.ok) throw new Error(`DuckDuckGo page error ${pageRes.status}`);
  const html = await pageRes.text();
  const vqdMatch = html.match(/vqd=([^&"'\s]+)/);
  if (!vqdMatch) throw new Error('DuckDuckGo: could not extract vqd token — the scraping method may be blocked');

  const imgRes = await fetch(
    `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&vqd=${vqdMatch[1]}&f=,,,,,,&l=us-en`,
    {
      headers: {
        Referer: 'https://duckduckgo.com/',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }
  );
  if (!imgRes.ok) throw new Error(`DuckDuckGo images error ${imgRes.status}`);
  const data = await imgRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).slice(0, count).map((r: any) => ({
    title: r.title || query,
    thumb: r.thumbnail,
    full: r.image,
    sourceUrl: r.url,
  }));
}

export async function searchPexelsVideos(
  query: string,
  apiKey: string,
  count = 4
): Promise<StockVideo[]> {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
    { headers: { Authorization: apiKey } }
  );
  if (!res.ok) throw new Error(`Pexels videos API error ${res.status}: ${res.statusText}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.videos ?? []).map((v: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files: any[] = v.video_files ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sd = files.find((f: any) => f.quality === 'sd') ?? files[files.length - 1];
    return {
      id: String(v.id),
      thumb: v.image,
      previewUrl: sd?.link ?? '',
      sdUrl: sd?.link ?? '',
      pageUrl: v.url,
      duration: v.duration ?? 0,
      user: v.user?.name ?? '',
    };
  });
}

