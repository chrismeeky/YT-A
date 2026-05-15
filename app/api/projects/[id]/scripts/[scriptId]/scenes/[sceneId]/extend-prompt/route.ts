import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  const body = (await request.json()) as {
    originalPrompt: string;
    narrationExcerpt?: string;
    durationSeconds: number;
    anthropicApiKey?: string;
    previousPrompt?: string;
    replaceInPlace?: boolean;
  };

  const apiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }
  if (!body.originalPrompt?.trim()) {
    return NextResponse.json({ error: 'originalPrompt is required.' }, { status: 400 });
  }

  const duration = Math.min(10, Math.max(2, body.durationSeconds ?? 6));

  const ai = new Anthropic({ apiKey });

  let userContent: string;
  if (body.replaceInPlace && body.previousPrompt) {
    userContent = `Rewrite the following video prompt so it is a smooth continuation of the PREVIOUS SEGMENT. The rewritten prompt should feel like a natural flow from the previous shot — not a new scene introduction, not a re-cut, but a continuation of the same story moment.

PREVIOUS SEGMENT (the shot that comes immediately before):
${body.previousPrompt}

CURRENT PROMPT TO REWRITE:
${body.originalPrompt}
${body.narrationExcerpt ? `\nNARRATION CONTEXT:\n${body.narrationExcerpt}` : ''}

REQUIREMENTS:
- Match the exact visual style, color palette, lighting, and atmosphere of the current prompt
- The rewritten prompt should pick up naturally from where the previous segment ends
- Preserve all character appearances — do not re-introduce anyone
- Keep the same duration intent (~${duration} seconds)
- Do NOT describe the previous segment's content — only write the current segment's continuation

Return ONLY valid JSON:
{
  "prompt": "the rewritten continuation prompt",
  "fingerprint": "shot_distance | subject/action | location | color+mood"
}`;
  } else {
    userContent = `You are extending a video prompt with a smooth continuation. You must produce TWO things:
1. A tweaked version of the original prompt that ends in a way that naturally leads into the continuation (e.g. a subject beginning to move, a camera starting to drift, a moment of transition — something that makes the cut feel motivated).
2. The continuation prompt itself, picking up from where the tweaked original leaves off.

ORIGINAL PROMPT:
${body.originalPrompt}
${body.previousPrompt ? `\nPREVIOUS SEGMENT (for visual flow context):\n${body.previousPrompt}` : ''}
${body.narrationExcerpt ? `\nNARRATION CONTEXT:\n${body.narrationExcerpt}` : ''}

REQUIREMENTS FOR BOTH PROMPTS:
- Match the exact visual style, color palette, lighting, atmosphere, and any technical specs from the original
- Preserve character appearances and positions — do not re-introduce anyone
- The tweaked original should be minimal — change only the ending so it implies the transition; keep everything else identical
- The continuation should feel like the same shot continuing or a natural cinematic cut — NOT a remake or re-introduction
- Continuation duration: ~${duration} seconds

Return ONLY valid JSON:
{
  "tweakedOriginal": "the original prompt with a subtly adjusted ending that sets up the transition",
  "continuation": "the ${duration}-second continuation prompt",
  "continuationFingerprint": "shot_distance | subject/action | location | color+mood"
}`;
  }

  let response: Awaited<ReturnType<typeof ai.messages.create>>;
  try {
    response = await ai.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'You are an expert video director specialising in AI video generation prompts for tools like Sora, Runway, and Kling. Respond ONLY with valid JSON, no markdown.',
      messages: [{ role: 'user', content: userContent }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status ?? 0;
    if (status === 529 || msg.includes('overloaded') || msg.includes('Overloaded')) {
      return NextResponse.json(
        { error: 'Anthropic API is temporarily overloaded. Wait a few seconds and try again.' },
        { status: 503 }
      );
    }
    if (status === 429 || msg.includes('rate limit') || msg.includes('rate_limit')) {
      return NextResponse.json(
        { error: 'Anthropic rate limit reached. Wait a moment and try again.' },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: `API error: ${msg}` }, { status: 502 });
  }

  void trackUsage({
    operation: 'extend-prompt',
    api: 'anthropic',
    project_id: params.id,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens),
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
  let cleaned = raw;
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  if (!cleaned.startsWith('{')) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
  }

  try {
    if (body.replaceInPlace) {
      const parsed = JSON.parse(cleaned) as { prompt: string; fingerprint?: string };
      return NextResponse.json({ prompt: parsed.prompt, tweakedOriginal: null, fingerprint: parsed.fingerprint ?? '' });
    }
    const parsed = JSON.parse(cleaned) as { tweakedOriginal: string; continuation: string; continuationFingerprint?: string };
    return NextResponse.json({ prompt: parsed.continuation, tweakedOriginal: parsed.tweakedOriginal, continuationFingerprint: parsed.continuationFingerprint ?? '' });
  } catch {
    return NextResponse.json({ prompt: raw, tweakedOriginal: null, fingerprint: '', continuationFingerprint: '' });
  }
}
