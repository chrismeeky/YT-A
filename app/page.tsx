import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ReelIQ — AI YouTube Script Generator & Channel Analyzer',
  description: "Analyze any YouTube channel's strategy in minutes. ReelIQ extracts the frameworks behind top-performing content — hooks, structure, pacing, language — and applies that intelligence to your original ideas.",
  keywords: ['YouTube script generator', 'YouTube channel analyzer', 'AI script writing', 'YouTube content strategy', 'video script AI', 'YouTube automation tool'],
  openGraph: {
    title: 'ReelIQ — From Channel Analysis to Production-Ready Script in Minutes',
    description: "Extract the frameworks behind top-performing YouTube content. Apply that strategy intelligence to your own original scripts. No copying — just creative leverage.",
    url: 'https://reeliq.io',
    siteName: 'ReelIQ',
    type: 'website',
    images: [{ url: 'https://reeliq.io/og-image.png', width: 1200, height: 630, alt: 'ReelIQ — YouTube Script Generator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReelIQ — AI YouTube Script Generator',
    description: 'From channel analysis to production-ready script in minutes.',
    images: ['https://reeliq.io/og-image.png'],
  },
  alternates: { canonical: 'https://reeliq.io' },
  robots: { index: true, follow: true },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ReelIQ',
  url: 'https://reeliq.io',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'AI-powered YouTube channel analyzer and script generator for content creators.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'YouTube channel strategy analysis across 18 dimensions',
    'AI-powered scene-by-scene script generation',
    'Visual prompt generation for Midjourney, Sora, and Runway',
    'Cross-scene variety tracking with visual fingerprints',
    'Character sheet management for consistent AI visuals',
    'ElevenLabs voice narration synthesis',
  ],
};

