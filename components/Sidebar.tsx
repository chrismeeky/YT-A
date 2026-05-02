'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

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

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col border-r"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">▶</span>
          <span className="font-semibold text-sm tracking-tight">YT Analyzer</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItem('/', 'Projects', '📁')}
        {navItem('/settings', 'Settings', '⚙️')}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
        <p>yt-dlp required for channel analysis.</p>
        <p className="mt-1">
          <code className="bg-[#1a1a1a] px-1 rounded">brew install yt-dlp</code>
        </p>
      </div>
    </aside>
  );
}
