import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string } }
) {
  const body = (await request.json()) as {
    characterName: string;
    scenes: Array<{ narration: string; title: string }>;
    scriptTopic: string;
    anthropicApiKey?: string;
  };

  const apiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }
  if (!body.characterName?.trim()) {
    return NextResponse.json({ error: 'characterName is required.' }, { status: 400 });
  }

  const scriptContext = body.scenes.map(s => `[${s.title}]\n${s.narration}`).join('\n\n');

  const ai = new Anthropic({ apiKey });
  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: 'You are a character design expert for fictional stories. Respond ONLY with valid JSON, no markdown.',
    messages: [
      {
        role: 'user',
        content: `Create a detailed character sheet for "${body.characterName}" based on how they appear in this script.

SCRIPT TOPIC: ${body.scriptTopic}

SCRIPT SCENES:
${scriptContext}

Generate a comprehensive visual character sheet. If the script doesn't explicitly describe certain physical attributes, infer them based on the character's role, time period, and story context.

Return JSON with this exact structure:
{
  "age": "e.g. mid-30s, elderly, teenage",
  "gender": "e.g. male, female, non-binary",
  "ethnicity": "e.g. East Asian, Mediterranean, West African",
  "height": "e.g. tall, average height, petite",
  "build": "e.g. athletic, slender, stocky, muscular",
  "hairColor": "e.g. jet black, auburn, silver-streaked",
  "hairStyle": "e.g. short cropped, long wavy, braided",
  "eyeColor": "e.g. dark brown, piercing blue, hazel",
  "skinTone": "e.g. pale, olive, deep brown",
  "facialFeatures": "e.g. sharp jawline, prominent cheekbones, weathered wrinkles",
  "typicalOutfit": "e.g. worn leather jacket and dark jeans, formal Victorian suit",
  "styleNotes": "e.g. always carries a worn notebook, distinctive scar above left eyebrow",
  "fullDescription": "A single comprehensive paragraph (4-6 sentences) describing this character visually, suitable for use as an AI image generation reference. Include all key visual details in a flowing, descriptive narrative."
}`,
      },
    ],
  });

  void trackUsage({
    operation: 'generate-character-sheet',
    api: 'anthropic',
    project_id: params.id,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens),
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ sheet: parsed });
  } catch {
    return NextResponse.json({ error: 'Failed to parse character sheet response.' }, { status: 500 });
  }
}
