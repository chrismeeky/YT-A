'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { Script, CharacterSheet, DetectedCharacter } from '@/lib/types';

interface Props {
  script: Script;
  projectId: string;
  onClose: () => void;
  onSave: (characters: CharacterSheet[]) => void;
  onDetected: (detected: DetectedCharacter[]) => void;
  anthropicApiKey: string;
  visualStyle?: string;
}

type Mode = 'view' | 'generate' | 'from-image';

const FIELD_LABELS: Array<[keyof CharacterSheet, string]> = [
  ['age', 'Age'],
  ['gender', 'Gender'],
  ['ethnicity', 'Ethnicity'],
  ['height', 'Height'],
  ['build', 'Build'],
  ['hairColor', 'Hair Color'],
  ['hairStyle', 'Hair Style'],
  ['eyeColor', 'Eye Color'],
  ['skinTone', 'Skin Tone'],
  ['facialFeatures', 'Facial Features'],
  ['typicalOutfit', 'Typical Outfit'],
  ['styleNotes', 'Style Notes'],
];

function appearanceAdvisory(count: number): { label: string; color: string; advice: string } {
  if (count >= 10) return {
    label: 'Major character',
    color: 'text-green-400',
    advice: 'Appears frequently throughout the story. A character sheet is strongly recommended — visual consistency will have a significant impact across scenes.',
  };
  if (count >= 5) return {
    label: 'Recurring character',
    color: 'text-indigo-400',
    advice: 'Appears in multiple scenes. A character sheet is recommended to keep their look consistent wherever they show up.',
  };
  if (count >= 2) return {
    label: 'Supporting character',
    color: 'text-yellow-400',
    advice: 'Has a moderate presence. Worth generating a sheet if they have a distinctive appearance or emotionally significant role.',
  };
  return {
    label: 'Minor character',
    color: 'text-[#71717a]',
    advice: 'Appears only once or twice. A character sheet is optional — consider skipping unless their look is important to the story.',
  };
}

