import fs from 'fs';
import path from 'path';
import os from 'os';
import type { Project, Analysis, Script, AppSettings, MediaFile } from './types';
import { DEFAULT_SETTINGS } from './types';

function getStorageRoot(): string {
  const envPath = process.env.STORAGE_PATH;
  if (envPath) return envPath;

  const settingsPath = path.join(os.homedir(), '.youtube-analyzer', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as AppSettings;
      if (s.storagePath) return s.storagePath;
    } catch {
      // ignore
    }
  }
  return path.join(os.homedir(), 'Documents', 'YoutubeAnalyzer');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJSON(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Settings ──────────────────────────────────────────────────────────────

const SETTINGS_FILE = path.join(os.homedir(), '.youtube-analyzer', 'settings.json');

export function getSettings(): AppSettings {
  const saved = readJSON<Partial<AppSettings>>(SETTINGS_FILE);
  return {
    ...DEFAULT_SETTINGS,
    ...(saved ?? {}),
    // settings page values take priority; env vars are fallback
    anthropicApiKey: saved?.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    elevenLabsApiKey: saved?.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || '',
    elevenLabsVoiceId: saved?.elevenLabsVoiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_SETTINGS.elevenLabsVoiceId,
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJSON(SETTINGS_FILE, settings);
}

// ─── Projects ──────────────────────────────────────────────────────────────

function projectsDir(): string {
  return path.join(getStorageRoot(), 'projects');
}

function projectDir(projectId: string): string {
  return path.join(projectsDir(), projectId);
}

export function listProjects(): Project[] {
  const dir = projectsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map(id => readJSON<Project>(path.join(dir, id, 'project.json')))
    .filter((p): p is Project => p !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getProject(id: string): Project | null {
  return readJSON<Project>(path.join(projectDir(id), 'project.json'));
}

export function saveProject(project: Project): void {
  writeJSON(path.join(projectDir(project.id), 'project.json'), project);
}

export function deleteProject(id: string): void {
  const dir = projectDir(id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
}

// ─── Analyses ──────────────────────────────────────────────────────────────

function analysesDir(projectId: string): string {
  return path.join(projectDir(projectId), 'analyses');
}

export function listAnalyses(projectId: string): Analysis[] {
  const dir = analysesDir(projectId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJSON<Analysis>(path.join(dir, f)))
    .filter((a): a is Analysis => a !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAnalysis(projectId: string, analysisId: string): Analysis | null {
  return readJSON<Analysis>(path.join(analysesDir(projectId), `${analysisId}.json`));
}

export function saveAnalysis(projectId: string, analysis: Analysis): void {
  writeJSON(path.join(analysesDir(projectId), `${analysis.id}.json`), analysis);
}

export function deleteAnalysis(projectId: string, analysisId: string): void {
  const f = path.join(analysesDir(projectId), `${analysisId}.json`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

// ─── Scripts ───────────────────────────────────────────────────────────────

function scriptsDir(projectId: string): string {
  return path.join(projectDir(projectId), 'scripts');
}

function scriptDir(projectId: string, scriptId: string): string {
  return path.join(scriptsDir(projectId), scriptId);
}

export function listScripts(projectId: string): Script[] {
  const dir = scriptsDir(projectId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map(id => readJSON<Script>(path.join(dir, id, 'script.json')))
    .filter((s): s is Script => s !== null)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getScript(projectId: string, scriptId: string): Script | null {
  return readJSON<Script>(path.join(scriptDir(projectId, scriptId), 'script.json'));
}

export function saveScript(projectId: string, script: Script): void {
  writeJSON(path.join(scriptDir(projectId, script.id), 'script.json'), script);
}

export function deleteScript(projectId: string, scriptId: string): void {
  const dir = scriptDir(projectId, scriptId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
}

// ─── Scene Media ────────────────────────────────────────────────────────────

function sceneDir(projectId: string, scriptId: string, sceneId: string): string {
  return path.join(scriptDir(projectId, scriptId), 'scenes', sceneId);
}

export function getSceneMediaPath(projectId: string, scriptId: string, sceneId: string): string {
  return path.join(sceneDir(projectId, scriptId, sceneId), 'media');
}

export function getSceneAudioPath(projectId: string, scriptId: string, sceneId: string): string {
  return sceneDir(projectId, scriptId, sceneId);
}

export function saveMediaFile(
  projectId: string,
  scriptId: string,
  sceneId: string,
  filename: string,
  buffer: Buffer
): void {
  const dir = path.join(sceneDir(projectId, scriptId, sceneId), 'media');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, filename), buffer);
}

export function saveAudioFile(
  projectId: string,
  scriptId: string,
  sceneId: string,
  filename: string,
  buffer: Buffer
): void {
  const dir = sceneDir(projectId, scriptId, sceneId);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, filename), buffer);
}

export function deleteMediaFile(
  projectId: string,
  scriptId: string,
  sceneId: string,
  filename: string
): void {
  const filePath = path.join(sceneDir(projectId, scriptId, sceneId), 'media', filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function getFileBuffer(filePath: string): Buffer | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

// ─── Save Script to Organised Disk Layout ─────────────────────────────────

export function saveScriptToDisk(projectId: string, script: Script): string {
  const root = getStorageRoot();
  const project = getProject(projectId);
  const safeTitle = script.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  const outputDir = path.join(root, 'exports', `${project?.name ?? projectId}`, safeTitle);

  fs.writeFileSync(
    path.join(outputDir, 'script.json'),
    JSON.stringify(script, null, 2)
  );

  for (const scene of script.scenes) {
    const safeScene = scene.title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    const sceneFolder = path.join(outputDir, `scene-${String(scene.number).padStart(3, '0')}-${safeScene}`);
    ensureDir(sceneFolder);

    fs.writeFileSync(path.join(sceneFolder, 'scene.json'), JSON.stringify(scene, null, 2));

    const srcMediaDir = path.join(sceneDir(projectId, script.id, scene.id), 'media');
    if (fs.existsSync(srcMediaDir)) {
      for (const file of fs.readdirSync(srcMediaDir)) {
        fs.copyFileSync(path.join(srcMediaDir, file), path.join(sceneFolder, file));
      }
    }

    if (scene.audioFile) {
      const audioSrc = path.join(sceneDir(projectId, script.id, scene.id), scene.audioFile);
      if (fs.existsSync(audioSrc)) {
        fs.copyFileSync(audioSrc, path.join(sceneFolder, scene.audioFile));
      }
    }
  }

  return outputDir;
}

// ─── Media file listing helper ─────────────────────────────────────────────

export function listMediaFiles(
  projectId: string,
  scriptId: string,
  sceneId: string
): MediaFile[] {
  const dir = path.join(sceneDir(projectId, scriptId, sceneId), 'media');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir).map(filename => {
    const ext = path.extname(filename).toLowerCase();
    const type: MediaFile['type'] = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)
      ? 'image'
      : ['.mp4', '.mov', '.webm', '.avi'].includes(ext)
        ? 'video'
        : 'audio';
    const absolutePath = path.join(dir, filename);
    return {
      id: filename,
      type,
      filename,
      originalName: filename,
      uploadedAt: fs.statSync(absolutePath).mtime.toISOString(),
      absolutePath,
    };
  });
}

export function getAbsoluteMediaPath(
  projectId: string,
  scriptId: string,
  sceneId: string,
  filename: string
): string {
  return path.join(sceneDir(projectId, scriptId, sceneId), 'media', filename);
}
