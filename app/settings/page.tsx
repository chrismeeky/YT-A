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

export default function SettingsPage() {
  const storage = useStorage();
  const [form, setForm] = useState<Partial<AppSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    storage.getSettings().then(s => { setForm(s); setLoading(false); });
  }, [storage]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await storage.saveSettings(form as AppSettings);
      setMsg('Settings saved ✓');
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

  const section = (title: string, children: React.ReactNode) => (
    <div
      className="rounded-xl border p-6 space-y-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h2 className="font-medium text-sm text-[#a1a1aa] uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  );

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

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Settings</h1>
      <p className="text-[#71717a] text-sm mb-8">API keys and defaults for your workspace.</p>

      {BETA_MODE && (
        <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4 flex gap-3 items-start">
          <span className="text-yellow-400 text-lg flex-shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-yellow-300">Beta mode — API keys are managed by the platform</p>
            <p className="text-xs text-yellow-200/70 mt-1">
              You are using a hosted beta build. All API keys (Anthropic, YouTube, ElevenLabs, Pexels) are
              provided by the platform and cannot be changed here. Voice and script settings below still apply.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={save} className="space-y-6">
        {section('API Keys', <>
          {field(
            'Anthropic API Key',
            <SecretInput
              value={BETA_MODE ? '••••••••••••••••••••' : (form.anthropicApiKey ?? '')}
              onChange={v => set('anthropicApiKey', v)}
              className={inputClass}
              style={BETA_MODE ? disabledInputStyle : inputStyle}
              placeholder="sk-ant-…"
              disabled={BETA_MODE}
            />,
            BETA_MODE ? undefined : 'Required for channel analysis and script generation.'
          )}
          {field(
            'ElevenLabs API Key',
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
            'ElevenLabs Voice ID',
            <SecretInput
              value={form.elevenLabsVoiceId ?? ''}
              onChange={v => set('elevenLabsVoiceId', v)}
              className={inputClass}
              style={inputStyle}
              placeholder="21m00Tcm4TlvDq8ikWAM"
            />,
            'Default: 21m00Tcm4TlvDq8ikWAM (Rachel). Find voice IDs in the ElevenLabs dashboard.'
          )}
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
            'Brave Search API Key',
            <SecretInput
              value={BETA_MODE ? '••••••••••••••••••••' : (form.braveApiKey ?? '')}
              onChange={v => set('braveApiKey', v)}
              className={inputClass}
              style={BETA_MODE ? disabledInputStyle : inputStyle}
              placeholder="…"
              disabled={BETA_MODE}
            />,
            BETA_MODE ? undefined : 'Required for Real Images per scene. Free tier: 2,000 queries/month at api.search.brave.com.'
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
        </>)}

        {section('ElevenLabs Voice Settings', (
          <div className="space-y-5">
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
        ))}

        {section('Script Defaults', <>
          <div className="grid grid-cols-2 gap-4">
            {field(
              'Default Video Length (minutes)',
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
              'Default Narration Speed (WPM)',
              <input
                type="number"
                min={80}
                max={300}
                value={form.defaultWpm ?? 150}
                onChange={e => set('defaultWpm', Number(e.target.value))}
                className={inputClass}
                style={inputStyle}
              />,
            )}
          </div>
          <p className="text-xs text-[#52525b]">
            These are used as defaults when generating new scripts. You can override them per script.
          </p>
        </>)}

        <div className="flex items-center gap-4">
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

      <div
        className="mt-8 rounded-xl border p-5"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h3 className="font-medium text-sm mb-3">Prerequisites</h3>
        <ul className="space-y-2 text-sm text-[#71717a]">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">▶</span>
            <span>
              <strong className="text-[#a1a1aa]">YouTube Data API key</strong> needed for fetching channel videos.{' '}
              Enable the YouTube Data API v3 at{' '}
              <span className="font-mono text-xs bg-[#1a1a1a] px-1.5 py-0.5 rounded">console.cloud.google.com</span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">▶</span>
            <span>
              <strong className="text-[#a1a1aa]">Anthropic API key</strong> needed for analysis and script generation.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">▶</span>
            <span>
              <strong className="text-[#a1a1aa]">ElevenLabs API key</strong> needed for scene audio generation (optional).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">▶</span>
            <span>
              <strong className="text-[#a1a1aa]">Pexels API key</strong> needed for stock photo search per scene (optional, free at pexels.com/api).
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
