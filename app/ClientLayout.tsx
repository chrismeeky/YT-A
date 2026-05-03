'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { StorageProvider } from '@/components/StorageProvider';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.replace('/login');
    }
  }, [user, loading, pathname, router]);

  if (loading) return null;
  if (!user && pathname !== '/login') return null;

  // Login page gets no sidebar/layout — full-screen centered wrapper
  if (pathname === '/login') return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      {children}
    </div>
  );

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
