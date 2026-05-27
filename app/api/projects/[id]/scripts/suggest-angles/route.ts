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
    const nature = body.analysis.channelInsights.contentNature?.classification ?? 'non-fictional';

    const prompt = `You are a story development expert helping a YouTube creator choose a narrative angle for their video.

Topic: "${body.topic}"
${body.context ? `Story context: ${body.context}\n` : ''}Content nature: ${nature}
Channel overview: ${body.analysis.channelInsights.channelOverview}

Identify 4–6 distinct narrative angles this story could be told from. Think about: whose perspective anchors the story, what the emotional core is, what gets emphasized vs. de-emphasized, what the audience walks away feeling or knowing.

Make the angles meaningfully distinct — genuinely different lenses, not slight variations of each other. Examples of angle dimensions: victim vs. offender vs. society vs. investigator vs. systemic critique vs. historical context vs. psychological deep-dive vs. survivor aftermath.

For each angle provide:
- "angle": a punchy short name (3–6 words)
- "description": 1–2 sentences explaining the perspective and what it highlights
- "focus": one clear writing instruction Claude should follow when scripting from this angle
- "channelFavors": true for the ONE angle that best matches how this channel already tells its stories (based on the channel overview and style provided), false for all others. Exactly one should be true.

Respond with a raw JSON array only. No markdown, no code fences, no explanation.
[{"angle": "...", "description": "...", "focus": "...", "channelFavors": false}, ...]`;

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

    const angles = JSON.parse(raw) as { angle: string; description: string; focus: string; channelFavors: boolean }[];

    void trackUsage({
      operation: 'suggest-angles',
      api: 'anthropic',
      project_id: params.id,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens, 'claude-haiku-4-5-20251001'),
    });

    return NextResponse.json({ angles });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[suggest-angles]', message);
    if (message.includes('parse') || message.includes('JSON')) {
      return NextResponse.json({ error: 'Model returned unexpected output. Try again.' }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
