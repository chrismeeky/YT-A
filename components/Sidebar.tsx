'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useStorage } from '@/components/StorageProvider';
import type { AppSettings } from '@/lib/types';

const BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE === 'true';

const INTEGRATIONS: { key: keyof AppSettings; label: string; betaExempt: boolean }[] = [
  { key: 'anthropicApiKey',  label: 'Anthropic',        betaExempt: true  },
  { key: 'youtubeApiKey',    label: 'YouTube Data API', betaExempt: false },
  { key: 'elevenLabsApiKey', label: 'ElevenLabs',       betaExempt: true  },
  { key: 'pexelsApiKey',     label: 'Pexels',           betaExempt: true  },
];

const COLLAPSED_KEY = 'sidebar-collapsed';

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, signOut } = useAuth();
  const storage = useStorage();
  const [pendingCount, setPendingCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  });

  const toggle = () => setCollapsed(v => {
    const next = !v;
    localStorage.setItem(COLLAPSED_KEY, String(next));
    return next;
  });

  useEffect(() => {
    storage.getSettings().then(s => {
      const count = INTEGRATIONS.filter(i => {
        if (BETA_MODE && i.betaExempt) return false;
        return !s[i.key];
      }).length;
      setPendingCount(count);
    });
  }, [storage]);

  const navItem = (href: string, label: string, icon: string, badge?: number) => {
    const active =
      pathname === href ||
      (href === '/dashboard' && pathname.startsWith('/projects')) ||
      (href !== '/dashboard' && pathname.startsWith(href));

    if (collapsed) {
      return (
        <Link
          key={href}
          href={href}
          title={label}
          className={`flex items-center justify-center w-9 h-9 rounded-lg text-base transition-colors mx-auto ${
            active ? 'bg-[#1e1e2e] text-white' : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
          }`}
        >
          {icon}
          {badge != null && badge > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </Link>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          active ? 'bg-[#1e1e2e] text-white' : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
        }`}
      >
        <span className="text-base">{icon}</span>
        {label}
        {badge != null && badge > 0 && (
          <span className="ml-auto text-[10px] font-bold bg-amber-500 text-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <aside
      className="flex-shrink-0 flex flex-col border-r transition-[width] duration-150 overflow-hidden"
      style={{
        width: collapsed ? 56 : 224,
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Logo */}
      <div
        className="border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', padding: collapsed ? '20px 0' : '20px 16px' }}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <span className="text-xl">▶</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl">▶</span>
            <span className="font-semibold text-sm tracking-tight">ReelIQ</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 p-2 space-y-1 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {navItem('/dashboard', 'Projects', '📁')}
        {navItem('/research', 'Research', '🔍')}
        {navItem('/usage', 'Usage', '📊')}
        {navItem('/settings', 'Settings', '⚙️', pendingCount)}
        {navItem('/docs', 'Docs', '📖')}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 pb-2">
        <button
          onClick={toggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex items-center gap-2 rounded-lg text-xs transition-colors text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1a1a1a] ${
            collapsed ? 'w-9 h-9 justify-center mx-auto' : 'w-full px-3 py-2'
          }`}
        >
          <span className="text-sm">{collapsed ? '›' : '‹'}</span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* Footer */}
      {user && !collapsed && (
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs truncate mb-1" style={{ color: 'var(--text-3)' }}>{user.email}</p>
          <button
            onClick={handleSignOut}
            className="text-xs py-1 rounded hover:bg-[#1a1a1a] transition-colors w-full text-left"
            style={{ color: 'var(--text-3)' }}
          >
            Sign out
          </button>
        </div>
      )}

      {/* Footer collapsed — just sign out icon */}
      {user && collapsed && (
        <div className="p-2 border-t flex justify-center" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-base text-[#52525b] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            ↪
          </button>
        </div>
      )}
    </aside>
  );
}
