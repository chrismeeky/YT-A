import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/elevenlabs';
import { generateSpeechCartesia } from '@/lib/cartesia';
import { resolveKey, resolveKeyWithFallback } from '@/lib/beta';
import { trackUsage } from '@/lib/usage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  void params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as {
    provider?:             'elevenlabs' | 'cartesia';
    narration?:            string;
    sceneNumber?:          number;
    elevenLabsApiKey?:     string;
    elevenLabsVoiceId?:    string;
    elevenLabsSpeed?:      number;
    elevenLabsStability?:  number;
    elevenLabsSimilarity?: number;
    elevenLabsStyle?:      number;
    cartesiaApiKey?:       string;
    cartesiaVoiceId?:      string;
    cartesiaSpeed?:        number;
    cartesiaModel?:        string;
  };

  if (!body.narration?.trim()) {
    return NextResponse.json({ error: 'Scene has no narration text.' }, { status: 400 });
  }

  const provider   = body.provider ?? 'elevenlabs';
  const sceneNum   = body.sceneNumber ?? 0;
  const filename   = `audio_scene_${String(sceneNum).padStart(3, '0')}.mp3`;
  const characters = body.narration.trim().length;

  try {
    let audioBuffer: Buffer;

    if (provider === 'cartesia') {
      const cartesiaApiKey = resolveKey(body.cartesiaApiKey, 'NEXT_PUBLIC_CARTESIA_API_KEY');
      if (!cartesiaApiKey) {
        return NextResponse.json({ error: 'Cartesia API key required. Add it in Settings.' }, { status: 400 });
      }
      const voiceId = resolveKeyWithFallback(body.cartesiaVoiceId, 'NEXT_PUBLIC_CARTESIA_VOICE_ID');
      if (!voiceId) {
        return NextResponse.json({ error: 'Cartesia Voice ID required. Add it in Settings.' }, { status: 400 });
      }
      audioBuffer = await generateSpeechCartesia(body.narration, cartesiaApiKey, voiceId, body.cartesiaSpeed, body.cartesiaModel);
      void trackUsage({ operation: 'audio', api: 'cartesia', project_id: params.id, characters });
    } else {
      const elevenLabsApiKey = resolveKey(body.elevenLabsApiKey, 'NEXT_PUBLIC_ELEVENLABS_API_KEY');
      if (!elevenLabsApiKey) {
        return NextResponse.json({ error: 'ElevenLabs API key required. Add it in Settings.' }, { status: 400 });
      }
      const voiceId = resolveKeyWithFallback(body.elevenLabsVoiceId, 'NEXT_PUBLIC_ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM';
      audioBuffer = await generateSpeech(body.narration, elevenLabsApiKey, voiceId, {
        speed:      body.elevenLabsSpeed,
        stability:  body.elevenLabsStability,
        similarity: body.elevenLabsSimilarity,
        style:      body.elevenLabsStyle,
      });
      void trackUsage({ operation: 'audio', api: 'elevenlabs', project_id: params.id, characters });
    }

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
