'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { StorageProvider } from '@/components/StorageProvider';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';

const AUTH_PAGES   = ['/login', '/signup'];
const PUBLIC_PAGES = ['/', '/login', '/signup'];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && !PUBLIC_PAGES.includes(pathname)) {
      router.replace('/login');
    }
    if (user && AUTH_PAGES.includes(pathname)) {
      router.replace('/dashboard');
    }
  }, [user, loading, pathname, router]);

  if (loading) return null;

  // Landing page — full-width scrollable, no sidebar
  if (pathname === '/') {
    return <div className="flex-1 overflow-y-auto">{children}</div>;
  }

  // Auth pages (login/signup) — centered, no sidebar
  if (AUTH_PAGES.includes(pathname)) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        {children}
      </div>
    );
  }

  if (!user) return null;

  return (
    <StorageProvider>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </StorageProvider>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>{children}</AuthGate>
    </AuthProvider>
  );
}
