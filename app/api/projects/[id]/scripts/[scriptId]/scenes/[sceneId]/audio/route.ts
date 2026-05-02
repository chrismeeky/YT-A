import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  void params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as {
    narration?:            string;
    sceneNumber?:          number;
    elevenLabsApiKey?:     string;
    elevenLabsVoiceId?:    string;
    elevenLabsSpeed?:      number;
    elevenLabsStability?:  number;
    elevenLabsSimilarity?: number;
    elevenLabsStyle?:      number;
  };

  const elevenLabsApiKey = body.elevenLabsApiKey?.trim() ?? '';
  if (!elevenLabsApiKey) {
    return NextResponse.json({ error: 'ElevenLabs API key required. Add it in Settings.' }, { status: 400 });
  }

  if (!body.narration?.trim()) {
    return NextResponse.json({ error: 'Scene has no narration text.' }, { status: 400 });
  }

  const voiceId    = body.elevenLabsVoiceId?.trim() || '21m00Tcm4TlvDq8ikWAM';
  const sceneNum   = body.sceneNumber ?? 0;
  const filename   = `audio_scene_${String(sceneNum).padStart(3, '0')}.mp3`;

  try {
    const audioBuffer = await generateSpeech(
      body.narration,
      elevenLabsApiKey,
      voiceId,
      {
        speed:      body.elevenLabsSpeed,
        stability:  body.elevenLabsStability,
        similarity: body.elevenLabsSimilarity,
        style:      body.elevenLabsStyle,
      },
    );

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Filename': filename,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Audio generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
