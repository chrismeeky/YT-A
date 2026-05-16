// Client-side storage — File System Access API (Chrome/Edge) with IndexedDB fallback.
// This module is browser-only. Never import it from server-side code (API routes).

// showDirectoryPicker is not yet in TypeScript's lib.dom.d.ts
declare global {
  interface Window {
    showDirectoryPicker(opts?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
  }
}

import type { Project, Analysis, Script, MediaFile, AppSettings, ChannelBookmark } from './types';
import { DEFAULT_SETTINGS } from './types';

// ─── IndexedDB helpers ─────────────────────────────────────────────────────

const DB_NAME    = 'youtube-analyzer';
const DB_VERSION = 1;
const HANDLE_STORE = 'handles';   // stores the FSAA root DirectoryHandle
const FILE_STORE   = 'files';     // fallback file storage (key = path, value = string|ArrayBuffer)

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE);
      if (!db.objectStoreNames.contains(FILE_STORE))   db.createObjectStore(FILE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror   = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

function idbAllKeys(db: IDBDatabase, store: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror   = () => reject(req.error);
  });
}

// ─── FSAA helpers ──────────────────────────────────────────────────────────

function fsaaSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function nestedDir(
  root: FileSystemDirectoryHandle,
  parts: string[],
  create = true,
): Promise<FileSystemDirectoryHandle> {
  let cur = root;
  for (const raw of parts) {
    const p = raw.replace(/[\x00-\x1f\x7f/\\]/g, '-').trim() || '_';
    cur = await cur.getDirectoryHandle(p, { create });
  }
  return cur;
}

async function fsaaReadText(
  root: FileSystemDirectoryHandle, dir: string[], name: string,
): Promise<string | null> {
  try {
    const d = await nestedDir(root, dir, false);
    const f = await (await d.getFileHandle(name)).getFile();
    return await f.text();
  } catch { return null; }
}

async function fsaaWriteText(
  root: FileSystemDirectoryHandle, dir: string[], name: string, content: string,
): Promise<void> {
  const d = await nestedDir(root, dir, true);
  const w = await (await d.getFileHandle(name, { create: true })).createWritable();
  await w.write(content);
  await w.close();
}

async function fsaaReadBinary(
  root: FileSystemDirectoryHandle, dir: string[], name: string,
): Promise<ArrayBuffer | null> {
  try {
    const d = await nestedDir(root, dir, false);
    const f = await (await d.getFileHandle(name)).getFile();
    return await f.arrayBuffer();
  } catch { return null; }
}

async function fsaaWriteBinary(
  root: FileSystemDirectoryHandle, dir: string[], name: string, data: ArrayBuffer,
): Promise<void> {
  const d = await nestedDir(root, dir, true);
  const w = await (await d.getFileHandle(name, { create: true })).createWritable();
  await w.write(data);
  await w.close();
}

async function fsaaDeleteEntry(
  root: FileSystemDirectoryHandle, dir: string[], name: string, recursive = false,
): Promise<void> {
  try {
    const d = await nestedDir(root, dir, false);
    await d.removeEntry(name, { recursive });
  } catch { /* already gone */ }
}

async function fsaaListDir(
  root: FileSystemDirectoryHandle, dir: string[],
): Promise<{ name: string; kind: 'file' | 'directory' }[]> {
  try {
    const d = await nestedDir(root, dir, false);
    const out: { name: string; kind: 'file' | 'directory' }[] = [];
    for await (const [name, handle] of d.entries()) out.push({ name, kind: handle.kind });
    return out;
  } catch { return []; }
}

async function fsaaGetObjectUrl(
  root: FileSystemDirectoryHandle, dir: string[], name: string,
): Promise<string | null> {
  try {
    const d = await nestedDir(root, dir, false);
    const f = await (await d.getFileHandle(name)).getFile();
    return URL.createObjectURL(f);
  } catch { return null; }
}

// ─── Owner file ────────────────────────────────────────────────────────────

interface OwnerFile { userId: string; email: string; }

// ─── ClientStorage class ───────────────────────────────────────────────────

