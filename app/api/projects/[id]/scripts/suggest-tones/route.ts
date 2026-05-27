import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import type { Analysis } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await request.json()) as {
    topic: string;
    context?: string;
    analysis: Analysis;
    anthropicApiKey?: string;
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required. Add it in Settings.' }, { status: 400 });
  }

  if (!body.topic?.trim()) {
    return NextResponse.json({ error: 'Topic required.' }, { status: 400 });
  }

  try {
    const ai = new Anthropic({ apiKey: anthropicApiKey });
    const insights = body.analysis.channelInsights;

    const prompt = `You are a narrative voice expert helping a YouTube creator choose a narration tone for their video.

Topic: "${body.topic}"
${body.context ? `Story context: ${body.context}\n` : ''}Channel overview: ${insights.channelOverview}
Channel tone/style: ${insights.contentStyle?.tone ?? 'not specified'}, energy: ${insights.contentStyle?.energy ?? 'not specified'}
Writing voice: ${insights.writingStyle?.voiceAndPersonality ?? 'not specified'}

Suggest 5–6 distinct narration tones that would work for this specific topic. Make them meaningfully different from each other — not just synonyms. Think about: emotional register, pacing of language, how the narrator relates to the audience, the underlying attitude toward the subject matter.

For each tone:
- "tone": a punchy 2–4 word name
- "description": 1–2 sentences on what this tone sounds like and what it does for the story
- "instruction": one precise writing instruction Claude should follow to write in this tone
- "channelFavors": true for the ONE tone that most closely matches how this channel already sounds based on the style info above, false for all others. Exactly one must be true.

Respond with a raw JSON array only. No markdown, no code fences, no explanation.
[{"tone": "...", "description": "...", "instruction": "...", "channelFavors": false}, ...]`;

    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are a JSON API. Always respond with valid raw JSON only. Never use markdown or code fences.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const arrayMatch = stripped.match(/\[[\s\S]*\]/);
    const raw = arrayMatch ? arrayMatch[0] : stripped;

    const tones = JSON.parse(raw) as { tone: string; description: string; instruction: string; channelFavors: boolean }[];

    void trackUsage({
      operation: 'suggest-tones',
      api: 'anthropic',
      project_id: params.id,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens, 'claude-haiku-4-5-20251001'),
    });

    return NextResponse.json({ tones });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[suggest-tones]', message);
    if (message.includes('parse') || message.includes('JSON')) {
      return NextResponse.json({ error: 'Model returned unexpected output. Try again.' }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
