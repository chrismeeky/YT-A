/**
 * Unified LLM adapter — abstracts Claude (Anthropic) and Grok (xAI) behind a single interface.
 * All logic in lib/claude.ts is shared; only the underlying HTTP call differs.
 */

import Anthropic from '@anthropic-ai/sdk';

export type LLMProvider = 'claude' | 'grok';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
}

// ─── Normalised content block types ──────────────────────────────────────────
// Compatible with Anthropic SDK types (duck-typed); Grok adapter transforms as needed.

export interface LLMTextBlock {
  type: 'text';
  text: string;
  // Anthropic prompt-caching extension — silently stripped for Grok
  cache_control?: { type: 'ephemeral' };
}

export interface LLMImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string; // e.g. 'image/jpeg'
    data: string;       // base64-encoded bytes
  };
}

export type LLMContentBlock = LLMTextBlock | LLMImageBlock;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export interface LLMCompleteParams {
  system?: string;
  messages: LLMMessage[];
  maxTokens: number;
  /** Claude model name — ignored for Grok (always uses grok-4.3). */
  claudeModel?: string;
  /** Anthropic-beta header value (e.g. 'prompt-caching-2024-07-31') — ignored for Grok. */
  anthropicBeta?: string;
  /** Request timeout in ms. */
  timeout?: number;
  /**
   * Grok reasoning effort. Defaults to 'low'.
   * Use 'high' only for tasks that genuinely need multi-step reasoning.
   * Reasoning tokens consume the same max_output_tokens budget as text tokens,
   * so 'high' on long-form generation tasks leaves far fewer tokens for actual output.
   */
  grokReasoningEffort?: 'high' | 'low' | 'none';
}

export interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** 'max_tokens' when output was truncated; 'end_turn' / 'stop' otherwise. */
  stopReason: string;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Build an LLMConfig from resolved API keys.
 * Returns null if the active key is empty (caller should return a 400).
 */
export function makeLLMConfig(
  provider: LLMProvider | undefined,
  anthropicApiKey: string | undefined,
  xaiApiKey: string | undefined,
): LLMConfig | null {
  const p: LLMProvider = provider ?? 'claude';
  const key = p === 'grok' ? (xaiApiKey ?? '') : (anthropicApiKey ?? '');
  if (!key) return null;
  return { provider: p, apiKey: key };
}

export function llmErrorMessage(provider: LLMProvider): string {
  return provider === 'grok'
    ? 'xAI API key required. Add it in Settings.'
    : 'Anthropic API key required. Add it in Settings.';
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function llmComplete(config: LLMConfig, params: LLMCompleteParams): Promise<LLMResult> {
  if (config.provider === 'grok') {
    return grokComplete(config.apiKey, params);
  }
  return claudeComplete(config.apiKey, params);
}

// ─── Claude (Anthropic SDK) ───────────────────────────────────────────────────

async function claudeComplete(apiKey: string, params: LLMCompleteParams): Promise<LLMResult> {
  const ai = new Anthropic({ apiKey });
  const model = params.claudeModel ?? 'claude-sonnet-4-6';

  const messages = params.messages as Anthropic.MessageParam[];

  const opts: Parameters<typeof ai.messages.create>[1] = params.timeout
    ? { timeout: params.timeout }
    : undefined;

  const extra = params.anthropicBeta
    ? { headers: { 'anthropic-beta': params.anthropicBeta } }
    : {};

  // Retry up to 3 times on 529 overload errors (Anthropic servers temporarily at capacity).
  const createMsg = () => ai.messages.create(
    {
      model,
      max_tokens: params.maxTokens,
      ...(params.system ? { system: params.system } : {}),
      messages,
    },
    { ...opts, ...extra },
  );

  let response = await (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 5000));
      try {
        return await createMsg();
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status !== 529 || attempt === 2) throw err;
      }
    }
    // unreachable — loop always returns or throws
    return createMsg();
  })();

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    stopReason: response.stop_reason ?? 'end_turn',
  };
}

// ─── Grok (xAI Responses API) ─────────────────────────────────────────────────

interface GrokInputContentBlock {
  type: string;
  text?: string;
  image_url?: string;
}

interface GrokMessage {
  role: string;
  content: string | GrokInputContentBlock[];
}

interface GrokResponseOutput {
  type: string;
  role?: string;
  content?: Array<{ type: string; text?: string }>;
}

interface GrokResponse {
  output: GrokResponseOutput[];
  status?: string; // 'completed' | 'incomplete'
  usage: {
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens?: number;
  };
  incomplete_details?: { reason?: string } | null;
}

function toGrokContent(content: string | LLMContentBlock[]): string | GrokInputContentBlock[] {
  if (typeof content === 'string') return content;
  return content.map(block => {
    if (block.type === 'text') {
      // xAI Responses API uses "input_text" for text content blocks
      return { type: 'input_text', text: block.text };
    }
    // image block → image_url format
    const img = block as LLMImageBlock;
    return {
      type: 'input_image',
      image_url: `data:${img.source.media_type};base64,${img.source.data}`,
    };
  });
}

async function grokComplete(apiKey: string, params: LLMCompleteParams): Promise<LLMResult> {
  const input: GrokMessage[] = params.messages.map(m => ({
    role: m.role,
    content: toGrokContent(m.content),
  }));

  const reasoningEffort = params.grokReasoningEffort ?? 'low';
  // Reasoning tokens consume the same max_output_tokens budget.
  // Add headroom: low=2×, high=3× so actual text output isn't starved.
  const reasoningMultiplier = reasoningEffort === 'high' ? 3 : reasoningEffort === 'low' ? 2 : 1;
  // Cap at 29,000 — grok-4.3 hard limit is 30,000 (reasoning + text combined).
  const maxOutputTokens = Math.min(29000, Math.round(params.maxTokens * reasoningMultiplier));

  const body: Record<string, unknown> = {
    model: 'grok-4.3',
    reasoning: { effort: reasoningEffort },
    stream: false,
    max_output_tokens: maxOutputTokens,
    input,
  };

  if (params.system) {
    body.instructions = params.system;
  }

  const controller = params.timeout ? new AbortController() : null;
  const timer = controller && params.timeout
    ? setTimeout(() => controller.abort(), params.timeout)
    : null;

  let res: Response;
  try {
    res = await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Grok API error ${res.status}: ${err}`);
  }

  const data = await res.json() as GrokResponse;

  // Find the message output (skip reasoning block)
  const messageOutput = data.output?.find(o => o.type === 'message');
  const text = messageOutput?.content?.find(c => c.type === 'output_text')?.text ?? '';

  // Only treat as truncated when the API explicitly says max_tokens was the reason.
  // data.status === 'incomplete' alone can fire for content filters, context limits, etc.
  const incompleteReason = data.incomplete_details?.reason ?? '';
  const isMaxTokens = incompleteReason === 'max_tokens' || incompleteReason === 'max_output_tokens';
  const stopReason = isMaxTokens ? 'max_tokens' : 'end_turn';

  if (data.status === 'incomplete' && !isMaxTokens) {
    throw new Error(`Grok generation stopped unexpectedly: ${incompleteReason || data.status}`);
  }

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
    stopReason,
  };
}
