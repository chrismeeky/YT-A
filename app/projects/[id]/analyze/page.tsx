'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { ChannelVideo } from '@/lib/types';

type Step = 'input' | 'select' | 'analyzing' | 'done';

export default function AnalyzePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [step, setStep] = useState<Step>('input');
  const [channelUrl, setChannelUrl] = useState('');
  const [analysisName, setAnalysisName] = useState('');
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');
  const [progress, setProgress] = useState('');

  const fetchVideos = async () => {
    setFetching(true);
    setFetchError('');
    try {
      const res = await fetch(`/api/projects/${id}/channel-videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setFetchError(data.error); return; }
      setVideos(data);
      setStep('select');
    } catch {
      setFetchError('Failed to fetch videos. Make sure yt-dlp is installed.');
    } finally {
      setFetching(false);
    }
  };

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

    setTimeout(() => setProgress(`Fetching transcripts and thumbnails for ${selectedVideos.length} videos…`), 500);
    setTimeout(() => setProgress('Analysing with Claude AI…'), 3000);
    setTimeout(() => setProgress('Synthesising channel insights…'), 8000);

    try {
      const res = await fetch(`/api/projects/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: selectedVideos,
          channelUrl,
          analysisName: analysisName || `${selectedVideos[0]?.channelName || 'Channel'} Analysis`,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAnalyzeError(data.error); setStep('select'); return; }
      setStep('done');
    } catch {
      setAnalyzeError('Analysis failed. Check your API key in Settings.');
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
              onClick={fetchVideos}
              disabled={fetching || !channelUrl.trim()}
              className="px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-sm font-medium transition-colors flex-shrink-0"
            >
              {fetching ? 'Fetching…' : 'Fetch Videos'}
            </button>
          </div>
          {fetchError && <p className="text-xs text-red-400 mt-2">{fetchError}</p>}
        </div>
      )}

      {/* Step 2 — Video selection */}
      {step === 'select' && videos.length > 0 && (
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-sm">
              Step 2 — Select Videos{' '}
              <span className="text-[#52525b]">({selected.size}/3 selected)</span>
            </h2>
            {selected.size === 3 && (
              <span className="text-xs text-yellow-500">Maximum 3 videos reached</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
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

          {selected.size > 0 && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#71717a] mb-1">Analysis Name (optional)</label>
                <input
                  value={analysisName}
                  onChange={e => setAnalysisName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border focus:border-indigo-400"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  placeholder={`${videos.find(v => selected.has(v.id))?.channelName || 'Channel'} Analysis`}
                />
              </div>
              {analyzeError && <p className="text-xs text-red-400">{analyzeError}</p>}
              <button
                onClick={runAnalysis}
                className="w-full py-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
              >
                Analyse {selected.size} Selected Video{selected.size !== 1 ? 's' : ''} →
              </button>
            </div>
          )}
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
