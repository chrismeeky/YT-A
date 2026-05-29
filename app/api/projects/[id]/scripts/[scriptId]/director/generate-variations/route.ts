import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcAnthropicCost } from '@/lib/usage';
import { getUserIdFromRequest } from '@/lib/supabase';
import type { Analysis, DirectorAssetType } from '@/lib/types';

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string } }
) {
  void params;
  const body = (await request.json()) as {
    assetType: DirectorAssetType;
    narrationExcerpt: string;
    narrationSlice?: string;
    currentRationale: string;
    sceneTitle: string;
    sceneDescription?: string;
    scriptTitle: string;
    analysis: Analysis;
    characters?: Array<{ name: string; fullDescription: string }>;
    anthropicApiKey?: string;
  };

  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });
  }

  const userId = await getUserIdFromRequest(request);
  const { assetType, narrationExcerpt, narrationSlice, currentRationale, sceneTitle, sceneDescription, scriptTitle, analysis, characters } = body;

  const assetDescriptions: Record<DirectorAssetType, string> = {
    'ai-video':    'cinematic AI-generated video clip',
    'ai-image':    'AI-generated illustrated still',
    'stock-video': 'stock footage B-roll clip',
    'stock-photo': 'stock photograph',
    'real-image':  'real archival photograph or documented image',
  };

  const contentNature = analysis.channelInsights.contentNature?.classification ?? '';
  const productionStyle = analysis.channelInsights.visualBrand?.productionStyle ?? '';
  const brollPattern = analysis.channelInsights.visualSceneGuide?.brollPattern ?? '';
  const narrativeLens = analysis.channelInsights.narrativeLens ?? '';

  // The specific text this visual covers (slot slice if multi-shot, else full segment)
  const visualText = narrationSlice ?? narrationExcerpt;

  const charactersBlock = characters?.length
    ? `\nKEY SUBJECTS IN THIS SCRIPT:\n${characters.map(c => `- ${c.name}: ${c.fullDescription}`).join('\n')}`
    : '';

  const ai = new Anthropic({ apiKey: anthropicApiKey });

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: 'You are a visual director generating concise shot concepts. Respond ONLY with valid JSON, no markdown fences, no prose.',
    messages: [{
      role: 'user',
      content: `Generate 4 distinct visual variations for a ${assetDescriptions[assetType]} to accompany this narration.

SCRIPT: ${scriptTitle}
SCENE: ${sceneTitle}${sceneDescription ? `\n${sceneDescription}` : ''}${charactersBlock}
${narrativeLens ? `NARRATIVE LENS (default visual subject): ${narrativeLens}` : ''}

NARRATION SEGMENT: "${narrationExcerpt}"${narrationSlice && narrationSlice !== narrationExcerpt ? `\nSPECIFIC SHOT TEXT: "${narrationSlice}"` : ''}
VISUAL TO BE REPLACED: "${currentRationale}"

CHANNEL STYLE: ${contentNature}${productionStyle ? ` — ${productionStyle}` : ''}${brollPattern ? `\nBroll pattern: ${brollPattern}` : ''}

Rules:
- Each variation is a director's brief: 3–6 words, lowercase, highly specific
- Use the actual named subjects, locations, and events from the narration — not generic stand-ins
- Cover genuinely different visual approaches: literal (show the person/event), symbolic, atmospheric, abstract
- Do NOT repeat or paraphrase the current visual
- Match the channel's production style

Return ONLY:
{ "variations": ["concept one", "concept two", "concept three", "concept four"] }`,
    }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');

  const parsed = JSON.parse(cleaned) as { variations: string[] };

  void trackUsage({
    operation: 'generate-variations',
    api: 'anthropic',
    project_id: params.id,
    user_id: userId,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    estimated_cost_usd: calcAnthropicCost(response.usage.input_tokens, response.usage.output_tokens),
  });

  return NextResponse.json({ variations: parsed.variations });
}
