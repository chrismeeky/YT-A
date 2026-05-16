'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { Project, Analysis, Script } from '@/lib/types';
import ConfirmModal from '@/components/ConfirmModal';
import { useStorage } from '@/components/StorageProvider';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const channel = searchParams.get('channel') ?? '';
  const analyzeHref = channel
    ? `/projects/${id}/analyze?channel=${encodeURIComponent(channel)}`
    : `/projects/${id}/analyze`;
  const storage = useStorage();
  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [tab, setTab] = useState<'analyses' | 'scripts'>('analyses');
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'analysis' | 'script'; id: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      storage.getProject(id),
      storage.listAnalyses(id),
      storage.listScripts(id),
    ]).then(([p, a, s]) => {
      setProject(p);
      setAnalyses(Array.isArray(a) ? a : []);
      setScripts(Array.isArray(s) ? s : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, storage]);

  const deleteAnalysis = async (analysisId: string) => {
    await storage.deleteAnalysis(id, analysisId);
    setAnalyses(a => a.filter(x => x.id !== analysisId));
    setConfirmDelete(null);
  };

  const deleteScript = async (scriptId: string) => {
    await storage.deleteScript(id, scriptId);
    setScripts(s => s.filter(x => x.id !== scriptId));
    setConfirmDelete(null);
  };

  const handleImportAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError('');
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Analysis;
      if (!data.channelInsights || !data.videoAnalyses || !data.name) {
        throw new Error('Invalid analysis file — missing required fields.');
      }
      const imported: Analysis = {
        ...data,
        id: crypto.randomUUID(),
        projectId: id,
        createdAt: data.createdAt ?? new Date().toISOString(),
      };
      await storage.saveAnalysis(id, imported);
      setAnalyses(prev => [imported, ...prev]);
      setTab('analyses');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import analysis.');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[#52525b]">Loading…</div>;
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[#a1a1aa] mb-4">Project not found</p>
        <Link href="/" className="text-indigo-300 hover:text-indigo-300 text-sm">← Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/" className="text-sm text-[#52525b] hover:text-white transition-colors">Projects</Link>
          <span className="text-[#333] mx-2">/</span>
          <span className="text-sm">{project.name}</span>
        </div>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-[#52525b] mt-1">
            {analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'} · {scripts.length} {scripts.length === 1 ? 'script' : 'scripts'}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportAnalysis}
          />
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border text-sm transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444] disabled:opacity-40"
            style={{ borderColor: 'var(--border)' }}
            title="Import a .reeliq.json analysis file"
          >
            {importing ? '⟳ Importing…' : '⬆ Import Analysis'}
          </button>
          <Link
            href={analyzeHref}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border text-sm transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444]"
            style={{ borderColor: 'var(--border)' }}
          >
            <span>🔍</span> New Analysis
          </Link>
          {analyses.length > 0 && (
            <Link
              href={`/projects/${id}/scripts/new`}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
            >
              <span>✍️</span> New Script
            </Link>
          )}
        </div>
      </div>

      {importError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {importError}
          <button onClick={() => setImportError('')} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {(['analyses', 'scripts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-[#71717a] hover:text-white'
            }`}
          >
            {t === 'analyses' ? `Channel Analyses (${analyses.length})` : `Scripts (${scripts.length})`}
          </button>
        ))}
      </div>

      {/* Analyses tab */}
      {tab === 'analyses' && (
        <div>
          {analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-[#a1a1aa] mb-2">No analyses yet</p>
              <p className="text-[#52525b] text-sm mb-6">Paste a YouTube channel URL to analyse its top videos</p>
              <Link
                href={analyzeHref}
                className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
              >
                Start Analysis
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {analyses.map(analysis => (
                <div
                  key={analysis.id}
                  className="rounded-xl border p-5 group"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{analysis.name}</h3>
                      <p className="text-xs text-[#52525b] mt-0.5">
                        {analysis.channelName || analysis.channelUrl} · {analysis.videoAnalyses.length} videos analysed ·{' '}
                        {formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmDelete({ type: 'analysis', id: analysis.id })}
                      className="opacity-0 group-hover:opacity-100 text-[#52525b] hover:text-red-400 transition-all text-sm ml-4"
                    >
                      🗑
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysis.channelInsights.contentPillars.slice(0, 4).map(p => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/15 text-indigo-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-[#71717a]">{analysis.channelInsights.channelOverview}</p>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/projects/${id}/analyses/${analysis.id}`}
                      className="px-3 py-1.5 rounded-md text-xs border transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      View Full Analysis →
                    </Link>
                    <Link
                      href={`/projects/${id}/scripts/new?analysisId=${analysis.id}`}
                      className="px-3 py-1.5 rounded-md text-xs bg-indigo-500 hover:bg-indigo-600 transition-colors font-medium"
                    >
                      Write Script
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scripts tab */}
      {tab === 'scripts' && (
        <div>
          {scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-3xl mb-3">✍️</p>
              <p className="text-[#a1a1aa] mb-2">No scripts yet</p>
              {analyses.length > 0 ? (
                <>
                  <p className="text-[#52525b] text-sm mb-6">Generate a script based on your channel analysis</p>
                  <Link
                    href={`/projects/${id}/scripts/new`}
                    className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
                  >
                    Create Script
                  </Link>
                </>
              ) : (
                <p className="text-[#52525b] text-sm">Run a channel analysis first, then create scripts from it.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {scripts.map(script => (
                <div
                  key={script.id}
                  className="rounded-xl border p-5 group"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/projects/${id}/scripts/${script.id}`}
                        className="font-semibold text-sm hover:text-indigo-300 transition-colors"
                      >
                        {script.title}
                      </Link>
                      <p className="text-xs text-[#52525b] mt-0.5">
                        {script.scenes.length} scenes · {script.settings.videoLength}min · {' '}
                        {formatDistanceToNow(new Date(script.updatedAt), { addSuffix: true })}
                        {script.savedToDisk && (
                          <span className="ml-2 text-green-500">✓ saved to disk</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmDelete({ type: 'script', id: script.id })}
                      className="opacity-0 group-hover:opacity-100 text-[#52525b] hover:text-red-400 transition-all text-sm ml-4"
                    >
                      🗑
                    </button>
                  </div>
                  <p className="text-xs text-[#71717a] mt-2">Topic: {script.topic}</p>
                  <div className="mt-4">
                    <Link
                      href={`/projects/${id}/scripts/${script.id}`}
                      className="px-3 py-1.5 rounded-md text-xs border transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Open Editor →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={confirmDelete.type === 'analysis' ? 'Delete this analysis?' : 'Delete this script?'}
          onConfirm={() => confirmDelete.type === 'analysis' ? deleteAnalysis(confirmDelete.id) : deleteScript(confirmDelete.id)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
