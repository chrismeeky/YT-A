'use client';

import { useEffect, useState, useCallback } from 'react';
import { useStorage } from '@/components/StorageProvider';

interface ElevenLabsBalance {
  charactersUsed: number;
  charactersLimit: number;
  charactersRemaining: number;
  resetAt: string | null;
  status: string;
  tier: string;
}

interface UsageEntry {
  id: string;
  timestamp: string;
  operation: string;
  api: 'anthropic' | 'elevenlabs' | 'youtube' | 'pexels';
  project_id?: string;
  user_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd?: number;
  characters?: number;
  quota_units?: number;
  requests?: number;
  key_fingerprint?: string;
}

interface AggRow {
  api: string;
  operation: string;
  estimated_cost_usd?: number;
  input_tokens?: number;
  output_tokens?: number;
  characters?: number;
  quota_units?: number;
  requests?: number;
  key_fingerprint?: string;
}

const PAGE_SIZE = 20;

const RANGES = [
  { label: 'Today',    days: 1 },
  { label: '7 days',   days: 7 },
  { label: '30 days',  days: 30 },
  { label: 'All time', days: 0 },
] as const;

const API_COLORS: Record<string, string> = {
  anthropic:  '#818cf8',
  elevenlabs: '#34d399',
  youtube:    '#f87171',
  pexels:     '#fb923c',
};

const OP_LABELS: Record<string, string> = {
  'analyze':          'Channel Analysis',
  'analyze-video':    'Video Analysis',
  'synthesize':       'Synthesis',
  'generate-script':  'Script Generation',
  'suggest-topics':   'Topic Suggestions',
  'generate-assets':  'Scene Assets',
  'generate-description': 'YT Description',
  'extract-context':  'Context Extraction',
  'audio':            'Audio Generation',
  'channel-videos':   'Channel Videos',
  'research-search':  'Research Search',
  'research-channel': 'Channel Details',
};

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtCost(usd: number) {
  if (usd < 0.001) return `<$0.001`;
  return `$${usd.toFixed(4)}`;
}

