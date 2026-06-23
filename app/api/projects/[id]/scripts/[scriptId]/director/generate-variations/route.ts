import { NextRequest, NextResponse } from 'next/server';
import { makeLLMConfig, llmErrorMessage, llmComplete } from '@/lib/llm';
import { resolveKey } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
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
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
  };

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  const userId = await getUserIdFromRequest(request);
  const { assetType, narrationExcerpt, narrationSlice, currentRationale, sceneTitle, sceneDescription, scriptTitle, analysis, characters } = body;

  const assetDescriptions: Record<DirectorAssetType, string> = {
    'ai-video':    'cinematic AI-generated video clip',
    'ai-image':    'AI-generated illustrated still',
    'stock-video': 'stock footage B-roll clip',
    'stock-photo': 'stock photograph',
    'real-image':  'real archival photograph or documented image',
  };

  const isStock = assetType === 'stock-video' || assetType === 'stock-photo';
  const isReal = assetType === 'real-image';

  const contentNature = analysis.channelInsights.contentNature?.classification ?? '';
  const productionStyle = analysis.channelInsights.visualBrand?.productionStyle ?? '';
  const brollPattern = analysis.channelInsights.visualSceneGuide?.brollPattern ?? '';
  const narrativeLens = analysis.channelInsights.narrativeLens ?? '';

  // The specific text this visual covers (slot slice if multi-shot, else full segment)
  const visualText = narrationSlice ?? narrationExcerpt;

  const charactersBlock = characters?.length
    ? `\nKEY SUBJECTS IN THIS SCRIPT:\n${characters.map(c => `- ${c.name}: ${c.fullDescription}`).join('\n')}`
    : '';

  const response = await llmComplete(llm, {
    claudeModel: 'claude-sonnet-4-6',
    maxTokens: 512,
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
${isStock ? `- STOCK FOOTAGE RULE: Generate GENERIC, searchable B-roll concepts (mood, atmosphere, environment, motion, textures, lighting, time of day). NEVER include specific people names, character names, or story-specific events/locations — stock libraries do not have them. Think like a documentary editor cutting generic illustrative footage.` : `- Use the actual named subjects, locations, and events from the narration when they are the visual focus — not generic stand-ins`}
- Cover genuinely different visual approaches: ${isStock ? 'wide landscape, close detail, atmospheric, symbolic, motion-based' : 'literal (show the person/event), symbolic, atmospheric, abstract'}
- Do NOT repeat or paraphrase the current visual
- Match the channel's production style

Return ONLY:
{ "variations": ["concept one", "concept two", "concept three", "concept four"] }`,
    }],
  });

  const raw = response.text;
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');

  const parsed = JSON.parse(cleaned) as { variations: string[] };

  const { cost: varCost, api: varApi } = calcLLMCost(llm.provider, response.inputTokens, response.outputTokens);
  void trackUsage({
    operation: 'generate-variations',
    api: varApi,
    project_id: params.id,
    user_id: userId,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    estimated_cost_usd: varCost,
  });

  return NextResponse.json({ variations: parsed.variations });
}
