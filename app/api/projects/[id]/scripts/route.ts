import { NextRequest, NextResponse } from 'next/server';
import { listScripts } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  return NextResponse.json(listScripts(params.id));
}
