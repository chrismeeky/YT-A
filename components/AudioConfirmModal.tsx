'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  fullScript: string;
  totalWords: number;
  totalSeconds: number;
  onConfirm: (provider: 'elevenlabs' | 'cartesia') => void;
  onClose: () => void;
}

export default function AudioConfirmModal({ fullScript, totalWords, totalSeconds, onConfirm, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [provider, setProvider] = useState<'elevenlabs' | 'cartesia'>('elevenlabs');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!mounted) return null;

  const minutes = Math.round(totalSeconds / 60 * 10) / 10;
  const chars = fullScript.length;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="flex flex-col rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          width: '640px',
          maxWidth: '95vw',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-semibold">Generate Full Script Audio</p>
            <p className="text-xs text-[#52525b] mt-0.5">
              {totalWords.toLocaleString()} words · ~{minutes} min · {chars.toLocaleString()} characters
            </p>
          </div>
          <button onClick={onClose} className="text-[#52525b] hover:text-white transition-colors text-lg leading-none">×</button>
        </div>

        {/* Script preview */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-[#52525b] mb-2 uppercase tracking-wider font-medium">Script</p>
          <div
            className="rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
            style={{ background: 'var(--surface-2)', color: 'var(--text-2)', maxHeight: '300px', overflowY: 'auto' }}
          >
            {fullScript}
          </div>
        </div>

        {/* Provider selection + confirm */}
        <div className="px-5 py-4 border-t flex-shrink-0 space-y-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <p className="text-xs text-[#71717a] mr-1">Provider:</p>
            {(['elevenlabs', 'cartesia'] as const).map(p => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                  provider === p
                    ? 'bg-indigo-500/20 border-indigo-500/60 text-indigo-300'
                    : 'border-[#333] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#444]'
                }`}
              >
                {p === 'elevenlabs' ? 'ElevenLabs' : 'Cartesia'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { onConfirm(provider); onClose(); }}
              className="px-4 py-2 rounded-md text-sm font-medium bg-indigo-500 hover:bg-indigo-600 transition-colors"
            >
              Generate Audio
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm border transition-colors text-[#71717a] hover:text-white hover:border-[#444]"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
