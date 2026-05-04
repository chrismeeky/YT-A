'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { v4 as uuid } from 'uuid';
import type { ChannelVideo, VideoAnalysis, Analysis, ChannelBookmark } from '@/lib/types';
import { useStorage } from '@/components/StorageProvider';

type Step = 'input' | 'select' | 'analyzing' | 'done';

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
}

function StepIcon({ status }: { status: ProgressStep['status'] }) {
  if (status === 'loading') {
    return (
      <svg className="w-4 h-4 animate-spin text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    );
  }
  if (status === 'done') {
    return <span className="w-4 h-4 flex-shrink-0 text-green-400 text-sm leading-none">✓</span>;
  }
  if (status === 'error') {
    return <span className="w-4 h-4 flex-shrink-0 text-red-400 text-sm leading-none">✗</span>;
  }
  return <span className="w-4 h-4 flex-shrink-0 rounded-full border border-[#444] inline-block" />;
}

export default function AnalyzePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storage = useStorage();

  const [step, setStep] = useState<Step>('input');
  const [channelUrl, setChannelUrl] = useState(() => searchParams.get('channel') ?? '');
  const [analysisName, setAnalysisName] = useState('');
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [uploadsPlaylistId, setUploadsPlaylistId] = useState<string | undefined>();
  const [bookmarks, setBookmarks] = useState<ChannelBookmark[]>([]);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    storage.listBookmarks().then(setBookmarks);
  }, [storage]);

  useEffect(() => {
    const pre = searchParams.get('channel');
    if (pre) fetchVideos(pre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectBookmark = (bm: ChannelBookmark) => {
    const url = bm.channel.customUrl
      ? `https://www.youtube.com/${bm.channel.customUrl}`
      : `https://www.youtube.com/channel/${bm.channel.id}`;
    setChannelUrl(url);
    setBookmarkOpen(false);
    fetchVideos(url);
  };

  const fetchVideos = async (urlOverride?: string) => {
    const url = urlOverride ?? channelUrl;
    setFetching(true);
    setFetchError('');
    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/channel-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: url, youtubeApiKey: settings.youtubeApiKey }),
      });
      const data = await res.json();
      if (!res.ok) { setFetchError(data.error); return; }
      setVideos(data.videos);
      setNextPageToken(data.nextPageToken);
      setUploadsPlaylistId(data.uploadsPlaylistId);
      const channelName = data.videos[0]?.channelName;
      if (channelName) setAnalysisName(`${channelName} Analysis`);
      setStep('select');
    } catch {
      setFetchError('Failed to fetch videos.');
    } finally {
      setFetching(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/channel-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelUrl,
          youtubeApiKey: settings.youtubeApiKey,
          pageToken: nextPageToken,
          uploadsPlaylistId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFetchError(data.error); return; }
      setVideos(prev => [...prev, ...data.videos]);
      setNextPageToken(data.nextPageToken);
    } catch {
      setFetchError('Failed to load more videos.');
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, loadingMore, channelUrl, uploadsPlaylistId, storage, id]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container || !nextPageToken) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { root: container, rootMargin: '120px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextPageToken]);

  const toggleVideo = (videoId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else if (next.size < 3) {
        next.add(videoId);
      }
      return next;
    });
  };

  const updateStep = (stepId: string, status: ProgressStep['status']) => {
    setProgressSteps(prev => prev.map(s => s.id === stepId ? { ...s, status } : s));
  };

  const runAnalysis = async () => {
    const selectedVideos = videos.filter(v => selected.has(v.id));
    const settings = await storage.getSettings();

    // Build the step list upfront
    const steps: ProgressStep[] = [
      ...selectedVideos.map((v, i) => ({
        id: `video-${i}`,
        label: `Analysing video ${i + 1} of ${selectedVideos.length}: "${v.title.length > 50 ? v.title.slice(0, 47) + '…' : v.title}"`,
        status: 'pending' as const,
      })),
      { id: 'synthesize', label: 'Synthesising channel insights with Claude', status: 'pending' },
      { id: 'save', label: 'Saving analysis', status: 'pending' },
    ];

    setProgressSteps(steps);
    setStep('analyzing');
    setAnalyzeError('');

    try {
      const videoAnalyses: VideoAnalysis[] = [];

      for (let i = 0; i < selectedVideos.length; i++) {
        const video = selectedVideos[i];
        const stepId = `video-${i}`;
        updateStep(stepId, 'loading');

        const res = await fetch(`/api/projects/${id}/analyze/video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video, anthropicApiKey: settings.anthropicApiKey }),
        });
        const data = await res.json() as { result?: VideoAnalysis; error?: string };

        if (!res.ok || data.error) {
          updateStep(stepId, 'error');
          // Skip this video but continue with the rest
          continue;
        }

        videoAnalyses.push(data.result!);
        updateStep(stepId, 'done');
      }

      if (videoAnalyses.length === 0) {
        setAnalyzeError('All selected videos were declined or failed. Please choose different videos.');
        setStep('select');
        return;
      }

      // Synthesize
      updateStep('synthesize', 'loading');
      const synthRes = await fetch(`/api/projects/${id}/analyze/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoAnalyses, anthropicApiKey: settings.anthropicApiKey }),
      });
      const synthData = await synthRes.json() as { result?: unknown; error?: string };

      if (!synthRes.ok || synthData.error) {
        updateStep('synthesize', 'error');
        setAnalyzeError(synthData.error ?? 'Synthesis failed');
        setStep('select');
        return;
      }
      updateStep('synthesize', 'done');

      // Save
      updateStep('save', 'loading');
      const analysis: Analysis = {
        id: uuid(),
        name: analysisName || `${selectedVideos[0]?.channelName || 'Channel'} Analysis`,
        projectId: id,
        createdAt: new Date().toISOString(),
        channelUrl,
        channelName: selectedVideos[0]?.channelName || '',
        videoAnalyses,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channelInsights: synthData.result as any,
      };
      await storage.saveAnalysis(id, analysis);
      updateStep('save', 'done');

      // Small pause so the user sees all green ticks
      await new Promise(r => setTimeout(r, 600));
      router.push(`/projects/${id}`);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed. Check your API key in Settings.');
      setStep('select');
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#52525b] mb-8">
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">← Project</Link>
        <span>/</span>
        <span>New Analysis</span>
      </div>

      <h1 className="text-2xl font-semibold mb-1">Analyse a YouTube Channel</h1>
      <p className="text-[#71717a] text-sm mb-8">Paste a channel URL, pick up to 3 videos, and let Claude do the rest.</p>

      {/* Step 1 — Input */}
      {(step === 'input' || step === 'select') && (
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-medium text-sm mb-4">Step 1 — Channel URL</h2>
          <div className="flex gap-3">
            <input
              value={channelUrl}
              onChange={e => setChannelUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !fetching && channelUrl && fetchVideos()}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm border focus:border-indigo-400"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              placeholder="https://www.youtube.com/@channelname or /channel/UC…"
              disabled={fetching}
            />
            <button
              onClick={() => fetchVideos()}
              disabled={fetching || !channelUrl.trim()}
              className="px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-sm font-medium transition-colors flex-shrink-0"
            >
              {fetching ? 'Fetching…' : 'Fetch Videos'}
            </button>
          </div>
          {fetchError && <p className="text-xs text-red-400 mt-2">{fetchError}</p>}

          {bookmarks.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setBookmarkOpen(o => !o)}
                className="text-xs transition-colors flex items-center gap-1"
                style={{ color: 'var(--text-3)' }}
              >
                <span>{bookmarkOpen ? '▲' : '▼'}</span>
                {bookmarkOpen ? 'Hide saved channels' : `Choose from ${bookmarks.length} saved channel${bookmarks.length !== 1 ? 's' : ''}`}
              </button>

              {bookmarkOpen && (
                <div
                  className="mt-2 rounded-lg border overflow-hidden divide-y"
                  style={{ borderColor: 'var(--border)', maxHeight: '224px', overflowY: 'auto' }}
                >
                  {bookmarks.map(bm => (
                    <button
                      key={bm.channel.id}
                      onClick={() => selectBookmark(bm)}
                      disabled={fetching}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      {bm.channel.thumbnail && (
                        <img src={bm.channel.thumbnail} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{bm.channel.title}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                          {bm.channel.customUrl} · {bm.channel.subscriberCount.toLocaleString()} subs
                        </p>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: '#6366f1' }}>
                        {bm.channel.outlierScore.toFixed(1)}×
      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Video selection */}
      {step === 'select' && videos.length > 0 && (
        <div
          className="rounded-xl border flex flex-col mb-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: '72vh' }}
        >
          <div
            className="px-6 pt-5 pb-4 flex-shrink-0 border-b space-y-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-sm">
                Step 2 — Select Videos{' '}
                <span className="text-[#52525b]">({selected.size}/3 selected)</span>
              </h2>
              {selected.size === 3 && (
                <span className="text-xs text-yellow-500">Maximum reached</span>
              )}
            </div>
            <div className="flex gap-3 items-center">
              <input
                value={analysisName}
                onChange={e => setAnalysisName(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm border focus:border-indigo-400"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                placeholder="Analysis name…"
              />
              <button
                onClick={runAnalysis}
                disabled={selected.size === 0}
                className="px-5 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors flex-shrink-0"
              >
                Analyse {selected.size > 0 ? `${selected.size} Video${selected.size !== 1 ? 's' : ''}` : 'Videos'} →
              </button>
            </div>
            {analyzeError && <p className="text-xs text-red-400">{analyzeError}</p>}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-2">
              {videos.map(video => {
                const isSelected = selected.has(video.id);
                const isDisabled = !isSelected && selected.size >= 3;
                return (
                  <button
                    key={video.id}
                    onClick={() => !isDisabled && toggleVideo(video.id)}
                    className={`relative rounded-lg border text-left overflow-hidden transition-all ${
                      isSelected
                        ? 'border-indigo-400 ring-2 ring-indigo-400/30'
                        : isDisabled
                          ? 'border-[#222] opacity-40 cursor-not-allowed'
                          : 'border-[#222] hover:border-[#444]'
                    }`}
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <div className="relative aspect-video">
                      <Image src={video.thumbnail} alt={video.title} fill className="object-cover" unoptimized />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-xs">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium line-clamp-2 leading-tight">{video.title}</p>
                      <p className="text-[10px] text-[#52525b] mt-1">
                        {video.duration} · {video.viewCount.toLocaleString()} views
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div ref={sentinelRef} className="h-px" />
            {loadingMore && <p className="text-center text-[#52525b] text-xs py-4">Loading more videos…</p>}
            {!nextPageToken && !loadingMore && (
              <p className="text-center text-[#52525b] text-xs py-4">{videos.length} videos loaded</p>
            )}
          </div>
        </div>
      )}

      {/* Analyzing — step list */}
      {step === 'analyzing' && (
        <div
          className="rounded-xl border p-8"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-semibold mb-6">Analysing…</h2>
          <div className="space-y-4">
            {progressSteps.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <StepIcon status={s.status} />
                <span
                  className="text-sm"
                  style={{
                    color: s.status === 'done'
                      ? 'var(--text)'
                      : s.status === 'loading'
                        ? 'var(--text)'
                        : s.status === 'error'
                          ? '#f87171'
                          : 'var(--text-3)',
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-8" style={{ color: 'var(--text-3)' }}>
            This may take 30–90 seconds per video. Please keep this tab open.
          </p>
        </div>
      )}
    </div>
  );
}