export default function CharacterConsistencyModal({ script, projectId, onClose, onSave, onDetected, anthropicApiKey, visualStyle }: Props) {
  const cached = script.detectedCharacters ?? [];
  const [detectedChars, setDetectedChars] = useState<DetectedCharacter[]>(cached);
  const [detecting, setDetecting] = useState(cached.length === 0);
  const [characters, setCharacters] = useState<CharacterSheet[]>(script.characters ?? []);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [customName, setCustomName] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);

  // Image upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mediaType: string; dataUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editing state for the full description
  const [editingDesc, setEditingDesc] = useState(false);

  const selectedSheet = characters.find(c => c.name === selectedName);

  const runDetection = useCallback(async (signal: AbortSignal) => {
    setDetecting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/${script.id}/characters/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: script.scenes.map(s => ({ narration: s.narration, title: s.title })),
          anthropicApiKey,
        }),
        signal,
      });
      if (signal.aborted) return;
      const data = await res.json() as { characters?: DetectedCharacter[] };
      if (data.characters?.length) {
        setDetectedChars(data.characters);
        setSelectedName(prev => prev ?? data.characters![0].name);
        onDetected(data.characters);
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
    } finally {
      if (!signal.aborted) setDetecting(false);
    }
  }, [projectId, script.id, script.scenes, anthropicApiKey, onDetected]); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: skip detection if cached results already exist
  useEffect(() => {
    if (cached.length > 0) {
      setSelectedName(prev => prev ?? cached[0]?.name ?? null);
      return;
    }
    const controller = new AbortController();
    runDetection(controller.signal);
    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const countMap = new Map(detectedChars.map(c => [c.name, c.count]));
  const allNames = Array.from(new Set([
    ...detectedChars.map(c => c.name),
    ...characters.map(c => c.name),
  ]));

  const handleSelectName = (name: string) => {
    setSelectedName(name);
    setMode('view');
    setError('');
    setUploadedImage(null);
    setEditingDesc(false);
  };

  const generateFromText = async (name: string) => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/${script.id}/characters/generate-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: name,
          scenes: script.scenes.map(s => ({ narration: s.narration, title: s.title })),
          scriptTopic: script.topic,
          visualStyle,
          anthropicApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sheet) {
        setError(data.error ?? 'Generation failed.');
        return;
      }
      const sheet: CharacterSheet = {
        id: uuid(),
        name,
        ...data.sheet,
        generatedFrom: 'text',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveSheet(sheet);
      setMode('view');
    } catch {
      setError('Failed to generate character sheet.');
    } finally {
      setGenerating(false);
    }
  };

  const generateFromImage = async (name: string) => {
    if (!uploadedImage) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/scripts/${script.id}/characters/sheet-from-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: name,
          imageBase64: uploadedImage.base64,
          mediaType: uploadedImage.mediaType,
          visualStyle,
          anthropicApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sheet) {
        setError(data.error ?? 'Image analysis failed.');
        return;
      }
      const sheet: CharacterSheet = {
        id: uuid(),
        name,
        ...data.sheet,
        generatedFrom: 'image',
        sourceThumbnail: uploadedImage.dataUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveSheet(sheet);
      setMode('view');
      setUploadedImage(null);
    } catch {
      setError('Failed to analyze image.');
    } finally {
      setGenerating(false);
    }
  };

  const saveSheet = useCallback((sheet: CharacterSheet) => {
    setCharacters(prev => {
      const without = prev.filter(c => c.name !== sheet.name);
      return [...without, sheet];
    });
  }, []);

  const updateSheetField = (field: keyof CharacterSheet, value: string) => {
    if (!selectedSheet) return;
    const updated: CharacterSheet = { ...selectedSheet, [field]: value, updatedAt: new Date().toISOString() };
    saveSheet(updated);
  };

  const deleteSheet = (name: string) => {
    setCharacters(prev => prev.filter(c => c.name !== name));
    if (selectedName === name) setSelectedName(allNames.find(n => n !== name) ?? null);
    setMode('view');
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      setUploadedImage({ base64, mediaType, dataUrl });
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  const inputClass = 'w-full rounded-md px-3 py-1.5 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400';
  const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="flex rounded-xl border overflow-hidden w-full max-w-4xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', height: '85vh', maxHeight: '700px' }}
      >
        {/* Sidebar */}
        <div
          className="w-56 flex-shrink-0 flex flex-col border-r"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#71717a]">Characters</span>
            {detecting
              ? <span className="text-[10px] text-[#52525b] animate-pulse">Detecting…</span>
              : <button
                  onClick={() => { const c = new AbortController(); runDetection(c.signal); }}
                  className="text-[10px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                  title="Re-run character detection"
                >
                  ↺ Re-detect
                </button>
            }
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {allNames.length === 0 && !detecting && (
              <p className="text-xs text-[#52525b] px-4 py-3">No characters detected. Add one manually.</p>
            )}
            {allNames.map(name => {
              const hasSheet = characters.some(c => c.name === name);
              const count = countMap.get(name);
              return (
                <button
                  key={name}
                  onClick={() => handleSelectName(name)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                    selectedName === name
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="truncate flex-1">{name}</span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    {count !== undefined && (
                      <span
                        className="text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--surface)', color: 'var(--text-2)' }}
                        title={`Appears ${count} time${count !== 1 ? 's' : ''} in the script`}
                      >
                        {count}
                      </span>
                    )}
                    {hasSheet && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Sheet saved" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Add custom character */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            {addingCustom ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customName.trim()) {
                      const name = customName.trim();
                      if (!allNames.includes(name)) setDetectedChars(p => [...p, { name, count: 0 }]);
                      setSelectedName(name);
                      setCustomName('');
                      setAddingCustom(false);
                    }
                    if (e.key === 'Escape') { setAddingCustom(false); setCustomName(''); }
                  }}
                  placeholder="Character name…"
                  className="w-full rounded-md px-2 py-1.5 text-xs border focus:border-indigo-400"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
                <p className="text-[10px] text-[#52525b]">Enter to add · Esc to cancel</p>
              </div>
            ) : (
              <button
                onClick={() => setAddingCustom(true)}
                className="w-full text-xs text-[#52525b] hover:text-[#a1a1aa] transition-colors text-left"
              >
                + Add character
              </button>
            )}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="font-semibold text-base">Character Consistency</h2>
              <p className="text-xs text-[#71717a] mt-0.5">
                {selectedName
                  ? selectedSheet
                    ? `Character sheet saved · Referenced in prompt generation`
                    : `No sheet yet for ${selectedName}`
                  : 'Select a character to get started'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { onSave(characters); onClose(); }}
                className="px-4 py-1.5 rounded-md text-sm bg-indigo-500 hover:bg-indigo-600 transition-colors font-medium"
              >
                Save & Close
              </button>
              <button
                onClick={onClose}
                className="text-[#52525b] hover:text-white transition-colors text-lg leading-none px-1"
              >
                ×
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedName ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[#52525b] text-sm">
                  {detecting ? 'Detecting characters from your script…' : 'Select a character from the sidebar'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Character name + actions */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedName}</h3>
                  <div className="flex items-center gap-2">
                    {selectedSheet && (
                      <>
                        <button
                          onClick={() => { setMode('generate'); setError(''); }}
                          className="px-3 py-1.5 rounded-md text-xs border transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444]"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          Regenerate
                        </button>
                        <button
                          onClick={() => deleteSheet(selectedName)}
                          className="px-3 py-1.5 rounded-md text-xs border transition-colors text-red-400 hover:text-red-300 border-red-900 hover:border-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Appearance count advisory */}
                {(() => {
                  const count = countMap.get(selectedName);
                  if (count === undefined) return null;
                  const { label, color, advice } = appearanceAdvisory(count);
                  return (
                    <div
                      className="rounded-lg border px-4 py-3 flex items-start gap-3"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${color}`}>{label}</span>
                          <span className="text-xs text-[#52525b]">·</span>
                          <span className="text-xs text-[#52525b]">
                            {count} appearance{count !== 1 ? 's' : ''} in the script
                          </span>
                        </div>
                        <p className="text-xs text-[#71717a] leading-relaxed">{advice}</p>
                      </div>
                    </div>
                  );
                })()}

                {error && (
                  <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* No sheet yet — show generation options */}
                {!selectedSheet && mode === 'view' && (
                  <div className="space-y-3">
                    <p className="text-sm text-[#71717a]">
                      Generate a character sheet to maintain visual consistency when creating image and video prompts.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { setMode('generate'); setError(''); }}
                        className="rounded-xl border p-5 text-left hover:border-indigo-500/50 transition-colors space-y-2"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                      >
                        <div className="text-2xl">✨</div>
                        <div className="font-medium text-sm">Generate from Script</div>
                        <div className="text-xs text-[#52525b]">
                          Claude reads the full script and infers the character's appearance from context.
                        </div>
                      </button>
                      <button
                        onClick={() => { setMode('from-image'); setError(''); }}
                        className="rounded-xl border p-5 text-left hover:border-indigo-500/50 transition-colors space-y-2"
                        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                      >
                        <div className="text-2xl">🖼️</div>
                        <div className="font-medium text-sm">Build from Image</div>
                        <div className="text-xs text-[#52525b]">
                          Upload a reference image and Claude extracts a precise visual description.
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* Generate from script */}
                {mode === 'generate' && (
                  <div
                    className="rounded-xl border p-5 space-y-4"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                  >
                    <p className="text-sm text-[#a1a1aa]">
                      Claude will analyze the script and generate a detailed visual description for <strong className="text-white">{selectedName}</strong> based on how they appear in the narration.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => generateFromText(selectedName)}
                        disabled={generating}
                        className="px-4 py-2 rounded-md text-sm bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
                      >
                        {generating ? <><span className="animate-pulse">⚡</span> Generating…</> : '⚡ Generate Sheet'}
                      </button>
                      <button
                        onClick={() => { setMode('view'); setError(''); }}
                        className="px-4 py-2 rounded-md text-sm border text-[#a1a1aa] hover:text-white transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Build from image */}
                {mode === 'from-image' && (
                  <div
                    className="rounded-xl border p-5 space-y-4"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                  >
                    <p className="text-sm text-[#a1a1aa]">
                      Upload a reference image of <strong className="text-white">{selectedName}</strong>. Claude will extract a detailed visual description from it.
                    </p>

                    {!uploadedImage ? (
                      <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                          dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'hover:border-[#555]'
                        }`}
                        style={{ borderColor: dragOver ? undefined : 'var(--border)' }}
                      >
                        <div className="text-3xl mb-2">📁</div>
                        <p className="text-sm text-[#a1a1aa]">Drop an image here or click to browse</p>
                        <p className="text-xs text-[#52525b] mt-1">JPEG, PNG, WebP, GIF</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-start gap-4">
                          <img
                            src={uploadedImage.dataUrl}
                            alt="Reference"
                            className="w-24 h-24 rounded-lg object-cover border flex-shrink-0"
                            style={{ borderColor: 'var(--border)' }}
                          />
                          <div className="flex-1 space-y-2">
                            <p className="text-sm text-[#a1a1aa]">Image ready. Click Generate to extract the character description.</p>
                            <button
                              onClick={() => { setUploadedImage(null); fileInputRef.current && (fileInputRef.current.value = ''); }}
                              className="text-xs text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                            >
                              Remove image
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => generateFromImage(selectedName)}
                        disabled={generating || !uploadedImage}
                        className="px-4 py-2 rounded-md text-sm bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
                      >
                        {generating ? <><span className="animate-pulse">⚡</span> Analyzing…</> : '⚡ Generate from Image'}
                      </button>
                      <button
                        onClick={() => { setMode('view'); setError(''); setUploadedImage(null); }}
                        className="px-4 py-2 rounded-md text-sm border text-[#a1a1aa] hover:text-white transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* View / edit saved sheet */}
                {selectedSheet && mode === 'view' && (
                  <div className="space-y-4">
                    {/* Source thumbnail */}
                    {selectedSheet.sourceThumbnail && (
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedSheet.sourceThumbnail}
                          alt="Reference"
                          className="w-16 h-16 rounded-lg object-cover border flex-shrink-0"
                          style={{ borderColor: 'var(--border)' }}
                        />
                        <span className="text-xs text-[#52525b]">Generated from uploaded image</span>
                      </div>
                    )}

                    {/* Full description */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-[#71717a] uppercase tracking-wider">
                          Full Description (used in prompts)
                        </label>
                        <button
                          onClick={() => setEditingDesc(v => !v)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {editingDesc ? 'Done' : 'Edit'}
                        </button>
                      </div>
                      {editingDesc ? (
                        <textarea
                          value={selectedSheet.fullDescription ?? ''}
                          onChange={e => updateSheetField('fullDescription', e.target.value)}
                          rows={4}
                          className="w-full rounded-lg px-3 py-2.5 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-y"
                          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                        />
                      ) : (
                        <div
                          className="rounded-lg border px-4 py-3 text-sm text-[#a1a1aa] leading-relaxed"
                          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                        >
                          {selectedSheet.fullDescription || <span className="text-[#52525b] italic">No description yet</span>}
                        </div>
                      )}
                    </div>

                    {/* Attribute grid */}
                    <div>
                      <label className="text-xs font-medium text-[#71717a] uppercase tracking-wider block mb-3">
                        Attributes
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {FIELD_LABELS.map(([field, label]) => (
                          <div key={field}>
                            <label className="block text-xs text-[#52525b] mb-1">{label}</label>
                            <input
                              value={(selectedSheet[field] as string) ?? ''}
                              onChange={e => updateSheetField(field, e.target.value)}
                              className={inputClass}
                              style={inputStyle}
                              placeholder={`—`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-[#52525b] pt-1">
                      Created from {selectedSheet.generatedFrom === 'image' ? 'image' : 'script'} ·
                      Updated {new Date(selectedSheet.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
