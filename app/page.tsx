'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import type { Project } from '@/lib/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useStorage } from '@/components/StorageProvider';

export default function Dashboard() {
  const storage = useStorage();
  const searchParams = useSearchParams();
  const channel = searchParams.get('channel') ?? '';
  const cq = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    storage.listProjects()
      .then(data => { setProjects(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [storage]);

  const deleteProject = async (id: string) => {
    await storage.deleteProject(id);
    setProjects(p => p.filter(x => x.id !== id));
    setConfirmDelete(null);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-[#71717a] text-sm mt-1">Analyze channels and generate scripts</p>
        </div>
        <Link
          href={`/projects/new${cq}`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
        >
          <span>+</span> New Project
        </Link>
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#52525b]">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-4xl mb-4">📺</p>
          <p className="text-[#a1a1aa] text-base mb-2">No projects yet</p>
          <p className="text-[#52525b] text-sm mb-6">Create a project to start analysing YouTube channels</p>
          <Link
            href={`/projects/new${cq}`}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div
              key={project.id}
              className="rounded-xl border p-5 hover:border-[#333] transition-colors group"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xl">
                  📺
                </div>
                <button
                  onClick={() => setConfirmDelete({ id: project.id, name: project.name })}
                  className="opacity-0 group-hover:opacity-100 text-[#52525b] hover:text-red-400 transition-all text-sm"
                >
                  🗑
                </button>
              </div>
              <Link href={`/projects/${project.id}`}>
                <h3 className="font-semibold text-sm mb-1 hover:text-indigo-300 transition-colors">
                  {project.name}
                </h3>
              </Link>
              <p className="text-xs text-[#52525b]">
                Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
              </p>
              <div className="flex gap-2 mt-4">
                <Link
                  href={`/projects/${project.id}${cq}`}
                  className="flex-1 text-center py-1.5 rounded-md text-xs border transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Open
                </Link>
                <Link
                  href={`/projects/${project.id}/analyze${cq}`}
                  className={`flex-1 text-center py-1.5 rounded-md text-xs border transition-colors ${channel ? 'border-[#6366f1] text-[#6366f1] hover:bg-[#6366f1] hover:text-white' : 'text-[#a1a1aa] hover:text-white hover:border-[#444]'}`}
                  style={{ borderColor: channel ? '#6366f1' : 'var(--border)' }}
                >
                  {channel ? '⚡ Analyze' : '+ Analyze'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`Delete project "${confirmDelete.name}"? This cannot be undone.`}
          onConfirm={() => deleteProject(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
