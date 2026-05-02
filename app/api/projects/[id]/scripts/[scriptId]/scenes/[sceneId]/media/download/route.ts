import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { getScript, saveScript, saveMediaFile } from '@/lib/storage';
import type { MediaFile } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  const scene = script.scenes.find(s => s.id === params.sceneId);
  if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });

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

    const filename = `${uuid()}${ext}`;
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    saveMediaFile(params.id, params.scriptId, params.sceneId, filename, buffer);

    const isVideo = ['.mp4', '.mov', '.webm'].includes(ext);
    const mediaFile: MediaFile = {
      id: filename,
      type: isVideo ? 'video' : 'image',
      filename,
      originalName: originalName || filename,
      uploadedAt: new Date().toISOString(),
    };

    const updatedScenes = script.scenes.map(s =>
      s.id === params.sceneId
        ? { ...s, mediaFiles: [...(s.mediaFiles ?? []), mediaFile] }
        : s
    );
    saveScript(params.id, { ...script, scenes: updatedScenes, updatedAt: new Date().toISOString() });

    return NextResponse.json({ ok: true, filename });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
