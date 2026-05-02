import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getScript, saveScript, getAnalysis } from '@/lib/storage';
import { generateSceneAssets } from '@/lib/claude';
import { searchPexels, searchDuckDuckGo, searchPexelsVideos } from '@/lib/image-search';
import type { StockPhotoSegment, RealImageSegment, StockVideoSegment } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scriptId: string; sceneId: string } }
) {
  const settings = getSettings();
  if (!settings.anthropicApiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured.' }, { status: 400 });
  }

  const script = getScript(params.id, params.scriptId);
  if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  const scene = script.scenes.find(s => s.id === params.sceneId);
  if (!scene) return NextResponse.json({ error: 'Scene not found' }, { status: 404 });

  const analysis = getAnalysis(params.id, script.analysisId);
  if (!analysis) return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });

  const body = (await request.json()) as {
    image?: boolean;
    video?: boolean;
    stock?: boolean;
    stockPhotos?: boolean;
    realImages?: boolean;
    stockVideos?: boolean;
  };

  try {
    const assets = await generateSceneAssets(
      settings.anthropicApiKey,
      scene,
      analysis.channelInsights,
      {
        image: body.image ?? scene.includeImagePrompt,
        video: body.video ?? scene.includeVideoPrompt,
        stock: body.stock ?? scene.includeStockUrl,
        stockPhotos: body.stockPhotos ?? scene.includeStockPhotos,
        realImages: body.realImages ?? scene.includeRealImages,
        stockVideos: body.stockVideos ?? scene.includeStockVideos,
      },
      analysis,
      scene.assetGranularity ?? 2
    );

    // Fetch stock photos for each query in parallel
    let stockPhotoSegments: StockPhotoSegment[] | undefined;
    if (assets.stockPhotoQueries?.length) {
      if (!settings.pexelsApiKey) {
        return NextResponse.json({ error: 'Pexels API key not configured. Add it in Settings.' }, { status: 400 });
      }
      stockPhotoSegments = await Promise.all(
        assets.stockPhotoQueries.map(async ({ query, excerpt }) => ({
          query,
          narrationExcerpt: excerpt,
          photos: await searchPexels(query, settings.pexelsApiKey, 6),
        }))
      );
    }

    // Fetch real images for each query in parallel (DuckDuckGo scraping)
    let realImageSegments: RealImageSegment[] | undefined;
    if (assets.realImageQueries?.length) {
      realImageSegments = await Promise.all(
        assets.realImageQueries.map(async ({ query, excerpt }) => ({
          query,
          narrationExcerpt: excerpt,
          images: await searchDuckDuckGo(query, 6),
        }))
      );
    }

    // Fetch Pexels stock videos
    let stockVideoSegments: StockVideoSegment[] | undefined;
    if (assets.stockVideoQueries?.length) {
      if (!settings.pexelsApiKey) {
        return NextResponse.json({ error: 'Pexels API key not configured. Add it in Settings.' }, { status: 400 });
      }
      stockVideoSegments = await Promise.all(
        assets.stockVideoQueries.map(async ({ query, excerpt }) => ({
          query,
          narrationExcerpt: excerpt,
          videos: await searchPexelsVideos(query, settings.pexelsApiKey, 4),
        }))
      );
    }

    const updatedScenes = script.scenes.map(s =>
      s.id === params.sceneId
        ? {
            ...s,
            imagePrompts: assets.imagePrompts ?? s.imagePrompts,
            imagePromptExcerpts: assets.imagePromptExcerpts ?? s.imagePromptExcerpts,
            videoPrompts: assets.videoPrompts ?? s.videoPrompts,
            videoPromptExcerpts: assets.videoPromptExcerpts ?? s.videoPromptExcerpts,
            stockUrl: assets.stockUrl ?? s.stockUrl,
            ...(stockPhotoSegments !== undefined && { stockPhotoSegments }),
            ...(realImageSegments !== undefined && { realImageSegments }),
            ...(stockVideoSegments !== undefined && { stockVideoSegments }),
          }
        : s
    );

    const updated = { ...script, scenes: updatedScenes, updatedAt: new Date().toISOString() };
    saveScript(params.id, updated);
    return NextResponse.json({ ok: true, assets: { ...assets, stockPhotoSegments, realImageSegments, stockVideoSegments } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Asset generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
