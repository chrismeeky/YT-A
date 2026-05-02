import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/storage';
import type { AppSettings } from '@/lib/types';

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as Partial<AppSettings>;
  const updated: AppSettings = { ...getSettings(), ...body };
  saveSettings(updated);
  return NextResponse.json({ ok: true });
}
