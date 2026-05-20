'use client';

import { useState, useCallback } from 'react';
import type { Script, Analysis, DirectorScene, DirectorSegment, DirectorAsset, DirectorAssetType, StockPhoto, StockVideo, RealImage, VisualAssetMix } from '@/lib/types';
import { useStorage } from '@/components/StorageProvider';
import MediaUploadModal from '@/components/MediaUploadModal';

function ExpandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 4.5V1h3.5M7.5 1H11v3.5M11 7.5V11H7.5M4.5 11H1V7.5" />
    </svg>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASSET_LABELS: Record<DirectorAssetType, string> = {
  'ai-video':    'AI Video',
  'ai-image':    'AI Image',
  'stock-video': 'Stock Video',
  'stock-photo': 'Stock Photo',
  'real-image':  'Real Image',
};

const ASSET_ICONS: Record<DirectorAssetType, string> = {
  'ai-video':    '🎬',
  'ai-image':    '🖼️',
  'stock-video': '📹',
  'stock-photo': '📷',
  'real-image':  '🔍',
};

const ASSET_COLORS: Record<DirectorAssetType, string> = {
  'ai-video':    '#818cf8',
  'ai-image':    '#34d399',
  'stock-video': '#f59e0b',
  'stock-photo': '#e879f9',
  'real-image':  '#f87171',
};

const ALL_TYPES: DirectorAssetType[] = ['ai-video', 'ai-image', 'stock-video', 'stock-photo', 'real-image'];

