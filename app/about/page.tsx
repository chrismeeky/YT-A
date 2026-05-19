import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about ReelIQ — why we built it, what drives us, and where we are headed.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ color: 'var(--text)' }}>
      {/* Navbar */}
      <nav
        className="border-b sticky top-0 z-50"
        style={{ borderColor: 'var(--border)', background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">▶</span>
            <span className="font-bold text-lg tracking-tight">ReelIQ</span>
          </Link>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-3)' }}>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-8"
            style={{ borderColor: '#6366f1', color: '#818cf8', background: 'rgba(99,102,241,0.1)' }}
          >
            ✦ About ReelIQ
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
            Built for creators who take<br />
            <span style={{ color: 'var(--accent)' }}>YouTube seriously</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-xl mx-auto" style={{ color: 'var(--text-2)' }}>
            ReelIQ started from a simple frustration: too much time spent studying what works on YouTube,
            and not enough time actually making videos. We built the tool we wished existed.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto px-6 py-16 space-y-6 text-sm text-[#a1a1aa] leading-relaxed">
          <h2 className="text-xl font-semibold text-white">Our story</h2>
          <p>
            Every serious YouTube creator eventually does the same thing: they reverse-engineer the channels
            they admire. They study the hooks, the pacing, the title formulas, the thumbnail patterns — trying
            to understand <em>why</em> certain videos perform and others don&apos;t.
          </p>
          <p>
            That process works. But it&apos;s slow, manual, and hard to apply consistently. You watch dozens
            of videos, take notes, build frameworks — and then still have to translate all of it into a
            script that sounds like you.
          </p>
          <p>
            ReelIQ was built to collapse that gap. Instead of spending hours on research, you get a
            structured channel analysis in minutes — covering not just the words, but the visuals: thumbnail
            composition, editing rhythm, B-roll patterns, color palettes. And then it applies that
            intelligence directly to your script, without copying a single line of anyone else&apos;s content.
          </p>
          <p>
            The strategy is borrowed. The content is entirely yours.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-xl font-semibold text-white mb-10 text-center">What we believe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: '🔬',
                title: 'Frameworks, not formulas',
                body: "Great content comes from understanding principles, not copying patterns. ReelIQ extracts the structural logic behind what works — not a template to paste over.",
              },
              {
                icon: '🔒',
                title: 'Your data stays yours',
                body: "Everything you create — projects, scripts, analyses — lives on your own machine. We don't store your content, and we never will. Your API keys go directly to each service.",
              },
              {
                icon: '⚡',
                title: 'Speed without shortcuts',
                body: "Moving fast is only valuable if the output is good. We obsess over both — reducing the hours between idea and production-ready script without sacrificing quality.",
              },
              {
                icon: '🎯',
                title: 'Depth over breadth',
                body: "We analyze 18 dimensions of a channel because surface-level insights aren't useful. Titles and hooks are obvious. Visual rhythm, emotional pacing, and language register are where strategy lives.",
              },
              {
                icon: '🤝',
                title: 'Creator-first',
                body: "Every decision we make — pricing, features, defaults — is made from the perspective of a working creator. Not a marketer, not an agency, not an enterprise.",
              },
              {
                icon: '🧠',
                title: 'AI as leverage, not replacement',
                body: "ReelIQ augments your creative process. The ideas, the angle, the voice — those are yours. AI handles the research, the structure, and the heavy lifting.",
              },
            ].map(v => (
              <div
                key={v.title}
                className="rounded-xl border p-6"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="text-2xl mb-3">{v.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-2">{v.title}</h3>
                <p className="text-sm text-[#71717a] leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What we're building */}
      <section className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto px-6 py-16 space-y-6 text-sm text-[#a1a1aa] leading-relaxed">
          <h2 className="text-xl font-semibold text-white">What we&apos;re building toward</h2>
          <p>
            Today, ReelIQ covers the research-to-script pipeline end to end. Our goal is to push further
            into production — tighter integrations with video editing tools, smarter asset curation,
            and deeper analysis that goes beyond individual channels to surface cross-niche patterns.
          </p>
          <p>
            We&apos;re a small team building in public, shipping fast, and talking directly to creators.
            If you have feedback, a feature request, or just want to share what you&apos;re making —
            reach out. We read everything.
          </p>
          <div className="pt-2">
            <a
              href="mailto:contact@reeliq.io"
              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              contact@reeliq.io ↗
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to try it?</h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--text-2)' }}>
            Set up takes about 10 minutes. No subscription required — you only pay for what you use on external APIs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 font-semibold text-sm transition-colors text-white"
            >
              Get Started Free
            </Link>
            <Link
              href="/docs"
              className="px-8 py-3 rounded-xl border font-semibold text-sm transition-colors hover:border-[#555]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>▶</span>
            <span className="font-semibold text-sm">ReelIQ</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            © {new Date().getFullYear()} ReelIQ. Built for YouTube creators.
          </p>
          <div className="flex gap-4 text-sm" style={{ color: 'var(--text-3)' }}>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/tos" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
