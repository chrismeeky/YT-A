import type { StockPhoto, RealImage, StockVideo } from './types';

// Cache vqd tokens per query so "Load more" requests reuse the same DDG session.
// Without this, each page request fetches a fresh vqd and the offset is applied to
// a different session, returning duplicates from page 1.
const vqdCache = new Map<string, { vqd: string; ts: number }>();
const VQD_TTL_MS = 5 * 60 * 1000; // 5 minutes — DDG tokens expire quickly

function getCachedVqd(query: string): string | null {
  const entry = vqdCache.get(query);
  if (entry && Date.now() - entry.ts < VQD_TTL_MS) return entry.vqd;
  vqdCache.delete(query);
  return null;
}

function setCachedVqd(query: string, vqd: string): void {
  vqdCache.set(query, { vqd, ts: Date.now() });
}

export async function searchPexels(
  query: string,
  apiKey: string,
  count = 6,
  page = 1,
): Promise<StockPhoto[]> {
  const res = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&page=${page}&orientation=landscape`,
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
  count = 6,
  proxyUrl?: string,
  offset = 0,
  vqdHint?: string,
  nextToken?: string,
): Promise<{ images: RealImage[]; vqd: string | null; next: string | null }> {
  const proxy = proxyUrl ?? process.env.NEXT_PUBLIC_DDG_PROXY_URL ?? '';
  if (proxy) {
    const url = `${proxy.replace(/\/$/, '')}?q=${encodeURIComponent(query)}&count=${count}&offset=${offset}`;
    console.log('[DDG proxy] GET', url);
    const r = await fetch(url);
    const text = await r.text();
    console.log('[DDG proxy] status:', r.status, 'body:', text.slice(0, 200));
    let d: { images?: RealImage[]; error?: string };
    try { d = JSON.parse(text); } catch { throw new Error(text.slice(0, 200)); }
    if (!r.ok || d.error) throw new Error(d.error ?? text.slice(0, 200));
    return { images: d.images ?? [], vqd: null, next: null };
  }

  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const browserHeaders = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Use caller-supplied vqd (from a previous page response) or fall back to cache, then fetch fresh.
  let vqd = vqdHint ?? getCachedVqd(query);
  if (!vqd) {
    const vqdRes = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
      { headers: browserHeaders }
    );
    const html = await vqdRes.text();
    const vqdMatch =
      html.match(/vqd=["']?([^&"'\s]+)["']?/) ??
      html.match(/data-vqd=["']([^"']+)["']/) ??
      html.match(/"vqd"\s*:\s*"([^"]+)"/);
    if (!vqdMatch) throw new Error('DuckDuckGo: could not extract vqd token');
    vqd = vqdMatch[1];
    setCachedVqd(query, vqd);
  }

  // Use the DDG-supplied next token for pagination, otherwise build the initial URL
  const url = nextToken
    ? `https://duckduckgo.com/i.js?${nextToken}`
    : `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&o=json&p=1&s=${offset}&u=bing&f=,,,&l=en-us`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': 'https://duckduckgo.com/',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  if (!res.ok) throw new Error(`DuckDuckGo Images error ${res.status}: ${res.statusText}`);
  const data = await res.json() as { results?: unknown[]; next?: string };
  console.log('[DDG] offset:', offset, 'nextToken:', nextToken ?? 'none', 'response.next:', data.next ?? 'none', 'results:', (data.results ?? []).length);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const images = (data.results ?? []).slice(0, count).map((r: any) => ({
    title: r.title || query,
    thumb: r.thumbnail || r.image || '',
    full: r.image || r.thumbnail || '',
    sourceUrl: r.url || '',
  }));
  return { images, vqd, next: data.next ?? null };
}

export async function searchBraveImages(
  query: string,
  apiKey: string,
  count = 6,
  offset = 0,
): Promise<RealImage[]> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/images/search?q=${encodeURIComponent(query)}&count=${count}&offset=${offset}`,
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
  count = 4,
  page = 1,
): Promise<StockVideo[]> {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${count}&page=${page}&orientation=landscape`,
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

