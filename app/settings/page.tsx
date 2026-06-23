'use client';

import { useEffect, useState } from 'react';
import { useStorage } from '@/components/StorageProvider';
import type { AppSettings } from '@/lib/types';

function SecretInput({
  value,
  onChange,
  placeholder,
  className,
  style,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
        style={{ ...style, paddingRight: '2.5rem' }}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525b] hover:text-[#a1a1aa] transition-colors disabled:opacity-30"
        tabIndex={-1}
        title={visible ? 'Hide' : 'Reveal'}
        disabled={disabled}
      >
        {visible ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

const BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE === 'true';

const NAV = [
  { id: 'general',    label: 'General',    icon: '⚙' },
  { id: 'elevenlabs', label: 'ElevenLabs', icon: '🎵' },
  { id: 'cartesia',   label: 'Cartesia',   icon: '🎙' },
  { id: 'media',      label: 'Media',      icon: '🖼' },
  { id: 'script',     label: 'Script',     icon: '📝' },
  { id: 'status',     label: 'Status',     icon: '✓' },
] as const;
type SectionId = typeof NAV[number]['id'];

export default function SettingsPage() {
  const storage = useStorage();
  const [form, setForm] = useState<Partial<AppSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [active, setActive] = useState<SectionId>('general');

  useEffect(() => {
    storage.getSettings().then(s => { setForm(s); setLoading(false); });
  }, [storage]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await storage.saveSettings(form as AppSettings);
      setMsg('Saved ✓');
    } catch {
      setMsg('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof AppSettings, value: string | number) =>
    setForm(f => ({ ...f, [key]: value }));

  const inputClass =
    'w-full rounded-lg px-4 py-2.5 text-sm border focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 font-mono';
  const inputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' };
  const disabledInputStyle = { background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-3)', opacity: 0.5, cursor: 'not-allowed' };

  const slider = (
    key: keyof AppSettings,
    label: string,
    min: number,
    max: number,
    step: number,
    format: (v: number) => string,
    hint?: string
  ) => {
    const val = (form[key] as number) ?? 0;
    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-medium">{label}</label>
          <span className="text-sm font-mono text-indigo-300">{format(val)}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={val}
          onChange={e => set(key, Number(e.target.value))}
          className="w-full accent-indigo-400 h-1.5 rounded-full"
          style={{ background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((val - min) / (max - min)) * 100}%, #27272a ${((val - min) / (max - min)) * 100}%, #27272a 100%)` }}
        />
        <div className="flex justify-between text-[10px] text-[#52525b] mt-0.5">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
        {hint && <p className="text-xs text-[#52525b] mt-1">{hint}</p>}
      </div>
    );
  };

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {node}
      {hint && <p className="text-xs text-[#52525b] mt-1">{hint}</p>}
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[#52525b]">Loading…</div>;
  }

  const llmProvider = form.llmProvider ?? 'claude';
  const llmLabel = llmProvider === 'grok' ? 'xAI (Grok)' : 'Anthropic (Claude)';
  const llmKeyOk = llmProvider === 'grok' ? !!form.xaiApiKey : (BETA_MODE || !!form.anthropicApiKey);

  const checks = [
    { label: llmLabel,         ok: llmKeyOk,                              betaProvided: llmProvider === 'claude', description: 'Channel analysis and script generation', critical: true  },
    { label: 'YouTube Data',   ok: !!form.youtubeApiKey,                  betaProvided: false, description: 'Fetching channel videos for analysis',   critical: true  },
    { label: 'ElevenLabs',     ok: BETA_MODE || !!form.elevenLabsApiKey,  betaProvided: true,  description: 'Scene audio generation',                 critical: false },
    { label: 'Cartesia',       ok: !!form.cartesiaApiKey,                 betaProvided: false, description: 'Alternative TTS — cheaper than ElevenLabs', critical: false },
    { label: 'Pexels',         ok: BETA_MODE || !!form.pexelsApiKey,      betaProvided: true,  description: 'Stock photos and videos per scene',      critical: false },
  ];
  const pendingCount = checks.filter(c => !c.ok).length;

  return (
    <div className="flex min-h-full">
      {/* Sidebar nav */}
      <aside
        className="w-44 flex-shrink-0 border-r sticky top-0 h-screen overflow-y-auto flex flex-col"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="p-4 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#52525b] mb-4 px-1">Settings</p>
          <nav className="space-y-0.5">
            {NAV.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active === item.id
                    ? 'bg-indigo-500/15 text-white font-medium'
                    : 'text-[#71717a] hover:bg-[#1a1a1a] hover:text-[#a1a1aa]'
                }`}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                {item.label}
                {item.id === 'status' && pendingCount > 0 && (
                  <span className="ml-auto text-[9px] font-bold bg-amber-500 text-black rounded-full px-1.5 py-0.5 leading-none">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {active === 'status' ? (
          // Status panel — read-only, no form needed
          <div className="p-8 max-w-xl mx-auto">
            <h2 className="text-lg font-semibold mb-1">Status</h2>
            <p className="text-[#71717a] text-sm mb-6">Integration health for your workspace.</p>

            {BETA_MODE && (
              <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4 flex gap-3 items-start">
                <span className="text-yellow-400 text-lg flex-shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-300">Beta mode — keys are managed by the platform</p>
                  <p className="text-xs text-yellow-200/70 mt-1">
                    API keys (Anthropic, ElevenLabs, Pexels) are provided by the platform.
                  </p>
                </div>
              </div>
            )}

            <div
              className="rounded-xl border p-5 space-y-3"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Integrations</span>
                {pendingCount > 0 ? (
                  <span className="text-[10px] font-bold bg-amber-500 text-black rounded-full px-1.5 py-0.5">{pendingCount} pending</span>
                ) : (
                  <span className="text-[10px] font-bold bg-green-500/20 text-green-400 rounded-full px-1.5 py-0.5">All set</span>
                )}
              </div>
              {checks.map(c => (
                <div key={c.label} className="flex items-start gap-3">
                  <span className={`mt-0.5 text-sm flex-shrink-0 ${c.ok ? 'text-green-400' : c.critical ? 'text-red-400' : 'text-amber-400'}`}>
                    {c.ok ? '✓' : c.critical ? '✕' : '○'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${c.ok ? 'text-[#a1a1aa]' : 'text-white'}`}>{c.label}</span>
                      {c.ok && BETA_MODE && c.betaProvided && (
                        <span className="text-[10px] text-[#52525b]">platform key</span>
                      )}
                      {!c.ok && c.critical && (
                        <span className="text-[10px] font-medium text-red-400">Required</span>
                      )}
                    </div>
                    <p className="text-xs text-[#52525b]">{c.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={save} className="p-8 max-w-xl mx-auto space-y-6">

            {/* General */}
            {active === 'general' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">General</h2>
                  <p className="text-[#71717a] text-sm">Core API keys for AI and YouTube.</p>
                </div>

                {BETA_MODE && (
                  <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4 flex gap-3 items-start">
                    <span className="text-yellow-400 text-lg flex-shrink-0 mt-0.5">⚠</span>
                    <div>
                      <p className="text-sm font-semibold text-yellow-300">Beta mode — keys are managed by the platform</p>
                      <p className="text-xs text-yellow-200/70 mt-1">
                        Anthropic, ElevenLabs, and Pexels keys are provided. Voice and script settings still apply.
                      </p>
                    </div>
                  </div>
                )}

                {field(
                    'AI Provider',
                    <div className="flex gap-2">
                      {(['claude', 'grok'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => set('llmProvider', p)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            (form.llmProvider ?? 'claude') === p
                              ? 'bg-indigo-500 border-indigo-500 text-white'
                              : 'border-[#333] text-[#a1a1aa] hover:border-[#555] hover:text-white'
                          }`}
                          style={(form.llmProvider ?? 'claude') !== p ? { background: 'var(--surface-2)' } : {}}
                        >
                          {p === 'claude' ? 'Claude' : 'Grok'}
                        </button>
                      ))}
                    </div>,
                    'Choose which LLM powers script generation and channel analysis.'
                  )}

                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {(form.llmProvider ?? 'claude') !== 'grok' && field(
                    'Anthropic API Key',
                    <SecretInput
                      value={BETA_MODE ? '••••••••••••••••••••' : (form.anthropicApiKey ?? '')}
                      onChange={v => set('anthropicApiKey', v)}
                      className={inputClass}
                      style={BETA_MODE ? disabledInputStyle : inputStyle}
                      placeholder="sk-ant-…"
                      disabled={BETA_MODE}
                    />,
                    BETA_MODE ? undefined : 'Required when using Claude for channel analysis and script generation. Switch to Grok above to use xAI instead.'
                  )}
                  {(form.llmProvider ?? 'claude') === 'grok' && field(
                    'xAI API Key',
                    <SecretInput
                      value={form.xaiApiKey ?? ''}
                      onChange={v => set('xaiApiKey', v)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="xai-…"
                    />,
                    'Required when using Grok. Get a key at console.x.ai.'
                  )}
                  {field(
                    'YouTube Data API Key',
                    <SecretInput
                      value={form.youtubeApiKey ?? ''}
                      onChange={v => set('youtubeApiKey', v)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="AIza…"
                    />,
                    BETA_MODE
                      ? 'Optional — leave blank to use the shared beta key. Add your own if you hit the rate limit.'
                      : 'Required for fetching channel videos. Get a free key at console.cloud.google.com → YouTube Data API v3.'
                  )}
                </div>
              </>
            )}

            {/* ElevenLabs */}
            {active === 'elevenlabs' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">ElevenLabs</h2>
                  <p className="text-[#71717a] text-sm">API key, voice selection, and voice settings.</p>
                </div>
                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {field(
                    'API Key',
                    <SecretInput
                      value={BETA_MODE ? '••••••••••••••••••••' : (form.elevenLabsApiKey ?? '')}
                      onChange={v => set('elevenLabsApiKey', v)}
                      className={inputClass}
                      style={BETA_MODE ? disabledInputStyle : inputStyle}
                      placeholder="sk-…"
                      disabled={BETA_MODE}
                    />,
                    BETA_MODE ? undefined : 'Required for audio generation on scenes.'
                  )}
                  {field(
                    'Voice ID',
                    <SecretInput
                      value={form.elevenLabsVoiceId ?? ''}
                      onChange={v => set('elevenLabsVoiceId', v)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="21m00Tcm4TlvDq8ikWAM"
                    />,
                    'Default: 21m00Tcm4TlvDq8ikWAM (Rachel). Find voice IDs in the ElevenLabs dashboard.'
                  )}
                </div>
                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52525b]">Voice Settings</h3>
                  {slider('elevenLabsSpeed', 'Speed', 0.7, 1.2, 0.01,
                    v => `${v.toFixed(2)}×`,
                    'Controls how fast the voice speaks. 1.0 is normal speed.'
                  )}
                  {slider('elevenLabsStability', 'Stability', 0, 1, 0.01,
                    v => `${Math.round(v * 100)}%`,
                    'Higher stability = more consistent but less expressive. Lower = more varied.'
                  )}
                  {slider('elevenLabsSimilarity', 'Similarity', 0, 1, 0.01,
                    v => `${Math.round(v * 100)}%`,
                    'How closely the AI matches the original voice. High values may introduce artifacts.'
                  )}
                  {slider('elevenLabsStyle', 'Style Exaggeration', 0, 1, 0.01,
                    v => `${Math.round(v * 100)}%`,
                    'Amplifies the speaking style. 0% = no exaggeration (more stable).'
                  )}
                </div>
              </>
            )}

            {/* Cartesia */}
            {active === 'cartesia' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Cartesia</h2>
                  <p className="text-[#71717a] text-sm">Cheaper alternative to ElevenLabs (~14× less per character).</p>
                </div>
                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {field(
                    'API Key',
                    <SecretInput
                      value={BETA_MODE ? '••••••••••••••••••••' : (form.cartesiaApiKey ?? '')}
                      onChange={v => set('cartesiaApiKey', v)}
                      className={inputClass}
                      style={BETA_MODE ? disabledInputStyle : inputStyle}
                      placeholder="sk-…"
                      disabled={BETA_MODE}
                    />,
                    BETA_MODE ? undefined : 'Get a key at cartesia.ai.'
                  )}
                  {field(
                    'Voice ID',
                    <SecretInput
                      value={form.cartesiaVoiceId ?? ''}
                      onChange={v => set('cartesiaVoiceId', v)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="e.g. a0e99841-438c-4a64-b679-ae501e7d6091"
                    />,
                    'Find voice IDs in the Cartesia dashboard under Voices.'
                  )}
                </div>
                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#52525b]">Voice Settings</h3>
                  {slider('cartesiaSpeed', 'Speed', 0.7, 1.2, 0.01,
                    v => `${v.toFixed(2)}×`,
                    'Controls how fast the voice speaks. 1.0 is normal speed.'
                  )}
                </div>
              </>
            )}

            {/* Media */}
            {active === 'media' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Media</h2>
                  <p className="text-[#71717a] text-sm">Stock photos, videos, and image search providers.</p>
                </div>
                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {field(
                    'Pexels API Key',
                    <SecretInput
                      value={BETA_MODE ? '••••••••••••••••••••' : (form.pexelsApiKey ?? '')}
                      onChange={v => set('pexelsApiKey', v)}
                      className={inputClass}
                      style={BETA_MODE ? disabledInputStyle : inputStyle}
                      placeholder="…"
                      disabled={BETA_MODE}
                    />,
                    BETA_MODE ? undefined : 'Required for Stock Photos & Videos per scene. Free at pexels.com/api — 200 requests/hour.'
                  )}
                  {field(
                    'Real Images Provider',
                    <div className="flex gap-2">
                      {(['brave', 'duckduckgo'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => set('realImageProvider', p)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            (form.realImageProvider ?? 'brave') === p
                              ? 'bg-indigo-500 border-indigo-500 text-white'
                              : 'border-[#333] text-[#a1a1aa] hover:border-[#555] hover:text-white'
                          }`}
                          style={(form.realImageProvider ?? 'brave') !== p ? { background: 'var(--surface-2)' } : {}}
                        >
                          {p === 'brave' ? 'Brave Search' : 'DuckDuckGo'}
                        </button>
                      ))}
                    </div>,
                    'Brave Search requires an API key but works on all hosts.'
                  )}
                  {(form.realImageProvider ?? 'brave') === 'brave' && field(
                    'Brave Search API Key',
                    <SecretInput
                      value={form.braveApiKey ?? ''}
                      onChange={v => set('braveApiKey', v)}
                      className={inputClass}
                      style={inputStyle}
                      placeholder="…"
                    />,
                    BETA_MODE
                      ? 'Optional — leave blank to use the shared beta key. Add your own for dedicated quota.'
                      : 'Required for Real Images per scene. Free tier: 2,000 queries/month at api.search.brave.com.'
                  )}
                </div>
              </>
            )}

            {/* Script */}
            {active === 'script' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Script</h2>
                  <p className="text-[#71717a] text-sm">Defaults applied when generating new scripts.</p>
                </div>
                <div
                  className="rounded-xl border p-6 space-y-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="grid grid-cols-2 gap-4">
                    {field(
                      'Default Video Length (min)',
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={form.defaultVideoLength ?? 5}
                        onChange={e => set('defaultVideoLength', Number(e.target.value))}
                        className={inputClass}
                        style={inputStyle}
                      />
                    )}
                    {field(
                      'Narration Speed (WPM)',
                      <input
                        type="number"
                        min={80}
                        max={300}
                        value={form.defaultWpm ?? 150}
                        onChange={e => set('defaultWpm', Number(e.target.value))}
                        className={inputClass}
                        style={inputStyle}
                      />
                    )}
                  </div>
                  <p className="text-xs text-[#52525b]">
                    These are defaults only — you can override them per script.
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center gap-4 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-sm font-medium transition-colors"
              >
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
              {msg && (
                <span className={`text-sm ${msg.includes('✓') ? 'text-green-400' : 'text-red-400'}`}>
                  {msg}
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
