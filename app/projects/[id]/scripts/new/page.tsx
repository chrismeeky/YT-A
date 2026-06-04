'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Analysis, Script, DirectorAssetType, DirectorSegment } from '@/lib/types';
import { useStorage } from '@/components/StorageProvider';
import { readSSE } from '@/lib/sse';

// ─── Per-scene refinement types ─────────────────────────────────────────────

type SceneRefineStatus = 'pending' | 'refining' | 'done' | 'approved' | 'error';
type SceneRefinementResult = { number: number; narration: string; directorSegments?: DirectorSegment[] };
type SceneRefineState = { status: SceneRefineStatus; result: SceneRefinementResult | null; error: string | null };

type ScriptDraft = {
  topic: string;
  additionalInstructions: string;
  suggestions: { topic: string; context: string }[];
  suggestionSeed: string | null;
  detailLevel: DetailLevelId;
  step: number;
};
const scriptDraftCache = new Map<string, ScriptDraft>();

type AssetMix = Record<DirectorAssetType, number>;

const ALL_ASSET_TYPES: DirectorAssetType[] = ['ai-video', 'ai-image', 'stock-video', 'stock-photo', 'real-image'];

const ASSET_MIX_LABELS: Record<DirectorAssetType, string> = {
  'ai-video':    'AI Video',
  'ai-image':    'AI Image',
  'stock-video': 'Stock Video',
  'stock-photo': 'Stock Photo',
  'real-image':  'Real Image',
};

const ASSET_MIX_COLORS: Record<DirectorAssetType, string> = {
  'ai-video':    '#818cf8',
  'ai-image':    '#34d399',
  'stock-video': '#f59e0b',
  'stock-photo': '#e879f9',
  'real-image':  '#f87171',
};

const EQUAL_MIX: AssetMix = { 'ai-video': 20, 'ai-image': 20, 'stock-video': 20, 'stock-photo': 20, 'real-image': 20 };

const DETAIL_LEVELS = [
  {
    id: 'restrained',
    label: 'Restrained',
    description: 'Broad strokes only. Events are acknowledged but not dwelt on — graphic elements are implied, not described.',
    instruction: 'Keep all descriptions high-level and restrained. Acknowledge events without dwelling on disturbing details. Graphic elements should be implied rather than described.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Clear and specific. Uses documented facts accurately without gratuitous detail.',
    instruction: 'Describe events clearly and specifically using all documented facts. Be accurate without being gratuitously graphic. Strike a balance between clarity and restraint.',
  },
  {
    id: 'detailed',
    label: 'Detailed',
    description: 'Thorough and precise. All known facts included — methods, evidence, timeline, scene specifics.',
    instruction: 'Be thorough and precise. Include all documented facts — specific methods, physical evidence, timelines, and scene descriptions. Do not invent details, but do not soften or omit what is known.',
  },
  {
    id: 'vivid',
    label: 'Vivid',
    description: 'Cinematic and immersive. Renders scenes with full sensory detail, unflinching where the story demands it.',
    instruction: 'Write with cinematic, sensory-rich detail. Render scenes fully and vividly using every documented fact available. Be unflinching — describe violence, crime scenes, and disturbing events graphically as the story warrants. Do not manufacture details, but treat all known information with maximum narrative intensity.',
  },
] as const;

type DetailLevelId = typeof DETAIL_LEVELS[number]['id'];

function getRecommendedDetailLevel(analysis: Analysis): DetailLevelId {
  const overview = (analysis.channelInsights.channelOverview ?? '').toLowerCase();
  const tone     = (analysis.channelInsights.contentStyle?.tone ?? '').toLowerCase();
  const voice    = (analysis.channelInsights.writingStyle?.voiceAndPersonality ?? '').toLowerCase();
  const nature   = analysis.channelInsights.contentNature?.classification ?? 'non-fictional';
  const combined = `${overview} ${tone} ${voice}`;

  if (/graphic|vivid|unflinch|brutal|raw|explicit|visceral|gore|harrowing|disturb/.test(combined)) return 'vivid';
  if (/detailed|thorough|deep.dive|forensic|in.depth|comprehensive|investigat|precise/.test(combined)) return 'detailed';
  if (/educational|family|kid|child|school|learn|young|wholesome/.test(combined)) return 'restrained';
  if (/dark|grim|somber|haunt|sinister|chill|suspens|gritty|crime|murder|killer/.test(combined)) return 'detailed';
  return nature === 'fictional' ? 'vivid' : 'balanced';
}

const STEP_LABELS = ['Topic', 'Story', 'Settings'];

