import { NextRequest, NextResponse } from 'next/server';
import { searchDuckDuckGoImages } from '@/lib/image-search';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const q     = request.nextUrl.searchParams.get('q') ?? '';
  const count = Number(request.nextUrl.searchParams.get('count') ?? '6');
  // proxy param comes from the client (stored in user settings)
  const proxy = request.nextUrl.searchParams.get('proxy') ?? process.env.NEXT_PUBLIC_DDG_PROXY_URL ?? '';

  if (!q) return NextResponse.json({ images: [] });

  try {
    if (proxy) {
      // Forward to the Cloudflare Worker — DDG scraping runs from Cloudflare IPs, not Vercel's
      const url = `${proxy.replace(/\/$/, '')}?q=${encodeURIComponent(q)}&count=${count}`;
      const r = await fetch(url);
      const d = await r.json() as { images?: unknown[]; error?: string };
      if (!r.ok) throw new Error(d.error ?? 'Proxy search failed');
      return NextResponse.json(d);
    }

    // No proxy — try directly (works on localhost, blocked on Vercel)
    const images = await searchDuckDuckGoImages(q, count);
    return NextResponse.json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DuckDuckGo search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
