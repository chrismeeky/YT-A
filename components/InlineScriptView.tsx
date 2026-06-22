'use client';

import { useMemo, useState } from 'react';
import type { Script, Analysis, DirectorSegment } from '@/lib/types';
import SliceModal from '@/components/SliceModal';

// Two clearly contrasting alternating backgrounds
const SLICE_COLORS = [
  { bg: 'rgba(99,102,241,0.18)', border: 'rgba(99,102,241,0.45)', sup: '#818cf8' },  // indigo
  { bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.40)', sup: '#34d399' },  // emerald
] as const;

interface Props {
  script: Script;
  analysis: Analysis | null;
  anthropicApiKey: string;
  pexelsApiKey?: string;
  braveApiKey?: string;
  realImageProvider?: 'brave' | 'duckduckgo';
  onScriptChange: (s: Script) => void;
}

interface TextPart {
  text: string;
  sliceIndex?: number; // undefined = unsliced text
}

function buildParts(fullScript: string, slices: DirectorSegment[]): TextPart[] {
  type Range = { start: number; end: number; sliceIndex: number };
  const ranges: Range[] = [];

  for (let i = 0; i < slices.length; i++) {
    const excerpt = slices[i].narrationExcerpt;
    if (!excerpt) continue;
    const idx = fullScript.indexOf(excerpt);
    if (idx >= 0) ranges.push({ start: idx, end: idx + excerpt.length, sliceIndex: i });
  }
  ranges.sort((a, b) => a.start - b.start);

  const parts: TextPart[] = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) parts.push({ text: fullScript.slice(pos, r.start) });
    parts.push({ text: fullScript.slice(r.start, r.end), sliceIndex: r.sliceIndex });
    pos = r.end;
  }
  if (pos < fullScript.length) parts.push({ text: fullScript.slice(pos) });
  return parts;
}

export default function InlineScriptView({
  script,
  analysis,
  anthropicApiKey,
  pexelsApiKey,
  braveApiKey,
  realImageProvider,
  onScriptChange,
}: Props) {
  const [openSliceIndex, setOpenSliceIndex] = useState<number | null>(null);

  const fullScript = script.fullScript ?? '';
  const slices = script.scriptSlices ?? [];

  const parts = useMemo(() => buildParts(fullScript, slices), [fullScript, slices]);

  const updateSlice = (updated: DirectorSegment) => {
    const newSlices = slices.map(s => s.id === updated.id ? updated : s);
    onScriptChange({ ...script, scriptSlices: newSlices });
  };

  const openSlice = openSliceIndex !== null ? slices[openSliceIndex] : null;

  if (!fullScript) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[#52525b]">
        No script generated yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="max-w-3xl mx-auto">
        {slices.length === 0 ? (
          // No slices — plain prose
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
            {fullScript}
          </p>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {parts.map((part, i) => {
              if (part.sliceIndex === undefined) {
                return <span key={i} className="whitespace-pre-wrap">{part.text}</span>;
              }
              const color = SLICE_COLORS[part.sliceIndex % 2];
              const num = part.sliceIndex! + 1;
              return (
                <mark
                  key={i}
                  onClick={() => setOpenSliceIndex(part.sliceIndex!)}
                  className="cursor-pointer rounded-sm transition-opacity hover:opacity-75 whitespace-pre-wrap"
                  title={`Slice ${num} — click to manage assets`}
                  style={{
                    background: color.bg,
                    color: 'inherit',
                    outline: `1px solid ${color.border}`,
                    outlineOffset: '1px',
                  }}
                >
                  {part.text}<sup style={{ fontSize: '9px', fontWeight: 700, color: color.sup, marginLeft: '2px', userSelect: 'none' }}>{num}</sup>
                </mark>
              );
            })}
          </p>
        )}

        {slices.length > 0 && (
          <p className="mt-6 text-xs text-[#52525b]">
            {slices.length} slices · click any highlighted passage to manage its visual assets
          </p>
        )}
      </div>

      {openSlice && openSliceIndex !== null && (
        <SliceModal
          slice={openSlice}
          sliceIndex={openSliceIndex}
          script={script}
          analysis={analysis}
          anthropicApiKey={anthropicApiKey}
          pexelsApiKey={pexelsApiKey}
          braveApiKey={braveApiKey}
          realImageProvider={realImageProvider}
          onSliceUpdate={updateSlice}
          onClose={() => setOpenSliceIndex(null)}
        />
      )}
    </div>
  );
}
