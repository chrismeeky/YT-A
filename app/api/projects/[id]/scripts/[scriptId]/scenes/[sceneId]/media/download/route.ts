import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  void params;
  const { url, originalName } = (await request.json()) as { url: string; originalName?: string };
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

  try {
    const imgRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!imgRes.ok) {
      return NextResponse.json({ error: `Failed to fetch image (${imgRes.status})` }, { status: 502 });
    }

    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
    const extFromType: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
    };
    const extFromUrl = path.extname(url.split('?')[0]).toLowerCase();
    const mimeType = contentType.split(';')[0].trim();
    const ext =
      extFromUrl && ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm'].includes(extFromUrl)
        ? extFromUrl
        : extFromType[mimeType] ?? '.jpg';

    const filename = originalName
      ? originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) + ext
      : `download${ext}`;

    const buffer = await imgRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'X-Filename': filename,
        'X-Ext': ext,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
