import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';

export const metadata: Metadata = {
  title: 'YouTube Analyzer',
  description: 'Analyze YouTube channels and generate scripts',
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
