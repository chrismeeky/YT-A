'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { ChannelVideo, Analysis, ChannelBookmark } from '@/lib/types';
import { useStorage } from '@/components/StorageProvider';
import { readSSE } from '@/lib/sse';

type Step = 'input' | 'select' | 'analyzing' | 'done';

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
  const [progress, setProgress] = useState('');
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

  // Auto-load next page when sentinel scrolls into view inside the card
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

  const runAnalysis = async () => {
    setStep('analyzing');
    setAnalyzeError('');
    setProgress('Starting analysis…');

    const selectedVideos = videos.filter(v => selected.has(v.id));

    try {
      const settings = await storage.getSettings();
      const res = await fetch(`/api/projects/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: selectedVideos,
          channelUrl,
          analysisName: analysisName || `${selectedVideos[0]?.channelName || 'Channel'} Analysis`,
          anthropicApiKey: settings.anthropicApiKey,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setAnalyzeError(data.error);
        setStep('select');
        return;
      }
      const data = await readSSE<Analysis>(res, setProgress);
      await storage.saveAnalysis(id, data);
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

          {/* Bookmark picker */}
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
          {/* Fixed header + CTA */}
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

          {/* Scrollable video grid */}
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
                      <Image
                        src={video.thumbnail}
                        alt={video.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
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

            {/* Sentinel + status */}
            <div ref={sentinelRef} className="h-px" />
            {loadingMore && (
              <p className="text-center text-[#52525b] text-xs py-4">Loading more videos…</p>
            )}
            {!nextPageToken && !loadingMore && (
              <p className="text-center text-[#52525b] text-xs py-4">{videos.length} videos loaded</p>
            )}
          </div>

        </div>
      )}

      {/* Analyzing */}
      {step === 'analyzing' && (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-4xl mb-4 animate-pulse">🔍</div>
          <h2 className="font-semibold mb-2">Analysing…</h2>
          <p className="text-sm text-[#71717a]">{progress}</p>
          <p className="text-xs text-[#52525b] mt-3">This may take 30–60 seconds</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div
          className="rounded-xl border p-10 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="text-4xl mb-4">✅</div>
          <h2 className="font-semibold mb-2">Analysis Complete</h2>
          <p className="text-sm text-[#71717a] mb-6">
            Channel insights saved. You can now generate scripts based on this analysis.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href={`/projects/${id}`}
              className="px-5 py-2.5 rounded-lg border text-sm transition-colors text-[#a1a1aa] hover:text-white hover:border-[#444]"
              style={{ borderColor: 'var(--border)' }}
            >
              View Project
            </Link>
            <Link
              href={`/projects/${id}/scripts/new`}
              className="px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
            >
              Write a Script →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
