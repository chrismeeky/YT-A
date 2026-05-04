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

export async function searchDuckDuckGoImages(
  query: string,
  count = 6
): Promise<RealImage[]> {
  const vqdRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
  );
  const html = await vqdRes.text();
  const vqdMatch = html.match(/vqd=([^&"]+)/);
  if (!vqdMatch) throw new Error('DuckDuckGo: could not extract vqd token');
  const vqd = vqdMatch[1];
  const res = await fetch(
    `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', Referer: 'https://duckduckgo.com/' } }
  );
  if (!res.ok) throw new Error(`DuckDuckGo Images error ${res.status}: ${res.statusText}`);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).slice(0, count).map((r: any) => ({
    title: r.title || query,
    thumb: r.thumbnail || r.image || '',
    full: r.image || r.thumbnail || '',
    sourceUrl: r.url || '',
  }));
}

export async function searchBraveImages(
  query: string,
  apiKey: string,
  count = 6
): Promise<RealImage[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Brave Images API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).slice(0, count).map((r: any) => ({
    title: r.title || query,
    thumb: r.thumbnail?.src ?? r.properties?.url ?? '',
    full: r.properties?.url ?? r.thumbnail?.src ?? '',
    sourceUrl: r.url ?? '',
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

