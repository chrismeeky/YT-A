import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
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
  const prompt = `You are a YouTube video strategist. Based on the following channel analysis, suggest 5 compelling video topic ideas that would perform well on this channel.

Channel: ${analysis.channelName}
Content pillars: ${insights.contentPillars?.join(', ') ?? 'N/A'}
Title formulas: ${insights.titleFormulas?.slice(0, 3).join(' | ') ?? 'N/A'}
Unique value proposition: ${insights.uniqueValueProposition ?? 'N/A'}
Audience: ${insights.audienceProfile?.demographics ?? 'N/A'}
Audience pain points: ${insights.audienceProfile?.painPoints?.join(', ') ?? 'N/A'}
Patterns to replicate: ${insights.thingsToSteal?.slice(0, 3).join(', ') ?? 'N/A'}

For each topic, write a short story context (2–4 sentences) with specific details the script writer needs: who is involved, what happened, key dates or numbers, the outcome. Use plausible realistic details — names, locations, timeline.

Respond with a raw JSON array only. No markdown, no code fences, no explanation.
[{"topic": "...", "context": "..."}, ...]`;

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: 'You are a JSON API. Always respond with valid raw JSON only. Never use markdown or code fences.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const arrayMatch = stripped.match(/\[[\s\S]*\]/);
  const raw = arrayMatch ? arrayMatch[0] : stripped;

  try {
    const suggestions = JSON.parse(raw) as { topic: string; context: string }[];
    return NextResponse.json({ suggestions });
  } catch {
    console.error('[suggest-topics] Parse failed. Raw response:', text);
    return NextResponse.json(
      { error: `Failed to parse suggestions. Model returned: ${text.slice(0, 200)}` },
      { status: 500 },
    );
  }
}