const features = [
  {
    icon: '🔍',
    title: 'Script + Visual Analysis',
    desc: "ReelIQ goes beyond transcripts. It extracts the visual DNA of a channel — thumbnail composition, color palette, editing pace, B-roll patterns, camera style, and motion design — alongside hook strategy, title formulas, and language patterns.",
  },
  {
    icon: '💡',
    title: 'Topic Intelligence',
    desc: "Get a pipeline of topic ideas tailored to any analyzed channel's content pillars, hook patterns, and audience profile — so you always know what to make next and why it will resonate.",
  },
  {
    icon: '✍️',
    title: 'AI Script Generation',
    desc: "Generate scripts informed by a channel's proven pacing, structure, and emotional beats — applied to your original topic and angle. The strategy is borrowed; the content is entirely yours.",
  },
  {
    icon: '🎬',
    title: 'Ready-to-Use Visual Assets',
    desc: 'Auto-generate AI image and video prompts (Midjourney, Sora, Runway) for every scene — or browse AI-curated stock photos, stock videos, and real web images sourced and matched to your narration.',
  },
  {
    icon: '📊',
    title: 'Channel Research',
    desc: 'Discover high-performing channels before your niche gets saturated. Outlier scoring surfaces videos that dramatically overperform their subscriber count.',
  },
  {
    icon: '🎭',
    title: 'Character Sheets',
    desc: 'Define recurring characters once. ReelIQ injects their visual traits into every image and video prompt — consistent characters across your entire production.',
  },
  {
    icon: '🔊',
    title: 'Voice Synthesis',
    desc: 'Turn your script into narration with ElevenLabs integration. Fine-tune stability, similarity, and style — export ready for your video editor.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Analyze any channel',
    desc: "Paste a YouTube channel URL. ReelIQ runs an 18-dimension analysis covering both script and visuals — hooks, title formulas, language patterns, thumbnail style, editing pace, color palette, and more. It also surfaces a pipeline of topic ideas that fit the channel's strategy.",
  },
  {
    step: '02',
    title: 'Generate your script',
    desc: "Choose your topic and target audience. ReelIQ uses the extracted creative framework as a blueprint — writing an original, scene-by-scene script, thumbnail concept, and YouTube description that is entirely your own.",
  },
  {
    step: '03',
    title: 'Produce your video',
    desc: 'For each scene, choose AI image or video prompts (Midjourney, Sora, Runway), browse AI-matched stock photos and videos, or pull real web images — plus voice narration synthesis. Everything your production needs to go from script to screen.',
  },
];

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-screen" style={{ color: 'var(--text)' }}>
        {/* Navbar */}
        <nav className="border-b sticky top-0 z-50" style={{ borderColor: 'var(--border)', background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(12px)' }}>
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">▶</span>
              <span className="font-bold text-lg tracking-tight">ReelIQ</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm px-4 py-2 rounded-lg transition-colors hover:text-white"
                style={{ color: 'var(--text-2)' }}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="text-sm px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 font-medium transition-colors text-white"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 py-28 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-8"
            style={{ borderColor: '#6366f1', color: '#818cf8', background: 'rgba(99,102,241,0.1)' }}
          >
            <span>✦</span> Script · Visual · Topic intelligence — powered by AI
          </div>
          <h1
            className="text-5xl sm:text-6xl font-bold leading-tight mb-6"
            style={{ letterSpacing: '-0.02em' }}
          >
            From Channel Analysis to
            <br />
            <span style={{ color: 'var(--accent)' }}>Production-Ready Script</span>
            <br />
            — in Minutes
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-2)' }}>
            ReelIQ analyzes any YouTube channel across 18 dimensions — not just the transcript, but the visuals:
            thumbnail composition, editing pace, color palette, B-roll patterns, and more.
            It surfaces topic ideas that fit the channel&apos;s strategy, and pairs your script with
            AI-curated stock photos, stock videos, and real images — ready for production.
            You bring the idea. ReelIQ brings the intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-base transition-colors text-white"
            >
              Start for Free
            </Link>
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-xl border font-semibold text-base transition-colors hover:border-[#555]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Sign In
            </Link>
          </div>
        </section>

        {/* Trust / Philosophy */}
        <section className="border-t border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="max-w-6xl mx-auto px-6 py-12">
            <p className="text-center text-xs font-semibold uppercase tracking-widest mb-8" style={{ color: 'var(--text-3)' }}>
              Strategy intelligence — not content copying
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
              {[
                {
                  icon: '🔬',
                  title: 'Frameworks, never content',
                  desc: "ReelIQ reads public video metadata and channel patterns to extract structural frameworks — hooks, pacing, emotional arcs, title logic, and visual style. No content is copied verbatim, ever.",
                },
                {
                  icon: '💡',
                  title: 'Your ideas, amplified',
                  desc: "You choose the topic, the angle, the audience. ReelIQ applies proven creative blueprints to your original concept — the same way a filmmaker studies great films before writing their own.",
                },
                {
                  icon: '✅',
                  title: 'Authentically yours',
                  desc: "Every script is generated from scratch around your brief. The result is original, platform-safe content that reflects your creative voice — not a remix of someone else's work.",
                },
              ].map(p => (
                <div key={p.title} className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <span className="text-2xl flex-shrink-0">{p.icon}</span>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{p.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-6 py-20">
            <h2 className="text-3xl font-bold text-center mb-4">Everything you need to dominate YouTube</h2>
            <p className="text-center mb-14 max-w-xl mx-auto" style={{ color: 'var(--text-2)' }}>
              Stop guessing what works. Let AI extract the creative frameworks behind top-performing channels — and apply them to your original content.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map(f => (
                <div
                  key={f.title}
                  className="rounded-xl border p-6 transition-colors hover:border-[#444]"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="text-2xl mb-3">{f.icon}</div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="max-w-6xl mx-auto px-6 py-20">
            <h2 className="text-3xl font-bold text-center mb-4">How it works</h2>
            <p className="text-center mb-16 max-w-xl mx-auto" style={{ color: 'var(--text-2)' }}>
              Three steps from channel URL to a fully-produced script ready for your studio.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              {steps.map(s => (
                <div key={s.step} className="text-center">
                  <div className="text-5xl font-bold mb-4" style={{ color: 'rgba(99,102,241,0.35)' }}>
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-lg mb-3">{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-6 py-24 text-center">
            <h2 className="text-4xl font-bold mb-4">Ready to create smarter?</h2>
            <p className="mb-8 max-w-lg mx-auto" style={{ color: 'var(--text-2)' }}>
              Join creators who use ReelIQ to research faster, script better, and produce videos that consistently perform.
            </p>
            <Link
              href="/signup"
              className="inline-block px-10 py-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-base transition-colors text-white"
            >
              Get Started — It&apos;s Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span>▶</span>
              <span className="font-semibold text-sm">ReelIQ</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              © {new Date().getFullYear()} ReelIQ. Built for YouTube creators.
            </p>
            <div className="flex gap-4 text-sm" style={{ color: 'var(--text-3)' }}>
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
              <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
