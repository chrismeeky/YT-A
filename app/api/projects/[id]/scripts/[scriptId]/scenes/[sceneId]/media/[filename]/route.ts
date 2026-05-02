import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import {
  getScript,
  saveScript,
  deleteMediaFile,
  getFileBuffer,
  getAbsoluteMediaPath,
} from '@/lib/storage';

// Serve a media file
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string; filename: string } }
) {
  const filePath = getAbsoluteMediaPath(params.id, params.scriptId, params.sceneId, params.filename);
  const buffer = getFileBuffer(filePath);
  if (!buffer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ext = path.extname(params.filename).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
  };

  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': contentTypeMap[ext] ?? 'application/octet-stream' },
  });
}

// Delete a media file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string; filename: string } }
) {
  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  deleteMediaFile(params.id, params.scriptId, params.sceneId, params.filename);

  const updatedScenes = script.scenes.map(s =>
    s.id === params.sceneId
      ? { ...s, mediaFiles: s.mediaFiles.filter(f => f.filename !== params.filename) }
      : s
  );
  const updated = { ...script, scenes: updatedScenes, updatedAt: new Date().toISOString() };
  saveScript(params.id, updated);

  return NextResponse.json({ ok: true });
}
