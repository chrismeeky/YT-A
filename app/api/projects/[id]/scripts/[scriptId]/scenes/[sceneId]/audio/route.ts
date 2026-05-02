import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getSettings, getScript, saveScript, saveAudioFile, getSceneAudioPath } from '@/lib/storage';
import { generateSpeech } from '@/lib/elevenlabs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  const script = getScript(params.id, params.scriptId);
  const scene  = script?.scenes.find(s => s.id === params.sceneId);
  const audioFile = scene?.audioFile ?? null;
  if (!audioFile) return NextResponse.json({ audioFile: null, absolutePath: null });
  const absolutePath = path.join(getSceneAudioPath(params.id, params.scriptId, params.sceneId), audioFile);
  return NextResponse.json({ audioFile, absolutePath });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  // Body is optional — all fields fall back to server settings.json for local dev
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as {
    elevenLabsApiKey?:    string;
    elevenLabsVoiceId?:   string;
    elevenLabsSpeed?:     number;
    elevenLabsStability?: number;
    elevenLabsSimilarity?: number;
    elevenLabsStyle?:     number;
  };

  const settings = getSettings();

  const elevenLabsApiKey   = (body.elevenLabsApiKey   as string  | undefined)?.trim() || settings.elevenLabsApiKey;
  const elevenLabsVoiceId  = (body.elevenLabsVoiceId  as string  | undefined)?.trim() || settings.elevenLabsVoiceId;
  const elevenLabsSpeed    = (body.elevenLabsSpeed    as number  | undefined) ?? settings.elevenLabsSpeed;
  const elevenLabsStability   = (body.elevenLabsStability   as number | undefined) ?? settings.elevenLabsStability;
  const elevenLabsSimilarity  = (body.elevenLabsSimilarity  as number | undefined) ?? settings.elevenLabsSimilarity;
  const elevenLabsStyle       = (body.elevenLabsStyle       as number | undefined) ?? settings.elevenLabsStyle;

  if (!elevenLabsApiKey) {
    return NextResponse.json({ error: 'ElevenLabs API key not configured. Add it in Settings.' }, { status: 400 });
  }

  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  const scene = script.scenes.find(s => s.id === params.sceneId);
  if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });

  if (!scene.narration?.trim()) {
    return NextResponse.json({ error: 'Scene has no narration text' }, { status: 400 });
  }

  try {
    const audioBuffer = await generateSpeech(
      scene.narration,
      elevenLabsApiKey,
      elevenLabsVoiceId,
      {
        speed:      elevenLabsSpeed,
        stability:  elevenLabsStability,
        similarity: elevenLabsSimilarity,
        style:      elevenLabsStyle,
      },
    );

    const filename = `audio_scene_${String(scene.number).padStart(3, '0')}.mp3`;
    saveAudioFile(params.id, params.scriptId, params.sceneId, filename, audioBuffer);

    const updatedScenes = script.scenes.map(s =>
      s.id === params.sceneId ? { ...s, audioFile: filename } : s,
    );
    saveScript(params.id, { ...script, scenes: updatedScenes, updatedAt: new Date().toISOString() });

    return NextResponse.json({ ok: true, filename });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Audio generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
