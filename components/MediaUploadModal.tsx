'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MediaFile, Script } from '@/lib/types';
import { useStorage } from '@/components/StorageProvider';

interface Props {
  projectId: string;
  scriptId: string;
  sceneId: string;
  sceneNumber: number;
  script: Script;
  onClose: () => void;
  onScriptChange: (updated: Script) => void;
}

type Tab = 'image' | 'video' | 'audio';

export default function MediaUploadModal({
  projectId,
  scriptId,
  sceneId,
  sceneNumber,
  script,
  onClose,
  onScriptChange,
}: Props) {
  const storage = useStorage();
  const [tab, setTab] = useState<Tab>('image');
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [objectUrls, setObjectUrls] = useState<Record<string, string>>({});
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlRevokeRef = useRef<string[]>([]);

  const scene = script.scenes.find(s => s.id === sceneId);
  const mediaFiles: MediaFile[] = scene?.mediaFiles ?? [];
  const audioFile = scene?.audioFile;

  // Compute object URLs for all media files
  useEffect(() => {
    let cancelled = false;
    const newUrls: Record<string, string> = {};

    (async () => {
      for (const mf of mediaFiles) {
        if (objectUrls[mf.filename]) continue; // already computed
        const url = await storage.getMediaObjectUrl(projectId, scriptId, sceneId, mf.filename);
        if (url) newUrls[mf.filename] = url;
      }
      if (!cancelled && Object.keys(newUrls).length > 0) {
        urlRevokeRef.current.push(...Object.values(newUrls));
        setObjectUrls(prev => ({ ...prev, ...newUrls }));
      }
    })();

    return () => { cancelled = true; };
  }, [mediaFiles.map(f => f.filename).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Audio object URL
  useEffect(() => {
    if (tab !== 'audio' || !audioFile) { setAudioObjectUrl(null); return; }
    let cancelled = false;
    storage.getAudioObjectUrl(projectId, scriptId, sceneId, audioFile).then(url => {
      if (!cancelled) {
        if (url) urlRevokeRef.current.push(url);
        setAudioObjectUrl(url);
      }
    });
    return () => { cancelled = true; };
  }, [tab, audioFile, projectId, scriptId, sceneId, storage]);

  // Revoke all object URLs on unmount
  useEffect(() => {
    const toRevoke = urlRevokeRef.current;
    return () => { toRevoke.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  const updateScene = (patch: Partial<typeof scene>) => {
    const updated: Script = {
      ...script,
      scenes: script.scenes.map(s => s.id === sceneId ? { ...s, ...patch } : s),
      updatedAt: new Date().toISOString(),
    };
    onScriptChange(updated);
  };

  const upload = useCallback(async (fileList: FileList) => {
    setLoading(true);
    const uploaded: MediaFile[] = [];
    for (const file of Array.from(fileList)) {
      const extMatch = file.name.match(/(\.[^.]+)$/);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';
      const filename = `${crypto.randomUUID()}${ext}`;
      const buffer = await file.arrayBuffer();
      const isVideo = ['.mp4', '.mov', '.webm', '.avi'].includes(ext);
      const isAudio = ['.mp3', '.wav', '.m4a'].includes(ext);
      const type: MediaFile['type'] = isVideo ? 'video' : isAudio ? 'audio' : 'image';
      const mf = await storage.saveMediaFile(projectId, scriptId, sceneId, filename, buffer, file.name, type);
      const objUrl = URL.createObjectURL(new Blob([buffer], { type: file.type }));
      urlRevokeRef.current.push(objUrl);
      setObjectUrls(prev => ({ ...prev, [filename]: objUrl }));
      uploaded.push(mf);
    }
    updateScene({ mediaFiles: [...mediaFiles, ...uploaded] });
    setLoading(false);
  }, [storage, projectId, scriptId, sceneId, mediaFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteFile = async (filename: string) => {
    await storage.deleteMediaFile(projectId, scriptId, sceneId, filename);
    if (objectUrls[filename]) {
      URL.revokeObjectURL(objectUrls[filename]);
      setObjectUrls(prev => { const n = { ...prev }; delete n[filename]; return n; });
    }
    updateScene({ mediaFiles: mediaFiles.filter(f => f.filename !== filename) });
  };

  const deleteAudio = async () => {
    if (!audioFile) return;
    await storage.deleteAudioFile(projectId, scriptId, sceneId, audioFile);
    if (audioObjectUrl) { URL.revokeObjectURL(audioObjectUrl); setAudioObjectUrl(null); }
    updateScene({ audioFile: undefined });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  };

  const filteredFiles = mediaFiles
    .filter(f => (tab === 'audio' ? f.type === 'audio' : f.type === tab))
    .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());

  const accept =
    tab === 'image' ? 'image/*' :
    tab === 'video' ? 'video/*' :
    'audio/*,.mp3,.wav,.m4a';

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-4 py-2 text-sm rounded-md transition-colors ${
        tab === t ? 'bg-indigo-500 text-white' : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div
        className="w-full max-w-4xl rounded-xl border flex flex-col"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-base">Media — Scene {sceneNumber}</h2>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          {tabBtn('image', '🖼 Images')}
          {tabBtn('video', '🎬 Videos')}
          {tabBtn('audio', '🎵 Audio')}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Drop zone (not shown on audio tab since audio is generated, not uploaded) */}
          {tab !== 'audio' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer mb-6 transition-colors ${
                dragging ? 'border-indigo-400 bg-indigo-500/5' : 'border-[#333] hover:border-[#555]'
              }`}
            >
              <p className="text-2xl mb-2">{tab === 'image' ? '🖼' : '🎬'}</p>
              <p className="text-[#a1a1aa] text-sm">Drop files here or click to upload</p>
              <p className="text-[#52525b] text-xs mt-1">
                {tab === 'image' ? 'JPG, PNG, GIF, WebP' : 'MP4, MOV, WebM'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={accept}
                className="hidden"
                onChange={e => e.target.files && upload(e.target.files)}
              />
            </div>
          )}

          {loading && <p className="text-center text-[#a1a1aa] text-sm py-4">Uploading…</p>}

          {/* Audio section */}
          {tab === 'audio' && (
            <div className="mb-4">
              {audioFile ? (
                <div>
                  <p className="text-xs text-[#71717a] uppercase tracking-wider mb-2">Generated Audio</p>
                  <div className="p-3 rounded-lg border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base flex-shrink-0">🎵</span>
                      <p className="text-sm font-medium truncate flex-1">{audioFile}</p>
                      <button
                        onClick={deleteAudio}
                        title="Delete"
                        className="px-2 py-1 rounded text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 transition-colors flex-shrink-0"
                      >
                        🗑
                      </button>
                    </div>
                    {audioObjectUrl ? (
                      <audio controls src={audioObjectUrl} className="w-full h-8" />
                    ) : (
                      <p className="text-xs text-[#52525b]">Loading audio…</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-3xl mb-3">🎵</p>
                  <p className="text-[#a1a1aa] text-sm">No audio generated yet.</p>
                  <p className="text-[#52525b] text-xs mt-1">Use the Generate Audio button in the scene editor.</p>
                </div>
              )}
            </div>
          )}

          {/* Files grid */}
          {filteredFiles.length > 0 && tab !== 'audio' && (
            <div>
              <p className="text-xs text-[#71717a] uppercase tracking-wider mb-3">Uploaded Files</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    className="group relative rounded-lg border overflow-hidden"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}
                  >
                    {file.type === 'image' ? (
                      objectUrls[file.filename]
                        ? <img src={objectUrls[file.filename]} alt={file.originalName} className="w-full aspect-video object-cover" />
                        : <div className="w-full aspect-video bg-[#1a1a1a] flex items-center justify-center text-2xl">🖼</div>
                    ) : (
                      objectUrls[file.filename]
                        ? <video src={objectUrls[file.filename]} className="w-full aspect-video object-cover" />
                        : <div className="w-full aspect-video bg-[#1a1a1a] flex items-center justify-center text-2xl">🎬</div>
                    )}
                    <div className="p-2">
                      <p className="text-xs text-[#a1a1aa] truncate mb-1">{file.originalName}</p>
                      <div className="flex gap-1 justify-end">
                        {objectUrls[file.filename] && (
                          <>
                            <a
                              href={objectUrls[file.filename]}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open file"
                              className="flex-1 text-xs py-1 rounded transition-colors text-[#71717a] hover:text-white hover:bg-[#333] text-center"
                            >
                              ↗
                            </a>
                            <a
                              href={objectUrls[file.filename]}
                              download={file.originalName}
                              title="Download file"
                              className="flex-1 text-xs py-1 rounded transition-colors text-[#71717a] hover:text-white hover:bg-[#333] text-center"
                            >
                              ⬇
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => deleteFile(file.filename)}
                          title="Delete file"
                          className="px-2 py-1 rounded text-xs font-medium transition-colors text-red-500 hover:text-white hover:bg-red-500"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && filteredFiles.length === 0 && tab !== 'audio' && (
            <p className="text-center text-[#52525b] text-sm py-4">No {tab} files uploaded yet.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-xs text-[#52525b]" style={{ borderColor: 'var(--border)' }}>
          💡 Drop files to upload. Use <strong>↗ Open</strong> to view in a new tab, or <strong>⬇ Download</strong> to save locally.
        </div>
      </div>
    </div>
  );
}
