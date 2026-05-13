import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import type { Analysis } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  void params;
  const body = (await request.json()) as {
    analysis: Analysis;
    anthropicApiKey?: string;
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required. Add it in Settings.' }, { status: 400 });
  }

  if (!body.analysis?.id) {
    return NextResponse.json({ error: 'Analysis object required.' }, { status: 400 });
  }

  const analysis = body.analysis;
  const ai = new Anthropic({ apiKey: anthropicApiKey });

  const insights = analysis.channelInsights;
  const nature = insights.contentNature?.classification ?? 'non-fictional';

  const contextInstruction = nature === 'fictional'
    ? `For each topic, write a short story context (2–4 sentences) with the creative premise: the world, the central character or conflict, the dramatic question, and the emotional arc. Invent freely — specific names, places, and details are encouraged.`
    : nature === 'mixed'
    ? `For each topic, indicate whether it is fictional or based on real events. For real-world topics, describe the documented situation and note that the writer must research and verify all facts independently. For fictional topics, describe the creative premise freely.`
    : `For each topic, describe the documented real-world situation in broad strokes — the general case type, the documented outcome or conflict, and what makes it compelling. DO NOT invent specific names, dates, case numbers, or people — those must come from the writer's own research. The context should guide research, not replace it.`;

  const prompt = `You are a YouTube video strategist. Based on the following channel analysis, suggest 10 compelling video topic ideas that would perform well on this channel.

Channel: ${analysis.channelName}
Content nature: ${nature}${insights.contentNature?.reasoning ? ` (${insights.contentNature.reasoning})` : ''}
Content pillars: ${insights.contentPillars?.join(', ') ?? 'N/A'}
Title formulas: ${insights.titleFormulas?.slice(0, 3).join(' | ') ?? 'N/A'}
Unique value proposition: ${insights.uniqueValueProposition ?? 'N/A'}
Audience: ${insights.audienceProfile?.demographics ?? 'N/A'}
Audience pain points: ${insights.audienceProfile?.painPoints?.join(', ') ?? 'N/A'}
Patterns to replicate: ${insights.thingsToSteal?.slice(0, 3).join(', ') ?? 'N/A'}

${contextInstruction}

Respond with a raw JSON array only. No markdown, no code fences, no explanation.
[{"topic": "...", "context": "...", "isFactual": ${nature !== 'fictional'}}, ...]`;

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: 'You are a JSON API. Always respond with valid raw JSON only. Never use markdown or code fences.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const arrayMatch = stripped.match(/\[[\s\S]*\]/);
  const raw = arrayMatch ? arrayMatch[0] : stripped;

  try {
    const suggestions = JSON.parse(raw) as { topic: string; context: string; isFactual: boolean }[];

    void trackUsage({
      operation: 'suggest-topics',
      api: 'anthropic',
      project_id: params.id,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens),
    });

    return NextResponse.json({ suggestions });
  } catch {
    console.error('[suggest-topics] Parse failed. Raw response:', text);
    return NextResponse.json(
      { error: `Failed to parse suggestions. Model returned: ${text.slice(0, 200)}` },
      { status: 500 },
    );
  }
}
