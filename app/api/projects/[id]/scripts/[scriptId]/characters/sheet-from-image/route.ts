import { NextRequest, NextResponse } from 'next/server';
import { makeLLMConfig, llmErrorMessage, llmComplete } from '@/lib/llm';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';

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
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
  };

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });
  if (!body.characterName?.trim()) {
    return NextResponse.json({ error: 'characterName is required.' }, { status: 400 });
  }
  if (!body.imageBase64) {
    return NextResponse.json({ error: 'imageBase64 is required.' }, { status: 400 });
  }

  const response = await llmComplete(llm, {
    claudeModel: 'claude-sonnet-4-6',
    maxTokens: 2048,
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

  const { cost: imgSheetCost, api: imgSheetApi } = calcLLMCost(llm.provider, response.inputTokens, response.outputTokens);
  void trackUsage({
    operation: 'generate-character-sheet',
    api: imgSheetApi,
    project_id: params.id,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    estimated_cost_usd: imgSheetCost,
  });

  const raw = response.text || '{}';
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
