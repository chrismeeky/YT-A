import { NextRequest, NextResponse } from 'next/server';
import { getScript, saveScript, saveScriptToDisk } from '@/lib/storage';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; scriptId: string } }
) {
  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const outputDir = saveScriptToDisk(params.id, script);
    const updated = { ...script, savedToDisk: true, updatedAt: new Date().toISOString() };
    saveScript(params.id, updated);
    return NextResponse.json({ ok: true, outputDir });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