function sinceDate(days: number): string | null {
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function UsagePage() {
  const [logEntries, setLogEntries] = useState<UsageEntry[]>([]);
  const [allRows, setAllRows]       = useState<AggRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [range, setRange]           = useState<number>(7);
  const [loading, setLoading]       = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError]           = useState('');
  const [elBalance, setElBalance]   = useState<ElevenLabsBalance | null>(null);
  const [ytFingerprint, setYtFingerprint] = useState<string>('');
  const storage = useStorage();

  useEffect(() => {
    storage.getSettings().then(s => {
      const key = s.youtubeApiKey?.trim() ?? '';
      setYtFingerprint(key ? key.slice(-8) : '');
    });
  }, [storage]);

  const fetchPage = useCallback(async (p: number, r: number, isInitial: boolean) => {
    isInitial ? setLoading(true) : setPageLoading(true);
    setError('');
    try {
      const since = sinceDate(r);
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (since) params.set('since', since);
      const res = await fetch(`/api/usage?${params}`);
      const data = await res.json() as { entries?: UsageEntry[]; allRows?: AggRow[]; total?: number; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? 'Failed to load usage'); return; }
      setLogEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      if (isInitial) setAllRows(data.allRows ?? []);
    } catch {
      setError('Failed to load usage data');
    } finally {
      isInitial ? setLoading(false) : setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPage(1, range, true);
  }, [range, fetchPage]);

  useEffect(() => {
    fetch('/api/elevenlabs-balance')
      .then(r => r.json())
      .then(d => { if (!d.error) setElBalance(d as ElevenLabsBalance); })
      .catch(() => {});
  }, []);

  const goToPage = (p: number) => {
    setPage(p);
    fetchPage(p, range, false);
  };

  // Aggregations from allRows (full date range, lightweight)
  const anthropic  = allRows.filter(e => e.api === 'anthropic');
  const elevenlabs = allRows.filter(e => e.api === 'elevenlabs');
  const youtube    = allRows.filter(e => e.api === 'youtube');
  const pexels     = allRows.filter(e => e.api === 'pexels');

  const totalCost      = anthropic.reduce((s, e) => s + (e.estimated_cost_usd ?? 0), 0);
  const totalInputTok  = anthropic.reduce((s, e) => s + (e.input_tokens ?? 0), 0);
  const totalOutputTok = anthropic.reduce((s, e) => s + (e.output_tokens ?? 0), 0);
  const totalChars     = elevenlabs.reduce((s, e) => s + (e.characters ?? 0), 0);
  const totalQuota     = youtube.reduce((s, e) => {
    if (e.key_fingerprint && ytFingerprint && e.key_fingerprint !== ytFingerprint) return s;
    return s + (e.quota_units ?? 0);
  }, 0);
  const totalPexels    = pexels.reduce((s, e) => s + (e.requests ?? 0), 0);

  const opMap = new Map<string, { count: number; cost: number; tokens: number; chars: number; quota: number; requests: number }>();
  for (const e of allRows) {
    const key = `${e.api}:${e.operation}`;
    const cur = opMap.get(key) ?? { count: 0, cost: 0, tokens: 0, chars: 0, quota: 0, requests: 0 };
    opMap.set(key, {
      count:    cur.count + 1,
      cost:     cur.cost     + (e.estimated_cost_usd ?? 0),
      tokens:   cur.tokens   + (e.input_tokens ?? 0) + (e.output_tokens ?? 0),
      chars:    cur.chars    + (e.characters ?? 0),
      quota:    cur.quota    + (e.quota_units ?? 0),
      requests: cur.requests + (e.requests ?? 0),
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' };

  const card = (label: string, value: string, sub: string, api: string) => (
    <div
      className="rounded-xl border p-5 space-y-1"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: API_COLORS[api] }} />
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-3)' }}>{sub}</div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold mb-1">API Usage</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Granular breakdown of API calls and costs.
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                range === r.days ? 'bg-indigo-500 text-white' : 'hover:bg-[#1a1a1a]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--text-3)' }}>
          Loading usage data…
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {card('Anthropic', fmtCost(totalCost), `${fmt(totalInputTok)} in · ${fmt(totalOutputTok)} out tokens`, 'anthropic')}

            <div
              className="rounded-xl border p-5 space-y-1"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: API_COLORS['elevenlabs'] }} />
                <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>ElevenLabs</span>
              </div>
              {elBalance ? (
                <>
                  <div className="text-2xl font-semibold">{fmt(elBalance.charactersRemaining)}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                    chars remaining
                    <span className="ml-1 px-1 py-0.5 rounded text-[10px] uppercase" style={{ background: 'var(--surface-2)' }}>
                      {elBalance.tier}
                    </span>
                  </div>
                  {elBalance.charactersLimit > 0 && (
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          background: '#34d399',
                          width: `${Math.min(100, (elBalance.charactersUsed / elBalance.charactersLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                    {fmt(elBalance.charactersUsed)} used of {fmt(elBalance.charactersLimit)}
                    {elBalance.resetAt && ` · resets ${new Date(elBalance.resetAt).toLocaleDateString()}`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-semibold">{fmt(totalChars)}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>characters synthesised this period</div>
                </>
              )}
            </div>

            {card('YouTube', fmt(totalQuota), `quota units (daily limit: 10,000)${ytFingerprint ? ` · key …${ytFingerprint}` : ''}`, 'youtube')}
            {card('Pexels', fmt(totalPexels), 'requests made', 'pexels')}
          </div>

          {/* Per-operation breakdown */}
          <div className="rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-medium text-sm">By Operation</h2>
            </div>
            {opMap.size === 0 ? (
              <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-3)' }}>
                No usage recorded in this period.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    {['API', 'Operation', 'Calls', 'Detail', 'Cost'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-medium" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...opMap.entries()].sort((a, b) => b[1].cost - a[1].cost).map(([key, s]) => {
                    const [api, op] = key.split(':');
                    return (
                      <tr key={key} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: API_COLORS[api] }} />
                            <span className="capitalize">{api}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3">{OP_LABELS[op] ?? op}</td>
                        <td className="px-5 py-3 font-mono">{fmt(s.count)}</td>
                        <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                          {api === 'anthropic'  && `${fmt(s.tokens)} tokens`}
                          {api === 'elevenlabs' && `${fmt(s.chars)} chars`}
                          {api === 'youtube'    && `${fmt(s.quota)} quota units`}
                          {api === 'pexels'     && `${fmt(s.requests)} reqs`}
                        </td>
                        <td className="px-5 py-3 font-mono">
                          {api === 'anthropic' ? fmtCost(s.cost) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent log */}
          <div className="rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-medium text-sm">
                Recent Entries
                <span className="font-normal text-xs ml-1" style={{ color: 'var(--text-3)' }}>({fmt(total)})</span>
              </h2>
              {totalPages > 1 && (
                <Paginator page={page} totalPages={totalPages} onChange={goToPage} loading={pageLoading} />
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                    {['Time', 'API', 'Operation', 'Project', 'Detail', 'Cost'].map(h => (
                      <th key={h} className="px-5 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={pageLoading ? 'opacity-50' : ''}>
                  {logEntries.map(e => (
                    <tr key={e.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-5 py-2.5 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text-3)' }}>
                        {new Date(e.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: API_COLORS[e.api] }} />
                          <span className="capitalize">{e.api}</span>
                        </span>
                      </td>
                      <td className="px-5 py-2.5">{OP_LABELS[e.operation] ?? e.operation}</td>
                      <td className="px-5 py-2.5 font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                        {e.project_id ? e.project_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs" style={{ color: 'var(--text-3)' }}>
                        {e.api === 'anthropic'  && e.input_tokens  != null && `↑${fmt(e.input_tokens)} ↓${fmt(e.output_tokens ?? 0)}`}
                        {e.api === 'elevenlabs' && e.characters    != null && `${fmt(e.characters)} chars`}
                        {e.api === 'youtube'    && e.quota_units   != null && `${fmt(e.quota_units)} units`}
                        {e.api === 'pexels'     && e.requests      != null && `${fmt(e.requests)} reqs`}
                      </td>
                      <td className="px-5 py-2.5 font-mono text-xs">
                        {e.estimated_cost_usd != null ? fmtCost(e.estimated_cost_usd) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {fmt(total)}
                </span>
                <Paginator page={page} totalPages={totalPages} onChange={goToPage} loading={pageLoading} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Paginator({ page, totalPages, onChange, loading }: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  loading: boolean;
}) {
  const btnClass = 'px-2.5 py-1 rounded border text-xs transition-colors disabled:opacity-30';
  const btnStyle = { borderColor: 'var(--border)' };

  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1 || loading}
        className={`${btnClass} hover:bg-white/5`}
        style={btnStyle}
      >
        ←
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-xs" style={{ color: 'var(--text-3)' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            disabled={loading}
            className={`${btnClass} min-w-[28px]`}
            style={p === page
              ? { background: '#6366f1', color: '#fff', borderColor: '#6366f1' }
              : { ...btnStyle, background: 'var(--surface-2)' }}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages || loading}
        className={`${btnClass} hover:bg-white/5`}
        style={btnStyle}
      >
        →
      </button>
    </div>
  );
}
