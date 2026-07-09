import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getUserIdFromRequest } from '@/lib/supabase';
import { encryptSettings, decryptSettings } from '@/lib/settings-crypto';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/types';

export const runtime = 'nodejs';

// GET /api/settings — returns the caller's settings with API keys decrypted.
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabase();
  if (!db) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });

  const { data, error } = await db.from('settings').select('data').eq('user_id', userId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ settings: null }); // no saved settings yet

  const stored = { ...DEFAULT_SETTINGS, ...(data.data as AppSettings) };
  return NextResponse.json({ settings: decryptSettings(stored) });
}

// PUT /api/settings — encrypts API keys and upserts the caller's settings.
export async function PUT(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getSupabase();
  if (!db) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });

  const body = (await request.json()) as { settings?: AppSettings };
  if (!body?.settings) return NextResponse.json({ error: 'settings required' }, { status: 400 });

  const encrypted = encryptSettings(body.settings);
  const { error } = await db.from('settings').upsert({
    user_id: userId, data: encrypted, updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
