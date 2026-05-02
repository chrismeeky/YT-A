'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MediaFile } from '@/lib/types';

interface Props {
  projectId: string;
  scriptId: string;
  sceneId: string;
  sceneNumber: number;
  audioFile?: string;
  onClose: () => void;
  onFilesChanged: () => void;
}

type Tab = 'image' | 'video' | 'audio';

function CopyPathButton({ path }: { path: string | undefined }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!path) return null;
  const copy = () => {
    navigator.clipboard.writeText(path).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy file path"
      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
        copied ? 'text-green-400 bg-green-500/10' : 'text-[#71717a] hover:text-white hover:bg-[#333]'
      }`}
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

export default function MediaUploadModal({
  projectId,
  scriptId,
  sceneId,
  sceneNumber,
  audioFile,
  onClose,
  onFilesChanged,
}: Props) {
  const [tab, setTab] = useState<Tab>('image');
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [audioAbsolutePath, setAudioAbsolutePath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaBase = `/api/projects/${projectId}/scripts/${scriptId}/scenes/${sceneId}/media`;
  const audioBase = `/api/projects/${projectId}/scripts/${scriptId}/scenes/${sceneId}/audio`;

  const loadFiles = useCallback(async () => {
    const res = await fetch(mediaBase);
    if (res.ok) setFiles(await res.json());
  }, [mediaBase]);

  // Load on mount
  useState(() => { loadFiles(); });

  useEffect(() => {
    if (tab === 'audio' && audioFile) {
      fetch(audioBase).then(r => r.ok ? r.json() : null).then(data => {
        if (data?.absolutePath) setAudioAbsolutePath(data.absolutePath);
      });
    }
  }, [tab, audioFile, audioBase]);

  const upload = async (fileList: FileList) => {
    setLoading(true);
    const form = new FormData();
    Array.from(fileList).forEach(f => form.append('files', f));
    await fetch(mediaBase, { method: 'POST', body: form });
    await loadFiles();
    onFilesChanged();
    setLoading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
  };

  const deleteFile = async (filename: string) => {
    await fetch(`${mediaBase}/${filename}`, { method: 'DELETE' });
    await loadFiles();
    onFilesChanged();
  };

  const revealInFinder = async (filename: string) => {
    await fetch('/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, scriptId, sceneId, filename }),
    });
  };

  const revealAudioInFinder = async () => {
    if (!audioFile) return;
    await fetch('/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, scriptId, sceneId, filename: audioFile, type: 'audio' }),
    });
  };

  const filteredFiles = files
    .filter(f => (tab === 'audio' ? f.type === 'audio' : f.type === tab))
    .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());

  const accept =
    tab === 'image'
      ? 'image/*'
      : tab === 'video'
        ? 'video/*'
        : 'audio/*,.mp3,.wav,.m4a';

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-4 py-2 text-sm rounded-md transition-colors ${
        tab === t
          ? 'bg-indigo-500 text-white'
          : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
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
          <h2 className="font-semibold text-base">
            Media — Scene {sceneNumber}
          </h2>
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
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer mb-6 transition-colors ${
              dragging ? 'border-indigo-400 bg-indigo-500/5' : 'border-[#333] hover:border-[#555]'
            }`}
          >
            <p className="text-2xl mb-2">{tab === 'image' ? '🖼' : tab === 'video' ? '🎬' : '🎵'}</p>
            <p className="text-[#a1a1aa] text-sm">Drop files here or click to upload</p>
            <p className="text-[#52525b] text-xs mt-1">
              {tab === 'image' ? 'JPG, PNG, GIF, WebP' : tab === 'video' ? 'MP4, MOV, WebM' : 'MP3, WAV, M4A'}
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

          {loading && (
            <p className="text-center text-[#a1a1aa] text-sm py-4">Uploading…</p>
          )}

          {/* Audio section — show generated audio */}
          {tab === 'audio' && audioFile && (
            <div className="mb-4">
              <p className="text-xs text-[#71717a] uppercase tracking-wider mb-2">Generated Audio</p>
              <div
                className="p-3 rounded-lg border"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)' }}
              >
                {/* Filename + actions row */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base flex-shrink-0">🎵</span>
                  <p className="text-sm font-medium truncate flex-1">{audioFile}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={revealAudioInFinder}
                      title="Reveal in Finder"
                      className="px-2 py-1 rounded text-xs font-medium text-[#71717a] hover:text-white hover:bg-[#333] transition-colors"
                    >
                      📂 Finder
                    </button>
                    <a
                      href={`${audioBase}/${audioFile}`}
                      download={audioFile}
                      title="Download"
                      className="px-2 py-1 rounded text-xs font-medium text-[#71717a] hover:text-white hover:bg-[#333] transition-colors"
                    >
                      ⬇ Download
                    </a>
                    <CopyPathButton path={audioAbsolutePath ?? undefined} />
                    <button
                      onClick={async () => {
                        await fetch(`${audioBase}/${audioFile}`, { method: 'DELETE' });
                        onFilesChanged();
                      }}
                      title="Delete"
                      className="px-2 py-1 rounded text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 transition-colors"
                    >
                      🗑
                    </button>
                  </div>
                </div>
                {/* Audio player full width */}
                <audio
                  controls
                  src={`${audioBase}/${audioFile}`}
                  className="w-full h-8"
                />
              </div>
            </div>
          )}

          {/* Files grid */}
          {filteredFiles.length > 0 ? (
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
                      <img
                        src={`${mediaBase}/${file.filename}`}
                        alt={file.originalName}
                        className="w-full aspect-video object-cover"
                      />
                    ) : file.type === 'video' ? (
                      <video
                        src={`${mediaBase}/${file.filename}`}
                        className="w-full aspect-video object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-video flex items-center justify-center text-3xl">🎵</div>
                    )}
                    <div className="p-2">
                      <p className="text-xs text-[#a1a1aa] truncate mb-1">{file.originalName}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => revealInFinder(file.filename)}
                          title="Reveal in Finder — then drag to CapCut"
                          className="flex-1 text-xs py-1 rounded transition-colors text-[#71717a] hover:text-white hover:bg-[#333]"
                        >
                          📂
                        </button>
                        <a
                          href={`${mediaBase}/${file.filename}`}
                          download={file.originalName}
                          title="Download file"
                          className="flex-1 text-xs py-1 rounded transition-colors text-[#71717a] hover:text-white hover:bg-[#333] text-center"
                        >
                          ⬇
                        </a>
                        <CopyPathButton path={file.absolutePath} />
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
          ) : (
            !loading && (
              <p className="text-center text-[#52525b] text-sm py-4">
                No {tab} files uploaded yet.
              </p>
            )
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t text-xs text-[#52525b]" style={{ borderColor: 'var(--border)' }}>
          💡 Click <strong>📂 Finder</strong> to reveal the file in Finder, then drag it into CapCut. Or <strong>⬇ Download</strong> to save it locally.
        </div>
      </div>
    </div>
  );
}
