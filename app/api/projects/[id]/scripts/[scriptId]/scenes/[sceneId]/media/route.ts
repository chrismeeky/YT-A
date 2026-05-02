import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import path from 'path';
import {
  getScript,
  saveScript,
  saveMediaFile,
  listMediaFiles,
} from '@/lib/storage';
import type { MediaFile } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  const files = listMediaFiles(params.id, params.scriptId, params.sceneId);
  return NextResponse.json(files);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  const scene = script.scenes.find(s => s.id === params.sceneId);
  if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];

  if (!files.length) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const uploaded: MediaFile[] = [];

  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    const safeFilename = `${uuid()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    saveMediaFile(params.id, params.scriptId, params.sceneId, safeFilename, buffer);

    const type: MediaFile['type'] = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)
      ? 'image'
      : ['.mp4', '.mov', '.webm', '.avi'].includes(ext)
        ? 'video'
        : 'audio';

    uploaded.push({
      id: safeFilename,
      type,
      filename: safeFilename,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    });
  }

  // Merge into scene mediaFiles
  const updatedScenes = script.scenes.map(s =>
    s.id === params.sceneId
      ? { ...s, mediaFiles: [...(s.mediaFiles ?? []), ...uploaded] }
      : s
  );
  const updated = { ...script, scenes: updatedScenes, updatedAt: new Date().toISOString() };
  saveScript(params.id, updated);

  return NextResponse.json(uploaded, { status: 201 });
}
