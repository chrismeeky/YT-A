'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold mb-4 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
        {title}
      </h2>
      <div className="space-y-4 text-sm text-[#a1a1aa] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">
        {n}
      </div>
      <div className="flex-1 pb-4 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
        <p className="font-medium text-white mb-1">{title}</p>
        <div className="text-sm text-[#71717a] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function ApiCard({
  name,
  tag,
  tagColor,
  where,
  url,
  cost,
  usedFor,
  steps,
}: {
  name: string;
  tag: string;
  tagColor: string;
  where: string;
  url: string;
  cost: string;
  usedFor: string;
  steps: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#1a1a1a] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white">{name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagColor}`}>{tag}</span>
            <span className="text-[11px] text-[#52525b]">{cost}</span>
          </div>
          <p className="text-xs text-[#52525b] mt-0.5 truncate">{usedFor}</p>
        </div>
        <span className="text-[#52525b] text-xs flex-shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="pt-4 flex items-center gap-2 text-xs text-[#71717a]">
            <span>Get your key at</span>
            <code className="px-2 py-0.5 rounded text-indigo-300 font-mono text-[11px]" style={{ background: 'rgba(99,102,241,0.1)' }}>
              {where}
            </code>
          </div>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#71717a]">
                <span className="flex-shrink-0 text-[#52525b]">{i + 1}.</span>
                <span dangerouslySetInnerHTML={{ __html: s }} />
              </li>
            ))}
          </ol>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Open {where} ↗
          </a>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { id: 'overview',    label: 'Overview' },
  { id: 'quickstart',  label: 'Quick Start' },
  { id: 'api-keys',    label: 'API Keys' },
  { id: 'workflow',    label: 'Workflow' },
  { id: 'faq',         label: 'FAQ' },
];

