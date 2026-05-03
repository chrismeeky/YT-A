/**
 * Beta mode: when NEXT_PUBLIC_BETA_MODE=true, all API keys are sourced from
 * environment variables instead of user-provided values.
 *
 * Add these to your Vercel environment:
 *   NEXT_PUBLIC_BETA_MODE=true
 *   NEXT_PUBLIC_ANTHROPIC_API_KEY=sk-ant-…
 *   NEXT_PUBLIC_YOUTUBE_API_KEY=AIza…
 *   NEXT_PUBLIC_ELEVENLABS_API_KEY=sk-…
 *   NEXT_PUBLIC_ELEVENLABS_VOICE_ID=<voice id>
 *   NEXT_PUBLIC_PEXELS_API_KEY=…
 */

export const BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE === 'true';

/**
 * Beta-controlled key: in beta mode always uses the env var, ignoring client input.
 * Use for keys users should never need to supply (Anthropic, ElevenLabs API key, Pexels).
 */
export function resolveKey(clientKey: string | undefined, envVar: string): string {
  if (BETA_MODE) return (process.env[envVar] ?? '').trim();
  return (clientKey ?? '').trim();
}

/**
 * User-overridable key: client-supplied value wins if present; env var is the fallback.
 * Use for fields the user can still edit in beta mode (YouTube API key, Voice ID).
 */
export function resolveKeyWithFallback(clientKey: string | undefined, envVar: string): string {
  return (clientKey ?? '').trim() || (process.env[envVar] ?? '').trim();
}
