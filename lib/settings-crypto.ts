// Server-only. Encrypts the sensitive (API-key) fields of AppSettings before
// they are persisted to the cloud, so the database never holds them in plaintext.
// AES-256-GCM with a 32-byte key from SETTINGS_ENCRYPTION_KEY (base64).

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { AppSettings } from './types';

// Fields treated as secrets — encrypted at rest, decrypted on read.
const SENSITIVE_KEYS = [
  'anthropicApiKey',
  'xaiApiKey',
  'elevenLabsApiKey',
  'cartesiaApiKey',
  'pexelsApiKey',
  'braveApiKey',
  'youtubeApiKey',
] as const satisfies readonly (keyof AppSettings)[];

const PREFIX = 'enc.v1.';

function getKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) throw new Error('SETTINGS_ENCRYPTION_KEY is not set — cannot encrypt settings.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SETTINGS_ENCRYPTION_KEY must decode to 32 bytes (base64).');
  return key;
}

function encryptValue(plain: string): string {
  if (!plain) return plain; // don't encrypt empty strings
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`;
}

function decryptValue(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored; // plaintext / legacy / empty
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split('.');
  if (!ivB64 || !tagB64 || !ctB64) return '';
  try {
    const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return ''; // wrong key / tampered — fail closed to empty rather than throw
  }
}

/** Returns a copy of settings with sensitive fields encrypted. */
export function encryptSettings(settings: AppSettings): AppSettings {
  const out = { ...settings };
  for (const k of SENSITIVE_KEYS) {
    if (typeof out[k] === 'string') (out[k] as string) = encryptValue(out[k] as string);
  }
  return out;
}

/** Returns a copy of settings with sensitive fields decrypted. */
export function decryptSettings(settings: AppSettings): AppSettings {
  const out = { ...settings };
  for (const k of SENSITIVE_KEYS) {
    if (typeof out[k] === 'string') (out[k] as string) = decryptValue(out[k] as string);
  }
  return out;
}
