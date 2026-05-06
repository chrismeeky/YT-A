'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { v4 as uuid } from 'uuid';
import type { Script, Scene, Analysis } from '@/lib/types';
import SceneEditor from '@/components/SceneEditor';
import ConfirmModal from '@/components/ConfirmModal';
import { useStorage } from '@/components/StorageProvider';

export default function ScriptEditorPage() {
  const { id, scriptId } = useParams<{ id: string; scriptId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storage = useStorage();
  const [script, setScript] = useState<Script | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(() => searchParams.get('tab'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [savedToDisk, setSavedToDisk] = useState(false);
  const [exportFolder, setExportFolder] = useState('');
  const [descOpen, setDescOpen] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [descError, setDescError] = useState('');
  const [descCopied, setDescCopied] = useState(false);
  const [confirmDeleteSceneId, setConfirmDeleteSceneId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    storage.getScript(id, scriptId).then(async data => {
      if (!data) { setLoading(false); return; }
      setScript(data);
      setSavedToDisk(data.savedToDisk ?? false);
      const fromUrl = searchParams.get('scene');
      const exists = fromUrl && data.scenes?.some((s: Scene) => s.id === fromUrl);
      setActiveSceneId(exists ? fromUrl : (data.scenes?.[0]?.id ?? null));
      const tabFromUrl = searchParams.get('tab');
      if (tabFromUrl) setActiveTab(tabFromUrl);

      if (data.analysisId) {
        const a = await storage.getAnalysis(id, data.analysisId);
        setAnalysis(a);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, scriptId, storage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeSceneId) return;
    const params = new URLSearchParams({ scene: activeSceneId });
    if (activeTab) params.set('tab', activeTab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [activeSceneId, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedSave = useCallback(
    (updated: Script) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await storage.saveScript(id, { ...updated, updatedAt: new Date().toISOString() });
          setSaveMsg('Saved');
          setTimeout(() => setSaveMsg(''), 2000);
        } catch {
          setSaveMsg('Save failed');
        } finally {
          setSaving(false);
        }
      }, 1200);
    },
    [id, storage]
  );

  const handleScriptChange = useCallback(
    (updated: Script) => {
      setScript(updated);
      debouncedSave(updated);
    },
    [debouncedSave]
  );

  const generateDescription = async () => {
    if (!script) return;
    setGeneratingDesc(true);
    setDescError('');
    setDescOpen(true);
    try {
      const settings = await storage.getSettings();
      const fullScript = script.scenes.map(s => s.narration).join('\n\n');
      const res = await fetch(`/api/projects/${id}/scripts/${scriptId}/generate-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: script.title,
          fullScript,
          anthropicApiKey: settings.anthropicApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setDescError(data.error); return; }
      handleScriptChange({ ...script, youtubeDescription: data.description });
    } catch {
      setDescError('Failed to generate description');
    } finally {
      setGeneratingDesc(false);
    }
  };

  const saveNow = async () => {
    if (!script) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaving(true);
    try {
      const updated = { ...script, updatedAt: new Date().toISOString() };
      await storage.saveScript(id, updated);
      setScript(updated);
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveToDisk = async () => {
    if (!script) return;
    setSaving(true);
    try {
      const project = await storage.getProject(id);
      const folder = await storage.saveScriptToDisk(id, script, project?.name ?? 'Project');
      const updated = { ...script, savedToDisk: true, updatedAt: new Date().toISOString() };
      await storage.saveScript(id, updated);
      setScript(updated);
      setSavedToDisk(true);
      setExportFolder(folder);
      setSaveMsg('Exported ✓');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setSaveMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  const addScene = () => {
    if (!script) return;
    const newScene: Scene = {
      id: uuid(),
      number: script.scenes.length + 1,
      title: `Scene ${script.scenes.length + 1}`,
      narration: '',
      sceneDescription: '',
      estimatedDurationSeconds: 0,
      wordCount: 0,
      includeImagePrompt: true,
      includeVideoPrompt: true,
      includeStockUrl: false,
      includeStockPhotos: false,
      includeRealImages: false,
      includeStockVideos: false,
      mediaFiles: [],
    };
    const updated = { ...script, scenes: [...script.scenes, newScene] };
    handleScriptChange(updated);
    setActiveSceneId(newScene.id);
  };

  const deleteScene = (sceneId: string) => {
    if (!script || script.scenes.length <= 1) return;
    setConfirmDeleteSceneId(sceneId);
  };

  const confirmDeleteScene = () => {
    if (!script || !confirmDeleteSceneId) return;
    const scenes = script.scenes.filter(s => s.id !== confirmDeleteSceneId);
    const renumbered = scenes.map((s, i) => ({ ...s, number: i + 1 }));
    handleScriptChange({ ...script, scenes: renumbered });
    if (activeSceneId === confirmDeleteSceneId) setActiveSceneId(renumbered[0]?.id ?? null);
    setConfirmDeleteSceneId(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-[#52525b]">Loading…</div>;
  }
  if (!script) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-[#a1a1aa] mb-4">Script not found</p>
        <Link href={`/projects/${id}`} className="text-indigo-300 hover:text-indigo-300 text-sm">← Back</Link>
      </div>
    );
  }

  const totalWords = script.scenes.reduce((sum, s) => sum + (s.wordCount || 0), 0);
  const totalSeconds = script.scenes.reduce((sum, s) => sum + (s.estimatedDurationSeconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60 * 10) / 10;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b flex-shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Link href={`/projects/${id}`} className="text-[#52525b] hover:text-white transition-colors text-sm">
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <input
            value={script.title}
            onChange={e => handleScriptChange({ ...script, title: e.target.value })}
            className="bg-transparent font-semibold text-sm w-full focus:outline-none border-b border-transparent focus:border-[#333] pb-0.5"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-[#52525b] flex-shrink-0">
          <span>{totalWords.toLocaleString()} words</span>
          <span>·</span>
          <span>~{totalMinutes} min</span>
          <span>·</span>
          <span>{script.scenes.length} scenes</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saveMsg && (
            <span className="text-xs text-green-400">{saveMsg}</span>
          )}
          <button
            onClick={saveNow}
            disabled={saving}
            className="px-3 py-1.5 rounded-md text-xs border transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444] disabled:opacity-40"
            style={{ borderColor: 'var(--border)' }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={generateDescription}
            disabled={generatingDesc}
            className="px-3 py-1.5 rounded-md text-xs border transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444] disabled:opacity-40 flex items-center gap-1.5"
            style={{ borderColor: 'var(--border)' }}
            title="Generate YouTube description with Claude"
          >
            {generatingDesc ? <><span className="animate-pulse">✍️</span> Writing…</> : <>✍️ Description</>}
          </button>
          {storage.canSaveToDisk && (
            <button
              onClick={saveToDisk}
              disabled={saving}
              className="px-3 py-1.5 rounded-md text-xs bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 transition-colors font-medium"
            >
              📦 Export
            </button>
          )}
        </div>
      </div>

      {/* Export notice */}
      {savedToDisk && exportFolder && (
        <div
          className="px-6 py-2 text-xs border-b flex items-center gap-2"
          style={{ borderColor: 'var(--border)', background: '#0f1d0f', color: '#4ade80' }}
        >
          <span>✓</span>
          <span>Exported to <span className="font-mono">{exportFolder}</span> in your data folder</span>
        </div>
      )}

      {/* Thumbnail concept */}
      {script.thumbnailConcept && (
        <div
          className="px-6 py-2.5 text-xs border-b flex items-center gap-2"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
        >
          <span className="text-[#52525b]">Thumbnail concept:</span>
          <span>{script.thumbnailConcept}</span>
        </div>
      )}

      {/* YouTube description panel */}
      {(descOpen || script.youtubeDescription) && (
        <div className="border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <button
            onClick={() => setDescOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-2.5 text-xs text-[#71717a] hover:text-[#a1a1aa] transition-colors"
          >
            <span className="font-medium uppercase tracking-wider">YouTube Description</span>
            <span>{descOpen ? '▲' : '▼'}</span>
          </button>
          {descOpen && (
            <div className="px-6 pb-4 space-y-2">
              {descError && <p className="text-xs text-red-400">{descError}</p>}
              {generatingDesc ? (
                <div className="flex items-center gap-2 text-xs text-[#52525b] py-2">
                  <span className="animate-spin inline-block">⚡</span> Generating…
                </div>
              ) : (
                <textarea
                  value={script.youtubeDescription ?? ''}
                  onChange={e => handleScriptChange({ ...script, youtubeDescription: e.target.value })}
                  rows={8}
                  className="w-full rounded-lg px-3 py-2.5 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 font-mono resize-y"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder="Your YouTube description will appear here…"
                />
              )}
              <div className="flex items-center gap-3">
                <button
                  onClick={generateDescription}
                  disabled={generatingDesc}
                  className="px-3 py-1.5 rounded-md text-xs bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 transition-colors font-medium"
                >
                  {script.youtubeDescription ? '↺ Regenerate' : '⚡ Generate'}
                </button>
                {script.youtubeDescription && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(script.youtubeDescription ?? '').then(() => {
                        setDescCopied(true);
                        setTimeout(() => setDescCopied(false), 1500);
                      });
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      descCopied
                        ? 'text-green-400 border-green-500/40 bg-green-500/10'
                        : 'text-[#a1a1aa] hover:text-white hover:border-[#444]'
                    }`}
                    style={descCopied ? {} : { borderColor: 'var(--border)' }}
                  >
                    {descCopied ? '✓ Copied' : '⎘ Copy'}
                  </button>
                )}
                {script.youtubeDescription && (
                  <span className="text-xs text-[#52525b] ml-auto">
                    {script.youtubeDescription.length} chars
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main content: scene list + editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scene sidebar */}
        <div
          className="w-52 flex-shrink-0 border-r flex flex-col overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Scenes</span>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {script.scenes.map(scene => (
              <button
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                className={`w-full text-left px-3 py-2.5 group flex items-start gap-2 transition-colors ${
                  activeSceneId === scene.id
                    ? 'bg-indigo-500/15 border-l-2 border-indigo-400'
                    : 'hover:bg-[#1a1a1a] border-l-2 border-transparent'
                }`}
              >
                <span className="text-xs text-[#52525b] w-5 flex-shrink-0 pt-0.5">{scene.number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{scene.title || 'Untitled'}</p>
                  <p className="text-[10px] text-[#52525b] mt-0.5">
                    ~{scene.estimatedDurationSeconds}s · {scene.wordCount}w
                    {scene.audioFile && <span className="ml-1 text-green-500">🎵</span>}
                    {scene.mediaFiles?.length > 0 && <span className="ml-1 text-blue-400">📁</span>}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteScene(scene.id); }}
                  className="opacity-0 group-hover:opacity-100 text-[#333] hover:text-red-400 transition-all text-xs flex-shrink-0 pt-0.5"
                >
                  ×
                </button>
              </button>
            ))}
          </div>
          <div className="p-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={addScene}
              className="w-full py-2 rounded-md text-xs border transition-colors text-[#71717a] hover:text-white hover:border-[#444]"
              style={{ borderColor: 'var(--border)' }}
            >
              + Add Scene
            </button>
          </div>
        </div>

        {/* Scene editor */}
        <SceneEditor
          projectId={id}
          script={script}
          analysis={analysis}
          activeSceneId={activeSceneId}
          onScriptChange={handleScriptChange}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {confirmDeleteSceneId && (
        <ConfirmModal
          message="Delete this scene?"
          onConfirm={confirmDeleteScene}
          onCancel={() => setConfirmDeleteSceneId(null)}
        />
      )}
    </div>
  );
}
