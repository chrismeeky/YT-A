import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './ClientLayout';

export const metadata: Metadata = {
  title: 'ReelIQ',
  description: 'AI-powered YouTube research and script generation',
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
