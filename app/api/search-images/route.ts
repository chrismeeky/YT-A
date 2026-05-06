import { NextRequest, NextResponse } from 'next/server';
import { searchBraveImages } from '@/lib/image-search';
import { resolveKeyWithFallback } from '@/lib/beta';

export async function POST(request: NextRequest) {
  const { query, braveApiKey, count = 6 } = (await request.json()) as {
    query: string;
    braveApiKey?: string;
    count?: number;
  };

  if (!query?.trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const key = resolveKeyWithFallback(braveApiKey, 'NEXT_PUBLIC_BRAVE_API_KEY');
  if (!key) {
    return NextResponse.json({ error: 'Brave API key required. Add it in Settings.' }, { status: 400 });
  }

  try {
    const images = await searchBraveImages(query, key, count);
    return NextResponse.json({ images });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 });
  }
}
