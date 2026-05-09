'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Scene, Script, Analysis, RealImage, RealImageSegment } from '@/lib/types';
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
  activeTab: string | null;
  onTabChange: (tab: string) => void;
}

export default function SceneEditor({ projectId, script, analysis, activeSceneId, onScriptChange, activeTab, onTabChange }: Props) {
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
  const [struckItems, setStruckItems] = useState<Set<string>>(new Set());
  const [badgeAnimating, setBadgeAnimating] = useState(false);
  const prevMediaCountRef = useRef<number>(0);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const targetSegmentRef = useRef<number | null>(null);
  const [selectionPopover, setSelectionPopover] = useState<{ x: number; y: number; text: string; segmentIndex: number } | null>(null);
  const [searchingSelection, setSearchingSelection] = useState(false);
  const [newImageKeys, setNewImageKeys] = useState<Set<string>>(new Set());
  // extend prompt: key = `${sceneId}-${promptIndex}`, value = { open, duration, generating }
  const [extendState, setExtendState] = useState<Record<string, { open: boolean; duration: number; generating: boolean }>>({});

  const handleTabClick = (key: string) => {
    onTabChange(key);
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

  // Clear struck + active tab when switching between scenes (not on initial mount)
  const prevSceneRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSceneRef.current;
    prevSceneRef.current = activeSceneId;
    if (prev !== null && prev !== activeSceneId) {
      setStruckItems(new Set()); onTabChange(''); setAudioSuccess(''); setAudioError(''); setSelectionPopover(null);
    }
  }, [activeSceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss selection popover on outside click — ignore clicks inside the popover itself
  useEffect(() => {
    if (!selectionPopover) return;
    const dismiss = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (searchingSelection) return;
      setSelectionPopover(null);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [selectionPopover, searchingSelection]);

  const searchImagesFromSelection = async (query: string, segmentIndex: number) => {
    if (!scene || searchingSelection) return;
    setSearchingSelection(true);
    setAssetError('');
    try {
      const settings = await storage.getSettings();

      // Build a context-aware search query using the story topic + segment narration
      const segment = scene.realImageSegments?.[segmentIndex];
      let effectiveQuery = query;
      try {
        const qr = await fetch('/api/generate-image-query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selection: query,
            storyTopic: script.topic || script.title,
            segmentContext: segment?.narrationExcerpt || segment?.query,
            anthropicApiKey: settings.anthropicApiKey,
          }),
        });
        if (qr.ok) {
          const qd = await qr.json() as { query?: string };
          if (qd.query?.trim()) effectiveQuery = qd.query.trim();
        }
      } catch {
        // Non-critical — fall back to raw selection
      }

      let images: RealImage[] = [];
      if (settings.realImageProvider === 'duckduckgo') {
        const r = await fetch(`/api/ddg-images?q=${encodeURIComponent(effectiveQuery)}&count=6`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Search failed');
        images = d.images ?? [];
      } else {
        const r = await fetch('/api/search-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: effectiveQuery, braveApiKey: settings.braveApiKey, count: 6 }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Search failed');
        images = d.images ?? [];
      }
      if (images.length === 0) throw new Error('No images found for that selection.');

      // Merge new images into the existing segment at segmentIndex
      const existingSegments = scene.realImageSegments ?? [];
      const updatedSegments = existingSegments.map((seg, idx) =>
        idx === segmentIndex ? { ...seg, images: [...seg.images, ...images] } : seg
      );
      const updatedScene = { ...scene, realImageSegments: updatedSegments };
      const updatedScript = { ...script, scenes: script.scenes.map(s => s.id === scene.id ? updatedScene : s) };
      onScriptChange(updatedScript);
      // Save immediately so the new images survive a page refresh
      try {
        await storage.saveScript(projectId, { ...updatedScript, updatedAt: new Date().toISOString() });
      } catch { /* debounce save in parent will retry */ }

      // Track newly added image keys for highlight animation + scroll target
      const keys = new Set(images.map(img => img.full || img.thumb));
      targetSegmentRef.current = segmentIndex;
      setNewImageKeys(keys);
      setTimeout(() => setNewImageKeys(new Set()), 2500);

      setSelectionPopover(null);
      onTabChange('realImages');
    } catch (err) {
      setAssetError(err instanceof Error ? err.message : 'Image search failed');
      setSelectionPopover(null);
    } finally {
      setSearchingSelection(false);
    }
  };

  // Animate badge when media count increases (includes audio file)
  const activeScene = script.scenes.find(s => s.id === activeSceneId);
  const activeMediaCount = (activeScene?.mediaFiles?.length ?? 0) + (activeScene?.audioFile ? 1 : 0);
  useEffect(() => {
    if (activeMediaCount > prevMediaCountRef.current) setBadgeAnimating(true);
    prevMediaCountRef.current = activeMediaCount;
  }, [activeMediaCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to the updated segment after new images land in the DOM
  useEffect(() => {
    if (newImageKeys.size === 0) return;
    const segIdx = targetSegmentRef.current;
    if (segIdx === null) return;
    const timer = setTimeout(() => {
      const el = segmentRefs.current.get(segIdx);
      if (el && scrollBodyRef.current) {
        const body = scrollBodyRef.current;
        const bodyRect = body.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        // New images are appended at the bottom of the segment — scroll to reveal the segment bottom
        const scrollDown = elRect.bottom - bodyRect.bottom + 32;
        if (scrollDown > 0) {
          body.scrollBy({ top: scrollDown, behavior: 'smooth' });
        } else if (elRect.top < bodyRect.top) {
          body.scrollBy({ top: elRect.top - bodyRect.top - 24, behavior: 'smooth' });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newImageKeys]);

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
            realImageProvider: settings.realImageProvider,
            characters: script.characters ?? [],
            promptDetail: scene.promptDetail ?? 'auto',
            scriptTopic: script.topic || script.title,
            visualStyle: script.visualStyle,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setAssetError(data.error); return; }
      const { assets } = data;

      // DuckDuckGo only works locally (or via proxy) — server skips it; call the route client-side instead
      // Run sequentially to avoid DDG rate-limiting parallel requests
      if (settings.realImageProvider === 'duckduckgo' && assets.realImageQueries?.length) {
        const ddgResults = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const { query, excerpt } of assets.realImageQueries as { query: string; excerpt: string }[]) {
          try {
            const r = await fetch(`/api/ddg-images?q=${encodeURIComponent(query)}&count=6`);
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ?? 'DuckDuckGo image search failed');
            ddgResults.push({ query, narrationExcerpt: excerpt, images: d.images ?? [] });
          } catch (e) {
            console.warn('DDG failed for query:', query, e);
            ddgResults.push({ query, narrationExcerpt: excerpt, images: [] });
          }
          // Small delay between requests to avoid DDG rate-limiting
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        assets.realImageSegments = ddgResults;
      }

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
      const updatedScript = { ...script, scenes: script.scenes.map(s => s.id === sceneId ? updatedScene : s) };
      onScriptChange(updatedScript);
      // Save immediately so assets survive a page refresh before the debounce fires
      try {
        await storage.saveScript(projectId, { ...updatedScript, updatedAt: new Date().toISOString() });
      } catch { /* debounce save in parent will retry */ }
      // Auto-switch to the first newly populated tab only if still viewing this scene
      if (sceneId === activeSceneId) {
        const firstNewTab =
          assets.imagePrompts       ? 'imagePrompt' :
          assets.videoPrompts       ? 'videoPrompt' :
          assets.stockPhotoSegments ? 'stockPhotos' :
          assets.stockVideoSegments ? 'stockVideos' :
          assets.realImageSegments  ? 'realImages' : null;
        if (firstNewTab) onTabChange(firstNewTab);
      }
    } catch (err) {
      setAssetError(err instanceof Error ? err.message : 'Failed to generate assets');
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

  const effectiveTab = (activeTab && assetTabs.find(t => t.key === activeTab))
    ? activeTab
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
            onChange={e => { updateScene({ narration: e.target.value }); setSelectionPopover(null); }}
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

          {/* Prompt Detail slider */}
          {(() => {
            const detail = scene.promptDetail ?? 'auto';
            const levels: Array<{ value: string; label: string; tip: string }> = [
              { value: 'auto',     label: 'Auto',     tip: 'Let the platform decide the right level of detail based on scene content and duration.' },
              { value: 'brief',    label: 'Brief',    tip: 'Short, punchy prompts (20–40 words). Fast to process, great for simple visuals.' },
              { value: 'standard', label: 'Standard', tip: 'Moderately detailed prompts (50–80 words). Balanced quality and clarity.' },
              { value: 'detailed', label: 'Detailed', tip: 'Rich, specific prompts (80–120 words) with lighting, composition, and atmosphere.' },
              { value: 'verbose',  label: 'Verbose',  tip: 'Cinematic-grade prompts (120–200 words) with precise specifications for every element.' },
            ];
            const idx = levels.findIndex(l => l.value === detail);
            const current = levels[idx];
            const pct = (idx / (levels.length - 1)) * 100;
            return (
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Prompt Detail</span>
                  <span className="text-xs font-semibold text-indigo-300">{current.label}</span>
                </div>
                <input
                  type="range" min={0} max={levels.length - 1} step={1} value={idx}
                  onChange={e => updateScene({ promptDetail: levels[Number(e.target.value)].value as import('@/lib/types').PromptDetail })}
                  className="w-full h-1.5 rounded-full accent-indigo-400"
                  style={{ background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${pct}%, #27272a ${pct}%, #27272a 100%)` }}
                />
                <div className="flex justify-between text-[10px] text-[#71717a] mt-1 mb-1.5">
                  {levels.map(l => <span key={l.value}>{l.label}</span>)}
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
                  {(scene.videoPrompts?.length ? scene.videoPrompts : ['']).map((prompt, i) => {
                    const extKey = `${scene.id}-${i}`;
                    const ext = extendState[extKey];
                    const isExtension = scene.videoPromptIsExtension?.[i];
                    return (
                      <div key={i} className={`flex gap-2 ${isExtension ? 'pl-5' : ''}`}>
                        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-5">
                          {isExtension
                            ? <span className="text-[10px] text-yellow-500/60 mt-2">↳</span>
                            : <span className="text-xs text-[#52525b] pt-2 text-right">{i + 1}</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="relative group">
                            {scene.videoPromptExcerpts?.[i] && !isExtension && (
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
                            {isExtension && (
                              <p className="text-[10px] text-yellow-500/50 mb-1 font-medium tracking-wide uppercase">
                                Extension
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
                              placeholder={isExtension ? 'Continuation prompt…' : 'Sora/Runway style prompt…'}
                            />
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <button
                                onClick={() => setExtendState(prev => ({
                                  ...prev,
                                  [extKey]: { open: !prev[extKey]?.open, duration: prev[extKey]?.duration ?? 6, generating: false },
                                }))}
                                className="px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors text-yellow-400 border-yellow-900/60 hover:border-yellow-600 hover:text-yellow-300"
                                style={{ background: 'var(--surface)' }}
                                title="Extend this prompt"
                              >
                                ↗ Extend
                              </button>
                              <CopyButton text={prompt} onCopy={() => toggleStruck(`vid-${i}`)} />
                            </div>
                          </div>

                          {/* Extend UI */}
                          {ext?.open && (
                            <div
                              className="mt-2 rounded-lg border px-3 py-3 space-y-2"
                              style={{ borderColor: '#854d0e', background: 'rgba(120,53,15,0.15)' }}
                            >
                              <p className="text-[11px] text-yellow-300/70 font-medium">Generate continuation</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#71717a]">Duration</span>
                                <div className="flex gap-1">
                                  {[4, 6, 8, 10].map(s => (
                                    <button
                                      key={s}
                                      onClick={() => setExtendState(prev => ({ ...prev, [extKey]: { ...prev[extKey], duration: s } }))}
                                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                                        (ext.duration ?? 6) === s
                                          ? 'bg-yellow-500/20 border-yellow-600 text-yellow-300'
                                          : 'border-[#333] text-[#52525b] hover:border-[#555] hover:text-[#a1a1aa]'
                                      }`}
                                    >
                                      {s}s
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  disabled={ext.generating}
                                  onClick={async () => {
                                    setExtendState(prev => ({ ...prev, [extKey]: { ...prev[extKey], generating: true } }));
                                    try {
                                      const settings = await storage.getSettings();
                                      const res = await fetch(
                                        `/api/projects/${projectId}/scripts/${script.id}/scenes/${scene.id}/extend-prompt`,
                                        {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            originalPrompt: prompt,
                                            narrationExcerpt: scene.videoPromptExcerpts?.[i],
                                            durationSeconds: ext.duration ?? 6,
                                            anthropicApiKey: settings.anthropicApiKey,
                                          }),
                                        }
                                      );
                                      const data = await res.json();
                                      if (res.ok && data.prompt) {
                                        const prompts = [...(scene.videoPrompts ?? [])];
                                        const excerpts = [...(scene.videoPromptExcerpts ?? [])];
                                        const extensions = [...(scene.videoPromptIsExtension ?? prompts.map(() => false))];
                                        prompts.splice(i + 1, 0, data.prompt);
                                        excerpts.splice(i + 1, 0, '');
                                        extensions.splice(i + 1, 0, true);
                                        updateScene({ videoPrompts: prompts, videoPromptExcerpts: excerpts, videoPromptIsExtension: extensions });
                                        setExtendState(prev => ({ ...prev, [extKey]: { ...prev[extKey], open: false, generating: false } }));
                                      }
                                    } catch {
                                      setExtendState(prev => ({ ...prev, [extKey]: { ...prev[extKey], generating: false } }));
                                    }
                                  }}
                                  className="px-3 py-1 rounded text-xs bg-yellow-600/80 hover:bg-yellow-600 disabled:opacity-50 transition-colors font-medium text-white flex items-center gap-1.5"
                                >
                                  {ext.generating ? <><span className="animate-pulse">⚡</span> Generating…</> : `⚡ Generate ${ext.duration ?? 6}s continuation`}
                                </button>
                                <button
                                  onClick={() => setExtendState(prev => ({ ...prev, [extKey]: { ...prev[extKey], open: false } }))}
                                  className="px-3 py-1 rounded text-xs border text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                    <div
                      key={si}
                      ref={el => { if (el) segmentRefs.current.set(si, el); else segmentRefs.current.delete(si); }}
                      onMouseUp={e => {
                        const selected = window.getSelection()?.toString().trim() ?? '';
                        if (selected.length < 2) return;
                        setSelectionPopover({ x: e.clientX, y: e.clientY, text: selected, segmentIndex: si });
                      }}
                    >
                      <p className="text-xs mb-0.5 select-text cursor-text">
                        <span className="text-[#71717a]">Segment {si + 1}:</span>{' '}
                        <span className="text-[#52525b]">{seg.query}</span>
                      </p>
                      <p className="text-xs text-orange-300/70 italic mb-2 select-text cursor-text">{seg.narrationExcerpt}</p>
                      {seg.images.length === 0 ? (
                        <p className="text-xs text-[#52525b] italic">No results found — try regenerating.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {seg.images.map((img, ii) => {
                            const imgKey = img.full || `real-image-${si}-${ii}`;
                            const isSaved = savedNames.has(imgKey);
                            const isNewImg = newImageKeys.has(img.full || img.thumb);
                            return (
                              <div
                                key={ii}
                                className="group relative rounded-md overflow-hidden border transition-all duration-700"
                                style={{
                                  borderColor: isSaved ? '#22c55e' : isNewImg ? '#f97316' : 'var(--border)',
                                  boxShadow: isNewImg ? '0 0 0 2px rgba(249,115,22,0.4)' : undefined,
                                }}
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

      {/* Selection image search popover */}
      {selectionPopover && (
        <div
          ref={popoverRef}
          className="fixed z-50 flex items-center gap-2 px-3 py-2 rounded-lg border shadow-xl text-xs font-medium"
          style={{
            left: Math.min(selectionPopover.x - 10, window.innerWidth - 280),
            top: selectionPopover.y - 52,
            background: 'var(--surface)',
            borderColor: searchingSelection ? '#f97316' : 'var(--border)',
            color: 'var(--text)',
            transition: 'border-color 0.2s',
          }}
        >
          {searchingSelection ? (
            <>
              <span className="animate-spin inline-block text-orange-400">⟳</span>
              <span className="text-orange-300">Searching for &ldquo;{selectionPopover.text.length > 24 ? selectionPopover.text.slice(0, 24) + '…' : selectionPopover.text}&rdquo;…</span>
            </>
          ) : (
            <>
              <span className="text-[#52525b]">🔍</span>
              <button
                onClick={() => searchImagesFromSelection(selectionPopover.text, selectionPopover.segmentIndex)}
                className="hover:text-orange-300 transition-colors"
              >
                Search images for &ldquo;{selectionPopover.text.length > 28 ? selectionPopover.text.slice(0, 28) + '…' : selectionPopover.text}&rdquo;
              </button>
            </>
          )}
        </div>
      )}

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
