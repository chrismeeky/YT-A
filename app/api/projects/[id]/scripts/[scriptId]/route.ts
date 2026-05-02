import { NextRequest, NextResponse } from 'next/server';
import { getScript, saveScript, deleteScript } from '@/lib/storage';
import type { Script } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string } }
) {
  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(script);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string } }
) {
  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as Partial<Script>;
  const updated: Script = { ...script, ...body, updatedAt: new Date().toISOString() };
  saveScript(params.id, updated);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string } }
) {
  deleteScript(params.id, params.scriptId);
  return NextResponse.json({ ok: true });
}
