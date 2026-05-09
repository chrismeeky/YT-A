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
    imageBase64: string;  // base64-encoded image data (without data URL prefix)
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    visualStyle?: string;
    anthropicApiKey?: string;
  };

  const apiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }
  if (!body.characterName?.trim()) {
    return NextResponse.json({ error: 'characterName is required.' }, { status: 400 });
  }
  if (!body.imageBase64) {
    return NextResponse.json({ error: 'imageBase64 is required.' }, { status: 400 });
  }

  const ai = new Anthropic({ apiKey });
  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: 'You are a character design expert. Analyze images and extract precise visual character descriptions. Respond ONLY with valid JSON, no markdown.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: body.mediaType,
              data: body.imageBase64,
            },
          },
          {
            type: 'text',
            text: `Analyze this image and create a detailed character sheet for "${body.characterName}".
${body.visualStyle ? `\nVISUAL STYLE: ${body.visualStyle}\nWrite the fullDescription so it is ready to use as an AI image/video prompt in this exact visual style. Adapt the language and level of detail to fit the medium — for 3D animation use stylized/animated vocabulary; for photorealistic use precise real-world material terms. The character as described must look correct when rendered in this style.\n` : ''}
Extract every visual detail you can observe. Be precise and specific — this description will be used to maintain visual consistency when generating AI images of this character across multiple scenes.

Return JSON with this exact structure:
{
  "age": "estimated age range, e.g. mid-30s, elderly, teenage",
  "gender": "observed gender presentation",
  "ethnicity": "apparent ethnicity/heritage",
  "height": "estimated height/stature from image context",
  "build": "body type, e.g. athletic, slender, stocky",
  "hairColor": "precise hair color description",
  "hairStyle": "detailed hair style and length",
  "eyeColor": "eye color if visible",
  "skinTone": "specific skin tone description",
  "facialFeatures": "notable facial features — jawline, nose shape, distinctive marks, expressions",
  "typicalOutfit": "describe the clothing visible in the image in detail",
  "styleNotes": "any distinctive accessories, props, posture, or other visual identifiers",
  "fullDescription": "A comprehensive 4-6 sentence paragraph describing this character visually in precise detail, ready to paste directly into an AI image/video prompt. Bake the visual style into the description. Capture their essence — not just features but the overall visual impression they create."
}`,
          },
        ],
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
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  if (!cleaned.startsWith('{')) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) cleaned = match[0];
  }

  try {
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ sheet: parsed });
  } catch {
    return NextResponse.json({ error: 'Failed to parse character sheet from image.' }, { status: 500 });
  }
}