export default function NewScriptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAnalysisId = searchParams.get('analysisId') ?? '';
  const storage = useStorage();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [form, setForm] = useState({
    analysisId: preselectedAnalysisId,
    topic: '',
    targetAudience: '',
    additionalInstructions: '',
    videoLength: 5,
    wpm: 150,
  });
  const [step, setStep] = useState(1);
  const [directorMode, setDirectorMode] = useState(false);
  const [assetMix, setAssetMix] = useState<AssetMix>({ ...EQUAL_MIX });

  const setMixValue = (type: DirectorAssetType, value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    const remaining = 100 - clamped;
    const others = ALL_ASSET_TYPES.filter(t => t !== type);
    const otherTotal = others.reduce((s, t) => s + assetMix[t], 0);
    const next: AssetMix = { ...assetMix, [type]: clamped };
    if (otherTotal === 0) {
      const each = Math.floor(remaining / others.length);
      others.forEach((t, i) => { next[t] = i === others.length - 1 ? remaining - each * (others.length - 1) : each; });
    } else {
      let distributed = 0;
      for (let i = 0; i < others.length - 1; i++) {
        next[others[i]] = Math.round((assetMix[others[i]] / otherTotal) * remaining);
        distributed += next[others[i]];
      }
      next[others[others.length - 1]] = remaining - distributed;
    }
    setAssetMix(next);
  };

  const resetMixToChannel = () => {
    const analysis = getAnalysis();
    const vm = analysis?.channelInsights?.visualAssetMix;
    if (vm) {
      setAssetMix({ 'ai-video': vm['ai-video'], 'ai-image': vm['ai-image'], 'stock-video': vm['stock-video'], 'stock-photo': vm['stock-photo'], 'real-image': vm['real-image'] });
    } else {
      setAssetMix({ ...EQUAL_MIX });
    }
  };

  const [loading, setLoading] = useState(false);
  const [waitingToRetry, setWaitingToRetry] = useState(false);
  const retryFnRef = useRef<(() => Promise<void>) | null>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // ── Per-scene refinement state ─────────────────────────────────────────────
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pass1Script, setPass1Script] = useState<Script | null>(null);
  const [refinementAnalysis, setRefinementAnalysis] = useState<Analysis | null>(null);
  const [refinementAssetMix, setRefinementAssetMix] = useState<AssetMix | null>(null);
  const [sceneRefineStates, setSceneRefineStates] = useState<SceneRefineState[]>([]);
  const [activeRefineIdx, setActiveRefineIdx] = useState(0);
  const [autoApprove, setAutoApprove] = useState(false);
  // refs so async callbacks always read latest values
  const pass1ScriptRef = useRef<Script | null>(null);
  const refinementAnalysisRef = useRef<Analysis | null>(null);
  const refinementAssetMixRef = useRef<AssetMix | null>(null);
  const autoApproveRef = useRef(false);
  const activeRefineIdxRef = useRef(0);
  const refiningScenesRef = useRef<Set<number>>(new Set());
  const savingRef = useRef(false);
  const sceneStatusesRef = useRef<SceneRefineStatus[]>([]);
  const refinementStartedRef = useRef(false);
  pass1ScriptRef.current = pass1Script;
  refinementAnalysisRef.current = refinementAnalysis;
  refinementAssetMixRef.current = refinementAssetMix;
  autoApproveRef.current = autoApprove;
  activeRefineIdxRef.current = activeRefineIdx;
  sceneStatusesRef.current = sceneRefineStates.map(s => s.status);
  const [suggestions, setSuggestions] = useState<{ topic: string; context: string }[]>([]);
  const [suggestionSeed, setSuggestionSeed] = useState<string | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState('');
  const [detailLevel, setDetailLevel] = useState<DetailLevelId>('balanced');
  const [contextMode, setContextMode] = useState<'manual' | 'url'>('manual');
  const [urls, setUrls] = useState<string[]>(['']);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractedSources, setExtractedSources] = useState<string[]>([]);

  const cacheKey = (analysisId: string) => `topic-suggestions:${analysisId}`;
  const draftKey = id;

  const loadCached = (analysisId: string) => {
    try {
      const raw = localStorage.getItem(cacheKey(analysisId));
      if (raw) { setSuggestions(JSON.parse(raw)); setSuggestionSeed(null); }
    } catch { /* ignore */ }
  };

  const saveCache = (analysisId: string, data: { topic: string; context: string }[]) => {
    try { localStorage.setItem(cacheKey(analysisId), JSON.stringify(data)); } catch { /* ignore */ }
  };

  // Restore draft from in-memory cache on mount
  useEffect(() => {
    const draft = scriptDraftCache.get(draftKey);
    if (!draft) return;
    if (draft.topic) setForm(f => ({ ...f, topic: draft.topic, additionalInstructions: draft.additionalInstructions }));
    if (draft.suggestions?.length) { setSuggestions(draft.suggestions); setSuggestionSeed(draft.suggestionSeed); }
    if (draft.detailLevel) setDetailLevel(draft.detailLevel);
    if (draft.step) setStep(draft.step);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set recommended detail level when analysis changes
  useEffect(() => {
    const analysis = getAnalysis();
    if (analysis) setDetailLevel(getRecommendedDetailLevel(analysis));
  }, [form.analysisId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist draft on every change
  useEffect(() => {
    scriptDraftCache.set(draftKey, {
      topic: form.topic, additionalInstructions: form.additionalInstructions,
      suggestions, suggestionSeed, detailLevel, step,
    });
  }, [form.topic, form.additionalInstructions, suggestions, suggestionSeed, detailLevel, step, draftKey]);

  useEffect(() => {
    const handleOnline = () => {
      const retry = retryFnRef.current;
      if (retry) {
        retryFnRef.current = null;
        setWaitingToRetry(false);
        void retry();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Warn before leaving while script is generating
  useEffect(() => {
    if (!loading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loading]);

  useEffect(() => {
    if (!loading) return;
    const message = 'Script generation is in progress. Leave this page? Progress will be lost.';

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || anchor.target === '_blank') return;
      e.preventDefault();
      e.stopPropagation();
      if (window.confirm(message)) router.push(href);
    };

    const handlePopState = () => {
      if (window.confirm(message)) {
        // allow back — nothing to restore
      } else {
        history.pushState(null, '', window.location.href);
      }
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [loading, router]);

  useEffect(() => {
    Promise.all([
      storage.listAnalyses(id),
      storage.getSettings(),
    ]).then(([a, s]) => {
      setAnalyses(Array.isArray(a) ? a : []);
      const resolvedAnalysisId = preselectedAnalysisId || (Array.isArray(a) && a[0]?.id) || '';
      setForm(f => ({
        ...f,
        videoLength: s.defaultVideoLength ?? 5,
        wpm: s.defaultWpm ?? 150,
        analysisId: resolvedAnalysisId,
      }));
      if (resolvedAnalysisId) {
        setSuggestions(prev => {
          if (prev.length === 0) loadCached(resolvedAnalysisId);
          return prev;
        });
      }
    });
  }, [id, storage]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetWords = Math.round(form.videoLength * form.wpm);

  const getAnalysis = () => analyses.find(a => a.id === form.analysisId) ?? null;

  const suggestTopics = async (seed?: string) => {
    const analysis = getAnalysis();
    if (!analysis) return;
    setLoadingTopics(true);
    setTopicsError('');
    setSuggestions([]);
    const trimmedSeed = seed?.trim() ?? '';
    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/scripts/suggest-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis, anthropicApiKey: settings.anthropicApiKey, ...(trimmedSeed ? { seedTopic: trimmedSeed } : {}) }),
      });
      const data = await res.json().catch(() => ({ error: 'Server error — check your API key in Settings or try again.' }));
      if (!res.ok) { setTopicsError(data.error ?? 'Unknown server error'); return; }
      const fetched = data.suggestions ?? [];
      setSuggestions(fetched);
      setSuggestionSeed(trimmedSeed || null);
      saveCache(form.analysisId, fetched);
    } catch {
      setTopicsError('Failed to generate topic ideas.');
    } finally {
      setLoadingTopics(false);
    }
  };

  const extractContext = async () => {
    const validUrls = urls.filter(u => u.trim());
    if (!validUrls.length) return;
    setExtracting(true);
    setExtractError('');
    setExtractWarnings([]);
    setExtractedSources([]);
    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/scripts/extract-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls, topic: form.topic || undefined, anthropicApiKey: settings.anthropicApiKey }),
      });
      const data = await res.json().catch(() => ({ error: 'Server error — check your API key in Settings or try again.' }));
      if (!res.ok) { setExtractError(data.error ?? 'Unknown server error'); return; }
      setForm(f => ({ ...f, additionalInstructions: data.context }));
      if (data.warnings?.length) setExtractWarnings(data.warnings);
      const failedUrls = new Set((data.warnings ?? []).map((w: string) => w.split(':')[0].trim()));
      setExtractedSources(validUrls.filter(u => !failedUrls.has(u)));
      setContextMode('manual');
    } catch {
      setExtractError('Failed to extract context from URLs.');
    } finally {
      setExtracting(false);
    }
  };

  // ── Refinement helpers ────────────────────────────────────────────────────

  const startRefineAtRef = useRef<((idx: number) => Promise<void>) | null>(null);

  const startRefineAt = async (idx: number) => {
    const script = pass1ScriptRef.current;
    const analysis = refinementAnalysisRef.current;
    if (!script || !analysis || idx >= script.scenes.length) return;
    // Use sceneStatusesRef (updated every render) for a synchronous pending check
    if (sceneStatusesRef.current[idx] !== 'pending') return;
    // Use the Set as a mutex — claim the slot before any await
    if (refiningScenesRef.current.has(idx)) return;
    refiningScenesRef.current.add(idx);
    setSceneRefineStates(prev => {
      const next = [...prev];
      next[idx] = { status: 'refining', result: null, error: null };
      return next;
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 110_000);
    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/scripts/refine-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          targetScene: script.scenes[idx],
          allScenes: script.scenes.map(s => ({ id: s.id, number: s.number, title: s.title, narration: s.narration, wordCount: s.wordCount })),
          analysis,
          topic: script.topic,
          settings: script.settings,
          directorMode: script.directorMode ?? false,
          ...(script.directorMode && refinementAssetMixRef.current ? { assetMixOverride: refinementAssetMixRef.current } : {}),
          anthropicApiKey: settings.anthropicApiKey,
        }),
      });
      const data = await res.json() as { number: number; narration: string; directorSegments?: DirectorSegment[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Scene refinement failed');

      const result: SceneRefinementResult = { number: data.number, narration: data.narration, directorSegments: data.directorSegments };

      if (autoApproveRef.current) {
        setSceneRefineStates(prev => {
          const next = [...prev]; next[idx] = { status: 'approved', result, error: null }; return next;
        });
        void startRefineAtRef.current?.(idx + 1);
      } else {
        setSceneRefineStates(prev => {
          const next = [...prev]; next[idx] = { status: 'done', result, error: null }; return next;
        });
        // Next scene starts only on explicit approve (strictly sequential, one at a time).
      }
    } catch (err) {
      const msg = err instanceof Error
        ? (err.name === 'AbortError' ? 'Timed out after 110s — Re-refine to retry' : err.message)
        : 'Refinement failed';
      setSceneRefineStates(prev => {
        const next = [...prev];
        next[idx] = { status: 'error', result: null, error: msg };
        return next;
      });
    } finally {
      clearTimeout(timeoutId);
      refiningScenesRef.current.delete(idx);
    }
  };
  startRefineAtRef.current = startRefineAt;

  const approveSceneAt = (idx: number) => {
    const script = pass1ScriptRef.current!;
    setSceneRefineStates(prev => {
      const next = [...prev];
      if (next[idx]?.status === 'done') next[idx] = { ...next[idx], status: 'approved' };
      return next;
    });
    const nextIdx = idx + 1;
    if (nextIdx < script.scenes.length) {
      setActiveRefineIdx(nextIdx);
      void startRefineAt(nextIdx);
    }
  };

  const reRefineAt = (idx: number) => {
    refiningScenesRef.current.delete(idx);
    setSceneRefineStates(prev => {
      const next = [...prev]; next[idx] = { status: 'pending', result: null, error: null }; return next;
    });
    void startRefineAt(idx);
  };

  // Effect: kick off the first scene's refinement once state is committed.
  // Using useEffect + guard ensures sceneRefineStates + sceneStatusesRef are populated
  // before the pending check inside startRefineAt runs. Strictly sequential (one at a time);
  // next only starts on approve (or auto-approve chain).
  useEffect(() => {
    if (!refining || sceneRefineStates.length === 0) return;
    if (refinementStartedRef.current) return;
    refinementStartedRef.current = true;
    void startRefineAt(0);
  }, [refining, sceneRefineStates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effect: auto-approve done scenes when toggle is switched on mid-flow
  useEffect(() => {
    if (!autoApprove || !refining) return;
    setSceneRefineStates(prev => {
      const anyDone = prev.some(s => s.status === 'done');
      if (!anyDone) return prev;
      return prev.map(s => s.status === 'done' ? { ...s, status: 'approved' } : s);
    });
  }, [autoApprove, refining]);

  // Effect: all scenes approved → build final script, save, redirect
  useEffect(() => {
    if (!refining || !pass1Script || sceneRefineStates.length === 0 || savingRef.current) return;
    if (!sceneRefineStates.every(s => s.status === 'approved')) return;
    savingRef.current = true;
    setSaving(true);
    void (async () => {
      const finalScript: Script = {
        ...pass1Script,
        scenes: pass1Script.scenes.map((scene, i) => {
          const r = sceneRefineStates[i]?.result;
          if (!r) return scene;
          return { ...scene, narration: r.narration, ...(r.directorSegments?.length ? { directorSegments: r.directorSegments } : {}) };
        }),
      };
      await storage.saveScript(id, finalScript);
      scriptDraftCache.delete(draftKey);
      router.push(`/projects/${id}/scripts/${finalScript.id}`);
    })();
  }, [sceneRefineStates, refining]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    const analysis = getAnalysis();
    if (!analysis || !form.topic.trim()) return;
    setLoading(true);
    setProgress('');
    setError('');
    setWaitingToRetry(false);

    const payload = {
      ...form,
      analysis,
      directorMode,
      skipPass2: true,
      detailLevel: DETAIL_LEVELS.find(l => l.id === detailLevel)?.instruction ?? '',
      ...(directorMode ? { assetMixOverride: assetMix } : {}),
    };

    const run = async () => {
      try {
        const settings = await storage.getSettings();
        const res = await fetch(`/api/projects/${id}/scripts/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, anthropicApiKey: settings.anthropicApiKey }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Server error — check your API key in Settings.' }));
          setError(data.error ?? 'Unknown server error');
          setLoading(false);
          return;
        }
        const data = await readSSE<Script>(res, setProgress);
        // Transition to per-scene voice refinement
        const chosenAnalysis = getAnalysis()!;
        setPass1Script(data);
        setRefinementAnalysis(chosenAnalysis);
        setRefinementAssetMix(directorMode ? { ...assetMix } : null);
        setSceneRefineStates(data.scenes.map(() => ({ status: 'pending' as const, result: null, error: null })));
        setActiveRefineIdx(0);
        setLoading(false);
        setRefining(true);
        // Kickoff of refinement is handled by the useEffect below (after state commits so statusesRef is populated).
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Script generation failed. Check your API key in Settings.';
        const isNetworkError = /failed to fetch|networkerror|load failed|network request failed/i.test(message);
        if (isNetworkError) {
          setWaitingToRetry(true);
          retryFnRef.current = run;
          return;
        }
        setError(message);
        setLoading(false);
      }
    };

    await run();
  };

  const inputClass = 'w-full rounded-lg px-4 py-3 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400';
  const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' };

  // ─── Step indicator ──────────────────────────────────────────────────────────
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {STEP_LABELS.map((label, i) => {
        const s = i + 1;
        const done = step > s;
        const active = step === s;
        return (
          <div key={s} className="flex items-center">
            <button
              type="button"
              onClick={() => { if (done) setStep(s); }}
              className={`flex items-center gap-2 ${done ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                active  ? 'bg-indigo-500 border-indigo-500 text-white' :
                done    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' :
                          'bg-transparent border-[#444] text-[#52525b]'
              }`}>
                {done ? '✓' : s}
              </span>
              <span className={`text-sm ${active ? 'text-white font-medium' : done ? 'text-indigo-300' : 'text-[#52525b]'}`}>
                {label}
              </span>
            </button>
            {s < STEP_LABELS.length && (
              <div className={`w-12 h-px mx-3 transition-colors ${step > s ? 'bg-indigo-500/40' : 'bg-[#333]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── Summary chips shown at top of later steps ────────────────────────────
  const TopicSummary = () => (
    step > 1 && form.topic ? (
      <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <span className="text-xs text-[#52525b]">Topic:</span>
        <span className="text-xs text-[#a1a1aa] truncate max-w-[360px]">{form.topic}</span>
      </div>
    ) : null
  );

  // ── Refinement derived values ─────────────────────────────────────────────
  const approvedCount = sceneRefineStates.filter(s => s.status === 'approved').length;
  const totalScenes = pass1Script?.scenes.length ?? 0;
  const activeSceneData = pass1Script?.scenes[activeRefineIdx] ?? null;
  const activeState = sceneRefineStates[activeRefineIdx] ?? null;

  const statusIcon = (s: SceneRefineStatus) => {
    if (s === 'approved') return <span className="text-green-400 text-xs">✓</span>;
    if (s === 'refining') return <span className="text-indigo-400 text-xs animate-spin inline-block">⟳</span>;
    if (s === 'done')     return <span className="text-amber-400 text-xs">●</span>;
    if (s === 'error')    return <span className="text-red-400 text-xs">✕</span>;
    return <span className="text-[#3f3f46] text-xs">○</span>;
  };

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-[#52525b] mb-8">
          <Link href={`/projects/${id}`} className="hover:text-white transition-colors">← Project</Link>
          <span>/</span>
          <span>New Script</span>
        </div>

        {!(saving || refining) && (
          <>
            <h1 className="text-2xl font-semibold mb-1">Generate Script</h1>
            <p className="text-[#71717a] text-sm mb-8">Claude will write a script modelled on the selected channel analysis.</p>
          </>
        )}
      </div>

      {saving ? (
        <div className="max-w-2xl mx-auto rounded-xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-4xl mb-4 animate-pulse">💾</div>
          <h2 className="font-semibold mb-2">Saving script…</h2>
          <p className="text-sm text-[#71717a]">All {totalScenes} scenes approved. Saving and opening editor.</p>
        </div>

      ) : refining && pass1Script ? (
        /* ── Per-scene refinement UI ─────────────────────────────────────── */
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold">Voice Refinement</h1>
              <p className="text-sm text-[#71717a] mt-0.5">
                {approvedCount} of {totalScenes} scenes approved
              </p>
            </div>
            {/* Auto-approve toggle */}
            <button
              type="button"
              onClick={() => setAutoApprove(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors"
              style={{ borderColor: autoApprove ? '#818cf8' : 'var(--border)', background: autoApprove ? 'rgba(99,102,241,0.1)' : 'var(--surface)' }}
            >
              <span style={{ position: 'relative', display: 'inline-block', width: 32, height: 16, borderRadius: 8, background: autoApprove ? '#6366f1' : '#374151', transition: 'background 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, left: autoApprove ? 16 : 2, width: 12, height: 12, borderRadius: 6, background: 'white', transition: 'left 0.2s' }} />
              </span>
              <span className={autoApprove ? 'text-indigo-300' : 'text-[#71717a]'}>Auto-approve all</span>
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 rounded-full mb-6" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: totalScenes ? `${(approvedCount / totalScenes) * 100}%` : '0%' }}
            />
          </div>

          {/* Body */}
          <div className="flex gap-4" style={{ minHeight: 520 }}>
            {/* Scene list sidebar */}
            <div className="w-44 flex-shrink-0 rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">Scenes</p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
                {pass1Script.scenes.map((scene, i) => {
                  const st = sceneRefineStates[i];
                  const isActive = i === activeRefineIdx;
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveRefineIdx(i);
                        if (st?.status === 'pending') void startRefineAt(i);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors border-l-2 ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-transparent hover:bg-white/5 text-[#a1a1aa]'
                      }`}
                    >
                      <span className="flex-shrink-0 w-4">{st ? statusIcon(st.status) : null}</span>
                      <span className="truncate">{scene.number}. {scene.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active scene panel */}
            <div className="flex-1 rounded-xl border overflow-hidden flex flex-col" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {activeSceneData && activeState ? (
                <>
                  {/* Scene header */}
                  <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p className="text-[10px] text-[#52525b] uppercase tracking-wider">Scene {activeSceneData.number} of {totalScenes}</p>
                      <p className="text-sm font-medium mt-0.5">{activeSceneData.title}</p>
                    </div>
                    {activeState.status === 'approved' && (
                      <span className="text-xs text-green-400 flex items-center gap-1">✓ Approved</span>
                    )}
                  </div>

                  {/* Content area */}
                  <div className="flex-1 overflow-y-auto p-5">
                    {activeState.status === 'pending' && (
                      <div className="h-full flex items-center justify-center text-[#52525b] text-sm">
                        Waiting to start…
                      </div>
                    )}

                    {activeState.status === 'refining' && (
                      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm">
                        <span className="text-3xl animate-spin inline-block">⟳</span>
                        <p className="text-[#71717a]">Matching voice to channel…</p>
                      </div>
                    )}

                    {(activeState.status === 'done' || activeState.status === 'approved' || activeState.status === 'error') && (
                      <div className="grid grid-cols-2 gap-4 h-full">
                        <div>
                          <p className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Original Draft</p>
                          <p className="text-sm text-[#a1a1aa] leading-relaxed whitespace-pre-wrap">{activeSceneData.narration}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium text-indigo-400 uppercase tracking-wider mb-2">Voice-Matched</p>
                          {activeState.status === 'error' ? (
                            <p className="text-sm text-red-400">{activeState.error}</p>
                          ) : (
                            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{activeState.result?.narration}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action bar */}
                  {(activeState.status === 'done' || activeState.status === 'error') && !autoApprove && (
                    <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => reRefineAt(activeRefineIdx)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm text-[#71717a] hover:text-white transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        ↺ Re-refine
                      </button>
                      {activeState.status === 'done' && (
                        <button
                          type="button"
                          onClick={() => approveSceneAt(activeRefineIdx)}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
                        >
                          {activeRefineIdx < totalScenes - 1 ? 'Approve → Next' : '✓ Approve & Save'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-[#52525b] text-sm">
                  Select a scene to review
                </div>
              )}
            </div>
          </div>
        </div>

      ) : loading ? (
        <div className="max-w-2xl mx-auto rounded-xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {waitingToRetry ? (
            <>
              <div className="text-4xl mb-4">📡</div>
              <h2 className="font-semibold mb-2">Connection lost</h2>
              <p className="text-sm text-[#71717a]">Waiting for internet to reconnect…</p>
              <p className="text-xs text-[#52525b] mt-2">Generation will resume automatically when you&apos;re back online.</p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-4 animate-pulse">
                {progress?.includes('director') ? '🎬' : '✍️'}
              </div>
              <h2 className="font-semibold mb-2">
                {progress?.includes('director') ? 'Directing production…' : 'Writing your script…'}
              </h2>
              <p className="text-sm text-[#71717a]">{progress || `Generating ~${targetWords} words across scenes…`}</p>
              <p className="text-xs text-[#52525b] mt-2">
                {directorMode ? 'Script + director plan — this takes 30–60 seconds' : 'This takes 20–40 seconds'}
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
        <form onSubmit={generate} className="space-y-5">
          <StepIndicator />

          {/* ── STEP 1: Channel + Topic + Angles ───────────────────────────── */}
          {step === 1 && (
            <>
              {/* Channel Analysis */}
              <div>
                <label className="block text-sm font-medium mb-2">Channel Analysis</label>
                <select
                  value={form.analysisId}
                  onChange={e => {
                    const newId = e.target.value;
                    setForm(f => ({ ...f, analysisId: newId }));
                    setSuggestions([]);
                    if (newId) loadCached(newId);
                  }}
                  required
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">Select an analysis…</option>
                  {analyses.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {analyses.length === 0 && (
                  <p className="text-xs text-[#52525b] mt-1">No analyses yet — run a channel analysis first.</p>
                )}
              </div>

              {/* Video Topic */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Video Topic *</label>
                  <button
                    type="button"
                    onClick={() => suggestTopics()}
                    disabled={!form.analysisId || loadingTopics}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-[#333] hover:border-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[#71717a]"
                  >
                    {loadingTopics ? (
                      <><span className="animate-spin inline-block">⚡</span> Generating…</>
                    ) : suggestions.length > 0 ? <>↺ Regenerate</> : <>✨ Suggest Topics</>}
                  </button>
                </div>

                <input
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                  required
                  className={inputClass}
                  style={inputStyle}
                  placeholder="e.g. How to start investing with $100"
                />

                {form.topic.trim().length >= 3 && form.analysisId && (
                  <button
                    type="button"
                    onClick={() => suggestTopics(form.topic)}
                    disabled={loadingTopics}
                    className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
                  >
                    {loadingTopics
                      ? <><span className="animate-spin inline-block">⚡</span> Generating variations…</>
                      : <>✨ Suggest variations of &ldquo;{form.topic.length > 40 ? form.topic.slice(0, 40) + '…' : form.topic}&rdquo;</>}
                  </button>
                )}

                {topicsError && <p className="text-xs text-red-400 mt-2">{topicsError}</p>}
                {suggestions.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-[#52525b]">
                      {suggestionSeed
                        ? <>Variations of &ldquo;{suggestionSeed}&rdquo; — click to use:</>
                        : <>Click a topic to use it — context will be prefilled:</>}
                    </p>
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, topic: s.topic, additionalInstructions: s.context }));
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          form.topic === s.topic
                            ? 'border-indigo-400 bg-indigo-500/10 text-white'
                            : 'border-[#333] hover:border-[#555] hover:bg-[#1a1a1a] text-[#a1a1aa] hover:text-white'
                        }`}
                      >
                        <span className="text-[#52525b] mr-2">{i + 1}.</span>{s.topic}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Step 1 nav */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!form.analysisId || !form.topic.trim()}
                  className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Tone + Story Context + Target Audience ──────────────── */}
          {step === 2 && (
            <>
              <TopicSummary />

              {/* Detail Level */}
              <div>
                <label className="block text-sm font-medium mb-1">Story Detail Level</label>
                <p className="text-xs text-[#52525b] mb-3">
                  Controls how graphic and descriptive the narration gets. Claude will never invent facts — it uses as much detail as the story allows.
                </p>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {DETAIL_LEVELS.map(level => {
                    const isSelected = detailLevel === level.id;
                    const isRecommended = form.analysisId ? getRecommendedDetailLevel(getAnalysis()!) === level.id : false;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setDetailLevel(level.id)}
                        className={`relative px-3 py-2.5 rounded-lg border text-center transition-colors ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-500/10'
                            : 'border-[#333] hover:border-[#555] hover:bg-[#1a1a1a]'
                        }`}
                      >
                        <p className={`text-sm font-medium ${isSelected ? 'text-indigo-300' : 'text-[#e4e4e7]'}`}>{level.label}</p>
                        {isRecommended && (
                          <span className="mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-medium leading-tight">
                            Channel style
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#52525b] leading-relaxed">
                  {DETAIL_LEVELS.find(l => l.id === detailLevel)?.description}
                </p>
              </div>

              {/* Story Context */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Story Context (optional)</label>
                  <div className="flex rounded-md overflow-hidden border text-xs" style={{ borderColor: 'var(--border)' }}>
                    {(['manual', 'url'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setContextMode(mode)}
                        className={`px-3 py-1.5 transition-colors ${
                          contextMode === mode ? 'bg-indigo-500 text-white' : 'text-[#71717a] hover:text-white'
                        }`}
                        style={contextMode !== mode ? { background: 'var(--surface-2)' } : {}}
                      >
                        {mode === 'manual' ? 'Write' : '🔗 From URLs'}
                      </button>
                    ))}
                  </div>
                </div>

                {contextMode === 'manual' ? (
                  <>
                    <p className="text-xs text-[#52525b] mb-2">
                      Add details that give the script writer context — names, locations, key dates, what happened, the outcome.
                    </p>
                    {extractedSources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="text-xs text-[#52525b]">Sources:</span>
                        {extractedSources.map((url, i) => {
                          let hostname = url;
                          try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
                          return (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-[#333] text-[#71717a] hover:text-indigo-300 hover:border-indigo-400/50 transition-colors">
                              🔗 {hostname}
                            </a>
                          );
                        })}
                      </div>
                    )}
                    <textarea
                      value={form.additionalInstructions}
                      onChange={e => { setForm(f => ({ ...f, additionalInstructions: e.target.value })); setExtractedSources([]); }}
                      rows={4}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="e.g. The story is about John Doe, a 34-year-old from Atlanta who turned $500 into $50k trading options in 2023…"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-xs text-[#52525b] mb-2">
                      Paste article or public page URLs. Claude will fetch and extract the relevant story details.
                    </p>
                    <p className="text-xs text-[#a1a1aa] mb-2">
                      Note: Some sites block automated requests. News articles and blogs tend to work best.
                    </p>
                    <div className="space-y-2">
                      {urls.map((url, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={url}
                            onChange={e => { const next = [...urls]; next[i] = e.target.value; setUrls(next); }}
                            className={inputClass}
                            style={inputStyle}
                            placeholder="https://en.wikipedia.org/wiki/…"
                            type="url"
                          />
                          {urls.length > 1 && (
                            <button type="button" onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                              className="px-3 rounded-lg border text-[#52525b] hover:text-red-400 hover:border-red-400/50 transition-colors flex-shrink-0"
                              style={{ borderColor: 'var(--border)' }}>
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center gap-3 pt-1">
                        <button type="button" onClick={() => setUrls([...urls, ''])}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                          + Add URL
                        </button>
                        <button type="button" onClick={extractContext}
                          disabled={extracting || !urls.some(u => u.trim())}
                          className="px-4 py-1.5 rounded-md text-xs font-medium bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5">
                          {extracting ? <><span className="animate-spin inline-block">⚡</span> Extracting…</> : '⚡ Extract Context'}
                        </button>
                      </div>
                      {extractError && <p className="text-xs text-red-400 whitespace-pre-wrap">{extractError}</p>}
                      {!extractError && extractWarnings.length > 0 && (
                        <div className="text-xs text-yellow-400/80 space-y-0.5">
                          <p className="font-medium">Some URLs could not be fetched:</p>
                          {extractWarnings.map((w, i) => <p key={i} className="text-yellow-400/60">• {w}</p>)}
                        </div>
                      )}
                    </div>
                    {!extractError && form.additionalInstructions && (
                      <div className="mt-3">
                        <p className="text-xs text-green-400 mb-1">✓ Context extracted — switch to Write to review or edit</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-medium mb-2">Target Audience (optional)</label>
                <input
                  value={form.targetAudience}
                  onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="e.g. Beginner investors aged 20–35"
                />
              </div>

              {/* Step 2 nav */}
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg border text-sm text-[#71717a] hover:text-white transition-colors"
                  style={{ borderColor: 'var(--border)' }}>
                  ← Back
                </button>
                <button type="button" onClick={() => setStep(3)}
                  className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors">
                  Continue →
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Settings + Director Mode + Generate ─────────────────── */}
          {step === 3 && (
            <>
              <TopicSummary />

              {/* Script Settings */}
              <div className="rounded-lg border p-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Script Settings</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#71717a] mb-1">Video Length (minutes)</label>
                    <input
                      type="number" min={1} max={60}
                      value={form.videoLength}
                      onChange={e => setForm(f => ({ ...f, videoLength: Number(e.target.value) }))}
                      className="w-full rounded-md px-3 py-2 text-sm border focus:border-indigo-400"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#71717a] mb-1">Narration Speed (WPM)</label>
                    <input
                      type="number" min={80} max={300}
                      value={form.wpm}
                      onChange={e => setForm(f => ({ ...f, wpm: Number(e.target.value) }))}
                      className="w-full rounded-md px-3 py-2 text-sm border focus:border-indigo-400"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    />
                  </div>
                </div>
                <p className="text-xs text-[#52525b]">
                  Target: ~<strong className="text-[#a1a1aa]">{targetWords.toLocaleString()} words</strong>{' '}
                  ({form.videoLength} min × {form.wpm} WPM)
                </p>
              </div>

              {/* Director Mode */}
              <div className="rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => { const next = !directorMode; setDirectorMode(next); if (next) resetMixToChannel(); }}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <div className={`mt-0.5 w-9 h-5 rounded-full flex-shrink-0 transition-colors relative ${directorMode ? 'bg-indigo-500' : 'bg-[#333]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${directorMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      🎬 Director Mode
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal">Beta</span>
                    </p>
                    <p className="text-xs text-[#52525b] mt-0.5 leading-relaxed">
                      AI acts as a director — breaks each scene into precise visual segments, ranks the best media type for each (video, image, stock), and auto-generates all prompts on demand.
                    </p>
                  </div>
                </button>

                {directorMode && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-[#71717a] uppercase tracking-wide">Asset Mix</p>
                      <button type="button" onClick={resetMixToChannel}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                        Reset to channel
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        {ALL_ASSET_TYPES.map(type => (
                          <div key={type} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ASSET_MIX_COLORS[type] }} />
                            <span className="text-xs text-[#71717a] w-[72px] flex-shrink-0">{ASSET_MIX_LABELS[type]}</span>
                            <input type="range" min={0} max={100} value={assetMix[type]}
                              onChange={e => setMixValue(type, Number(e.target.value))}
                              className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                              style={{ accentColor: ASSET_MIX_COLORS[type] }} />
                            <span className="text-xs text-[#a1a1aa] w-8 text-right flex-shrink-0">{assetMix[type]}%</span>
                          </div>
                        ))}
                      </div>
                      {(() => {
                        let cum = 0;
                        const stops = ALL_ASSET_TYPES.filter(t => assetMix[t] > 0).map(t => {
                          const start = cum; cum += assetMix[t];
                          return `${ASSET_MIX_COLORS[t]} ${start}% ${cum}%`;
                        });
                        return (
                          <div className="flex-shrink-0 rounded-full"
                            style={{ width: 52, height: 52, background: stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : '#3f3f46' }} />
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              {/* Step 3 nav */}
              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg border text-sm text-[#71717a] hover:text-white transition-colors"
                  style={{ borderColor: 'var(--border)' }}>
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={!form.analysisId || !form.topic.trim()}
                  className="px-6 py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  {directorMode ? '🎬 Generate Script + Director Plan →' : 'Generate Script →'}
                </button>
              </div>
            </>
          )}
        </form>
        </div>
      )}
    </div>
  );
}
