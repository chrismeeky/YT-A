'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ClientStorage } from '@/lib/client-storage';
import { cloudStorage, CloudStorage } from '@/lib/cloud-storage';
import { getBrowserSupabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

const StorageContext = createContext<ClientStorage | null>(null);

export function useStorage(): ClientStorage {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used inside <StorageProvider>');
  return ctx;
}

type Status = 'loading' | 'unconfigured' | 'ready';
type MigrationState =
  | { kind: 'hidden' }
  | { kind: 'available'; count: number; local: ClientStorage }
  | { kind: 'needs-folder' }
  | { kind: 'running'; message: string; uploaded: number; total: number }
  | { kind: 'done'; summary: string };

function migratedKey(userId: string) { return `reeliq-cloud-migrated:${userId}`; }

export function StorageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [migration, setMigration] = useState<MigrationState>({ kind: 'hidden' });
  const localRef = useRef<ClientStorage | null>(null);

  const userId = user?.id;
  const userEmail = user?.email ?? '';

  useEffect(() => {
    if (!userId) return;
    if (!getBrowserSupabase()) { setStatus('unconfigured'); return; }

    let cancelled = false;
    setStatus('loading');
    setMigration({ kind: 'hidden' });

    cloudStorage.init(userId).then(async () => {
      if (cancelled) return;
      setStatus('ready');

      // One-time migration check: has this account already been moved?
      if (localStorage.getItem(migratedKey(userId))) return;

      // Look for existing on-device data to offer moving up.
      const local = new ClientStorage();
      const localReady = await local.init(userId);
      if (cancelled) return;
      localRef.current = local;

      if (!localReady) {
        // FSAA browser with no remembered folder — offer to connect it.
        setMigration({ kind: 'needs-folder' });
        return;
      }
      const projects = await local.listProjects();
      if (cancelled) return;
      if (projects.length > 0) setMigration({ kind: 'available', count: projects.length, local });
      else localStorage.setItem(migratedKey(userId), '1'); // nothing to move — mark done
    });

    return () => { cancelled = true; };
  }, [userId]);

  const runMigration = async (local: ClientStorage) => {
    if (!userId) return;
    try {
      const counts = await (cloudStorage as CloudStorage).migrateFromLocal(local, ({ message, uploaded, total }) =>
        setMigration({ kind: 'running', message, uploaded, total }),
      );
      localStorage.setItem(migratedKey(userId), '1');
      setMigration({
        kind: 'done',
        summary: `${counts.projects} projects, ${counts.scripts} scripts, ${counts.media} media files moved to the cloud.`,
      });
    } catch (err) {
      setMigration({ kind: 'running', message: `Migration failed: ${err instanceof Error ? err.message : 'unknown error'}`, uploaded: 0, total: 0 });
    }
  };

  const connectFolderAndMigrate = async () => {
    const local = localRef.current ?? new ClientStorage();
    localRef.current = local;
    const picked = await local.pickDirectory(userEmail).catch(() => false);
    if (!picked) return;
    await runMigration(local);
  };

  const skipMigration = () => {
    if (userId) localStorage.setItem(migratedKey(userId), '1');
    setMigration({ kind: 'hidden' });
  };

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'var(--bg)' }}>
        <p className="text-[#52525b] text-sm">Connecting to the cloud…</p>
      </div>
    );
  }

  if (status === 'unconfigured') {
    return (
      <div className="fixed inset-0 flex items-center justify-center px-6 z-50" style={{ background: 'var(--bg)' }}>
        <div className="w-full max-w-md rounded-2xl border p-8 text-center space-y-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-4xl">☁️</div>
          <h2 className="text-lg font-semibold">Cloud storage not configured</h2>
          <p className="text-sm text-[#71717a]">
            Set <span className="font-mono text-[#a1a1aa]">NEXT_PUBLIC_SUPABASE_URL</span> and{' '}
            <span className="font-mono text-[#a1a1aa]">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StorageContext.Provider value={cloudStorage}>
      {children}
      {migration.kind !== 'hidden' && (
        <div className="fixed inset-0 flex items-center justify-center px-6 z-[100]" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="w-full max-w-md rounded-2xl border p-8 text-center space-y-5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="text-4xl">☁️</div>

            {migration.kind === 'available' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Move your data to the cloud</h2>
                  <p className="text-sm text-[#71717a] leading-relaxed">
                    Found <span className="text-[#a1a1aa] font-medium">{migration.count}</span>{' '}
                    {migration.count === 1 ? 'project' : 'projects'} stored on this device. Move everything —
                    projects, scripts, and media — to your cloud account so it&apos;s available everywhere.
                  </p>
                </div>
                <button onClick={() => runMigration(migration.local)}
                  className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors">
                  Move to Cloud
                </button>
                <button onClick={skipMigration} className="text-xs transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                  Skip — start fresh in the cloud
                </button>
              </>
            )}

            {migration.kind === 'needs-folder' && (
              <>
                <div>
                  <h2 className="text-lg font-semibold mb-1">Import old data?</h2>
                  <p className="text-sm text-[#71717a] leading-relaxed">
                    If you previously stored data in a folder on this computer, connect it to move it into the cloud.
                    Otherwise you can start fresh.
                  </p>
                </div>
                <button onClick={connectFolderAndMigrate}
                  className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors">
                  Connect Folder &amp; Migrate
                </button>
                <button onClick={skipMigration} className="text-xs transition-colors hover:text-white" style={{ color: 'var(--text-3)' }}>
                  Skip — start fresh in the cloud
                </button>
              </>
            )}

            {migration.kind === 'running' && (
              <>
                <h2 className="text-lg font-semibold">Moving to the cloud…</h2>
                <p className="text-sm text-[#71717a] truncate">{migration.message}</p>
                {migration.total > 0 && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${Math.round((migration.uploaded / migration.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#52525b]">
                      {migration.uploaded} of {migration.total} items · {Math.round((migration.uploaded / migration.total) * 100)}%
                    </p>
                  </div>
                )}
                <p className="text-xs text-[#52525b]">Keep this tab open until it finishes.</p>
              </>
            )}

            {migration.kind === 'done' && (
              <>
                <h2 className="text-lg font-semibold">All set ✓</h2>
                <p className="text-sm text-[#71717a]">{migration.summary}</p>
                <button onClick={() => setMigration({ kind: 'hidden' })}
                  className="w-full py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors">
                  Continue
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </StorageContext.Provider>
  );
}
