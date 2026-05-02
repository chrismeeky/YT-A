import { NextRequest, NextResponse } from 'next/server';
import { getProject, saveProject, deleteProject } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as { name?: string };
  const updated = { ...project, ...body, updatedAt: new Date().toISOString() };
  saveProject(updated);
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  deleteProject(params.id);
  return NextResponse.json({ ok: true });
}
