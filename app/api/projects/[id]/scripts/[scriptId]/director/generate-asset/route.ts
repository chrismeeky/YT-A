import { NextRequest, NextResponse } from 'next/server';
import { generateDirectorPrompts } from '@/lib/claude';
import { searchPexels, searchBraveImages, searchDuckDuckGoImages, searchPexelsVideos } from '@/lib/image-search';
import { resolveKey, resolveKeyWithFallback } from '@/lib/beta';
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
    durationSeconds: number;
    durationEach?: number;
    searchQuery?: string;
    sceneTitle: string;
    sceneDescription: string;
    scriptTitle: string;
    analysis: Analysis;
    visualStyle?: string;
    directorNote?: string;
    characters?: Array<{ name: string; fullDescription: string }>;
    anthropicApiKey?: string;
    pexelsApiKey?: string;
    braveApiKey?: string;
    realImageProvider?: 'brave' | 'duckduckgo';
    wpm?: number;
  };

  const userId = await getUserIdFromRequest(request);
  const { assetType, narrationExcerpt, durationSeconds, durationEach, searchQuery, directorNote, sceneTitle, sceneDescription, scriptTitle, analysis, visualStyle, characters, wpm } = body;

  // ── Stock / real image searches ───────────────────────────────────────────
  if (assetType === 'stock-photo') {
    const pexelsApiKey = resolveKeyWithFallback(body.pexelsApiKey, 'NEXT_PUBLIC_PEXELS_API_KEY');
    if (!pexelsApiKey) return NextResponse.json({ error: 'Pexels API key required.' }, { status: 400 });
    if (!searchQuery) return NextResponse.json({ error: 'searchQuery required for stock-photo.' }, { status: 400 });
    void trackUsage({ operation: 'director-search', api: 'pexels', project_id: params.id, user_id: userId, requests: 1 });
    const photos = await searchPexels(searchQuery, pexelsApiKey, 6);
    return NextResponse.json({ photos });
  }

  if (assetType === 'stock-video') {
    const pexelsApiKey = resolveKeyWithFallback(body.pexelsApiKey, 'NEXT_PUBLIC_PEXELS_API_KEY');
    if (!pexelsApiKey) return NextResponse.json({ error: 'Pexels API key required.' }, { status: 400 });
    if (!searchQuery) return NextResponse.json({ error: 'searchQuery required for stock-video.' }, { status: 400 });
    void trackUsage({ operation: 'director-search', api: 'pexels', project_id: params.id, user_id: userId, requests: 1 });
    const videos = await searchPexelsVideos(searchQuery, pexelsApiKey, 6);
    return NextResponse.json({ videos });
  }

  if (assetType === 'real-image') {
    const provider = body.realImageProvider ?? 'brave';
    if (!searchQuery) return NextResponse.json({ error: 'searchQuery required for real-image.' }, { status: 400 });
    if (provider === 'brave') {
      const braveApiKey = resolveKeyWithFallback(body.braveApiKey, 'NEXT_PUBLIC_BRAVE_API_KEY');
      if (!braveApiKey) return NextResponse.json({ error: 'Brave API key required.' }, { status: 400 });
      const images = await searchBraveImages(searchQuery, braveApiKey, 6);
      return NextResponse.json({ images });
    }
    if (provider === 'duckduckgo') {
      const images = await searchDuckDuckGoImages(searchQuery, 6);
      return NextResponse.json({ images });
    }
    return NextResponse.json({ images: [] });
  }

  // ── AI prompt generation ──────────────────────────────────────────────────
  const anthropicApiKey = resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY');
  if (!anthropicApiKey) return NextResponse.json({ error: 'Anthropic API key required.' }, { status: 400 });

  // Derive the effective duration from narration text × WPM (accurate to the actual TTS read time).
  // Falls back to the pre-computed durationSeconds if WPM is not provided.
  const narrationWords = narrationExcerpt.trim().split(/\s+/).filter(Boolean).length;
  const effectiveDuration = wpm && narrationWords > 0
    ? Math.max(1, Math.round((narrationWords / wpm) * 60))
    : durationSeconds;
  const clipDuration = durationEach ?? Math.min(8, effectiveDuration);
  const clipCount = Math.max(1, Math.round(effectiveDuration / clipDuration));
  const productionStyle = analysis.channelInsights.visualBrand?.productionStyle ?? '';
  const visualGuide = analysis.channelInsights.visualSceneGuide;

  try {
    const { prompts, clipLabels, inputTokens, outputTokens } = await generateDirectorPrompts(anthropicApiKey, {
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
      directorNote,
    });

    void trackUsage({
      operation: 'director-prompts',
      api: 'anthropic',
      project_id: params.id,
      user_id: userId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: calcAnthropicCost(inputTokens, outputTokens),
    });

    return NextResponse.json({ prompts, clipLabels });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prompt generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
