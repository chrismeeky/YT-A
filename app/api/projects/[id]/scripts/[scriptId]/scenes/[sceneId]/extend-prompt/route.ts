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
  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are an expert video director specialising in AI video generation prompts for tools like Sora, Runway, and Kling. Respond ONLY with valid JSON, no markdown.',
    messages: [
      {
        role: 'user',
        content: `You are extending a video prompt with a smooth continuation. You must produce TWO things:
1. A tweaked version of the original prompt that ends in a way that naturally leads into the continuation (e.g. a subject beginning to move, a camera starting to drift, a moment of transition — something that makes the cut feel motivated).
2. The continuation prompt itself, picking up from where the tweaked original leaves off.

ORIGINAL PROMPT:
${body.originalPrompt}
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
  "continuation": "the ${duration}-second continuation prompt"
}`,
      },
    ],
  });

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
    const parsed = JSON.parse(cleaned) as { tweakedOriginal: string; continuation: string };
    return NextResponse.json({ prompt: parsed.continuation, tweakedOriginal: parsed.tweakedOriginal });
  } catch {
    // Fallback: treat raw text as continuation only, no tweak
    return NextResponse.json({ prompt: raw, tweakedOriginal: null });
  }
}
