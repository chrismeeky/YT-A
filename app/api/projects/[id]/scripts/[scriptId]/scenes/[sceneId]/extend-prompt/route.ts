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
    max_tokens: 512,
    system: 'You are an expert video director specialising in AI video generation prompts for tools like Sora, Runway, and Kling. Return only the prompt text, no explanation or formatting.',
    messages: [
      {
        role: 'user',
        content: `Generate a smooth ${duration}-second CONTINUATION prompt that picks up exactly where this video prompt ends.

ORIGINAL PROMPT:
${body.originalPrompt}
${body.narrationExcerpt ? `\nNARRATION CONTEXT:\n${body.narrationExcerpt}` : ''}

REQUIREMENTS:
- Feel like the same continuous shot or a natural cinematic cut from the original
- Match the exact visual style, color palette, lighting conditions, and atmosphere
- If the original shows a specific subject or character, continue from their position, expression, or action — do not re-introduce them
- Preserve camera quality, aspect ratio, and any technical specs mentioned in the original
- This is a continuation, not a remake — do NOT re-describe the setup or backstory
- Duration: ~${duration} seconds

Return ONLY the continuation prompt text.`,
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

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  return NextResponse.json({ prompt: text });
}
