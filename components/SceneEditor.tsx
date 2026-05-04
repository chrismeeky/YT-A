'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Scene, Script, Analysis } from '@/lib/types';
import MediaUploadModal from './MediaUploadModal';
import { useStorage } from '@/components/StorageProvider';

function ExpandIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
    </svg>
  );
}

function CopyButton({ text, className = '', onCopy }: { text: string; className?: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      onCopy?.();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={copy}
      title="Copy to clipboard"
      className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
        copied
          ? 'text-green-400 bg-green-500/10'
          : 'text-[#a1a1aa] hover:text-white hover:bg-[#2a2a2a]'
      } ${className}`}
    >
      {copied ? '✓ Copied' : '⎘ Copy'}
    </button>
  );
}

interface Props {
  projectId: string;
  script: Script;
  analysis: Analysis | null;
  activeSceneId: string | null;
  onScriptChange: (updated: Script) => void;
}

export default function SceneEditor({ projectId, script, analysis, activeSceneId, onScriptChange }: Props) {
  const storage = useStorage();
  const [showModal, setShowModal] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<{ src: string; title: string } | null>(null);
  const [generatingScenes, setGeneratingScenes] = useState<Set<string>>(new Set());
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [assetError, setAssetError] = useState('');
  const [audioError, setAudioError] = useState('');
  const [audioSuccess, setAudioSuccess] = useState('');
  const [savingPhoto, setSavingPhoto] = useState<string | null>(null);
  const [activeAssetTab, setActiveAssetTab] = useState<string | null>(null);
  const [struckItems, setStruckItems] = useState<Set<string>>(new Set());
  const [badgeAnimating, setBadgeAnimating] = useState(false);
  const prevMediaCountRef = useRef<number>(0);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (key: string) => {
    setActiveAssetTab(key);
    requestAnimationFrame(() => {
      if (scrollBodyRef.current && tabContentRef.current) {
        const bodyRect = scrollBodyRef.current.getBoundingClientRect();
        const contentRect = tabContentRef.current.getBoundingClientRect();
        scrollBodyRef.current.scrollBy({ top: contentRect.top - bodyRect.top - 24, behavior: 'smooth' });
      }
    });
  };

  const toggleStruck = (key: string) =>
    setStruckItems(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // Clear struck + active tab when switching scenes
  useEffect(() => { setStruckItems(new Set()); setActiveAssetTab(null); setAudioSuccess(''); setAudioError(''); }, [activeSceneId]);

  // Animate badge when media count increases (includes audio file)
  const activeScene = script.scenes.find(s => s.id === activeSceneId);
  const activeMediaCount = (activeScene?.mediaFiles?.length ?? 0) + (activeScene?.audioFile ? 1 : 0);
  useEffect(() => {
    if (activeMediaCount > prevMediaCountRef.current) setBadgeAnimating(true);
    prevMediaCountRef.current = activeMediaCount;
  }, [activeMediaCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const scene = activeScene;

  const updateScene = useCallback(
    (patch: Partial<Scene>) => {
      const scenes = script.scenes.map(s =>
        s.id === activeSceneId ? { ...s, ...patch } : s
      );
      onScriptChange({ ...script, scenes });
    },
    [script, activeSceneId, onScriptChange]
  );

  // Auto-update word count and duration when narration changes
  useEffect(() => {
    if (!scene) return;
    const words = scene.narration.trim().split(/\s+/).filter(Boolean).length;
    const duration = Math.round((words / script.settings.wpm) * 60);
    if (words !== scene.wordCount || duration !== scene.estimatedDurationSeconds) {
      updateScene({ wordCount: words, estimatedDurationSeconds: duration });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.narration]);

  const generateAssets = async () => {
    if (!scene) return;
    const sceneId = scene.id;
    setGeneratingScenes(prev => new Set(prev).add(sceneId));
    setAssetError('');
    try {
      const settings = await storage.getSettings();
      const res = await fetch(
        `/api/projects/${projectId}/scripts/${script.id}/scenes/${sceneId}/generate-assets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scene,
            analysis,
            anthropicApiKey: settings.anthropicApiKey,
            pexelsApiKey: settings.pexelsApiKey,
            braveApiKey: settings.braveApiKey,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setAssetError(data.error); return; }
      const { assets } = data;
      const updatedScene = {
        ...scene,
        imagePrompts:        assets.imagePrompts        ?? scene.imagePrompts,
        imagePromptExcerpts: assets.imagePromptExcerpts ?? scene.imagePromptExcerpts,
        videoPrompts:        assets.videoPrompts        ?? scene.videoPrompts,
        videoPromptExcerpts: assets.videoPromptExcerpts ?? scene.videoPromptExcerpts,
        ...(assets.stockPhotoSegments !== undefined && { stockPhotoSegments: assets.stockPhotoSegments }),
        ...(assets.realImageSegments  !== undefined && { realImageSegments:  assets.realImageSegments }),
        ...(assets.stockVideoSegments !== undefined && { stockVideoSegments: assets.stockVideoSegments }),
      };
      onScriptChange({ ...script, scenes: script.scenes.map(s => s.id === sceneId ? updatedScene : s) });
      // Auto-switch to the first newly populated tab only if still viewing this scene
      if (sceneId === activeSceneId) {
        const firstNewTab =
          assets.imagePrompts       ? 'imagePrompt' :
          assets.videoPrompts       ? 'videoPrompt' :
          assets.stockPhotoSegments ? 'stockPhotos' :
          assets.stockVideoSegments ? 'stockVideos' :
          assets.realImageSegments  ? 'realImages' : null;
        if (firstNewTab) setActiveAssetTab(firstNewTab);
      }
    } catch {
      setAssetError('Failed to generate assets');
    } finally {
      setGeneratingScenes(prev => { const next = new Set(prev); next.delete(sceneId); return next; });
    }
  };

  const generateAudio = async () => {
    if (!scene) return;
    setGeneratingAudio(true);
    setAudioError('');
    setAudioSuccess('');
    try {
      const settings = await storage.getSettings();
      const res = await fetch(
        `/api/projects/${projectId}/scripts/${script.id}/scenes/${scene.id}/audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            narration:            scene.narration,
            sceneNumber:          scene.number,
            elevenLabsApiKey:     settings.elevenLabsApiKey,
            elevenLabsVoiceId:    settings.elevenLabsVoiceId,
            elevenLabsSpeed:      settings.elevenLabsSpeed,
            elevenLabsStability:  settings.elevenLabsStability,
            elevenLabsSimilarity: settings.elevenLabsSimilarity,
            elevenLabsStyle:      settings.elevenLabsStyle,
          }),
        }
      );
      if (!res.ok) { const d = await res.json(); setAudioError(d.error); return; }
      const filename = res.headers.get('X-Filename') ?? `audio_scene_${String(scene.number).padStart(3, '0')}.mp3`;
      const buffer = await res.arrayBuffer();
      await storage.saveAudioFile(projectId, script.id, scene.id, filename, buffer);
      onScriptChange({ ...script, scenes: script.scenes.map(s => s.id === scene.id ? { ...s, audioFile: filename } : s) });
      setAudioSuccess(`Audio saved: ${filename}`);
    } catch {
      setAudioError('Audio generation failed');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const savePhotoToScene = async (url: string, originalName: string) => {
    if (!scene) return;
    setSavingPhoto(url);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/scripts/${script.id}/scenes/${scene.id}/media/download`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, originalName }),
        }
      );
      if (!res.ok) return;
      const ext = res.headers.get('X-Ext') ?? '.jpg';
      const filename = `${crypto.randomUUID()}${ext}`;
      const buffer = await res.arrayBuffer();
      const isVideo = ['.mp4', '.mov', '.webm'].includes(ext);
      const mediaFile = await storage.saveMediaFile(
        projectId, script.id, scene.id, filename, buffer, originalName, isVideo ? 'video' : 'image',
      );
      onScriptChange({
        ...script,
        scenes: script.scenes.map(s =>
          s.id === scene.id ? { ...s, mediaFiles: [...(s.mediaFiles ?? []), mediaFile] } : s
        ),
      });
      // Auto-download so the file lands in the user's Downloads folder
      const blob = new Blob([buffer], { type: isVideo ? 'video/mp4' : 'image/jpeg' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = originalName || filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } finally {
      setSavingPhoto(null);
    }
  };

  if (!scene) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#52525b]">
        Select a scene from the sidebar to edit it.
      </div>
    );
  }

  // Derive saved file names from mediaFiles
  const savedNames = new Set(scene.mediaFiles?.map(f => f.originalName) ?? []);

  const durationBadgeColor =
    scene.estimatedDurationSeconds <= 10
      ? 'bg-green-500/10 text-green-400'
      : scene.estimatedDurationSeconds <= 30
        ? 'bg-yellow-500/10 text-yellow-300'
        : 'bg-orange-500/10 text-orange-300';

  // Asset tabs — only show tabs that have generated content
  const assetTabs = [
    { key: 'imagePrompt', label: 'Image Prompts',   color: 'text-indigo-300',  border: '#6366f1', visible: !!scene.imagePrompts?.length },
    { key: 'videoPrompt', label: 'Video Prompts',   color: 'text-yellow-300',  border: '#eab308', visible: !!scene.videoPrompts?.length },
    { key: 'stockPhotos', label: '📷 Stock Photos', color: 'text-emerald-300', border: '#10b981', visible: !!scene.stockPhotoSegments?.length },
    { key: 'stockVideos', label: '📹 Stock Videos', color: 'text-sky-300',     border: '#0ea5e9', visible: !!scene.stockVideoSegments?.length },
    { key: 'realImages',  label: '🔍 Real Images',  color: 'text-orange-300',  border: '#f97316', visible: !!scene.realImageSegments?.length  },
  ].filter(t => t.visible);

  const effectiveTab = (activeAssetTab && assetTabs.find(t => t.key === activeAssetTab))
    ? activeAssetTab
    : assetTabs[0]?.key ?? '';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Fixed header — always visible */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
        {/* Title + badges */}
        <div className="flex items-center gap-3">
          <input
            value={scene.title}
            onChange={e => updateScene({ title: e.target.value })}
            className="bg-transparent text-base font-semibold flex-1 focus:outline-none border-b border-transparent focus:border-[#333] pb-0.5"
            placeholder="Scene title…"
          />
          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${durationBadgeColor}`}>
            ~{scene.estimatedDurationSeconds}s
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-[#1a1a1a] text-[#a1a1aa] flex-shrink-0">
            {scene.wordCount}w
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={generateAudio}
            disabled={generatingAudio || !scene.narration?.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#333] hover:border-[#555] hover:bg-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[#a1a1aa] hover:text-white"
          >
            {generatingAudio ? (
              <><span className="animate-pulse">🎵</span> Generating…</>
            ) : (
              <><span>🎵</span> Generate Audio</>
            )}
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#333] hover:border-[#555] hover:bg-[#1a1a1a] transition-colors text-[#a1a1aa] hover:text-white"
          >
            <span>📁</span> Media
            {((scene.mediaFiles?.length ?? 0) + (scene.audioFile ? 1 : 0)) > 0 && (
              <span
                className={`ml-0.5 bg-indigo-500 text-white rounded-full px-1.5 py-0.5 text-[10px] inline-block${badgeAnimating ? ' badge-pop' : ''}`}
                onAnimationEnd={() => setBadgeAnimating(false)}
              >
                {(scene.mediaFiles?.length ?? 0) + (scene.audioFile ? 1 : 0)}
              </span>
            )}
          </button>

          {scene.audioFile && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <span>🎵</span>{scene.audioFile}
            </span>
          )}
          {audioError && <span className="text-xs text-red-400">{audioError}</span>}
          {audioSuccess && <span className="text-xs text-green-400">✓ {audioSuccess}</span>}
        </div>
      </div>

      {/* Tab bar — flex-shrink-0 so it never scrolls away, zero gap with header */}
      {assetTabs.length > 0 && (
        <div
          className="flex-shrink-0 flex overflow-x-auto border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          {assetTabs.map(tab => {
            const isActive = effectiveTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  isActive
                    ? `${tab.color} border-current`
                    : 'text-[#71717a] border-transparent hover:text-[#a1a1aa]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable body */}
      <div ref={scrollBodyRef} className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* Narration */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Narration</label>
            <CopyButton text={scene.narration} />
          </div>
          <textarea
            value={scene.narration}
            onChange={e => updateScene({ narration: e.target.value })}
            rows={6}
            className="w-full rounded-lg px-3 py-2 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)', color: 'var(--text)' }}
            placeholder="What the narrator says…"
          />
        </div>

        {/* Scene description */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Visual Description</label>
            <CopyButton text={scene.sceneDescription} />
          </div>
          <textarea
            value={scene.sceneDescription}
            onChange={e => updateScene({ sceneDescription: e.target.value })}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm border focus:border-indigo-400"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)', color: 'var(--text)' }}
            placeholder="What the viewer sees…"
          />
        </div>

        {/* Assets panel */}
        <div
          className="rounded-lg border"
          style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)' }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Visual Assets</p>
            <button
              onClick={generateAssets}
              disabled={generatingScenes.has(scene.id) || (!scene.includeImagePrompt && !scene.includeVideoPrompt && !scene.includeStockPhotos && !scene.includeRealImages && !scene.includeStockVideos)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generatingScenes.has(scene.id) ? (
                <><span className="animate-spin inline-block">⚡</span> Generating…</>
              ) : (
                <><span>⚡</span> Generate Selected</>
              )}
            </button>
          </div>

          {assetError && <p className="text-xs text-red-400 px-4 pb-2">{assetError}</p>}

          {/* Checkboxes */}
          <div className="flex flex-wrap gap-4 px-4 pb-3">
            {[
              { key: 'includeImagePrompt' as const, label: 'Image Prompt' },
              { key: 'includeVideoPrompt' as const, label: 'Video Prompt' },
              { key: 'includeStockPhotos' as const, label: '📷 Stock Photos' },
              { key: 'includeRealImages' as const,  label: '🔍 Real Images' },
              { key: 'includeStockVideos' as const, label: '📹 Stock Videos' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={scene[key]}
                  onChange={e => updateScene({ [key]: e.target.checked })}
                  className="rounded accent-indigo-400"
                />
                <span className="text-[#a1a1aa]">{label}</span>
              </label>
            ))}
          </div>

          {/* Granularity slider */}
          {(() => {
            const g = scene.assetGranularity ?? 2;
            const levels = [
              { label: 'Minimal',   tip: 'One prompt per ~20s. Fewer assets — faster to edit, best for simple or short scenes.' },
              { label: 'Balanced',  tip: 'One prompt per ~10s. Covers each major story beat — the recommended default.' },
              { label: 'Detailed',  tip: 'One prompt per ~5s. More assets, more visual variety — good for action-heavy scenes.' },
              { label: 'Cinematic', tip: 'One prompt per ~3s. Maximum granularity — one prompt per key sentence. Best for high-production edits.' },
            ];
            const current = levels[g - 1];
            const pct = ((g - 1) / 3) * 100;
            return (
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Granularity</span>
                  <span className="text-xs font-semibold text-indigo-300">{current.label}</span>
                </div>
                <input
                  type="range" min={1} max={4} step={1} value={g}
                  onChange={e => updateScene({ assetGranularity: Number(e.target.value) })}
                  className="w-full h-1.5 rounded-full accent-indigo-400"
                  style={{ background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${pct}%, #27272a ${pct}%, #27272a 100%)` }}
                />
                <div className="flex justify-between text-[10px] text-[#71717a] mt-1 mb-1.5">
                  {levels.map(l => <span key={l.label}>{l.label}</span>)}
                </div>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">{current.tip}</p>
              </div>
            );
          })()}

          {/* No tabs — nothing enabled */}
          {assetTabs.length === 0 && (
            <p className="text-xs text-[#52525b] text-center px-4 pb-6">
              Enable at least one asset type above, then hit Generate Selected.
            </p>
          )}
        </div>{/* end assets config panel */}

        {/* Tab content */}
        {assetTabs.length > 0 && (
          <div ref={tabContentRef} className="pt-2">

              {/* Image Prompts */}
              {effectiveTab === 'imagePrompt' && scene.includeImagePrompt && (
                <div className="space-y-3">
                  {scene.estimatedDurationSeconds > 10 && (
                    <p className="text-[11px] text-indigo-300/70">
                      ~{Math.ceil(scene.estimatedDurationSeconds / 10)} frames for {scene.estimatedDurationSeconds}s
                    </p>
                  )}
                  {(scene.imagePrompts?.length ? scene.imagePrompts : ['']).map((prompt, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-xs text-[#52525b] pt-2 w-5 text-right flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 relative group">
                        {scene.imagePromptExcerpts?.[i] && (
                          <p
                            onClick={() => struckItems.has(`img-${i}`) && toggleStruck(`img-${i}`)}
                            title={struckItems.has(`img-${i}`) ? 'Click to unmark' : undefined}
                            className={`text-xs italic mb-1 line-clamp-2 select-none transition-all ${
                              struckItems.has(`img-${i}`)
                                ? 'line-through text-indigo-300/30 cursor-pointer'
                                : 'text-indigo-300/80'
                            }`}
                          >
                            {scene.imagePromptExcerpts[i]}
                          </p>
                        )}
                        <textarea
                          value={prompt}
                          onChange={e => {
                            const updated = [...(scene.imagePrompts ?? [''])];
                            updated[i] = e.target.value;
                            updateScene({ imagePrompts: updated });
                          }}
                          rows={2}
                          className="w-full rounded-md px-3 py-2 text-xs border focus:border-indigo-400"
                          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                          placeholder="Midjourney/DALL-E style prompt --ar 16:9…"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={prompt} onCopy={() => toggleStruck(`img-${i}`)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => updateScene({ imagePrompts: [...(scene.imagePrompts ?? []), ''] })}
                    className="text-xs text-indigo-300 transition-colors pl-7"
                  >
                    + Add frame
                  </button>
                </div>
              )}

              {/* Video Prompts */}
              {effectiveTab === 'videoPrompt' && scene.includeVideoPrompt && (
                <div className="space-y-3">
                  {scene.estimatedDurationSeconds > 10 && (
                    <p className="text-[11px] text-yellow-300/70">
                      ~{Math.ceil(scene.estimatedDurationSeconds / 8)} chunks for {scene.estimatedDurationSeconds}s
                    </p>
                  )}
                  {(scene.videoPrompts?.length ? scene.videoPrompts : ['']).map((prompt, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-xs text-[#52525b] pt-2 w-5 text-right flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 relative group">
                        {scene.videoPromptExcerpts?.[i] && (
                          <p
                            onClick={() => struckItems.has(`vid-${i}`) && toggleStruck(`vid-${i}`)}
                            title={struckItems.has(`vid-${i}`) ? 'Click to unmark' : undefined}
                            className={`text-xs italic mb-1 line-clamp-2 select-none transition-all ${
                              struckItems.has(`vid-${i}`)
                                ? 'line-through text-yellow-300/30 cursor-pointer'
                                : 'text-yellow-300/80'
                            }`}
                          >
                            {scene.videoPromptExcerpts[i]}
                          </p>
                        )}
                        <textarea
                          value={prompt}
                          onChange={e => {
                            const updated = [...(scene.videoPrompts ?? [''])];
                            updated[i] = e.target.value;
                            updateScene({ videoPrompts: updated });
                          }}
                          rows={2}
                          className="w-full rounded-md px-3 py-2 text-xs border focus:border-indigo-400"
                          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                          placeholder="Sora/Runway style prompt…"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyButton text={prompt} onCopy={() => toggleStruck(`vid-${i}`)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => updateScene({ videoPrompts: [...(scene.videoPrompts ?? []), ''] })}
                    className="text-xs text-indigo-300 transition-colors pl-7"
                  >
                    + Add chunk
                  </button>
                </div>
              )}

              {/* Stock Photos */}
              {effectiveTab === 'stockPhotos' && !!scene.stockPhotoSegments?.length && (
                <div className="space-y-5">
                  {scene.stockPhotoSegments.map((seg, si) => (
                    <div key={si}>
                      <p className="text-xs mb-0.5">
                        <span className="text-[#71717a]">Segment {si + 1}:</span>{' '}
                        <span className="text-[#52525b]">{seg.query}</span>
                      </p>
                      <p className="text-xs text-emerald-300/70 italic mb-2">{seg.narrationExcerpt}</p>
                      {seg.photos.length === 0 ? (
                        <p className="text-xs text-[#52525b] italic">No results for this query.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {seg.photos.map(photo => {
                            const photoName = `pexels-photo-${photo.id}.jpg`;
                            const isSaved = savedNames.has(photoName);
                            return (
                              <div
                                key={photo.id}
                                className="group relative rounded-md overflow-hidden border transition-colors"
                                style={{ borderColor: isSaved ? '#22c55e' : 'var(--border)' }}
                              >
                                <img src={photo.thumb} alt={photo.alt} className="w-full aspect-video object-cover" />
                                {isSaved && (
                                  <span className="absolute bottom-5 left-1 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium pointer-events-none">
                                    ✓ Saved
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                                  <button
                                    onClick={() => savePhotoToScene(photo.full, photoName)}
                                    disabled={savingPhoto === photo.full || isSaved}
                                    className="text-[10px] px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 w-full"
                                  >
                                    {savingPhoto === photo.full ? 'Saving…' : isSaved ? '✓ Saved' : '+ Save to Scene'}
                                  </button>
                                  <a
                                    href={photo.pageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white w-full text-center"
                                  >
                                    Open ↗
                                  </a>
                                </div>
                                <button
                                  onClick={() => setLightbox({ src: photo.full, alt: photo.alt || '' })}
                                  className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                  title="View full size"
                                >
                                  <ExpandIcon />
                                </button>
                                <p className="text-[9px] text-[#52525b] px-1 py-0.5 truncate">{photo.photographer}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Stock Videos */}
              {effectiveTab === 'stockVideos' && !!scene.stockVideoSegments?.length && (
                <div className="space-y-5">
                  {scene.stockVideoSegments.map((seg, si) => (
                    <div key={si}>
                      <p className="text-xs mb-0.5">
                        <span className="text-[#71717a]">Segment {si + 1}:</span>{' '}
                        <span className="text-[#52525b]">{seg.query}</span>
                      </p>
                      <p className="text-xs text-sky-300/70 italic mb-2">{seg.narrationExcerpt}</p>
                      {seg.videos.length === 0 ? (
                        <p className="text-xs text-[#52525b] italic">No results for this query.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {seg.videos.map(video => {
                            const videoName = `pexels-video-${video.id}.mp4`;
                            const isSaved = savedNames.has(videoName);
                            return (
                              <div
                                key={video.id}
                                className="group relative rounded-md overflow-hidden border transition-colors"
                                style={{ borderColor: isSaved ? '#22c55e' : 'var(--border)' }}
                              >
                                <button
                                  className="relative block w-full"
                                  onClick={() => setVideoPlayer({ src: video.sdUrl, title: video.user })}
                                  title="Play video"
                                >
                                  <img src={video.thumb} alt={video.user} className="w-full aspect-video object-cover" />
                                  <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">
                                    {video.duration}s
                                  </span>
                                  <span className="absolute inset-0 flex items-center justify-center text-2xl drop-shadow">▶</span>
                                </button>
                                {isSaved && (
                                  <span className="absolute bottom-5 left-1 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium pointer-events-none">
                                    ✓ Saved
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                                  <button
                                    onClick={() => setVideoPlayer({ src: video.sdUrl, title: video.user })}
                                    className="text-[10px] px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-white w-full"
                                  >
                                    ▶ Play
                                  </button>
                                  <button
                                    onClick={() => savePhotoToScene(video.sdUrl, videoName)}
                                    disabled={savingPhoto === video.sdUrl || isSaved}
                                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 w-full"
                                  >
                                    {savingPhoto === video.sdUrl ? 'Saving…' : isSaved ? '✓ Saved' : '+ Save to Scene'}
                                  </button>
                                  <a
                                    href={video.pageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white w-full text-center"
                                  >
                                    Open ↗
                                  </a>
                                </div>
                                <p className="text-[9px] text-[#52525b] px-1 py-0.5 truncate">{video.user}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Real Images */}
              {effectiveTab === 'realImages' && !!scene.realImageSegments?.length && (
                <div className="space-y-5">
                  {scene.realImageSegments.map((seg, si) => (
                    <div key={si}>
                      <p className="text-xs mb-0.5">
                        <span className="text-[#71717a]">Segment {si + 1}:</span>{' '}
                        <span className="text-[#52525b]">{seg.query}</span>
                      </p>
                      <p className="text-xs text-orange-300/70 italic mb-2">{seg.narrationExcerpt}</p>
                      {seg.images.length === 0 ? (
                        <p className="text-xs text-[#52525b] italic">No results found — try regenerating.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {seg.images.map((img, ii) => {
                            const imgKey = img.full || `real-image-${si}-${ii}`;
                            const isSaved = savedNames.has(imgKey);
                            return (
                              <div
                                key={ii}
                                className="group relative rounded-md overflow-hidden border transition-colors"
                                style={{ borderColor: isSaved ? '#22c55e' : 'var(--border)' }}
                              >
                                <img
                                  src={img.thumb}
                                  alt={img.title}
                                  className="w-full aspect-video object-cover"
                                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                                {isSaved && (
                                  <span className="absolute bottom-5 left-1 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium pointer-events-none">
                                    ✓ Saved
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                                  <button
                                    onClick={() => savePhotoToScene(img.full, imgKey)}
                                    disabled={savingPhoto === img.full || isSaved}
                                    className="text-[10px] px-2 py-1 rounded bg-orange-500 hover:bg-orange-400 text-white disabled:opacity-50 w-full"
                                  >
                                    {savingPhoto === img.full ? 'Saving…' : isSaved ? '✓ Saved' : '+ Save to Scene'}
                                  </button>
                                  <a
                                    href={img.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white w-full text-center"
                                  >
                                    Source ↗
                                  </a>
                                </div>
                                <button
                                  onClick={() => setLightbox({ src: img.full, alt: img.title || '' })}
                                  className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                  title="View full size"
                                >
                                  <ExpandIcon />
                                </button>
                                <p className="text-[9px] text-[#52525b] px-1 py-0.5 truncate">{img.title}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Empty state — tab selected but no content generated yet */}
              {effectiveTab && !{
                imagePrompt: scene.imagePrompts?.length,
                videoPrompt: scene.videoPrompts?.length,
                stockPhotos: scene.stockPhotoSegments?.length,
                stockVideos: scene.stockVideoSegments?.length,
                realImages:  scene.realImageSegments?.length,
              }[effectiveTab] && (
                <p className="text-xs text-[#52525b] text-center py-6">
                  Hit <strong>Generate Selected</strong> to populate this tab.
                </p>
              )}

            </div>
          )}

      </div>{/* end scrollable body */}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      {videoPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setVideoPlayer(null)}
        >
          <video
            ref={el => { if (el) el.requestFullscreen?.().catch(() => {}); }}
            src={videoPlayer.src}
            controls
            autoPlay
            className="max-w-[90vw] max-h-[90vh] rounded shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setVideoPlayer(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      {showModal && (
        <MediaUploadModal
          projectId={projectId}
          scriptId={script.id}
          sceneId={scene.id}
          sceneNumber={scene.number}
          script={script}
          onClose={() => setShowModal(false)}
          onScriptChange={onScriptChange}
        />
      )}
    </div>
  );
}
