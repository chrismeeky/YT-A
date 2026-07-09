// Cloud storage backend — persists all data to Supabase (Postgres + Storage).
// Extends ClientStorage so it satisfies the exact same interface used across the
// app via useStorage(); only the data methods are overridden to hit Supabase.
//
// Settings stay local (they hold secret API keys) — inherited from ClientStorage.
// JSON documents (projects / analyses / scripts / bookmarks) → Postgres tables.
// Media & audio binaries → the private 'media' Storage bucket.

import { ClientStorage } from './client-storage';
import { getBrowserSupabase } from './supabase';
import { DEFAULT_SETTINGS, type Project, type Analysis, type Script, type MediaFile, type ChannelBookmark, type AppSettings } from './types';

const BUCKET = 'media';

function contentTypeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg',
  };
  return map[ext] ?? 'application/octet-stream';
}

export class CloudStorage extends ClientStorage {
  private get sb() {
    const db = getBrowserSupabase();
    if (!db) throw new Error('Supabase is not configured (missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).');
    return db;
  }

  // No local folder/IDB needed — settings use localStorage (inherited), everything
  // else is remote. Always ready once we know the user.
  async init(userId: string): Promise<boolean> {
    this._userId = userId;
    this._idbPrefix = userId ? userId + '/' : '';
    this._mode = 'idb';
    this._ready = true;
    return true;
  }