function fmtDuration(s: number) {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  script: Script;
  analysis: Analysis | null;
  onScriptChange: (s: Script) => void;
  anthropicApiKey: string;
  pexelsApiKey?: string;
  braveApiKey?: string;
  realImageProvider?: 'brave' | 'duckduckgo';
}

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  segment,
  scene,
  script,
  analysis,
  anthropicApiKey,
  pexelsApiKey,
  braveApiKey,
  realImageProvider,
  visible,
  savingUrl,
  onUpdate,
  onSaveToScene,
  onLightbox,
  onVideoPlayer,
}: {
  asset: DirectorAsset;
  segment: DirectorSegment;
  scene: DirectorScene;
  script: Script;
  analysis: Analysis | null;
  anthropicApiKey: string;
  pexelsApiKey?: string;
  braveApiKey?: string;
  realImageProvider?: 'brave' | 'duckduckgo';
  visible: boolean;
  savingUrl: string | null;
  onUpdate: (updated: DirectorAsset) => void;
  onSaveToScene: (url: string, name: string, sceneId: string) => Promise<void>;
  onLightbox: (src: string, alt: string) => void;
  onVideoPlayer: (src: string, title: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const targetScene = script.scenes.find(s => s.id === scene.sceneId);
  const savedNames = new Set(targetScene?.directorMediaFiles?.map(f => f.originalName) ?? []);

  const isAI = asset.type === 'ai-video' || asset.type === 'ai-image';
  const clipCount = asset.type === 'ai-video'
    ? Math.ceil(segment.durationSeconds / (asset.durationEach ?? 8))
    : 1;

  const sceneData = script.scenes.find(s => s.id === scene.sceneId);

  const generate = async () => {
    if (!analysis) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/projects/${script.projectId}/scripts/${script.id}/director/generate-asset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetType: asset.type,
            narrationExcerpt: segment.narrationExcerpt,
            durationSeconds: segment.durationSeconds,
            durationEach: asset.durationEach,
            searchQuery: asset.searchQuery,
            directorNote: asset.rationale,
            sceneTitle: sceneData?.title ?? '',
            sceneDescription: sceneData?.sceneDescription ?? '',
            scriptTitle: script.title,
            analysis,
            visualStyle: script.visualStyle,
            characters: script.characters?.map(c => ({ name: c.name, fullDescription: c.fullDescription })),
            anthropicApiKey,
            pexelsApiKey,
            braveApiKey,
            realImageProvider,
          }),
        }
      );
      const data = await res.json() as {
        prompts?: string[];
        clipLabels?: ('CUT' | 'CONTINUOUS' | null)[];
        photos?: StockPhoto[];
        videos?: StockVideo[];
        images?: RealImage[];
        error?: string;
      };
      if (!res.ok || data.error) { setError(data.error ?? 'Generation failed'); return; }

      onUpdate({
        ...asset,
        generated: true,
        prompts: data.prompts ?? asset.prompts,
        clipLabels: data.clipLabels ?? asset.clipLabels,
        stockPhotos: data.photos ?? asset.stockPhotos,
        stockVideos: data.videos ?? asset.stockVideos,
        realImages: data.images ?? asset.realImages,
      });
      setExpanded(true);
    } catch {
      setError('Request failed');
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = (idx: number, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const copyAll = () => {
    if (asset.prompts.length === 0) return;
    navigator.clipboard.writeText(asset.prompts.join('\n\n')).then(() => {
      setCopied(-1);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  if (!visible) return null;

  const color = ASSET_COLORS[asset.type];
  const hasResults = asset.generated && (
    asset.prompts.length > 0 ||
    (asset.stockPhotos?.length ?? 0) > 0 ||
    (asset.stockVideos?.length ?? 0) > 0 ||
    (asset.realImages?.length ?? 0) > 0
  );

  return (
    <div
      className="rounded-lg border"
      style={{ borderColor: asset.generated ? color + '40' : 'var(--border)', background: 'var(--surface-2)' }}
    >
      {/* Asset header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Rank badge */}
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ background: color + '25', color }}
        >
          {asset.rank}
        </span>

        <span className="text-sm">{ASSET_ICONS[asset.type]}</span>
        <span className="text-xs font-medium flex-1">{ASSET_LABELS[asset.type]}</span>

        {asset.type === 'ai-video' && (
          <span className="text-[10px] text-[#52525b]">
            {clipCount}× {asset.durationEach ?? 8}s clip{clipCount > 1 ? 's' : ''}
          </span>
        )}

        {hasResults && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}

        {isAI && asset.prompts.length > 0 && (
          <button
            onClick={copyAll}
            className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1"
            style={copied === -1
              ? { background: '#0f1d0f', color: '#4ade80', border: '1px solid #4ade80' }
              : { background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46' }}
          >
            {copied === -1 ? '✓ Copied' : '⎘ Copy'}
          </button>
        )}

        <button
          onClick={generate}
          disabled={loading}
          className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
          style={asset.generated
            ? { background: color + '15', color, border: `1px solid ${color}40` }
            : { background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46' }}
        >
          {loading
            ? <><span className="animate-spin inline-block">⚡</span> {isAI ? 'Writing…' : 'Searching…'}</>
            : asset.generated
            ? '↺ Regen'
            : isAI ? '✨ Generate' : '🔍 Search'}
        </button>
      </div>

      {/* Rationale */}
      <div className="px-3 pb-2">
        <p className="text-[11px] text-[#52525b] leading-relaxed">{asset.rationale}</p>
        {asset.searchQuery && (
          <p className="text-[10px] text-[#3f3f46] mt-1">
            Search: <span className="text-[#52525b] font-mono">{asset.searchQuery}</span>
          </p>
        )}
        {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
      </div>

      {/* Results */}
      {hasResults && expanded && (
        <div className="border-t px-3 py-2 space-y-2" style={{ borderColor: 'var(--border)' }}>
          {/* AI prompts */}
          {asset.prompts.map((p, i) => {
            const label = asset.clipLabels?.[i] ?? null;
            return (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {asset.prompts.length > 1 && (
                    <p className="text-[10px] text-[#52525b]">Clip {i + 1} / {asset.prompts.length}</p>
                  )}
                  {label === 'CUT' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#1e3a5f', color: '#60a5fa' }}>✂ CUT</span>
                  )}
                  {label === 'CONTINUOUS' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#1a2e1a', color: '#86efac' }}>→ CONTINUOUS</span>
                  )}
                </div>
                <button
                  onClick={() => copyPrompt(i, p)}
                  className="text-[10px] px-2 py-0.5 rounded border transition-all"
                  style={copied === i
                    ? { color: '#4ade80', borderColor: '#4ade80', background: '#0f1d0f' }
                    : { color: '#52525b', borderColor: '#3f3f46', background: 'var(--surface)' }}
                >
                  {copied === i ? '✓ Copied' : '⎘ Copy'}
                </button>
              </div>
              <pre className="text-[11px] whitespace-pre-wrap leading-relaxed p-2 rounded text-[#a1a1aa]"
                style={{ background: 'var(--bg)' }}>
                {p}
              </pre>
            </div>
            );
          })}

          {/* Stock photos */}
          {(asset.stockPhotos?.length ?? 0) > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {asset.stockPhotos!.map(p => {
                const name = `pexels-photo-${p.id}.jpg`;
                const isSaved = savedNames.has(name);
                return (
                  <div key={p.id} className="group relative rounded-md overflow-hidden border transition-colors"
                    style={{ borderColor: isSaved ? '#22c55e' : 'var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.thumb} alt={p.alt} className="w-full aspect-video object-cover" />
                    {isSaved && (
                      <span className="absolute bottom-5 left-1 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium pointer-events-none">✓ Saved</span>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                      <button onClick={() => onSaveToScene(p.full, name, scene.sceneId)} disabled={savingUrl === p.full || isSaved}
                        className="text-[10px] px-2 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 w-full">
                        {savingUrl === p.full ? 'Saving…' : isSaved ? '✓ Saved' : '+ Save to Scene'}
                      </button>
                      <a href={p.pageUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white w-full text-center">Open ↗</a>
                    </div>
                    <button onClick={() => onLightbox(p.full, p.alt || '')}
                      className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80" title="View full size">
                      <ExpandIcon />
                    </button>
                    <p className="text-[9px] text-[#52525b] px-1 py-0.5 truncate">{p.photographer}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stock videos */}
          {(asset.stockVideos?.length ?? 0) > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {asset.stockVideos!.map(v => {
                const name = `pexels-video-${v.id}.mp4`;
                const isSaved = savedNames.has(name);
                return (
                  <div key={v.id} className="group relative rounded-md overflow-hidden border transition-colors"
                    style={{ borderColor: isSaved ? '#22c55e' : 'var(--border)' }}>
                    <button className="relative block w-full" onClick={() => onVideoPlayer(v.sdUrl, v.user)} title="Play video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.thumb} alt={v.user} className="w-full aspect-video object-cover" />
                      <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">{v.duration}s</span>
                      <span className="absolute inset-0 flex items-center justify-center text-2xl drop-shadow">▶</span>
                    </button>
                    {isSaved && (
                      <span className="absolute bottom-5 left-1 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium pointer-events-none">✓ Saved</span>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                      <button onClick={() => onVideoPlayer(v.sdUrl, v.user)}
                        className="text-[10px] px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-white w-full">▶ Play</button>
                      <button onClick={() => onSaveToScene(v.sdUrl, name, scene.sceneId)} disabled={savingUrl === v.sdUrl || isSaved}
                        className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 w-full">
                        {savingUrl === v.sdUrl ? 'Saving…' : isSaved ? '✓ Saved' : '+ Save to Scene'}
                      </button>
                      <a href={v.pageUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white w-full text-center">Open ↗</a>
                    </div>
                    <p className="text-[9px] text-[#52525b] px-1 py-0.5 truncate">{v.user}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Real images */}
          {(asset.realImages?.length ?? 0) > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {asset.realImages!.map((img, i) => {
                const imgKey = img.full || `real-${i}`;
                const isSaved = savedNames.has(imgKey);
                return (
                  <div key={i} className="group relative rounded-md overflow-hidden border transition-colors"
                    style={{ borderColor: isSaved ? '#22c55e' : 'var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.thumb} alt={img.title} className="w-full aspect-video object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    {isSaved && (
                      <span className="absolute bottom-5 left-1 z-10 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500 text-white font-medium pointer-events-none">✓ Saved</span>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                      <button onClick={() => onSaveToScene(img.full, imgKey, scene.sceneId)} disabled={savingUrl === img.full || isSaved}
                        className="text-[10px] px-2 py-1 rounded bg-orange-500 hover:bg-orange-400 text-white disabled:opacity-50 w-full">
                        {savingUrl === img.full ? 'Saving…' : isSaved ? '✓ Saved' : '+ Save to Scene'}
                      </button>
                      <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white w-full text-center">Source ↗</a>
                    </div>
                    <button onClick={() => onLightbox(img.full, img.title || '')}
                      className="absolute top-1 right-1 z-10 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80" title="View full size">
                      <ExpandIcon />
                    </button>
                    <p className="text-[9px] text-[#52525b] px-1 py-0.5 truncate">{img.title}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Segment card ─────────────────────────────────────────────────────────────

function SegmentCard({
  segment,
  scene,
  script,
  analysis,
  anthropicApiKey,
  pexelsApiKey,
  braveApiKey,
  realImageProvider,
  enabledTypes,
  savingUrl,
  onSegmentUpdate,
  onSaveToScene,
  onLightbox,
  onVideoPlayer,
}: {
  segment: DirectorSegment;
  scene: DirectorScene;
  script: Script;
  analysis: Analysis | null;
  anthropicApiKey: string;
  pexelsApiKey?: string;
  braveApiKey?: string;
  realImageProvider?: 'brave' | 'duckduckgo';
  enabledTypes: Set<DirectorAssetType>;
  savingUrl: string | null;
  onSegmentUpdate: (updated: DirectorSegment) => void;
  onSaveToScene: (url: string, name: string, sceneId: string) => Promise<void>;
  onLightbox: (src: string, alt: string) => void;
  onVideoPlayer: (src: string, title: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const updateAsset = useCallback((updatedAsset: DirectorAsset) => {
    onSegmentUpdate({
      ...segment,
      assets: segment.assets.map(a => a.id === updatedAsset.id ? updatedAsset : a),
    });
  }, [segment, onSegmentUpdate]);

  const visibleAssets = segment.assets.filter(a => enabledTypes.has(a.type));
  const generatedCount = segment.assets.filter(a => a.generated).length;
  const topAsset = segment.assets[0];

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      {/* Segment header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] mt-0.5 flex-shrink-0 text-[#52525b]">{open ? '▼' : '▶'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed text-[#a1a1aa]">{segment.narrationExcerpt}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-[#52525b]">{fmtDuration(segment.durationSeconds)}</span>
            {topAsset && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{ background: ASSET_COLORS[topAsset.type] + '20', color: ASSET_COLORS[topAsset.type] }}
              >
                {ASSET_ICONS[topAsset.type]} {ASSET_LABELS[topAsset.type]}
              </span>
            )}
            {generatedCount > 0 && (
              <span className="text-[9px] text-green-500">✓ {generatedCount} generated</span>
            )}
          </div>
        </div>
      </button>

      {/* Asset list */}
      {open && (
        <div className="border-t px-3 py-2.5 space-y-2" style={{ borderColor: 'var(--border)' }}>
          {visibleAssets.length === 0 ? (
            <p className="text-[11px] text-[#52525b]">No asset types enabled for this segment.</p>
          ) : (
            visibleAssets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                segment={segment}
                scene={scene}
                script={script}
                analysis={analysis}
                anthropicApiKey={anthropicApiKey}
                pexelsApiKey={pexelsApiKey}
                braveApiKey={braveApiKey}
                realImageProvider={realImageProvider}
                visible={enabledTypes.has(asset.type)}
                savingUrl={savingUrl}
                onUpdate={updateAsset}
                onSaveToScene={onSaveToScene}
                onLightbox={onLightbox}
                onVideoPlayer={onVideoPlayer}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main DirectorView ────────────────────────────────────────────────────────

export default function DirectorView({ script, analysis, onScriptChange, anthropicApiKey, pexelsApiKey, braveApiKey, realImageProvider }: Props) {
  const storage = useStorage();
  const [enabledTypes, setEnabledTypes] = useState<Set<DirectorAssetType>>(new Set(ALL_TYPES));
  const [showChart, setShowChart] = useState(false);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(
    script.directorPlan?.[0]?.sceneId ?? null
  );
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<{ src: string; title: string } | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [mediaModalSceneId, setMediaModalSceneId] = useState<string | null>(null);
  const [generatingAudioFor, setGeneratingAudioFor] = useState<string | null>(null);
  const [audioMsg, setAudioMsg] = useState<{ sceneId: string; text: string; ok: boolean } | null>(null);

  const saveToScene = useCallback(async (url: string, originalName: string, sceneId: string) => {
    setSavingUrl(url);
    try {
      const res = await fetch(
        `/api/projects/${script.projectId}/scripts/${script.id}/scenes/${sceneId}/media/download`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, originalName }) }
      );
      if (!res.ok) return;
      const ext = res.headers.get('X-Ext') ?? '.jpg';
      const filename = `${crypto.randomUUID()}${ext}`;
      const buffer = await res.arrayBuffer();
      const isVideo = ['.mp4', '.mov', '.webm'].includes(ext);
      const mediaFile = await storage.saveMediaFile(
        script.projectId, script.id, sceneId, filename, buffer, originalName, isVideo ? 'video' : 'image',
      );
      onScriptChange({
        ...script,
        scenes: script.scenes.map(s =>
          s.id === sceneId ? { ...s, directorMediaFiles: [...(s.directorMediaFiles ?? []), mediaFile] } : s
        ),
      });
    } finally {
      setSavingUrl(null);
    }
  }, [script, onScriptChange, storage]);

  const generateAudio = useCallback(async (sceneId: string, narration: string, sceneNumber: number) => {
    setGeneratingAudioFor(sceneId);
    setAudioMsg(null);
    try {
      const settings = await storage.getSettings();
      const res = await fetch(
        `/api/projects/${script.projectId}/scripts/${script.id}/scenes/${sceneId}/audio`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            narration,
            sceneNumber,
            elevenLabsApiKey:     settings.elevenLabsApiKey,
            elevenLabsVoiceId:    settings.elevenLabsVoiceId,
            elevenLabsSpeed:      settings.elevenLabsSpeed,
            elevenLabsStability:  settings.elevenLabsStability,
            elevenLabsSimilarity: settings.elevenLabsSimilarity,
            elevenLabsStyle:      settings.elevenLabsStyle,
          }),
        }
      );
      if (!res.ok) {
        const d = await res.json();
        setAudioMsg({ sceneId, text: d.error ?? 'Audio generation failed', ok: false });
        return;
      }
      const filename = res.headers.get('X-Filename') ?? `audio_scene_${String(sceneNumber).padStart(3, '0')}.mp3`;
      const buffer = await res.arrayBuffer();
      await storage.saveAudioFile(script.projectId, script.id, sceneId, filename, buffer);
      onScriptChange({ ...script, scenes: script.scenes.map(s => s.id === sceneId ? { ...s, audioFile: filename } : s) });
      setAudioMsg({ sceneId, text: `Saved: ${filename}`, ok: true });
    } catch {
      setAudioMsg({ sceneId, text: 'Audio generation failed', ok: false });
    } finally {
      setGeneratingAudioFor(null);
    }
  }, [script, onScriptChange, storage]);

  const toggleType = (type: DirectorAssetType) => {
    setEnabledTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) { if (next.size > 1) next.delete(type); }
      else next.add(type);
      return next;
    });
  };

  // Build a unified plan from either the new per-scene directorSegments (Option 2)
  // or the legacy script.directorPlan (Option 1 / older scripts), for backward compat.
  const plan: DirectorScene[] = script.scenes
    .filter(s => {
      const hasNew = (s.directorSegments?.length ?? 0) > 0;
      const hasLegacy = (script.directorPlan ?? []).some(dp => dp.sceneId === s.id);
      return hasNew || hasLegacy;
    })
    .map(s => {
      if ((s.directorSegments?.length ?? 0) > 0) {
        return { sceneId: s.id, segments: s.directorSegments! };
      }
      return script.directorPlan!.find(dp => dp.sceneId === s.id)!;
    });

  const updateSegment = useCallback((sceneId: string, updatedSegment: DirectorSegment) => {
    // Update in directorSegments (new) or directorPlan (legacy)
    const targetScene = script.scenes.find(s => s.id === sceneId);
    if (targetScene?.directorSegments) {
      onScriptChange({
        ...script,
        scenes: script.scenes.map(s =>
          s.id === sceneId
            ? { ...s, directorSegments: s.directorSegments!.map(seg => seg.id === updatedSegment.id ? updatedSegment : seg) }
            : s
        ),
      });
    } else {
      const newPlan = (script.directorPlan ?? []).map(s => {
        if (s.sceneId !== sceneId) return s;
        return { ...s, segments: s.segments.map(seg => seg.id === updatedSegment.id ? updatedSegment : seg) };
      });
      onScriptChange({ ...script, directorPlan: newPlan });
    }
  }, [script, onScriptChange]);

  if (plan.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#52525b] text-sm">
        No director plan available.
      </div>
    );
  }

  const activeScene = plan.find(s => s.sceneId === activeSceneId) ?? plan[0];
  const activeScriptScene = script.scenes.find(s => s.id === activeScene?.sceneId);

  const totalSegments = plan.reduce((n, s) => n + s.segments.length, 0);
  const totalGenerated = plan.reduce((n, s) => n + s.segments.reduce((m, seg) => m + seg.assets.filter(a => a.generated).length, 0), 0);

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Scene sidebar */}
      <div
        className="w-52 flex-shrink-0 border-r flex flex-col overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider">Scenes</p>
          <p className="text-[10px] text-[#3f3f46] mt-0.5">{totalSegments} segments · {totalGenerated} generated</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {plan.map((dirScene, i) => {
            const scriptScene = script.scenes.find(s => s.id === dirScene.sceneId);
            const genCount = dirScene.segments.reduce((n, seg) => n + seg.assets.filter(a => a.generated).length, 0);
            const isActive = dirScene.sceneId === activeScene?.sceneId;
            return (
              <button
                key={dirScene.sceneId}
                onClick={() => setActiveSceneId(dirScene.sceneId)}
                className={`w-full text-left px-3 py-2.5 group flex items-start gap-2 transition-colors border-l-2 ${
                  isActive ? 'bg-indigo-500/15 border-indigo-400' : 'hover:bg-[#1a1a1a] border-transparent'
                }`}
              >
                <span className="text-xs text-[#52525b] w-5 flex-shrink-0 pt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{scriptScene?.title ?? 'Scene'}</p>
                  <p className="text-[10px] text-[#52525b] mt-0.5">
                    {dirScene.segments.length} seg{dirScene.segments.length !== 1 ? 's' : ''}
                    {genCount > 0 && <span className="ml-1 text-green-500">·{genCount}✓</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 overflow-y-auto">
        {/* Toolbar */}
        <div
          className="sticky top-0 z-10 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="px-5 py-2.5 flex items-center gap-4">
            <p className="text-xs text-[#52525b] flex-shrink-0">Show:</p>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {ALL_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors"
                  style={enabledTypes.has(type)
                    ? { background: ASSET_COLORS[type] + '20', borderColor: ASSET_COLORS[type] + '60', color: ASSET_COLORS[type] }
                    : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-3)' }}
                >
                  {ASSET_ICONS[type]} {ASSET_LABELS[type]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowChart(v => !v)}
              title="Toggle asset distribution chart"
              className="text-[11px] px-2 py-0.5 rounded border transition-colors flex-shrink-0"
              style={showChart
                ? { background: '#27272a', color: '#a1a1aa', borderColor: '#52525b' }
                : { background: 'transparent', color: '#52525b', borderColor: '#3f3f46' }}
            >
              {showChart ? '▾ Hide chart' : '◈ Chart'}
            </button>
          </div>

          {/* Asset distribution charts */}
          {showChart && (() => {
            // ── Right chart: script mix from rank-1 assets ──
            const scriptCounts: Partial<Record<DirectorAssetType, number>> = {};
            let scriptTotal = 0;
            for (const dirScene of plan) {
              for (const seg of dirScene.segments) {
                const primary = seg.assets.find(a => a.rank === 1) ?? seg.assets[0];
                if (primary) {
                  scriptCounts[primary.type] = (scriptCounts[primary.type] ?? 0) + 1;
                  scriptTotal++;
                }
              }
            }

            function buildStops(pcts: Partial<Record<DirectorAssetType, number>>, total: number) {
              const types = ALL_TYPES.filter(t => (pcts[t] ?? 0) > 0);
              let cum = 0;
              return types.map(t => {
                const pct = ((pcts[t] ?? 0) / total) * 100;
                const start = cum;
                cum += pct;
                return { type: t, pct, start, end: cum };
              });
            }

            function PieChart({ stops, label, note }: {
              stops: { type: DirectorAssetType; pct: number; start: number; end: number }[];
              label: string;
              note: string;
            }) {
              const gradient = stops.length > 0
                ? stops.map(s => `${ASSET_COLORS[s.type]} ${s.start.toFixed(1)}% ${s.end.toFixed(1)}%`).join(', ')
                : '#3f3f46 0% 100%';
              return (
                <div className="flex-1 flex flex-col gap-2">
                  <p className="text-[10px] text-[#71717a] font-medium uppercase tracking-wide">{label}</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="flex-shrink-0 rounded-full"
                      style={{ width: 56, height: 56, background: `conic-gradient(${gradient})` }}
                    />
                    <div className="flex flex-col gap-0.5 flex-1">
                      {stops.length > 0 ? stops.map(({ type, pct }) => (
                        <div key={type} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ASSET_COLORS[type] }} />
                          <span className="text-[10px] text-[#a1a1aa] truncate">{ASSET_LABELS[type]}</span>
                          <span className="text-[10px] text-[#52525b] ml-auto">{Math.round(pct)}%</span>
                        </div>
                      )) : (
                        <p className="text-[10px] text-[#3f3f46] italic">{note}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // ── Left chart: channel mix from analysis ──
            const channelMix = analysis?.channelInsights?.visualAssetMix;
            const channelPcts: Partial<Record<DirectorAssetType, number>> = {};
            if (channelMix) {
              const total = (channelMix['ai-video'] + channelMix['ai-image'] + channelMix['stock-video'] + channelMix['stock-photo'] + channelMix['real-image']) || 100;
              for (const t of ALL_TYPES) channelPcts[t] = (channelMix[t] / total) * 100;
            }
            const channelStops = channelMix
              ? buildStops(channelPcts, 100)
              : [];

            const scriptStops = scriptTotal > 0 ? buildStops(scriptCounts, scriptTotal) : [];

            return (
              <div className="px-5 pb-4 pt-3 border-t flex items-start gap-4" style={{ borderColor: 'var(--border)' }}>
                <PieChart
                  stops={channelStops}
                  label="Channel's mix"
                  note="Re-run channel analysis to see channel mix"
                />
                <div className="w-px self-stretch" style={{ background: 'var(--border)' }} />
                <PieChart
                  stops={scriptStops}
                  label="This script"
                  note="No segments yet"
                />
              </div>
            );
          })()}
        </div>

        {/* Scene content */}
        {activeScene && (
          <div className="p-5 space-y-3">
            {/* Scene heading */}
            <div>
              <h2 className="text-sm font-semibold">{activeScriptScene?.title ?? 'Scene'}</h2>
              {activeScriptScene?.sceneDescription && (
                <p className="text-xs text-[#52525b] mt-0.5">{activeScriptScene.sceneDescription}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => activeScriptScene && generateAudio(activeScene.sceneId, activeScriptScene.narration, activeScriptScene.number)}
                disabled={generatingAudioFor === activeScene.sceneId || !activeScriptScene?.narration?.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#333] hover:border-[#555] hover:bg-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[#a1a1aa] hover:text-white"
              >
                {generatingAudioFor === activeScene.sceneId
                  ? <><span className="animate-pulse">🎵</span> Generating…</>
                  : <><span>🎵</span> Generate Audio</>}
              </button>
              <button
                onClick={() => setMediaModalSceneId(activeScene.sceneId)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#333] hover:border-[#555] hover:bg-[#1a1a1a] transition-colors text-[#a1a1aa] hover:text-white"
              >
                <span>📁</span> Media
                {((activeScriptScene?.directorMediaFiles?.length ?? 0) + (activeScriptScene?.audioFile ? 1 : 0)) > 0 && (
                  <span className="ml-0.5 bg-indigo-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">
                    {(activeScriptScene?.directorMediaFiles?.length ?? 0) + (activeScriptScene?.audioFile ? 1 : 0)}
                  </span>
                )}
              </button>
              {audioMsg?.sceneId === activeScene.sceneId && (
                <span className={`text-xs ${audioMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {audioMsg.ok ? `✓ ${audioMsg.text}` : audioMsg.text}
                </span>
              )}
              {activeScriptScene?.audioFile && audioMsg?.sceneId !== activeScene.sceneId && (
                <span className="text-xs text-green-400">🎵 {activeScriptScene.audioFile}</span>
              )}
            </div>

            {/* Narration */}
            {activeScriptScene?.narration && (
              <div
                className="rounded-lg border px-3 py-2.5 text-xs leading-relaxed text-[#71717a]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                {activeScriptScene.narration}
              </div>
            )}

            {/* Segments */}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-[#52525b] uppercase tracking-wider font-medium">
                {activeScene.segments.length} Visual Segment{activeScene.segments.length !== 1 ? 's' : ''}
              </p>
              {activeScene.segments.map(segment => (
                <SegmentCard
                  key={segment.id}
                  segment={segment}
                  scene={activeScene}
                  script={script}
                  analysis={analysis}
                  anthropicApiKey={anthropicApiKey}
                  pexelsApiKey={pexelsApiKey}
                  braveApiKey={braveApiKey}
                  realImageProvider={realImageProvider}
                  enabledTypes={enabledTypes}
                  savingUrl={savingUrl}
                  onSegmentUpdate={seg => updateSegment(activeScene.sceneId, seg)}
                  onSaveToScene={saveToScene}
                  onLightbox={(src, alt) => setLightbox({ src, alt })}
                  onVideoPlayer={(src, title) => setVideoPlayer({ src, title })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Director media modal */}
      {mediaModalSceneId && (() => {
        const ms = script.scenes.find(s => s.id === mediaModalSceneId);
        return ms ? (
          <MediaUploadModal
            projectId={script.projectId}
            scriptId={script.id}
            sceneId={mediaModalSceneId}
            sceneNumber={ms.number}
            script={script}
            onClose={() => setMediaModalSceneId(null)}
            onScriptChange={onScriptChange}
            mediaKey="directorMediaFiles"
          />
        ) : null;
      })()}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.src} alt={lightbox.alt} className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white text-xl leading-none">×</button>
        </div>
      )}

      {/* Video player */}
      {videoPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setVideoPlayer(null)}>
          <video src={videoPlayer.src} controls autoPlay className="max-w-[90vw] max-h-[90vh] rounded shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setVideoPlayer(null)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white text-xl leading-none">×</button>
        </div>
      )}
    </div>
  );
}
