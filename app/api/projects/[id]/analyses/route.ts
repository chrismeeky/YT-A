import { NextRequest, NextResponse } from 'next/server';
import { listAnalyses } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(listAnalyses(params.id));
}
