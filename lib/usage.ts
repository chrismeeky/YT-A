import { getSupabase } from './supabase';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80 / 1_000_000, output: 4 / 1_000_000 },
  default:                     { input: 3    / 1_000_000, output: 15 / 1_000_000 }, // sonnet
};

export function calcAnthropicCost(inputTokens: number, outputTokens: number, model?: string): number {
  const p = (model ? MODEL_PRICING[model] : undefined) ?? MODEL_PRICING.default;
  return inputTokens * p.input + outputTokens * p.output;
}

export interface UsageRecord {
  operation: string;
  api: 'anthropic' | 'elevenlabs' | 'youtube' | 'pexels';
  project_id?: string;
  user_id?: string;
  // Anthropic
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd?: number;
  // ElevenLabs
  characters?: number;
  // YouTube
  quota_units?: number;
  key_fingerprint?: string;
  // Pexels
  requests?: number;
}

export function keyFingerprint(key: string): string {
  return key.slice(-8);
}

export async function trackUsage(record: UsageRecord): Promise<void> {
  try {
    const db = getSupabase();
    if (!db) return;
    await db.from('api_usage').insert(record);
  } catch {
    // Non-critical — never propagate
  }
}
