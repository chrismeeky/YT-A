'use client';

// Wire this up in app/layout.tsx during Phase 3.
// Usage:  <StorageProvider>{children}</StorageProvider>
// Access: const s = useStorage();  await s.listProjects(); etc.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storage, ClientStorage } from '@/lib/client-storage';

const StorageContext = createContext<ClientStorage | null>(null);

export function useStorage(): ClientStorage {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used inside <StorageProvider>');
  return ctx;
}

type Status = 'loading' | 'needs-folder' | 'ready';

export function StorageProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    storage.init().then(ready => setStatus(ready ? 'ready' : 'needs-folder'));
  }, []);

  const pickFolder = async () => {
    const ok = await storage.pickDirectory();
    if (ok) setStatus('ready');
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg)' }}>
        <p className="text-[#52525b] text-sm">Initialising storage…</p>
      </div>
    );
  }

  if (status === 'needs-folder') {
    return (
      <div
        className="flex items-center justify-center h-screen px-6"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="w-full max-w-md rounded-2xl border p-8 text-center space-y-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-4xl">📁</div>
          <div>
            <h2 className="text-lg font-semibold mb-1">Choose your data folder</h2>
            <p className="text-sm text-[#71717a] leading-relaxed">
              All your projects, scripts, and media will be saved to a folder on your computer.
              Pick any folder — or create a new one called{' '}
              <span className="font-mono text-[#a1a1aa]">YoutubeAnalyzer</span>.
            </p>
          </div>
          <button
            onClick={pickFolder}
            className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
          >
            Pick Folder
          </button>
          <p className="text-xs text-[#52525b]">
            Your browser will ask for permission to read and write to that folder.
            You only need to do this once.
          </p>
          {!isFsaaAvailable() && (
            <div
              className="rounded-lg border px-4 py-3 text-left text-xs space-y-1"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <p className="text-yellow-400 font-medium">Browser note</p>
              <p className="text-[#71717a]">
                Your browser doesn&apos;t support the File System Access API. Data will be stored
                in your browser&apos;s local storage instead. Use Chrome or Edge for real file access.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <StorageContext.Provider value={storage}>
      {children}
    </StorageContext.Provider>
  );
}

function isFsaaAvailable() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}
