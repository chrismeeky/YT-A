'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, signOut } = useAuth();

  const navItem = (href: string, label: string, icon: string) => {
    const active = pathname === href || (href !== '/' && pathname.startsWith(href));
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-[#1e1e2e] text-white'
            : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
        }`}
      >
        <span className="text-base">{icon}</span>
        {label}
      </Link>
    );
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">▶</span>
          <span className="font-semibold text-sm tracking-tight">ReelIQ</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItem('/', 'Projects', '📁')}
        {navItem('/research', 'Research', '🔍')}
        {navItem('/usage', 'Usage', '📊')}
        {navItem('/settings', 'Settings', '⚙️')}
      </nav>

      {/* Footer */}
      {user && (
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
    </aside>
  );
}
