import { NextRequest, NextResponse } from 'next/server';
import { generateSceneAssets } from '@/lib/claude';
import { searchPexels, searchBraveImages, searchDuckDuckGoImages, searchPexelsVideos } from '@/lib/image-search';
import { resolveKey, resolveKeyWithFallback } from '@/lib/beta';
import { trackUsage, calcLLMCost } from '@/lib/usage';
import { makeLLMConfig, llmErrorMessage } from '@/lib/llm';
import type { Scene, Analysis, CharacterSheet, PromptDetail, StockPhotoSegment, RealImageSegment, StockVideoSegment } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  void params;
  const body = (await request.json()) as {
    scene: Scene;
    analysis: Analysis;
    image?: boolean;
    video?: boolean;
    stock?: boolean;
    stockPhotos?: boolean;
    realImages?: boolean;
    stockVideos?: boolean;
    anthropicApiKey?: string;
    xaiApiKey?: string;
    llmProvider?: 'claude' | 'grok';
    claudeModel?: string;
    pexelsApiKey?: string;
    braveApiKey?: string;
    realImageProvider?: 'brave' | 'duckduckgo';
    characters?: CharacterSheet[];
    promptDetail?: PromptDetail;
    scriptTopic?: string;
    visualStyle?: string;
    usedFingerprints?: string[];
  };

  const llm = makeLLMConfig(
    body.llmProvider,
    resolveKey(body.anthropicApiKey, 'NEXT_PUBLIC_ANTHROPIC_API_KEY'),
    resolveKey(body.xaiApiKey, 'NEXT_PUBLIC_XAI_API_KEY'),
  );
  if (!llm) return NextResponse.json({ error: llmErrorMessage(body.llmProvider ?? 'claude') }, { status: 400 });

  if (!body.scene?.id || !body.analysis?.id) {
    return NextResponse.json({ error: 'Scene and analysis objects required.' }, { status: 400 });
  }

  const scene    = body.scene;
  const analysis = body.analysis;

  try {
    const { result: assets, inputTokens, outputTokens } = await generateSceneAssets(
      llm,
      scene,
      analysis.channelInsights,
      {
        image:       body.image       ?? scene.includeImagePrompt,
        video:       body.video       ?? scene.includeVideoPrompt,
        stock:       body.stock       ?? scene.includeStockUrl,
        stockPhotos: body.stockPhotos ?? scene.includeStockPhotos,
        realImages:  body.realImages  ?? scene.includeRealImages,
        stockVideos: body.stockVideos ?? scene.includeStockVideos,
      },
      analysis,
      scene.assetGranularity ?? 2,
      body.characters ?? [],
      body.promptDetail ?? scene.promptDetail ?? 'auto',
      body.scriptTopic,
      body.visualStyle,
      body.usedFingerprints,
      body.claudeModel,
    );

    const { cost: assetsCost, api: assetsApi } = calcLLMCost(llm.provider, inputTokens, outputTokens);
    void trackUsage({
      operation: 'generate-assets',
      api: assetsApi,
      project_id: params.id,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: assetsCost,
    });

    let stockPhotoSegments: StockPhotoSegment[] | undefined;
    if (assets.stockPhotoQueries?.length) {
      const pexelsApiKey = resolveKeyWithFallback(body.pexelsApiKey, 'NEXT_PUBLIC_PEXELS_API_KEY');
      if (!pexelsApiKey) {
        return NextResponse.json({ error: 'Pexels API key required. Add it in Settings.' }, { status: 400 });
      }
      stockPhotoSegments = await Promise.all(
        assets.stockPhotoQueries.map(async ({ query, excerpt }) => ({
          query,
          narrationExcerpt: excerpt,
          photos: await searchPexels(query, pexelsApiKey, 6),
        })),
      );
    }

    let realImageSegments: RealImageSegment[] | undefined;
    if (assets.realImageQueries?.length) {
      const provider = body.realImageProvider ?? 'brave';
      if (provider === 'brave') {
        const braveApiKey = resolveKeyWithFallback(body.braveApiKey, 'NEXT_PUBLIC_BRAVE_API_KEY');
        if (!braveApiKey) {
          return NextResponse.json({ error: 'Brave Search API key required for Real Images. Add it in Settings.' }, { status: 400 });
        }
        realImageSegments = await Promise.all(
          assets.realImageQueries.map(async ({ query, excerpt }) => ({
            query,
            narrationExcerpt: excerpt,
            images: await searchBraveImages(query, braveApiKey, 6),
          })),
        );
      } else if (provider === 'duckduckgo') {
        realImageSegments = await Promise.all(
          assets.realImageQueries.map(async ({ query, excerpt }) => ({
            query,
            narrationExcerpt: excerpt,
            images: (await searchDuckDuckGoImages(query, 6)).images,
          })),
        );
      }
    }

    let stockVideoSegments: StockVideoSegment[] | undefined;
    if (assets.stockVideoQueries?.length) {
      const pexelsApiKey = resolveKeyWithFallback(body.pexelsApiKey, 'NEXT_PUBLIC_PEXELS_API_KEY');
      if (!pexelsApiKey) {
        return NextResponse.json({ error: 'Pexels API key required. Add it in Settings.' }, { status: 400 });
      }
      stockVideoSegments = await Promise.all(
        assets.stockVideoQueries.map(async ({ query, excerpt }) => ({
          query,
          narrationExcerpt: excerpt,
          videos: await searchPexelsVideos(query, pexelsApiKey, 4),
        })),
      );
    }

    const pexelsRequests = (assets.stockPhotoQueries?.length ?? 0) + (assets.stockVideoQueries?.length ?? 0);
    if (pexelsRequests > 0) {
      void trackUsage({
        operation: 'generate-assets',
        api: 'pexels',
        project_id: params.id,
        requests: pexelsRequests,
      });
    }

    return NextResponse.json({ ok: true, assets: { ...assets, stockPhotoSegments, realImageSegments, stockVideoSegments } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Asset generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
