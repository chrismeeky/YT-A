import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { listProjects, saveProject } from '@/lib/storage';
import type { Project } from '@/lib/types';

export async function GET() {
  return NextResponse.json(listProjects());
}

export async function POST(request: NextRequest) {
  const { name } = (await request.json()) as { name: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
  }

  const project: Project = {
    id: uuid(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveProject(project);
  return NextResponse.json(project, { status: 201 });
}
