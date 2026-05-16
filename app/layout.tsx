import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';

export const metadata: Metadata = {
  metadataBase: new URL('https://reeliq.io'),
  title: {
    default: 'ReelIQ — AI YouTube Script Generator & Channel Analyzer',
    template: '%s | ReelIQ',
  },
  description: "Analyze any YouTube channel's strategy in minutes. Generate production-ready, scene-by-scene scripts powered by AI. ReelIQ turns channel research into compelling video content.",
  keywords: ['YouTube script generator', 'YouTube channel analyzer', 'AI script writing', 'YouTube automation', 'video content strategy', 'AI video production'],
  authors: [{ name: 'ReelIQ' }],
  creator: 'ReelIQ',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://reeliq.io',
    siteName: 'ReelIQ',
    title: 'ReelIQ — From Channel Analysis to Production-Ready Script in Minutes',
    description: "Analyze any YouTube channel's strategy. Generate AI scripts that match top-performing content. Built for serious creators.",
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'ReelIQ — YouTube Script Generator' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReelIQ — AI YouTube Script Generator',
    description: 'From channel analysis to production-ready script in minutes.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: 'https://reeliq.io' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
