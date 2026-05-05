'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Analysis, Script } from '@/lib/types';
import { useStorage } from '@/components/StorageProvider';
import { readSSE } from '@/lib/sse';

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
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<{ topic: string; context: string }[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState('');
  const [contextMode, setContextMode] = useState<'manual' | 'url'>('manual');
  const [urls, setUrls] = useState<string[]>(['']);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [extractedSources, setExtractedSources] = useState<string[]>([]);

  const cacheKey = (analysisId: string) => `topic-suggestions:${analysisId}`;

  const loadCached = (analysisId: string) => {
    try {
      const raw = localStorage.getItem(cacheKey(analysisId));
      if (raw) setSuggestions(JSON.parse(raw));
    } catch { /* ignore */ }
  };

  const saveCache = (analysisId: string, data: { topic: string; context: string }[]) => {
    try {
      localStorage.setItem(cacheKey(analysisId), JSON.stringify(data));
    } catch { /* ignore */ }
  };

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
      if (resolvedAnalysisId) loadCached(resolvedAnalysisId);
    });
  }, [id, storage]); // eslint-disable-line react-hooks/exhaustive-deps

  const targetWords = Math.round(form.videoLength * form.wpm);

  const getAnalysis = () => analyses.find(a => a.id === form.analysisId) ?? null;

  const suggestTopics = async () => {
    const analysis = getAnalysis();
    if (!analysis) return;
    setLoadingTopics(true);
    setTopicsError('');
    setSuggestions([]);
    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/scripts/suggest-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis,
          anthropicApiKey: settings.anthropicApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setTopicsError(data.error); return; }
      const fetched = data.suggestions ?? [];
      setSuggestions(fetched);
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
        body: JSON.stringify({
          urls: validUrls,
          topic: form.topic || undefined,
          anthropicApiKey: settings.anthropicApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setExtractError(data.error); return; }
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

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    const analysis = getAnalysis();
    if (!analysis || !form.topic.trim()) return;
    setLoading(true);
    setProgress('');
    setError('');
    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/scripts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          analysis,
          anthropicApiKey: settings.anthropicApiKey,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        setLoading(false);
        return;
      }
      const data = await readSSE<Script>(res, setProgress);
      await storage.saveScript(id, data);
      router.push(`/projects/${id}/scripts/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script generation failed. Check your API key in Settings.');
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg px-4 py-3 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400';
  const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-[#52525b] mb-8">
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">← Project</Link>
        <span>/</span>
        <span>New Script</span>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Generate Script</h1>
      <p className="text-[#71717a] text-sm mb-8">Claude will write a script modelled on the selected channel analysis.</p>

      {loading ? (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-4xl mb-4 animate-pulse">✍️</div>
          <h2 className="font-semibold mb-2">Writing your script…</h2>
          <p className="text-sm text-[#71717a]">{progress || `Generating ~${targetWords} words across scenes…`}</p>
          <p className="text-xs text-[#52525b] mt-2">This takes 30–60 seconds</p>
        </div>
      ) : (
        <form onSubmit={generate} className="space-y-5">
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
                onClick={suggestTopics}
                disabled={!form.analysisId || loadingTopics}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-[#333] hover:border-indigo-400 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[#71717a]"
              >
                {loadingTopics ? (
                  <><span className="animate-spin inline-block">⚡</span> Generating…</>
                ) : suggestions.length > 0 ? (
                  <>↺ Regenerate</>
                ) : (
                  <>✨ Suggest Topics</>
                )}
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

            {topicsError && <p className="text-xs text-red-400 mt-2">{topicsError}</p>}
            {suggestions.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-xs text-[#52525b]">Click a topic to use it — context will be prefilled:</p>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, topic: s.topic, additionalInstructions: s.context }))}
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
                      contextMode === mode
                        ? 'bg-indigo-500 text-white'
                        : 'text-[#71717a] hover:text-white'
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
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-[#333] text-[#71717a] hover:text-indigo-300 hover:border-indigo-400/50 transition-colors"
                        >
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
                  Note: Some sitesAnalyze channels and generate scripts block automated requests and may not work. News articles and blogs tend to work best.
                </p>
                <div className="space-y-2">
                  {urls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={url}
                        onChange={e => {
                          const next = [...urls];
                          next[i] = e.target.value;
                          setUrls(next);
                        }}
                        className={inputClass}
                        style={inputStyle}
                        placeholder="https://en.wikipedia.org/wiki/…"
                        type="url"
                      />
                      {urls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                          className="px-3 rounded-lg border text-[#52525b] hover:text-red-400 hover:border-red-400/50 transition-colors flex-shrink-0"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setUrls([...urls, ''])}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      + Add URL
                    </button>
                    <button
                      type="button"
                      onClick={extractContext}
                      disabled={extracting || !urls.some(u => u.trim())}
                      className="px-4 py-1.5 rounded-md text-xs font-medium bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
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

          {/* Settings row */}
          <div
            className="rounded-lg border p-4 space-y-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <p className="text-xs font-medium text-[#71717a] uppercase tracking-wider">Script Settings</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#71717a] mb-1">Video Length (minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={form.videoLength}
                  onChange={e => setForm(f => ({ ...f, videoLength: Number(e.target.value) }))}
                  className="w-full rounded-md px-3 py-2 text-sm border focus:border-indigo-400"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block text-xs text-[#71717a] mb-1">Narration Speed (WPM)</label>
                <input
                  type="number"
                  min={80}
                  max={300}
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!form.analysisId || !form.topic.trim()}
            className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            Generate Script →
          </button>
        </form>
      )}
    </div>
  );
}
