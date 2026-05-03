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

  const data = await res.json() as {
    subscription?: {
      tier?: string;
      character_count?: number;
      character_limit?: number;
      next_character_reset_unix?: number;
      status?: string;
      currency?: string;
    };
    first_name?: string;
  };

  const sub = data.subscription ?? {};
  const used      = sub.character_count  ?? 0;
  const limit     = sub.character_limit  ?? 0;
  const remaining = Math.max(0, limit - used);

  return NextResponse.json({
    charactersUsed:      used,
    charactersLimit:     limit,
    charactersRemaining: remaining,
    resetAt:  sub.next_character_reset_unix ? new Date(sub.next_character_reset_unix * 1000).toISOString() : null,
    status:   sub.status ?? 'unknown',
    tier:     sub.tier   ?? 'unknown',
    currency: sub.currency ?? 'usd',
    firstName: data.first_name,
  });
}
