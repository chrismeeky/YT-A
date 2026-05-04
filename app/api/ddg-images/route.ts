import { NextRequest, NextResponse } from 'next/server';
import { searchDuckDuckGoImages } from '@/lib/image-search';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const q     = request.nextUrl.searchParams.get('q') ?? '';
  const count = Number(request.nextUrl.searchParams.get('count') ?? '6');
  if (!q) return NextResponse.json({ images: [] });
  try {
    const images = await searchDuckDuckGoImages(q, count);
    return NextResponse.json({ images });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'DuckDuckGo search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
