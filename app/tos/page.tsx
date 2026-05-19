import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for ReelIQ — AI YouTube Script Generator & Channel Analyzer.',
};

const EFFECTIVE_DATE = 'May 19, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-sm text-[#a1a1aa] leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function TosPage() {
  return (
    <div className="min-h-screen" style={{ color: 'var(--text)' }}>
      {/* Navbar */}
      <nav className="border-b sticky top-0 z-50" style={{ borderColor: 'var(--border)', background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">▶</span>
            <span className="font-bold text-lg tracking-tight">ReelIQ</span>
          </Link>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-3)' }}>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-3">Terms of Service</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Effective date: {EFFECTIVE_DATE}</p>
        </div>

        <div
          className="rounded-xl border px-8 py-6 mb-10 text-sm text-[#a1a1aa] leading-relaxed"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          Please read these Terms of Service carefully before using ReelIQ. By creating an account or
          using the service, you agree to be bound by these terms. If you do not agree, do not use ReelIQ.
        </div>

        <div className="space-y-10">
          <Section title="1. The Service">
            <p>
              ReelIQ (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) provides a web-based tool that analyzes publicly available
              YouTube channel data and uses AI to help users generate original video scripts, scene
              descriptions, visual asset prompts, and related creative content.
            </p>
            <p>
              ReelIQ is not affiliated with, endorsed by, or in any way officially connected with
              YouTube, Google, Anthropic, ElevenLabs, Pexels, or any other third-party service
              mentioned within the platform.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              You must be at least 13 years old to use ReelIQ. By using the service, you represent
              that you meet this requirement and that any information you provide is accurate.
            </p>
          </Section>

          <Section title="3. Your Account">
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activity that occurs under your account. Notify us immediately if you believe
              your account has been compromised.
            </p>
            <p>
              You may not share your account, create accounts by automated means, or create an
              account on behalf of someone else without their consent.
            </p>
          </Section>

          <Section title="4. API Keys and Third-Party Services">
            <p>
              ReelIQ integrates with third-party services (Anthropic, YouTube Data API, ElevenLabs,
              Pexels, Brave Search). To use these integrations you must provide your own API keys,
              which are subject to each provider&rsquo;s separate terms of service.
            </p>
            <p>
              Your API keys are stored locally on your own machine. They are transmitted directly
              to the respective third-party service when you make a request and are never stored on
              ReelIQ&rsquo;s servers. You are solely responsible for any costs, usage, or violations
              incurred through your API keys.
            </p>
          </Section>

          <Section title="5. Data Storage and Privacy">
            <p>
              All user-generated content — projects, analyses, scripts, media, and settings — is
              saved to a local folder on your own device that you select when you first use the app.
              ReelIQ does not upload, store, or have access to this data.
            </p>
            <p>
              Account authentication is handled by Supabase. Your email address and authentication
              credentials are governed by Supabase&rsquo;s privacy policy.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree not to use ReelIQ to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Copy, reproduce, or plagiarize any third party&rsquo;s copyrighted content.</li>
              <li>Generate content that is defamatory, harassing, fraudulent, or illegal.</li>
              <li>Circumvent YouTube&rsquo;s Terms of Service or access non-public data.</li>
              <li>Attempt to reverse-engineer, scrape, or exploit the platform in unauthorized ways.</li>
              <li>Use the service for any commercial spam or bulk content-farm operation.</li>
            </ul>
            <p>
              ReelIQ analyzes publicly available YouTube channel metadata and video information
              solely to extract structural and stylistic patterns. It does not reproduce video
              transcripts verbatim or facilitate copyright infringement.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              Scripts, analyses, and other content you generate using ReelIQ are yours. You retain
              full ownership of the creative output you produce with the tool.
            </p>
            <p>
              The ReelIQ platform, its interface, codebase, branding, and proprietary algorithms
              are owned by us and protected by applicable intellectual property laws. You may not
              copy, modify, distribute, or create derivative works of the platform without our
              express written permission.
            </p>
          </Section>

          <Section title="8. Disclaimer of Warranties">
            <p>
              ReelIQ is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind,
              express or implied, including but not limited to warranties of merchantability,
              fitness for a particular purpose, or non-infringement.
            </p>
            <p>
              We do not warrant that the service will be uninterrupted, error-free, or that AI-generated
              content will be accurate, complete, or suitable for any particular purpose. AI outputs
              should always be reviewed and edited before publication.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, ReelIQ and its operators shall not be liable
              for any indirect, incidental, special, consequential, or punitive damages arising from
              your use of or inability to use the service — including but not limited to loss of
              revenue, data, or goodwill.
            </p>
            <p>
              Our total liability for any claim arising out of these terms shall not exceed the
              amount you paid us in the twelve months preceding the claim, or $10 USD, whichever
              is greater.
            </p>
          </Section>

          <Section title="10. Termination">
            <p>
              We reserve the right to suspend or terminate your account at any time for violations
              of these terms or for any other reason at our discretion. You may stop using ReelIQ
              at any time.
            </p>
            <p>
              Upon termination, your locally stored data remains on your device and is unaffected.
            </p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>
              We may update these Terms from time to time. When we do, we will update the effective
              date at the top of this page. Continued use of the service after changes are posted
              constitutes your acceptance of the revised terms.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These Terms are governed by the laws of the jurisdiction in which ReelIQ operates,
              without regard to conflict of law provisions. Any disputes shall be resolved in the
              courts of that jurisdiction.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              If you have questions about these Terms, please contact us at{' '}
              <a href="mailto:contact@reeliq.io" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                contact@reeliq.io
              </a>.
            </p>
          </Section>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>▶</span>
            <span className="font-semibold text-sm">ReelIQ</span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            © {new Date().getFullYear()} ReelIQ. Built for YouTube creators.
          </p>
          <div className="flex gap-4 text-sm" style={{ color: 'var(--text-3)' }}>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
            <Link href="/tos" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