  // ─── Settings (cloud, API keys encrypted server-side) ─────────────────
  private async authToken(): Promise<string | null> {
    const { data } = await this.sb.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async getSettings(): Promise<AppSettings> {
    const token = await this.authToken();
    // Not signed in — fall back to whatever is stored locally.
    if (!token) return super.getSettings();
    try {
      const res = await fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return super.getSettings();
      const { settings } = await res.json() as { settings: AppSettings | null };
      if (settings) return { ...DEFAULT_SETTINGS, ...settings };

      // No cloud settings row yet. This happens for accounts that migrated
      // before settings were part of the migration — their keys still live
      // on-device (localStorage or a picked folder). Read them via a properly
      // initialized local instance and back-fill the cloud, once per session.
      if (!this._settingsBackfillTried) {
        this._settingsBackfillTried = true;
        let local: AppSettings;
        try {
          const localStore = new ClientStorage();
          const ready = await localStore.init(this._userId);
          local = ready ? await localStore.getSettings() : await super.getSettings();
        } catch {
          local = await super.getSettings();
        }
        if (this._hasApiKeys(local)) {
          try { await this.saveSettings(local); } catch { /* best-effort */ }
        }
        return local;
      }
      return { ...DEFAULT_SETTINGS };
    } catch {
      return super.getSettings();
    }
  }

  private _settingsBackfillTried = false;

  private _hasApiKeys(s: AppSettings): boolean {
    const keys: (keyof AppSettings)[] = [
      'anthropicApiKey', 'xaiApiKey', 'elevenLabsApiKey',
      'cartesiaApiKey', 'pexelsApiKey', 'braveApiKey', 'youtubeApiKey',
    ];
    return keys.some(k => typeof s[k] === 'string' && (s[k] as string).length > 0);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const token = await this.authToken();
    if (!token) throw new Error('Not signed in — cannot save settings.');
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ settings }),
    });
    if (!res.ok) throw new Error(`Failed to save settings (${res.status}).`);
  }

  // ─── Projects ─────────────────────────────────────────────────────────
  async listProjects(): Promise<Project[]> {
    const { data, error } = await this.sb.from('projects').select('data').order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(r => r.data as Project);
  }

  async getProject(id: string): Promise<Project | null> {
    const { data, error } = await this.sb.from('projects').select('data').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data?.data as Project) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    const { error } = await this.sb.from('projects').upsert({
      id: project.id, user_id: this._userId, data: project, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async deleteProject(id: string): Promise<void> {
    // No FK cascade — remove children, media, then the project row.
    await this.sb.from('scripts').delete().eq('project_id', id);
    await this.sb.from('analyses').delete().eq('project_id', id);
    await this._removeStoragePrefix(`${this._userId}/media/${id}/`);
    await this._removeStoragePrefix(`${this._userId}/audio/${id}/`);
    const { error } = await this.sb.from('projects').delete().eq('id', id);
    if (error) throw error;
  }

  // ─── Analyses ─────────────────────────────────────────────────────────
  async listAnalyses(projectId: string): Promise<Analysis[]> {
    const { data, error } = await this.sb.from('analyses').select('data').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map(r => r.data as Analysis);
  }

  async getAnalysis(projectId: string, analysisId: string): Promise<Analysis | null> {
    const { data, error } = await this.sb.from('analyses').select('data').eq('id', analysisId).maybeSingle();
    if (error) throw error;
    return (data?.data as Analysis) ?? null;
  }

  async saveAnalysis(projectId: string, analysis: Analysis): Promise<void> {
    const { error } = await this.sb.from('analyses').upsert({
      id: analysis.id, project_id: projectId, user_id: this._userId, data: analysis, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async deleteAnalysis(projectId: string, analysisId: string): Promise<void> {
    const { error } = await this.sb.from('analyses').delete().eq('id', analysisId);
    if (error) throw error;
  }

  // ─── Scripts ──────────────────────────────────────────────────────────
  async listScripts(projectId: string): Promise<Script[]> {
    const { data, error } = await this.sb.from('scripts').select('data').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []).map(r => r.data as Script);
  }

  async getScript(projectId: string, scriptId: string): Promise<Script | null> {
    const { data, error } = await this.sb.from('scripts').select('data').eq('id', scriptId).maybeSingle();
    if (error) throw error;
    return (data?.data as Script) ?? null;
  }

  async saveScript(projectId: string, script: Script): Promise<void> {
    const { error } = await this.sb.from('scripts').upsert({
      id: script.id, project_id: projectId, user_id: this._userId, data: script, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async deleteScript(projectId: string, scriptId: string): Promise<void> {
    await this._removeStoragePrefix(`${this._userId}/media/${projectId}/${scriptId}/`);
    await this._removeStoragePrefix(`${this._userId}/audio/${projectId}/${scriptId}/`);
    const { error } = await this.sb.from('scripts').delete().eq('id', scriptId);
    if (error) throw error;
  }

  // ─── Bookmarks ────────────────────────────────────────────────────────
  async listBookmarks(): Promise<ChannelBookmark[]> {
    const { data, error } = await this.sb.from('bookmarks').select('data');
    if (error) throw error;
    return (data ?? []).map(r => r.data as ChannelBookmark);
  }

  async getBookmark(channelId: string): Promise<ChannelBookmark | null> {
    const { data, error } = await this.sb.from('bookmarks').select('data').eq('id', channelId).maybeSingle();
    if (error) throw error;
    return (data?.data as ChannelBookmark) ?? null;
  }

  async saveBookmark(bookmark: ChannelBookmark): Promise<void> {
    const { error } = await this.sb.from('bookmarks').upsert({
      id: bookmark.channel.id, user_id: this._userId, data: bookmark, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  }

  async deleteBookmark(channelId: string): Promise<void> {
    const { error } = await this.sb.from('bookmarks').delete().eq('id', channelId);
    if (error) throw error;
  }

  // ─── Media files (Storage bucket) ─────────────────────────────────────
  private mediaPath(projectId: string, scriptId: string, sceneId: string, filename: string): string {
    return `${this._userId}/media/${projectId}/${scriptId}/${sceneId}/${filename}`;
  }
  private audioPath(projectId: string, scriptId: string, sceneId: string, filename: string): string {
    return `${this._userId}/audio/${projectId}/${scriptId}/${sceneId}/${filename}`;
  }

  async saveMediaFile(
    projectId: string, scriptId: string, sceneId: string,
    filename: string, buffer: ArrayBuffer, originalName: string, type: MediaFile['type'],
  ): Promise<MediaFile> {
    const { error } = await this.sb.storage.from(BUCKET).upload(
      this.mediaPath(projectId, scriptId, sceneId, filename),
      buffer,
      { upsert: true, contentType: contentTypeFor(filename) },
    );
    if (error) throw error;
    return { id: crypto.randomUUID(), type, filename, originalName, uploadedAt: new Date().toISOString() };
  }

  async deleteMediaFile(projectId: string, scriptId: string, sceneId: string, filename: string): Promise<void> {
    await this.sb.storage.from(BUCKET).remove([this.mediaPath(projectId, scriptId, sceneId, filename)]);
  }

  async getMediaObjectUrl(projectId: string, scriptId: string, sceneId: string, filename: string): Promise<string | null> {
    const { data, error } = await this.sb.storage.from(BUCKET)
      .createSignedUrl(this.mediaPath(projectId, scriptId, sceneId, filename), 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  // ─── Audio files (Storage bucket) ─────────────────────────────────────
  async saveAudioFile(
    projectId: string, scriptId: string, sceneId: string, filename: string, buffer: ArrayBuffer,
  ): Promise<void> {
    const { error } = await this.sb.storage.from(BUCKET).upload(
      this.audioPath(projectId, scriptId, sceneId, filename),
      buffer,
      { upsert: true, contentType: contentTypeFor(filename) },
    );
    if (error) throw error;
  }

  async deleteAudioFile(projectId: string, scriptId: string, sceneId: string, filename: string): Promise<void> {
    await this.sb.storage.from(BUCKET).remove([this.audioPath(projectId, scriptId, sceneId, filename)]);
  }

  async getAudioObjectUrl(projectId: string, scriptId: string, sceneId: string, filename: string): Promise<string | null> {
    const { data, error } = await this.sb.storage.from(BUCKET)
      .createSignedUrl(this.audioPath(projectId, scriptId, sceneId, filename), 3600);
    if (error) return null;
    return data?.signedUrl ?? null;
  }

  // ─── Internal: recursively remove a Storage path prefix ───────────────
  private async _removeStoragePrefix(prefix: string): Promise<void> {
    // Supabase Storage has no recursive delete; list then remove.
    const stack = [prefix.replace(/\/$/, '')];
    const toRemove: string[] = [];
    while (stack.length) {
      const dir = stack.pop()!;
      const { data } = await this.sb.storage.from(BUCKET).list(dir, { limit: 1000 });
      for (const entry of data ?? []) {
        const full = `${dir}/${entry.name}`;
        // Files have metadata / an id; folders don't.
        if (entry.id) toRemove.push(full);
        else stack.push(full);
      }
    }
    if (toRemove.length) await this.sb.storage.from(BUCKET).remove(toRemove);
  }

  // ─── One-time migration: local (IndexedDB / picked folder) → cloud ────
  // Reads existing on-device data via an already-initialized ClientStorage and
  // pushes it up. The caller owns the local instance (and any folder picking).
  //
  // Two passes: first scan the whole library to build a task list (so we know
  // the total up front), then upload each item, reporting granular progress so
  // the UI never looks stuck on a single long step.
  async migrateFromLocal(
    local: ClientStorage,
    onProgress?: (p: { message: string; uploaded: number; total: number }) => void,
  ): Promise<{ projects: number; analyses: number; scripts: number; bookmarks: number; media: number }> {
    type Task =
      | { kind: 'project'; label: string; project: Project }
      | { kind: 'analysis'; label: string; projectId: string; analysis: Analysis }
      | { kind: 'script'; label: string; projectId: string; script: Script }
      | { kind: 'media'; label: string; projectId: string; scriptId: string; sceneId: string; mf: MediaFile }
      | { kind: 'audio'; label: string; projectId: string; scriptId: string; sceneId: string; filename: string }
      | { kind: 'bookmark'; label: string; bookmark: ChannelBookmark }
      | { kind: 'settings'; label: string; settings: AppSettings };

    // ── Pass 1: scan ──────────────────────────────────────────────────
    onProgress?.({ message: 'Scanning your library…', uploaded: 0, total: 0 });
    const tasks: Task[] = [];
    const projects = await local.listProjects();
    for (const project of projects) {
      tasks.push({ kind: 'project', label: `Project “${project.name}”`, project });

      for (const analysis of await local.listAnalyses(project.id)) {
        tasks.push({ kind: 'analysis', label: `Analysis “${analysis.name || analysis.channelName || 'Channel'}”`, projectId: project.id, analysis });
      }

      for (const script of await local.listScripts(project.id)) {
        tasks.push({ kind: 'script', label: `Script “${script.title}”`, projectId: project.id, script });
        for (const scene of script.scenes ?? []) {
          for (const mf of scene.mediaFiles ?? []) {
            const noun = mf.type === 'video' ? 'video' : mf.type === 'audio' ? 'audio' : 'image';
            tasks.push({ kind: 'media', label: `${noun} for “${script.title}”`, projectId: project.id, scriptId: script.id, sceneId: scene.id, mf });
          }
          if (scene.audioFile) {
            tasks.push({ kind: 'audio', label: `narration audio for “${script.title}”`, projectId: project.id, scriptId: script.id, sceneId: scene.id, filename: scene.audioFile });
          }
        }
      }
    }
    for (const bookmark of await local.listBookmarks()) {
      tasks.push({ kind: 'bookmark', label: `Bookmark “${bookmark.channel.title ?? 'channel'}”`, bookmark });
    }

    // Settings (incl. API keys) — uploaded first so keys are available immediately.
    tasks.unshift({ kind: 'settings', label: 'settings & API keys', settings: await local.getSettings() });

    // ── Pass 2: upload ────────────────────────────────────────────────
    const counts = { projects: 0, analyses: 0, scripts: 0, bookmarks: 0, media: 0 };
    const total = tasks.length;
    let uploaded = 0;

    const fetchBuffer = async (url: string | null): Promise<ArrayBuffer | null> => {
      if (!url) return null;
      try { return await (await fetch(url)).arrayBuffer(); } catch { return null; }
    };

    for (const task of tasks) {
      onProgress?.({ message: `Uploading ${task.label}…`, uploaded, total });
      switch (task.kind) {
        case 'project':  await this.saveProject(task.project); counts.projects++; break;
        case 'analysis': await this.saveAnalysis(task.projectId, task.analysis); counts.analyses++; break;
        case 'script':   await this.saveScript(task.projectId, task.script); counts.scripts++; break;
        case 'media': {
          const buf = await fetchBuffer(await local.getMediaObjectUrl(task.projectId, task.scriptId, task.sceneId, task.mf.filename));
          if (buf) { await this.saveMediaFile(task.projectId, task.scriptId, task.sceneId, task.mf.filename, buf, task.mf.originalName, task.mf.type); counts.media++; }
          break;
        }
        case 'audio': {
          const buf = await fetchBuffer(await local.getAudioObjectUrl(task.projectId, task.scriptId, task.sceneId, task.filename));
          if (buf) await this.saveAudioFile(task.projectId, task.scriptId, task.sceneId, task.filename, buf);
          break;
        }
        case 'bookmark': await this.saveBookmark(task.bookmark); counts.bookmarks++; break;
        case 'settings': await this.saveSettings(task.settings); break;
      }
      uploaded++;
      onProgress?.({ message: `Uploading ${task.label}…`, uploaded, total });
    }

    onProgress?.({ message: 'Migration complete.', uploaded, total });
    return counts;
  }
}

// Singleton — the app's storage backend.
export const cloudStorage = new CloudStorage();
