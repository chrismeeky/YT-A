import { NextResponse } from 'next/server';
import { resolveKey } from '@/lib/beta';

export async function GET() {
  const apiKey = resolveKey(undefined, 'NEXT_PUBLIC_ELEVENLABS_API_KEY');
  if (!apiKey) return NextResponse.json({ error: 'No ElevenLabs API key configured' }, { status: 400 });

  const res = await fetch('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json() as Record<string, any>;

  // Return the full response to inspect what fields are available
  return NextResponse.json(data);
}
