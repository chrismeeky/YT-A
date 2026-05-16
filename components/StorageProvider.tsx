'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { storage, ClientStorage } from '@/lib/client-storage';
import { useAuth } from '@/components/AuthProvider';

const StorageContext = createContext<ClientStorage | null>(null);

export function useStorage(): ClientStorage {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used inside <StorageProvider>');
  return ctx;
}

type Status = 'loading' | 'needs-folder' | 'ready';

export function StorageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus]       = useState<Status>('loading');
  const [ownerError, setOwnerError] = useState('');

  useEffect(() => {
    if (!user) return;
    setStatus('loading');
    setOwnerError('');
    storage.init(user.id).then(ready => setStatus(ready ? 'ready' : 'needs-folder'));
  }, [user]);

  const pickFolder = async () => {
    setOwnerError('');
    try {
      const ok = await storage.pickDirectory(user?.email ?? '');
      if (ok) setStatus('ready');
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('OWNER:')) {
        setOwnerError(err.message.replace('OWNER:', ''));
      }
    }
  };

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--bg)' }}>
        <p className="text-[#52525b] text-sm">Initialising storage…</p>
      </div>
    );
  }

  if (status === 'needs-folder') {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center px-6 z-50"
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
              <span className="font-mono text-[#a1a1aa]">ReelIQ</span>.
            </p>
            {user?.email && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-3)' }}>
                Signed in as <span className="font-medium">{user.email}</span>
              </p>
            )}
          </div>

          {ownerError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-400">
              {ownerError}
            </div>
          )}

          <button
            onClick={pickFolder}
            className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
          >
            {ownerError ? 'Pick a Different Folder' : 'Pick Folder'}
          </button>
          <p className="text-xs text-[#52525b]">
            Your browser will ask for permission to read and write to that folder.
            You only need to do this once per account.
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
