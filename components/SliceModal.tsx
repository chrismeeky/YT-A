'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Script, Analysis, DirectorSegment, DirectorScene, MediaFile } from '@/lib/types';
import { SegmentCard } from '@/components/DirectorView';
import { useStorage } from '@/components/StorageProvider';

interface Props {
  slice: DirectorSegment;
  sliceIndex: number;
  script: Script;
  analysis: Analysis | null;
  anthropicApiKey: string;
  xaiApiKey?: string;
  llmProvider?: 'claude' | 'grok';
  pexelsApiKey?: string;
  braveApiKey?: string;
  realImageProvider?: 'brave' | 'duckduckgo';
  onSliceUpdate: (updated: DirectorSegment) => void;
  onClose: () => void;
}

// Fake DirectorScene — sceneId used only to look up scene metadata (title/description).
// Empty string gives undefined sceneData which is handled gracefully in AssetCard.
const EMPTY_SCENE: DirectorScene = { sceneId: '', segments: [] };

export default function SliceModal({
  slice,
  sliceIndex,
  script,
  analysis,
  anthropicApiKey,
  xaiApiKey,
  llmProvider,
  pexelsApiKey,
  braveApiKey,
  realImageProvider,
  onSliceUpdate,
  onClose,
}: Props) {
  const storage = useStorage();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<{ src: string; title: string } | null>(null);
  const [mediaObjectUrls, setMediaObjectUrls] = useState<Record<string, string>>({});
  const [draggingOver, setDraggingOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const urlRevokeRef = useRef<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sliceRef = useRef(slice);
  sliceRef.current = slice;

  useEffect(() => {
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  useEffect(() => {
    return () => { urlRevokeRef.current.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (lightbox || videoPlayer) { setLightbox(null); setVideoPlayer(null); } else { onClose(); } } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, lightbox, videoPlayer]);

  // Load object URLs for saved media files
  useEffect(() => {
    const files = slice.mediaFiles ?? [];
    if (files.length === 0) return;
    let cancelled = false;
    (async () => {
      const newUrls: Record<string, string> = {};
      for (const mf of files) {
        if (mediaObjectUrls[mf.filename]) continue;
        const url = await storage.getMediaObjectUrl(script.projectId, script.id, slice.id, mf.filename);
        if (url) newUrls[mf.filename] = url;
      }
      if (!cancelled && Object.keys(newUrls).length > 0) {
        urlRevokeRef.current.push(...Object.values(newUrls));
        setMediaObjectUrls(prev => ({ ...prev, ...newUrls }));
      }
    })();
    return () => { cancelled = true; };
  }, [(slice.mediaFiles ?? []).map(f => f.filename).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveToSlice = useCallback(async (url: string, originalName: string, _sceneId: string) => {
    setSavingUrl(url);
    try {
      const res = await fetch(
        `/api/projects/${script.projectId}/scripts/${script.id}/scenes/${sliceRef.current.id}/media/download`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, originalName }) },
      );
      if (!res.ok) return;
      const ext = res.headers.get('X-Ext') ?? '.jpg';
      const filename = `${crypto.randomUUID()}${ext}`;
      const buffer = await res.arrayBuffer();
      const isVideo = ['.mp4', '.mov', '.webm'].includes(ext);
      const mediaFile = await storage.saveMediaFile(
        script.projectId, script.id, sliceRef.current.id, filename, buffer, originalName, isVideo ? 'video' : 'image',
      );
      const current = sliceRef.current;
      onSliceUpdate({ ...current, mediaFiles: [...(current.mediaFiles ?? []), mediaFile] });
    } finally {
      setSavingUrl(null);
    }
  }, [script.projectId, script.id, storage, onSliceUpdate]);

  const deleteMedia = useCallback(async (mf: MediaFile) => {
    await storage.deleteMediaFile(script.projectId, script.id, slice.id, mf.filename);
    onSliceUpdate({ ...sliceRef.current, mediaFiles: (sliceRef.current.mediaFiles ?? []).filter(f => f.filename !== mf.filename) });
    if (mediaObjectUrls[mf.filename]) URL.revokeObjectURL(mediaObjectUrls[mf.filename]);
    setMediaObjectUrls(prev => { const n = { ...prev }; delete n[mf.filename]; return n; });
  }, [script.projectId, script.id, slice.id, storage, onSliceUpdate, mediaObjectUrls]);

  const uploadLocalFiles = useCallback(async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (accepted.length === 0) return;
    setUploadingFiles(true);
    try {
      for (const file of accepted) {
        const ext = '.' + (file.name.split('.').pop() ?? 'jpg');
        const filename = `${crypto.randomUUID()}${ext}`;
        const buffer = await file.arrayBuffer();
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        const mediaFile = await storage.saveMediaFile(
          script.projectId, script.id, sliceRef.current.id, filename, buffer, file.name, type,
        );
        const objUrl = URL.createObjectURL(new Blob([buffer], { type: file.type }));
        urlRevokeRef.current.push(objUrl);
        setMediaObjectUrls(prev => ({ ...prev, [filename]: objUrl }));
        onSliceUpdate({ ...sliceRef.current, mediaFiles: [...(sliceRef.current.mediaFiles ?? []), mediaFile] });
      }
    } finally {
      setUploadingFiles(false);
    }
  }, [script.projectId, script.id, storage, onSliceUpdate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files.length > 0) uploadLocalFiles(e.dataTransfer.files);
  }, [uploadLocalFiles]);

  if (!mounted) return null;

  const words = slice.narrationExcerpt.trim().split(/\s+/).filter(Boolean).length;
  const mediaFiles = slice.mediaFiles ?? [];
  const SLICE_COLORS = [
    { bg: 'rgba(99,102,241,0.18)', color: '#818cf8' },
    { bg: 'rgba(16,185,129,0.14)', color: '#34d399' },
  ] as const;
  const chipColor = SLICE_COLORS[sliceIndex % 2];

  return createPortal(
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
        style={{ background: 'rgba(0,0,0,0.75)', opacity: visible ? 1 : 0 }}
        onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      >
        <div
          className="flex flex-col rounded-xl border shadow-2xl overflow-hidden transition-all duration-200"
          style={{
            background: 'var(--surface)',
            borderColor: draggingOver ? '#818cf8' : 'var(--border)',
            width: '700px',
            maxWidth: '95vw',
            maxHeight: '88vh',
            boxShadow: draggingOver ? '0 0 0 2px #818cf8' : undefined,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
            opacity: visible ? 1 : 0,
          }}
          onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingOver(false); }}
          onDrop={handleDrop}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold" style={{ background: chipColor.bg, color: chipColor.color }}>
                Slice {sliceIndex + 1}
              </span>
              <span className="text-xs text-[#52525b]">{words}w · ~{slice.durationSeconds}s</span>
            </div>
            <button onClick={onClose} className="text-[#52525b] hover:text-white transition-colors text-lg leading-none">×</button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Assets */}
            <div className="p-4">
              <SegmentCard
                segment={slice}
                scene={EMPTY_SCENE}
                script={script}
                analysis={analysis}
                anthropicApiKey={anthropicApiKey}
                xaiApiKey={xaiApiKey}
                llmProvider={llmProvider}
                pexelsApiKey={pexelsApiKey}
                braveApiKey={braveApiKey}
                realImageProvider={realImageProvider}
                savingUrl={savingUrl}
                initialOpen={true}
                onSegmentUpdate={onSliceUpdate}
                onSaveToScene={saveToSlice}
                onLightbox={(src, alt) => setLightbox({ src, alt })}
                onVideoPlayer={(src, title) => setVideoPlayer({ src, title })}
              />
            </div>

            {/* Saved media folder */}
            <div className="px-4 pb-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">
                  {uploadingFiles ? 'Uploading…' : mediaFiles.length > 0 ? `Saved to Slice — ${mediaFiles.length} file${mediaFiles.length !== 1 ? 's' : ''}` : 'Media Folder'}
                </p>
                <label className="cursor-pointer text-xs text-[#71717a] hover:text-white transition-colors border rounded px-2 py-0.5" style={{ borderColor: 'var(--border)' }}>
                  + Upload
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { if (e.target.files) uploadLocalFiles(e.target.files); e.target.value = ''; }} />
                </label>
              </div>
              {mediaFiles.length === 0 && !uploadingFiles && (
                <div className="flex items-center justify-center rounded-lg border border-dashed py-6 text-xs text-[#52525b]" style={{ borderColor: 'var(--border)' }}>
                  Drop images or videos here, or click Upload
                </div>
              )}
              {mediaFiles.length > 0 && <div className="grid grid-cols-4 gap-2 mt-2">
                  {mediaFiles.map(mf => {
                    const objUrl = mediaObjectUrls[mf.filename];
                    return (
                      <div key={mf.filename} className="relative group rounded-md overflow-hidden border aspect-video bg-[#111]" style={{ borderColor: 'var(--border)' }}>
                        {mf.type === 'video' ? (
                          objUrl
                            ? <video src={objUrl} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-[#52525b] text-xs">Video</div>
                        ) : (
                          objUrl
                            /* eslint-disable-next-line @next/next/no-img-element */
                            ? <img src={objUrl} alt={mf.originalName} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-[#52525b] text-xs">Image</div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                          {mf.type === 'video' && objUrl && (
                            <button onClick={() => setVideoPlayer({ src: objUrl, title: mf.originalName })} className="text-xs text-white bg-white/20 rounded px-2 py-0.5 hover:bg-white/30">▶ Play</button>
                          )}
                          {mf.type === 'image' && objUrl && (
                            <button onClick={() => setLightbox({ src: objUrl, alt: mf.originalName })} className="text-xs text-white bg-white/20 rounded px-2 py-0.5 hover:bg-white/30">View</button>
                          )}
                          {objUrl && (
                            <a href={objUrl} download={mf.originalName} className="text-xs text-white bg-white/20 rounded px-2 py-0.5 hover:bg-white/30" onClick={e => e.stopPropagation()}>↓ Download</a>
                          )}
                          <button onClick={() => deleteMedia(mf)} className="text-xs text-red-400 bg-white/10 rounded px-2 py-0.5 hover:bg-white/20">Delete</button>
                        </div>
                        <p className="absolute bottom-0 left-0 right-0 text-[9px] text-white/60 truncate px-1 pb-0.5 bg-gradient-to-t from-black/60">{mf.originalName}</p>
                      </div>
                    );
                  })}
                </div>}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.src} alt={lightbox.alt} className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white text-xl leading-none">×</button>
        </div>
      )}

      {/* Video player */}
      {videoPlayer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setVideoPlayer(null)}>
          <video src={videoPlayer.src} controls autoPlay className="max-w-[90vw] max-h-[90vh] rounded shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setVideoPlayer(null)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white text-xl leading-none">×</button>
        </div>
      )}
    </>,
    document.body,
  );
}
