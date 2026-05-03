import { getSupabase } from './supabase';

// claude-sonnet-4-6 pricing
const INPUT_COST  = 3  / 1_000_000; // $3 per million input tokens
const OUTPUT_COST = 15 / 1_000_000; // $15 per million output tokens

export function calcAnthropicCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST + outputTokens * OUTPUT_COST;
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