export class ClientStorage {
  private db:   IDBDatabase | null = null;
  private root: FileSystemDirectoryHandle | null = null;
  private _mode:   'fsaa' | 'idb' = 'idb';
  private _ready = false;
  private _userId    = '';
  private _idbPrefix = '';  // userId + '/'

  get isReady()      { return this._ready; }
  get mode()         { return this._mode; }
  get canSaveToDisk(){ return this._mode === 'fsaa'; }

  // Prefix all FILE_STORE keys so each account's data is isolated.
  private k(path: string): string { return this._idbPrefix + path; }

  // Per-user localStorage settings key, with legacy fallback.
  private get settingsLsKey(): string {
    return this._userId ? `yt-analyzer-settings:${this._userId}` : 'yt-analyzer-settings';
  }

  // Call once on app start with the authenticated user's ID.
  // Returns true if storage is immediately usable.
  async init(userId: string): Promise<boolean> {
    // Reset all state so re-init with a different user is clean.
    this._userId    = userId;
    this._idbPrefix = userId ? userId + '/' : '';
    this.root       = null;
    this._mode      = 'idb';
    this._ready     = false;

    this.db = await openIDB();

    if (fsaaSupported()) {
      const userKey = userId ? 'root:' + userId : 'root';
      let saved = await idbGet<FileSystemDirectoryHandle>(this.db, HANDLE_STORE, userKey);

      // Backward compat: migrate legacy 'root' handle to this user's key.
      if (!saved && userId) {
        const legacy = await idbGet<FileSystemDirectoryHandle>(this.db, HANDLE_STORE, 'root');
        if (legacy) {
          saved = await this._claimLegacyFsaaHandle(legacy, userId);
          if (saved) {
            await idbPut(this.db, HANDLE_STORE, userKey, saved);
            await idbDelete(this.db, HANDLE_STORE, 'root');
          }
        }
      }

      if (saved) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let perm = await (saved as any).queryPermission({ mode: 'readwrite' });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (perm === 'prompt') perm = await (saved as any).requestPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            this.root   = saved;
            this._mode  = 'fsaa';
            this._ready = true;
            return true;
          }
        } catch { /* fall through to folder picker */ }
      }
      return false;
    }

    // IDB fallback mode — no folder picker needed.
    this._mode  = 'idb';
    this._ready = true;
    // Migrate legacy (un-prefixed) keys to this user's namespace.
    if (userId) await this._migrateIdbLegacy();
    return true;
  }

  // Shows the native directory picker.
  // Throws an Error with message starting with 'OWNER:' if the folder belongs to another account.
  // Returns true on success, false if user cancelled.
  async pickDirectory(userEmail = ''): Promise<boolean> {
    if (!fsaaSupported() || !this.db) return false;
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch {
      return false; // user cancelled or browser blocked
    }

    const ownerMsg = await this._checkFolderOwnership(handle);
    if (ownerMsg) throw new Error('OWNER:' + ownerMsg);

    // Claim the folder.
    await fsaaWriteText(handle, [], '.reeliq-owner',
      JSON.stringify({ userId: this._userId, email: userEmail } satisfies OwnerFile));

    const userKey = this._userId ? 'root:' + this._userId : 'root';
    await idbPut(this.db, HANDLE_STORE, userKey, handle);
    this.root   = handle;
    this._mode  = 'fsaa';
    this._ready = true;
    return true;
  }

  // ─── Ownership helpers ────────────────────────────────────────────────

  private async _checkFolderOwnership(handle: FileSystemDirectoryHandle): Promise<string | null> {
    try {
      const f = await (await handle.getFileHandle('.reeliq-owner')).getFile();
      const data = JSON.parse(await f.text()) as Partial<OwnerFile>;
      if (data.userId && data.userId !== this._userId) {
        const who = data.email ? `the account "${data.email}"` : 'another account';
        return `This folder is already used by ${who}. Please choose or create a different folder.`;
      }
    } catch { /* no owner file — folder is unclaimed */ }
    return null;
  }

  // Attempt to claim the legacy (un-owned) FSAA handle for the current user.
  // Returns the handle if claimed, null if already owned by someone else.
  private async _claimLegacyFsaaHandle(
    handle: FileSystemDirectoryHandle,
    userId: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let perm = await (handle as any).queryPermission({ mode: 'readwrite' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (perm === 'prompt') perm = await (handle as any).requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return null;

      const ownerRaw = await fsaaReadText(handle, [], '.reeliq-owner');
      if (ownerRaw) {
        const data = JSON.parse(ownerRaw) as Partial<OwnerFile>;
        // If owned by a different user, don't claim it.
        if (data.userId && data.userId !== userId) return null;
      }

      // Write/update the owner file.
      await fsaaWriteText(handle, [], '.reeliq-owner',
        JSON.stringify({ userId, email: '' } satisfies OwnerFile));
      return handle;
    } catch { return null; }
  }

  // Migrate legacy IDB file keys (e.g. `projects/...`) to the user-namespaced form.
  private async _migrateIdbLegacy(): Promise<void> {
    if (!this.db || !this._idbPrefix) return;
    const allKeys = await idbAllKeys(this.db, FILE_STORE);
    // If the user already has namespaced data, skip migration.
    if (allKeys.some(k => k.startsWith(this._idbPrefix))) return;

    const LEGACY = ['projects/', 'research/', 'media:', 'audio:'];
    const legacyKeys = allKeys.filter(k => LEGACY.some(p => k.startsWith(p)));
    for (const key of legacyKeys) {
      const val = await idbGet<unknown>(this.db, FILE_STORE, key);
      if (val !== null) {
        await idbPut(this.db, FILE_STORE, this.k(key), val);
        await idbDelete(this.db, FILE_STORE, key);
      }
    }

    // Migrate localStorage settings.
    const legacySettings = localStorage.getItem('yt-analyzer-settings');
    if (legacySettings && !localStorage.getItem(this.settingsLsKey)) {
      localStorage.setItem(this.settingsLsKey, legacySettings);
      localStorage.removeItem('yt-analyzer-settings');
    }
  }

  // ─── Settings ─────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings> {
    let raw: string | null = null;
    if (this._mode === 'fsaa' && this.root) {
      raw = await fsaaReadText(this.root, [], 'settings.json');
    } else {
      raw = localStorage.getItem(this.settingsLsKey);
      // Backward compat: if no user-scoped key, check and migrate the legacy key.
      if (!raw && this._userId) {
        const legacy = localStorage.getItem('yt-analyzer-settings');
        if (legacy) {
          localStorage.setItem(this.settingsLsKey, legacy);
          localStorage.removeItem('yt-analyzer-settings');
          raw = legacy;
        }
      }
    }
    if (!raw) return { ...DEFAULT_SETTINGS };
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; }
    catch { return { ...DEFAULT_SETTINGS }; }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const json = JSON.stringify(settings, null, 2);
    if (this._mode === 'fsaa' && this.root) {
      await fsaaWriteText(this.root, [], 'settings.json', json);
    } else {
      localStorage.setItem(this.settingsLsKey, json);
    }
  }

  // ─── Projects ─────────────────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    if (this._mode === 'fsaa' && this.root) {
      const dirs = (await fsaaListDir(this.root, ['projects']))
        .filter(e => e.kind === 'directory').map(e => e.name);
      return (await Promise.all(
        dirs.map(id => this._fsaaReadJson<Project>(['projects', id], 'project.json')),
      )).filter(Boolean) as Project[];
    }
    return this._idbListJson<Project>('projects/', '/project.json');
  }

  async getProject(id: string): Promise<Project | null> {
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaReadJson<Project>(['projects', id], 'project.json');
    return this._idbReadJson<Project>(`projects/${id}/project.json`);
  }

  async saveProject(project: Project): Promise<void> {
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaWriteJson(['projects', project.id], 'project.json', project);
    await this._idbWriteJson(`projects/${project.id}/project.json`, project);
  }

  async deleteProject(id: string): Promise<void> {
    if (this._mode === 'fsaa' && this.root)
      return fsaaDeleteEntry(this.root, ['projects'], id, true);
    await this._idbDeletePrefix(`projects/${id}/`);
  }

  // ─── Analyses ─────────────────────────────────────────────────────────

  async listAnalyses(projectId: string): Promise<Analysis[]> {
    if (this._mode === 'fsaa' && this.root) {
      const files = (await fsaaListDir(this.root, ['projects', projectId, 'analyses']))
        .filter(e => e.kind === 'file' && e.name.endsWith('.json')).map(e => e.name);
      return (await Promise.all(
        files.map(f => this._fsaaReadJson<Analysis>(['projects', projectId, 'analyses'], f)),
      )).filter(Boolean) as Analysis[];
    }
    return this._idbListJsonWithSuffix<Analysis>(`projects/${projectId}/analyses/`, '.json');
  }

  async getAnalysis(projectId: string, analysisId: string): Promise<Analysis | null> {
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaReadJson<Analysis>(['projects', projectId, 'analyses'], `${analysisId}.json`);
    return this._idbReadJson<Analysis>(`projects/${projectId}/analyses/${analysisId}.json`);
  }

  async saveAnalysis(projectId: string, analysis: Analysis): Promise<void> {
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaWriteJson(['projects', projectId, 'analyses'], `${analysis.id}.json`, analysis);
    await this._idbWriteJson(`projects/${projectId}/analyses/${analysis.id}.json`, analysis);
  }

  async deleteAnalysis(projectId: string, analysisId: string): Promise<void> {
    if (this._mode === 'fsaa' && this.root)
      return fsaaDeleteEntry(this.root, ['projects', projectId, 'analyses'], `${analysisId}.json`);
    await this._idbDeleteKey(`projects/${projectId}/analyses/${analysisId}.json`);
  }

  // ─── Scripts ──────────────────────────────────────────────────────────

  async listScripts(projectId: string): Promise<Script[]> {
    if (this._mode === 'fsaa' && this.root) {
      const dirs = (await fsaaListDir(this.root, ['projects', projectId, 'scripts']))
        .filter(e => e.kind === 'directory').map(e => e.name);
      return (await Promise.all(
        dirs.map(id => this._fsaaReadJson<Script>(['projects', projectId, 'scripts', id], 'script.json')),
      )).filter(Boolean) as Script[];
    }
    return this._idbListJson<Script>(`projects/${projectId}/scripts/`, '/script.json');
  }

  async getScript(projectId: string, scriptId: string): Promise<Script | null> {
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaReadJson<Script>(['projects', projectId, 'scripts', scriptId], 'script.json');
    return this._idbReadJson<Script>(`projects/${projectId}/scripts/${scriptId}/script.json`);
  }

  async saveScript(projectId: string, script: Script): Promise<void> {
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaWriteJson(['projects', projectId, 'scripts', script.id], 'script.json', script);
    await this._idbWriteJson(`projects/${projectId}/scripts/${script.id}/script.json`, script);
  }

  async deleteScript(projectId: string, scriptId: string): Promise<void> {
    if (this._mode === 'fsaa' && this.root)
      return fsaaDeleteEntry(this.root, ['projects', projectId, 'scripts'], scriptId, true);
    await this._idbDeletePrefix(`projects/${projectId}/scripts/${scriptId}/`);
  }

  // ─── Media files ──────────────────────────────────────────────────────

  async saveMediaFile(
    projectId: string, scriptId: string, sceneId: string,
    filename: string, buffer: ArrayBuffer, originalName: string, type: MediaFile['type'],
  ): Promise<MediaFile> {
    const mediaFile: MediaFile = {
      id: crypto.randomUUID(),
      type,
      filename,
      originalName,
      uploadedAt: new Date().toISOString(),
    };
    if (this._mode === 'fsaa' && this.root) {
      await fsaaWriteBinary(
        this.root,
        ['projects', projectId, 'scripts', scriptId, 'scenes', sceneId, 'media'],
        filename, buffer,
      );
    } else {
      await idbPut(this.db!, FILE_STORE, this.k(`media:${projectId}/${scriptId}/${sceneId}/${filename}`), buffer);
    }
    return mediaFile;
  }

  async deleteMediaFile(
    projectId: string, scriptId: string, sceneId: string, filename: string,
  ): Promise<void> {
    if (this._mode === 'fsaa' && this.root) {
      await fsaaDeleteEntry(
        this.root,
        ['projects', projectId, 'scripts', scriptId, 'scenes', sceneId, 'media'],
        filename,
      );
    } else {
      await idbDelete(this.db!, FILE_STORE, this.k(`media:${projectId}/${scriptId}/${sceneId}/${filename}`));
    }
  }

  async getMediaObjectUrl(
    projectId: string, scriptId: string, sceneId: string, filename: string,
  ): Promise<string | null> {
    if (this._mode === 'fsaa' && this.root) {
      return fsaaGetObjectUrl(
        this.root,
        ['projects', projectId, 'scripts', scriptId, 'scenes', sceneId, 'media'],
        filename,
      );
    }
    const buf = await idbGet<ArrayBuffer>(this.db!, FILE_STORE, this.k(`media:${projectId}/${scriptId}/${sceneId}/${filename}`));
    if (!buf) return null;
    return URL.createObjectURL(new Blob([buf]));
  }

  // ─── Audio files ──────────────────────────────────────────────────────

  async saveAudioFile(
    projectId: string, scriptId: string, sceneId: string,
    filename: string, buffer: ArrayBuffer,
  ): Promise<void> {
    if (this._mode === 'fsaa' && this.root) {
      await fsaaWriteBinary(
        this.root,
        ['projects', projectId, 'scripts', scriptId, 'scenes', sceneId],
        filename, buffer,
      );
    } else {
      await idbPut(this.db!, FILE_STORE, this.k(`audio:${projectId}/${scriptId}/${sceneId}/${filename}`), buffer);
    }
  }

  async deleteAudioFile(
    projectId: string, scriptId: string, sceneId: string, filename: string,
  ): Promise<void> {
    if (this._mode === 'fsaa' && this.root) {
      await fsaaDeleteEntry(
        this.root,
        ['projects', projectId, 'scripts', scriptId, 'scenes', sceneId],
        filename,
      );
    } else {
      await idbDelete(this.db!, FILE_STORE, this.k(`audio:${projectId}/${scriptId}/${sceneId}/${filename}`));
    }
  }

  async getAudioObjectUrl(
    projectId: string, scriptId: string, sceneId: string, filename: string,
  ): Promise<string | null> {
    if (this._mode === 'fsaa' && this.root) {
      return fsaaGetObjectUrl(
        this.root,
        ['projects', projectId, 'scripts', scriptId, 'scenes', sceneId],
        filename,
      );
    }
    const buf = await idbGet<ArrayBuffer>(this.db!, FILE_STORE, this.k(`audio:${projectId}/${scriptId}/${sceneId}/${filename}`));
    if (!buf) return null;
    return URL.createObjectURL(new Blob([buf]));
  }

  // ─── Bookmarks ────────────────────────────────────────────────────────

  async listBookmarks(): Promise<ChannelBookmark[]> {
    if (this._mode === 'fsaa' && this.root) {
      const files = (await fsaaListDir(this.root, ['research', 'bookmarks']))
        .filter(e => e.kind === 'file' && e.name.endsWith('.json')).map(e => e.name);
      return (await Promise.all(
        files.map(f => this._fsaaReadJson<ChannelBookmark>(['research', 'bookmarks'], f)),
      )).filter(Boolean) as ChannelBookmark[];
    }
    return this._idbListJson<ChannelBookmark>('research/bookmarks/', '.json');
  }

  async getBookmark(channelId: string): Promise<ChannelBookmark | null> {
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaReadJson<ChannelBookmark>(['research', 'bookmarks'], `${channelId}.json`);
    return this._idbReadJson<ChannelBookmark>(`research/bookmarks/${channelId}.json`);
  }

  async saveBookmark(bookmark: ChannelBookmark): Promise<void> {
    const id = bookmark.channel.id;
    if (this._mode === 'fsaa' && this.root)
      return this._fsaaWriteJson(['research', 'bookmarks'], `${id}.json`, bookmark);
    await this._idbWriteJson(`research/bookmarks/${id}.json`, bookmark);
  }

  async deleteBookmark(channelId: string): Promise<void> {
    if (this._mode === 'fsaa' && this.root)
      return fsaaDeleteEntry(this.root, ['research', 'bookmarks'], `${channelId}.json`);
    await this._idbDeleteKey(`research/bookmarks/${channelId}.json`);
  }

  // ─── Export (Save to Disk) ────────────────────────────────────────────

  async saveScriptToDisk(projectId: string, script: Script, projectName: string): Promise<string> {
    if (!this.canSaveToDisk || !this.root) {
      throw new Error('Save to Disk requires a picked storage folder (not supported in this browser).');
    }
    const safe = (s: string) =>
      s
        .replace(/[\x00-\x1f\x7f]/g, '')
        .replace(/[/\\?%*:|"<>.]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50)
        .trim()
        || 'untitled';
    const folder = `${safe(projectName)} - ${safe(script.title)}`;

    for (const scene of script.scenes) {
      const sceneDir = `scene_${String(scene.number).padStart(3, '0')}_${safe(scene.title)}`;
      const base     = ['exports', folder, sceneDir];

      await this._fsaaWriteJson(base, 'scene.json', scene);

      for (const mf of scene.mediaFiles ?? []) {
        const buf = await fsaaReadBinary(
          this.root,
          ['projects', projectId, 'scripts', script.id, 'scenes', scene.id, 'media'],
          mf.filename,
        );
        if (buf) await fsaaWriteBinary(this.root, [...base, 'media'], mf.filename, buf);
      }

      if (scene.audioFile) {
        const buf = await fsaaReadBinary(
          this.root,
          ['projects', projectId, 'scripts', script.id, 'scenes', scene.id],
          scene.audioFile,
        );
        if (buf) await fsaaWriteBinary(this.root, base, scene.audioFile, buf);
      }
    }

    return folder;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────

  private async _fsaaReadJson<T>(dir: string[], name: string): Promise<T | null> {
    if (!this.root) return null;
    const raw = await fsaaReadText(this.root, dir, name);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  private async _fsaaWriteJson(dir: string[], name: string, data: unknown): Promise<void> {
    if (!this.root) return;
    await fsaaWriteText(this.root, dir, name, JSON.stringify(data, null, 2));
  }

  private async _idbReadJson<T>(key: string): Promise<T | null> {
    if (!this.db) return null;
    const raw = await idbGet<string>(this.db, FILE_STORE, this.k(key));
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  private async _idbWriteJson(key: string, data: unknown): Promise<void> {
    if (!this.db) return;
    await idbPut(this.db, FILE_STORE, this.k(key), JSON.stringify(data));
  }

  private async _idbDeleteKey(key: string): Promise<void> {
    if (!this.db) return;
    await idbDelete(this.db, FILE_STORE, this.k(key));
  }

  private async _idbDeletePrefix(prefix: string): Promise<void> {
    if (!this.db) return;
    const full  = this.k(prefix);
    const keys  = await idbAllKeys(this.db, FILE_STORE);
    await Promise.all(keys.filter(k => k.startsWith(full)).map(k => idbDelete(this.db!, FILE_STORE, k)));
  }

  private async _idbListJson<T>(prefix: string, suffix: string): Promise<T[]> {
    if (!this.db) return [];
    const full = this.k(prefix);
    const keys = await idbAllKeys(this.db, FILE_STORE);
    const hits  = keys.filter(k => k.startsWith(full) && k.endsWith(suffix));
    return (await Promise.all(hits.map(k => this._idbReadJsonRaw<T>(k)))).filter(Boolean) as T[];
  }

  private async _idbListJsonWithSuffix<T>(prefix: string, suffix: string): Promise<T[]> {
    return this._idbListJson<T>(prefix, suffix);
  }

  // Reads a raw (already-prefixed) IDB key directly.
  private async _idbReadJsonRaw<T>(rawKey: string): Promise<T | null> {
    if (!this.db) return null;
    const raw = await idbGet<string>(this.db, FILE_STORE, rawKey);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
}

// Singleton — import this in components and pages.
export const storage = new ClientStorage();
