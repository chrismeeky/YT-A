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
  for (const p of parts) cur = await cur.getDirectoryHandle(p, { create });
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

// ─── ClientStorage class ───────────────────────────────────────────────────

export class ClientStorage {
  private db:   IDBDatabase | null = null;
  private root: FileSystemDirectoryHandle | null = null;
  private _mode:  'fsaa' | 'idb' = 'idb';
  private _ready = false;

  get isReady()      { return this._ready; }
  get mode()         { return this._mode; }
  get canSaveToDisk(){ return this._mode === 'fsaa'; }

  // Call once on app start. Returns true if storage is immediately usable.
  async init(): Promise<boolean> {
    this.db = await openIDB();

    if (fsaaSupported()) {
      const saved = await idbGet<FileSystemDirectoryHandle>(this.db, HANDLE_STORE, 'root');
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
        } catch { /* fall through to IDB */ }
      }
      // FSAA available but no handle yet — caller shows folder picker
      return false;
    }

    // FSAA not supported → use IDB automatically
    this._mode  = 'idb';
    this._ready = true;
    return true;
  }

  // Shows the native directory picker. Returns true on success.
  async pickDirectory(): Promise<boolean> {
    if (!fsaaSupported() || !this.db) return false;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await idbPut(this.db, HANDLE_STORE, 'root', handle);
      this.root   = handle;
      this._mode  = 'fsaa';
      this._ready = true;
      return true;
    } catch { return false; }
  }

  // ─── Settings ─────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings> {
    let raw: string | null = null;
    if (this._mode === 'fsaa' && this.root) {
      raw = await fsaaReadText(this.root, [], 'settings.json');
    } else {
      raw = localStorage.getItem('yt-analyzer-settings');
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
      localStorage.setItem('yt-analyzer-settings', json);
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
      await idbPut(this.db!, FILE_STORE, `media:${projectId}/${scriptId}/${sceneId}/${filename}`, buffer);
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
      await idbDelete(this.db!, FILE_STORE, `media:${projectId}/${scriptId}/${sceneId}/${filename}`);
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
    const buf = await idbGet<ArrayBuffer>(this.db!, FILE_STORE, `media:${projectId}/${scriptId}/${sceneId}/${filename}`);
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
      await idbPut(this.db!, FILE_STORE, `audio:${projectId}/${scriptId}/${sceneId}/${filename}`, buffer);
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
      await idbDelete(this.db!, FILE_STORE, `audio:${projectId}/${scriptId}/${sceneId}/${filename}`);
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
    const buf = await idbGet<ArrayBuffer>(this.db!, FILE_STORE, `audio:${projectId}/${scriptId}/${sceneId}/${filename}`);
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

  // Returns the export folder name. Only works in FSAA mode.
  async saveScriptToDisk(projectId: string, script: Script, projectName: string): Promise<string> {
    if (!this.canSaveToDisk || !this.root) {
      throw new Error('Save to Disk requires a picked storage folder (not supported in this browser).');
    }
    const safe   = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 50);
    const folder = `${safe(projectName)} — ${safe(script.title)}`;

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
    const raw = await idbGet<string>(this.db, FILE_STORE, key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  private async _idbWriteJson(key: string, data: unknown): Promise<void> {
    if (!this.db) return;
    await idbPut(this.db, FILE_STORE, key, JSON.stringify(data));
  }

  private async _idbDeleteKey(key: string): Promise<void> {
    if (!this.db) return;
    await idbDelete(this.db, FILE_STORE, key);
  }

  private async _idbDeletePrefix(prefix: string): Promise<void> {
    if (!this.db) return;
    const keys = await idbAllKeys(this.db, FILE_STORE);
    await Promise.all(keys.filter(k => k.startsWith(prefix)).map(k => idbDelete(this.db!, FILE_STORE, k)));
  }

  // Lists JSON files whose keys match: prefix + <anything> + suffix
  private async _idbListJson<T>(prefix: string, suffix: string): Promise<T[]> {
    if (!this.db) return [];
    const keys = await idbAllKeys(this.db, FILE_STORE);
    const hits  = keys.filter(k => k.startsWith(prefix) && k.endsWith(suffix));
    return (await Promise.all(hits.map(k => this._idbReadJson<T>(k)))).filter(Boolean) as T[];
  }

  private async _idbListJsonWithSuffix<T>(prefix: string, suffix: string): Promise<T[]> {
    return this._idbListJson<T>(prefix, suffix);
  }
}

// Singleton — import this in components and pages.
export const storage = new ClientStorage();
