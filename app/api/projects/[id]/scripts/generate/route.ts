import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { getSettings, getAnalysis, saveScript } from '@/lib/storage';
import { generateScript } from '@/lib/claude';
import type { Script, Scene, ScriptSettings } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as {
    analysisId: string;
    topic: string;
    targetAudience?: string;
    additionalInstructions?: string;
    videoLength?: number;
    wpm?: number;
  };

  const settings = getSettings();
  if (!settings.anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured. Go to Settings.' }, { status: 400 });
  }

  const analysis = getAnalysis(params.id, body.analysisId);
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const videoLength = body.videoLength ?? settings.defaultVideoLength;
  const wpm = body.wpm ?? settings.defaultWpm;
  const targetWordCount = Math.round(videoLength * wpm);

  const scriptSettings: ScriptSettings = { videoLength, wpm, targetWordCount };

  const generated = await generateScript(
    settings.anthropicApiKey,
    analysis,
    scriptSettings,
    body.topic,
    body.targetAudience ?? '',
    body.additionalInstructions ?? ''
  );

  const scenes: Scene[] = generated.scenes.map(s => ({
    id: uuid(),
    number: s.number,
    title: s.title,
    narration: s.narration,
    sceneDescription: s.sceneDescription,
    estimatedDurationSeconds: s.estimatedDurationSeconds,
    wordCount: s.wordCount,
    includeImagePrompt: true,
    includeVideoPrompt: true,
    includeStockUrl: false,
    includeStockPhotos: false,
    includeRealImages: false,
    includeStockVideos: false,
    mediaFiles: [] as import('@/lib/types').MediaFile[],
  }));

  const script: Script = {
    id: uuid(),
    projectId: params.id,
    analysisId: body.analysisId,
    title: generated.title,
    topic: body.topic,
    targetAudience: body.targetAudience ?? '',
    additionalInstructions: body.additionalInstructions ?? '',
    thumbnailConcept: generated.thumbnailConcept,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: scriptSettings,
    scenes,
    savedToDisk: false,
  };

  saveScript(params.id, script);
  return NextResponse.json(script, { status: 201 });
}
