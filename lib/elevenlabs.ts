interface VoiceSettings {
  speed: number;
  stability: number;
  similarity: number;
  style: number;
}

export async function generateSpeech(
  text: string,
  apiKey: string,
  voiceId: string,
  voiceSettings?: Partial<VoiceSettings>
): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: voiceSettings?.stability ?? 0.5,
        similarity_boost: voiceSettings?.similarity ?? 0.75,
        style: voiceSettings?.style ?? 0.0,
        use_speaker_boost: true,
        speed: voiceSettings?.speed ?? 1.0,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${err}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
