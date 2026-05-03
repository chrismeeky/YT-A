import { NextRequest, NextResponse } from 'next/server';

// Proxy YouTube channel thumbnails to avoid CDN hotlinking restrictions.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  // Only proxy YouTube CDN domains
  const allowed = ['yt3.ggpht.com', 'yt3.googleusercontent.com', 'i.ytimg.com', 'img.youtube.com'];
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (!allowed.includes(hostname)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://www.youtube.com/',
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!res.ok) return new NextResponse('Image fetch failed', { status: res.status });

    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Image fetch error', { status: 500 });
  }
}
