export async function generateSpeechCartesia(
  text: string,
  apiKey: string,
  voiceId: string,
  speed?: number,
  model?: string
): Promise<Buffer> {
  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Cartesia-Version': '2026-03-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: model ?? 'sonic-3.5-2026-05-04',
      transcript: text,
      voice: { mode: 'id', id: voiceId },
      output_format: { container: 'wav', encoding: 'pcm_s16le', sample_rate: 44100 },
      generation_config: {
        speed: speed ?? 1.0,
        volume: 1,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cartesia error ${response.status}: ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
