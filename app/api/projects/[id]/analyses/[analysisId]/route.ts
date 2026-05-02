import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, deleteAnalysis } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; analysisId: string } }
) {
  const analysis = getAnalysis(params.id, params.analysisId);
  if (!analysis) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(analysis);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; analysisId: string } }
) {
  deleteAnalysis(params.id, params.analysisId);
  return NextResponse.json({ ok: true });
}
