export async function generateSpeechCartesia(
  text: string,
  apiKey: string,
  voiceId: string,
  speed?: number
): Promise<Buffer> {
  const voice: Record<string, unknown> = { mode: 'id', id: voiceId };

  if (speed !== undefined && speed !== 1.0) {
    // Cartesia speed: -1 (slowest) to 1 (fastest); map from ElevenLabs-style 0.7–1.2 range
    const normalized = Math.max(-1, Math.min(1, (speed - 1.0) * 2));
    voice['__experimental_controls'] = { speed: normalized };
  }

  const response = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Cartesia-Version': '2024-06-10',
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      model_id: 'sonic-3.5',
      transcript: text,
      voice,
      language: 'en',
      output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cartesia error ${response.status}: ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
