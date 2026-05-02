import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getAbsoluteMediaPath, getSceneAudioPath } from '@/lib/storage';

const execAsync = promisify(exec);

// Opens the enclosing folder in Finder and selects the file (macOS)
export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    projectId?: string;
    scriptId?: string;
    sceneId?: string;
    filename?: string;
    type?: string;
    filePath?: string;
  };

  let resolved: string;

  if (body.projectId && body.scriptId && body.sceneId && body.filename) {
    if (body.type === 'audio') {
      resolved = path.join(getSceneAudioPath(body.projectId, body.scriptId, body.sceneId), body.filename);
    } else {
      resolved = getAbsoluteMediaPath(body.projectId, body.scriptId, body.sceneId, body.filename);
    }
  } else if (body.filePath) {
    resolved = path.resolve(body.filePath);
    const home = process.env.HOME ?? '/Users';
    if (!resolved.startsWith(home) && !resolved.startsWith('/tmp')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'filePath or media identifiers required' }, { status: 400 });
  }

  try {
    if (fs.existsSync(resolved)) {
      await execAsync(`open -R "${resolved}"`);
    } else {
      await execAsync(`open "${path.dirname(resolved)}"`);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to open Finder' }, { status: 500 });
  }
}
