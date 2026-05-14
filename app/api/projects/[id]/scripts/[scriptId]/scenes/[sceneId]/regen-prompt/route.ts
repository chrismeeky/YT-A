import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import { resolvePromptLock } from '@/lib/visual-styles';
import type { Analysis, CharacterSheet, PromptDetail } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  const body = (await request.json()) as {
    type: 'image' | 'video';
    excerpt: string;
    sceneTitle: string;
    sceneDescription: string;
    sceneNarration: string;
    visualStyle?: string;
    characters?: CharacterSheet[];
    promptDetail?: PromptDetail;
    scriptTopic?: string;
    anthropicApiKey?: string;
    analysis?: Analysis;
    siblingPrompts?: string[];
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required. Add it in Settings.' }, { status: 400 });
  }
  if (!body.excerpt?.trim()) {
    return NextResponse.json({ error: 'Excerpt is required.' }, { status: 400 });
  }

  const ai = new Anthropic({ apiKey: anthropicApiKey });
  const insights = body.analysis?.channelInsights;
  const lock = resolvePromptLock(body.visualStyle) || insights?.visualBrand?.productionStyle;
  const isImage = body.type === 'image';

  const detailInstruction =
    body.promptDetail === 'brief'    ? 'BRIEF — 20–40 words. Essential subject and style only.' :
    body.promptDetail === 'standard' ? 'STANDARD — 50–80 words. Subject, mood, lighting, and composition.' :
    body.promptDetail === 'detailed' ? 'DETAILED — 80–120 words. Lighting, composition, atmosphere, colour, texture.' :
    body.promptDetail === 'verbose'  ? 'VERBOSE — 120–200 words. Full cinematic specification.' :
    'AUTO — choose the right level of detail based on excerpt content and emotional weight.';

  const characterBlock = (body.characters ?? []).length > 0
    ? `\nCHARACTERS — when mentioned, include exact visual traits from these sheets:\n${(body.characters ?? [])
        .map(c => `${c.name}: ${[c.hairColor, c.hairStyle, c.build, c.typicalOutfit, c.skinTone].filter(Boolean).join(', ')}`)
        .join('\n')}`
    : '';

  const siblings = (body.siblingPrompts ?? []).filter(p => p?.trim());
  const siblingBlock = siblings.length > 0
    ? `\nEXISTING PROMPTS FOR THIS SCENE (already in use — do NOT repeat their subjects, compositions, or camera moves):\n${siblings.map((p, n) => `${n + 1}. ${p.slice(0, 120)}…`).join('\n')}\n`
    : '';

  const userPrompt = `Generate a single ${isImage ? 'Midjourney/DALL-E image prompt (append --ar 16:9)' : 'Sora/Runway video prompt (~8s)'} for the narration segment below.

${lock ? `VISUAL STYLE: ${lock}\n` : ''}SCENE CONTEXT:
Title: ${body.sceneTitle}
Visual Description: ${body.sceneDescription}
${body.scriptTopic ? `Topic: ${body.scriptTopic}` : ''}${characterBlock}
${siblingBlock}
NARRATION SEGMENT:
"${body.excerpt}"

DETAIL LEVEL: ${detailInstruction}

RULES:
- Subject-first: if the narration describes a person, depict that person or their actions
- Stay within the scene's time period, geography, and atmosphere
- No text overlays, captions, subtitles, watermarks, or lower thirds
- Never add "no people" phrases when narration describes humans
- Choose a different primary subject, camera angle, or composition than the existing prompts above
${isImage ? '- End with --ar 16:9' : '- Describe motion and camera movement naturally'}

Return ONLY the prompt text — no JSON, no explanation, no markdown.`;

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: 'You are an expert visual prompt writer for YouTube video production. Return ONLY the prompt text.',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const prompt = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

  void trackUsage({
    operation: 'regen-prompt',
    api: 'anthropic',
    project_id: params.id,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens),
  });

  return NextResponse.json({ prompt });
}
