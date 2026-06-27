import { NextRequest, NextResponse } from 'next/server';
import { generateDirectorPrompts, generateSearchQuery } from '@/lib/claude';
import { searchPexels, searchBraveImages, searchDuckDuckGoImages, searchPexelsVideos } from '@/lib/image-search';
import { resolveKey, resolveKeyWithFallback } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';
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
    durationSeconds: number;
    durationEach?: number;
    clipCountOverride?: number;
    searchQuery?: string;
    sceneTitle: string;
    sceneDescription: string;
    scriptTitle: string;
    analysis: Analysis;
    visualStyle?: string;
    directorNote?: string;
    characters?: Array<{ name: string; fullDescription: string }>;
    siblingAssets?: Array<{ rationale: string; searchQuery?: string }>;
    page?: number;
    ddgVqd?: string;
    ddgNext?: string;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
    pexelsApiKey?: string;
    braveApiKey?: string;
    realImageProvider?: 'brave' | 'duckduckgo';
    wpm?: number;
  };

  const userId = await getUserIdFromRequest(request);
  const { assetType, narrationExcerpt, durationSeconds, durationEach, clipCountOverride, searchQuery, directorNote, sceneTitle, sceneDescription, scriptTitle, analysis, visualStyle, characters, siblingAssets, page = 1, wpm } = body;

  // Build a sibling visuals list for search query generation: prefer searchQuery over rationale
  // so the context is as specific as possible (e.g. "Edmund Kemper 1973 mugshot" vs "subject portrait")
  const siblingVisuals = siblingAssets
    ?.map(a => a.searchQuery || a.rationale)
    .filter(Boolean) as string[] | undefined;

  // ── Search query resolution ───────────────────────────────────────────────
  // If a query was already generated (by the director plan or a previous request), use it as-is.
  // Only generate a new one when the field is absent. Stale/bad queries are corrected by Regen,
  // which always arrives here with no searchQuery.
  const queryContentNature  = analysis.channelInsights.contentNature?.classification;
  const queryProductionStyle = analysis.channelInsights.visualBrand?.productionStyle ?? '';
  const queryBrollPattern   = analysis.channelInsights.visualSceneGuide?.brollPattern;

  const resolveQuery = async (type: 'stock-photo' | 'stock-video' | 'real-image'): Promise<string> => {
    if (searchQuery) return searchQuery;
    const queryLlm = makeLLMConfig(
      body.llmProvider,
      resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
      resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
    );
    if (!queryLlm) {
      return characters?.length
        ? `${characters[0].name} ${sceneTitle}`.trim()
        : sceneTitle || narrationExcerpt.slice(0, 40);
    }
    return generateSearchQuery(queryLlm, narrationExcerpt, type, {
      scriptTitle,
      sceneTitle,
      sceneDescription,
      characters,
      contentNature:       queryContentNature,
      productionStyle:     queryProductionStyle,
      channelBrollPattern: queryBrollPattern,
      siblingVisuals,
      directorNote:        directorNote || undefined,
    });
  };

  // ── Stock / real image searches ───────────────────────────────────────────
  if (assetType === 'stock-photo') {
    const pexelsApiKey = resolveKeyWithFallback(body.pexelsApiKey, 'NEXT_PUBLIC_PEXELS_API_KEY');
    if (!pexelsApiKey) return NextResponse.json({ error: 'Pexels API key required.' }, { status: 400 });
    const query = await resolveQuery('stock-photo');
    void trackUsage({ operation: 'director-search', api: 'pexels', project_id: params.id, user_id: userId, requests: 1 });
    const photos = await searchPexels(query, pexelsApiKey, 6, page);
    return NextResponse.json({ photos, autoSearchQuery: query });
  }

  if (assetType === 'stock-video') {
    const pexelsApiKey = resolveKeyWithFallback(body.pexelsApiKey, 'NEXT_PUBLIC_PEXELS_API_KEY');
    if (!pexelsApiKey) return NextResponse.json({ error: 'Pexels API key required.' }, { status: 400 });
    const query = await resolveQuery('stock-video');
    void trackUsage({ operation: 'director-search', api: 'pexels', project_id: params.id, user_id: userId, requests: 1 });
    const videos = await searchPexelsVideos(query, pexelsApiKey, 6, page);
    return NextResponse.json({ videos, autoSearchQuery: query });
  }

  if (assetType === 'real-image') {
    const provider = body.realImageProvider ?? 'brave';
    const query = await resolveQuery('real-image');
    const offset = (page - 1) * 6;
    if (provider === 'brave') {
      const braveApiKey = resolveKeyWithFallback(body.braveApiKey, 'NEXT_PUBLIC_BRAVE_API_KEY');
      if (!braveApiKey) return NextResponse.json({ error: 'Brave API key required.' }, { status: 400 });
      const images = await searchBraveImages(query, braveApiKey, 6, offset);
      return NextResponse.json({ images, autoSearchQuery: query });
    }
    if (provider === 'duckduckgo') {
      try {
        const { images, vqd, next } = await searchDuckDuckGoImages(query, 6, undefined, offset, body.ddgVqd, body.ddgNext);
        console.log('[DDG route] page:', page, 'offset:', offset, 'vqd:', vqd?.slice(0, 20), 'next:', next?.slice(0, 60) ?? 'null', 'images:', images.length);
        return NextResponse.json({ images, autoSearchQuery: query, ddgVqd: vqd, ddgNext: next });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'DuckDuckGo search failed';
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }
    return NextResponse.json({ images: [], autoSearchQuery: query });
  }

  // ── AI prompt generation ──────────────────────────────────────────────────
  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  // Derive the effective duration from narration text × WPM (accurate to the actual TTS read time).
  // Falls back to the pre-computed durationSeconds if WPM is not provided.
  const narrationWords = narrationExcerpt.trim().split(/\s+/).filter(Boolean).length;
  const effectiveDuration = wpm && narrationWords > 0
    ? Math.max(1, Math.round((narrationWords / wpm) * 60))
    : durationSeconds;
  const clipDuration = durationEach ?? Math.min(8, effectiveDuration);
  const clipCount = clipCountOverride ?? Math.max(1, Math.round(effectiveDuration / clipDuration));
  const productionStyle = analysis.channelInsights.visualBrand?.productionStyle ?? '';
  const visualGuide = analysis.channelInsights.visualSceneGuide;

  try {
    const { prompts, clipLabels, inputTokens, outputTokens } = await generateDirectorPrompts(llm, {
      assetType,
      narrationExcerpt,
      durationEach: clipDuration,
      clipCount,
      sceneTitle,
      sceneDescription,
      scriptTitle,
      productionStyle,
      visualStyle,
      characters,
      channelBrollPattern: visualGuide?.brollPattern,
      channelEditingRhythm: visualGuide?.editingRhythm,
      contentNature: analysis.channelInsights.contentNature?.classification,
      narrativeLens: analysis.channelInsights.narrativeLens,
      // For user-added assets (no directorNote), pass only story/character context —
      // NOT the scene description, which is already in the static block and would
      // override the narration excerpt if repeated as a mandatory directive.
      directorNote: directorNote || [
        scriptTitle && `Story: ${scriptTitle}.`,
        characters?.length && `Key subjects: ${characters.map(c => c.name).join(', ')}.`,
      ].filter(Boolean).join(' ') || undefined,
    });

    const { cost: directorCost, api: directorApi } = calcLLMCost(llm.provider, inputTokens, outputTokens);
    void trackUsage({
      operation: 'director-prompts',
      api: directorApi,
      project_id: params.id,
      user_id: userId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: directorCost,
    });

    return NextResponse.json({ prompts, clipLabels });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prompt generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