export default function DocsPage() {
  const [activeId, setActiveId] = useState('overview');

  useEffect(() => {
    const update = () => {
      const threshold = window.innerHeight * 0.4;
      let active = NAV[0].id;
      for (const { id } of NAV) {
        const heading = document.getElementById(id);
        if (heading && heading.getBoundingClientRect().top <= threshold) {
          active = id;
        }
      }
      setActiveId(active);
    };

    // capture:true catches scroll on any element (including overflow-y:auto divs)
    document.addEventListener('scroll', update, { passive: true, capture: true });
    update();
    return () => document.removeEventListener('scroll', update, { capture: true });
  }, []);

  return (
    <div className="min-h-full py-12 px-6">
      <div className="max-w-5xl mx-auto flex gap-12">
        {/* Sticky sidebar TOC */}
        <aside className="hidden lg:block w-44 flex-shrink-0 sticky top-8 self-start">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#52525b] mb-3">On this page</p>
          <nav className="space-y-1">
            {NAV.map(n => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`block text-sm py-0.5 transition-colors ${
                  activeId === n.id
                    ? 'text-indigo-400 font-medium'
                    : 'text-[#71717a] hover:text-white'
                }`}
              >
                {activeId === n.id && (
                  <span className="inline-block w-1 h-1 rounded-full bg-indigo-400 mr-2 mb-0.5" />
                )}
                {n.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <Link href="/settings" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              ⚙ Go to Settings
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-12">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Documentation</h1>
          <p className="text-[#71717a] text-sm">Everything you need to set up and start using ReelIQ.</p>
        </div>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <p>
            ReelIQ is an AI-powered tool for YouTube creators. It analyzes any YouTube channel to extract
            its content strategy — title formulas, hook patterns, writing style, visual rhythm — and then
            uses that analysis to generate production-ready, scene-by-scene scripts that match the channel's style.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { icon: '🔍', title: 'Analyze', body: 'Point ReelIQ at any YouTube channel. It fetches recent videos and runs a deep analysis across 18 dimensions.' },
              { icon: '✍️', title: 'Generate', body: 'Pick a topic and generate a full script — narration, scene descriptions, and AI image/video prompts — tuned to the channel\'s style.' },
              { icon: '🎬', title: 'Produce', body: 'Export scripts, generate voiceover audio with ElevenLabs, and pull matching stock footage from Pexels — all in one place.' },
            ].map(c => (
              <div
                key={c.title}
                className="rounded-lg border p-4"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <p className="text-2xl mb-2">{c.icon}</p>
                <p className="font-medium text-white text-sm mb-1">{c.title}</p>
                <p className="text-xs text-[#52525b] leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Quick Start */}
        <Section id="quickstart" title="Quick Start">
          <p>Follow these steps to go from zero to your first generated script.</p>
          <div className="pt-2 space-y-0">
            <Step n={1} title="Add your API keys">
              Go to <Link href="/settings" className="text-indigo-400 hover:text-indigo-300">Settings</Link> and
              add at minimum your <strong className="text-white">Anthropic</strong> and{' '}
              <strong className="text-white">YouTube Data API</strong> keys. These two are required for the core
              workflow. The others (ElevenLabs, Pexels, Brave Search) unlock optional features.
            </Step>
            <Step n={2} title="Create a project">
              Go to <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">Projects</Link> and
              click <strong className="text-white">New Project</strong>. A project groups your analyses and scripts
              for a particular creative focus or client.
            </Step>
            <Step n={3} title="Analyze a YouTube channel">
              Inside your project, click <strong className="text-white">Analyze Channel</strong>. Paste any YouTube
              channel URL, fetch its videos, select the ones you want to include, and hit Analyze. ReelIQ will
              study the channel across 18 dimensions and produce a channel strategy report.
            </Step>
            <Step n={4} title="Generate a script">
              From the analysis, click <strong className="text-white">New Script</strong>. Enter a topic (or pick
              from AI-suggested topics based on the channel), choose your target length and audience, and generate.
              ReelIQ writes a full scene-by-scene script in the analyzed channel's style.
            </Step>
            <Step n={5} title="Produce your assets">
              In the script editor, generate AI image and video prompts per scene, pull stock footage from Pexels,
              and generate voiceover audio with ElevenLabs — all without leaving the app.
            </Step>
          </div>
        </Section>

        {/* API Keys */}
        <Section id="api-keys" title="API Keys">
          <p>
            ReelIQ connects to external services for AI, video data, audio, and media. Your keys are stored
            locally on your machine and are never sent to ReelIQ's servers.
          </p>
          <div className="space-y-3 pt-2">
            <ApiCard
              name="Anthropic"
              tag="Required"
              tagColor="bg-red-500/20 text-red-400"
              where="console.anthropic.com"
              url="https://console.anthropic.com"
              cost="Pay-as-you-go"
              usedFor="Channel analysis, script generation, topic suggestions, image query refinement"
              steps={[
                'Go to <strong class="text-white">console.anthropic.com</strong> and sign up or log in.',
                'In the left sidebar, click <strong class="text-white">API Keys</strong>.',
                'Click <strong class="text-white">Create Key</strong>, give it a name, and copy it.',
                'Paste it into the Anthropic API Key field in <strong class="text-white">Settings</strong>.',
              ]}
            />
            <ApiCard
              name="YouTube Data API v3"
              tag="Required"
              tagColor="bg-red-500/20 text-red-400"
              where="console.cloud.google.com"
              url="https://console.cloud.google.com"
              cost="Free (10,000 units/day)"
              usedFor="Fetching channel videos and metadata for analysis"
              steps={[
                'Go to <strong class="text-white">console.cloud.google.com</strong> and create a project (or select an existing one).',
                'Navigate to <strong class="text-white">APIs & Services → Library</strong> and search for <em>YouTube Data API v3</em>.',
                'Click it and press <strong class="text-white">Enable</strong>.',
                'Go to <strong class="text-white">APIs & Services → Credentials → Create Credentials → API Key</strong>.',
                'Copy the key and paste it into <strong class="text-white">Settings → YouTube Data API Key</strong>.',
              ]}
            />
            <ApiCard
              name="ElevenLabs"
              tag="Optional"
              tagColor="bg-amber-500/20 text-amber-400"
              where="elevenlabs.io"
              url="https://elevenlabs.io"
              cost="Free tier: 10,000 chars/month"
              usedFor="Generating voiceover audio for each scene"
              steps={[
                'Go to <strong class="text-white">elevenlabs.io</strong> and sign up.',
                'Click your avatar (bottom-left) → <strong class="text-white">Profile + API Key</strong>.',
                'Copy your API key and paste it into <strong class="text-white">Settings → ElevenLabs API Key</strong>.',
                'Optionally, copy a Voice ID from the <strong class="text-white">Voices</strong> library and paste it into the Voice ID field. The default (Rachel) works well for narration.',
              ]}
            />
            <ApiCard
              name="Pexels"
              tag="Optional"
              tagColor="bg-amber-500/20 text-amber-400"
              where="pexels.com/api"
              url="https://www.pexels.com/api"
              cost="Free (200 requests/hour)"
              usedFor="Stock photos and stock videos per scene"
              steps={[
                'Go to <strong class="text-white">pexels.com/api</strong> and sign in or create an account.',
                'Click <strong class="text-white">Get Started</strong> and fill in your application details (personal use is fine).',
                'Your API key will be shown immediately — copy it.',
                'Paste it into <strong class="text-white">Settings → Pexels API Key</strong>.',
              ]}
            />
            <ApiCard
              name="Brave Search"
              tag="Optional"
              tagColor="bg-amber-500/20 text-amber-400"
              where="api.search.brave.com"
              url="https://api.search.brave.com"
              cost="Free tier: 2,000 queries/month"
              usedFor="Fetching real documentary images per scene (alternative to DuckDuckGo)"
              steps={[
                'Go to <strong class="text-white">api.search.brave.com</strong> and sign up.',
                'Under <strong class="text-white">Subscriptions</strong>, subscribe to the <em>Data for Search</em> free plan.',
                'Go to <strong class="text-white">API Keys</strong>, create a new key, and copy it.',
                'Paste it into <strong class="text-white">Settings → Brave Search API Key</strong>.',
                'Make sure <strong class="text-white">Real Images Provider</strong> is set to <em>Brave Search</em>.',
              ]}
            />
          </div>
        </Section>

        {/* Workflow */}
        <Section id="workflow" title="Workflow">
          <p>Understanding how the pieces fit together helps you get the most out of ReelIQ.</p>
          <div
            className="rounded-xl border p-5 space-y-3"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            {[
              { icon: '📺', label: 'Channel URL', arrow: true },
              { icon: '🔍', label: 'Video fetch + selection', arrow: true },
              { icon: '🧠', label: 'AI analysis (18 dimensions)', arrow: true },
              { icon: '💡', label: 'Topic suggestions', arrow: true },
              { icon: '✍️', label: 'Script generation (scenes + narration)', arrow: true },
              { icon: '🎨', label: 'Asset generation (image/video prompts, stock media)', arrow: true },
              { icon: '🎙️', label: 'Voiceover audio via ElevenLabs', arrow: false },
            ].map(step => (
              <div key={step.label} className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{step.icon}</span>
                  <span className="text-sm text-white">{step.label}</span>
                </div>
                {step.arrow && <div className="pl-3.5 text-[#52525b] text-xs">↓</div>}
              </div>
            ))}
          </div>
          <p className="pt-2">
            Each analysis is reusable — you can generate multiple scripts from the same channel analysis.
            Scripts are saved locally to your chosen storage folder and can be exported as text files.
          </p>
        </Section>

        {/* FAQ */}
        <Section id="faq" title="FAQ">
          {[
            {
              q: 'Where is my data stored?',
              a: 'Everything — projects, analyses, scripts, and media — is saved to a folder on your own machine that you choose when you first open the app. Nothing is uploaded to ReelIQ servers.',
            },
            {
              q: 'Are my API keys safe?',
              a: 'Yes. Keys are stored in your local storage folder. They are sent directly to the respective service (Anthropic, ElevenLabs, etc.) when you make a request — they never pass through ReelIQ\'s infrastructure.',
            },
            {
              q: 'How much does it cost to run?',
              a: 'ReelIQ itself is free. You pay only for what you use on external services. A typical channel analysis costs roughly $0.05–0.15 in Anthropic credits. Script generation is similar. YouTube, Pexels, and Brave have free tiers generous enough for regular use.',
            },
            {
              q: 'How many videos should I include in an analysis?',
              a: 'Between 5 and 15 recent videos gives the best results. Too few (1–2) may not capture the channel\'s full pattern. Too many increases cost and analysis time without meaningfully improving accuracy.',
            },
            {
              q: 'Can I analyze any YouTube channel?',
              a: 'Yes, as long as the channel has publicly available videos. Private or age-restricted videos are skipped automatically.',
            },
            {
              q: 'What if I run out of API quota?',
              a: 'Each service shows clear error messages when quota is exceeded. YouTube Data API resets daily. Pexels and Brave reset monthly. Anthropic is pay-as-you-go with no hard quota — you can raise your usage limit in the Anthropic console.',
            },
          ].map(item => (
            <details
              key={item.q}
              className="group rounded-lg border px-4 py-3 cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <summary className="text-sm font-medium text-white list-none flex items-center justify-between gap-2">
                {item.q}
                <span className="text-[#52525b] text-xs group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-xs text-[#71717a] leading-relaxed mt-3">{item.a}</p>
            </details>
          ))}
        </Section>
        </div>
      </div>
    </div>
  );
}
