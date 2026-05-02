import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getSceneAudioPath, getFileBuffer, getScript, saveScript } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string; filename: string } }
) {
  const dir = getSceneAudioPath(params.id, params.scriptId, params.sceneId);
  const filePath = path.join(dir, params.filename);
  const buffer = getFileBuffer(filePath);
  if (!buffer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string; filename: string } }
) {
  const dir = getSceneAudioPath(params.id, params.scriptId, params.sceneId);
  const filePath = path.join(dir, params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const script = getScript(params.id, params.scriptId);
  if (script) {
    const updatedScenes = script.scenes.map(s =>
      s.id === params.sceneId && s.audioFile === params.filename
        ? { ...s, audioFile: undefined }
        : s
    );
    saveScript(params.id, { ...script, scenes: updatedScenes, updatedAt: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true });
}
