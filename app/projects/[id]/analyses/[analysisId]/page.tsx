'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Analysis, VideoAnalysis } from '@/lib/types';

// ─── Score pill ────────────────────────────────────────────────────────────

function Score({ value, label }: { value: number; label: string }) {
  const color =
    value >= 8 ? 'text-green-400 bg-green-500/10' :
    value >= 6 ? 'text-yellow-300 bg-yellow-500/10' :
    'text-red-400 bg-red-500/10';
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg ${color}`}>
      <span className="text-xl font-bold leading-none">{value}</span>
      <span className="text-[10px] mt-1 opacity-80">{label}</span>
    </div>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | boolean | number }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-[#71717a] flex-shrink-0 w-36 pt-0.5">{label}</span>
      <span className="text-xs text-[#d4d4d8] flex-1">
        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
      </span>
    </div>
  );
}

function Tags({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((item, i) => (
        <span key={i} className="text-xs px-2 py-1 rounded-md bg-[#1a1a1a] text-[#a1a1aa] border border-[#2a2a2a]">
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Single video deep-dive ─────────────────────────────────────────────────

function VideoDeepDive({ v }: { v: VideoAnalysis }) {
  const s = v.overallScores;
  return (
    <div className="space-y-4">
      {/* Scores overview */}
      <div className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h3 className="font-semibold text-sm mb-4">Overall Scores</h3>
        <div className="flex flex-wrap gap-3">
          <Score value={s?.hookStrength ?? 0} label="Hook" />
          <Score value={s?.retentionPotential ?? 0} label="Retention" />
          <Score value={s?.scriptQuality ?? 0} label="Script" />
          <Score value={s?.thumbnailEffectiveness ?? 0} label="Thumbnail" />
          <Score value={s?.algorithmOptimization ?? 0} label="Algorithm" />
          <Score value={s?.productionValue ?? 0} label="Production" />
          <Score value={s?.overall ?? 0} label="Overall" />
        </div>
        {s?.keyStrengths?.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-green-500 uppercase tracking-wider mb-1">Key Strengths</p>
              <ul className="space-y-1">
                {s.keyStrengths.map((x, i) => <li key={i} className="text-xs text-[#a1a1aa] flex gap-1"><span className="text-green-500">✓</span>{x}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Weaknesses</p>
              <ul className="space-y-1">
                {s.keyWeaknesses?.map((x, i) => <li key={i} className="text-xs text-[#a1a1aa] flex gap-1"><span className="text-red-400">✗</span>{x}</li>)}
              </ul>
            </div>
          </div>
        )}
        {s?.topRecommendation && (
          <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-600/20">
            <p className="text-[10px] text-indigo-300 uppercase tracking-wider mb-1">Top Recommendation</p>
            <p className="text-xs text-[#d4d4d8]">{s.topRecommendation}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Topic & Positioning */}
        <Section icon="🎯" title="1. Topic & Positioning">
          <Row label="Core Idea" value={v.topicPositioning?.coreIdea} />
          <Row label="Niche Specificity" value={v.topicPositioning?.nicheSpecificity} />
          <Row label="Angle" value={v.topicPositioning?.angle} />
          <Row label="Competitive Position" value={v.topicPositioning?.competitivePosition} />
        </Section>

        {/* 2. Hook */}
        <Section icon="🪝" title="2. Hook (First 5–15s)">
          <Row label="Type" value={v.hook?.type} />
          <Row label="Opening Lines" value={v.hook?.openingLines} />
          <Row label="Clarity" value={v.hook?.clarity} />
          <Row label="Retention Intent" value={v.hook?.retentionIntent} />
          <Row label="Creates Open Loop" value={v.hook?.createsOpenLoop} />
          {v.hook?.openLoopDescription && (
            <Row label="Loop Description" value={v.hook.openLoopDescription} />
          )}
        </Section>

        {/* 3. Title Structure */}
        <Section icon="📝" title="3. Title Structure">
          <Row label="Format Pattern" value={v.titleStructure?.formatPattern} />
          <Row label="Search Intent" value={v.titleStructure?.searchIntentAlignment} />
          <div>
            <span className="text-xs text-[#71717a]">Keywords</span>
            <Tags items={v.titleStructure?.keywords} />
          </div>
          <div>
            <span className="text-xs text-[#71717a]">Emotional Triggers</span>
            <Tags items={v.titleStructure?.emotionalTriggers} />
          </div>
        </Section>

        {/* 4. Thumbnail Design */}
        <Section icon="🖼" title="4. Thumbnail Design">
          <div className="flex gap-3">
            <Image
              src={v.thumbnail}
              alt={v.videoTitle}
              width={120}
              height={68}
              className="rounded-md flex-shrink-0 object-cover"
              unoptimized
            />
            <div className="space-y-1 flex-1">
              <Row label="Complexity" value={v.thumbnailDesign?.visualComplexity} />
              <Row label="Face/Expression" value={v.thumbnailDesign?.facialExpression} />
              <Row label="Colors" value={v.thumbnailDesign?.colorAndContrast} />
            </div>
          </div>
          <Row label="Text Overlay" value={v.thumbnailDesign?.textOverlay} />
          <Row label="Curiosity Gap" value={v.thumbnailDesign?.curiosityGapAlignment} />
          <Row label="Title Synergy" value={v.thumbnailDesign?.titleThumbnailSynergy} />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-[#71717a]">Effectiveness</span>
            <Score value={v.thumbnailDesign?.effectivenessRating ?? 0} label="" />
          </div>
        </Section>

        {/* 5. Content Structure */}
        <Section icon="🏗" title="5. Content Structure">
          <Row label="Uses Loops" value={v.contentStructure?.usesCarryForwardLoops} />
          <Row label="Loop Mechanism" value={v.contentStructure?.loopMechanism} />
          <Row label="Stimulus Frequency" value={v.contentStructure?.newStimulusFrequency} />
          {v.contentStructure?.segments?.length > 0 && (
            <div>
              <p className="text-xs text-[#71717a] mb-1">Segments</p>
              <ul className="space-y-1">
                {v.contentStructure.segments.map((seg, i) => (
                  <li key={i} className="text-xs text-[#a1a1aa] pl-2 border-l border-[#333]">{seg}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* 6. Retention Mechanics */}
        <Section icon="⚙️" title="6. Retention Mechanics">
          <Row label="Visual Change Rate" value={v.retentionMechanics?.visualChangeFrequency} />
          <Row label="Story Style" value={v.retentionMechanics?.storyProgressionStyle} />
          <Row label="Drop-off Risk" value={v.retentionMechanics?.mainDropOffRisk} />
          <div>
            <span className="text-xs text-[#71717a]">Pattern Interrupts</span>
            <Tags items={v.retentionMechanics?.patternInterrupts} />
          </div>
          <div>
            <span className="text-xs text-[#71717a]">Retention Strengths</span>
            <Tags items={v.retentionMechanics?.retentionStrengths} />
          </div>
        </Section>

        {/* 7. Script & Language */}
        <Section icon="✍️" title="7. Script & Language">
          <Row label="Sentence Style" value={v.scriptAndLanguage?.sentenceStyle} />
          <Row label="Technical Depth" value={v.scriptAndLanguage?.technicalDepth} />
          <Row label="Directness" value={v.scriptAndLanguage?.directnessLevel} />
          <div>
            <span className="text-xs text-[#71717a]">Rhetorical Devices</span>
            <Tags items={v.scriptAndLanguage?.rhetoricalDevices} />
          </div>
          {v.scriptAndLanguage?.standoutPhrases?.length > 0 && (
            <div>
              <p className="text-xs text-[#71717a] mb-1">Standout Phrases</p>
              {v.scriptAndLanguage.standoutPhrases.map((p, i) => (
                <p key={i} className="text-xs italic text-[#a1a1aa] border-l-2 border-indigo-400 pl-2 mb-1">&ldquo;{p}&rdquo;</p>
              ))}
            </div>
          )}
        </Section>

        {/* 8. Emotional Triggers */}
        <Section icon="💥" title="8. Emotional Triggers">
          <Row label="Emotional Arc" value={v.emotionalTriggers?.emotionalArc} />
          <Row label="Intensity" value={v.emotionalTriggers?.intensityProgression} />
          <Row label="Payoff Quality" value={v.emotionalTriggers?.payoffQuality} />
          <div>
            <span className="text-xs text-[#71717a]">Primary Emotions</span>
            <Tags items={v.emotionalTriggers?.primaryEmotions} />
          </div>
        </Section>

        {/* 9. Visual Style */}
        <Section icon="🎬" title="9. Visual Style & Editing">
          <Row label="Camera Style" value={v.visualStyleEditing?.inferredCameraStyle} />
          <Row label="B-Roll" value={v.visualStyleEditing?.brollEstimate} />
          <Row label="Graphics & Text" value={v.visualStyleEditing?.graphicsAndText} />
          <Row label="Editing Pace" value={v.visualStyleEditing?.editingPace} />
          <Row label="Branding" value={v.visualStyleEditing?.brandingConsistency} />
        </Section>

        {/* 10. Audio Design */}
        <Section icon="🎵" title="10. Audio Design">
          <Row label="Voice Tone" value={v.audioDesign?.voiceToneAndClarity} />
          <Row label="Music Style" value={v.audioDesign?.backgroundMusicStyle} />
          <Row label="Sound Design" value={v.audioDesign?.soundDesignRole} />
          <Row label="Production Level" value={v.audioDesign?.audioProductionLevel} />
        </Section>

        {/* 11. Pacing */}
        <Section icon="⏱" title="11. Pacing">
          <Row label="Narrative Speed" value={v.pacing?.narrativeSpeed} />
          <Row label="Idea Density" value={v.pacing?.ideaDensity} />
          <Row label="Breathing Room" value={v.pacing?.breathingRoom} />
        </Section>

        {/* 12. Call-to-Action */}
        <Section icon="📣" title="12. Call-to-Action">
          <Row label="Friction Level" value={v.callToAction?.frictionLevel} />
          <Row label="Integration" value={v.callToAction?.integrationQuality} />
          <div>
            <span className="text-xs text-[#71717a]">Placements</span>
            <Tags items={v.callToAction?.ctaPlacements} />
          </div>
          <div>
            <span className="text-xs text-[#71717a]">Types</span>
            <Tags items={v.callToAction?.ctaTypes} />
          </div>
        </Section>

        {/* 13. Audience Targeting */}
        <Section icon="👥" title="13. Audience Targeting">
          <Row label="Target Viewer" value={v.audienceTargeting?.primaryTargetViewer} />
          <Row label="Knowledge Level" value={v.audienceTargeting?.assumedKnowledgeLevel} />
          <div>
            <span className="text-xs text-[#71717a]">Demographic Signals</span>
            <Tags items={v.audienceTargeting?.demographicSignals} />
          </div>
          <div>
            <span className="text-xs text-[#71717a]">Identity Markers</span>
            <Tags items={v.audienceTargeting?.communityIdentityMarkers} />
          </div>
        </Section>

        {/* 14. Engagement Signals */}
        <Section icon="💬" title="14. Engagement Signals">
          <div>
            <span className="text-xs text-[#71717a]">Predicted Comment Types</span>
            <Tags items={v.engagementSignals?.predictedCommentTypes} />
          </div>
          <div>
            <span className="text-xs text-[#71717a]">Shareability Factors</span>
            <Tags items={v.engagementSignals?.shareabilityFactors} />
          </div>
          <div>
            <span className="text-xs text-[#71717a]">Community Building</span>
            <Tags items={v.engagementSignals?.communityBuildingElements} />
          </div>
        </Section>

        {/* 15. Algorithm Fit */}
        <Section icon="📈" title="15. Algorithm Fit">
          <Row label="Watch Time Potential" value={v.algorithmFit?.watchTimePotential} />
          <Row label="Session Continuation" value={v.algorithmFit?.sessionContinuationStrategy} />
          <div>
            <span className="text-xs text-[#71717a]">CTR Drivers</span>
            <Tags items={v.algorithmFit?.ctrDrivers} />
          </div>
        </Section>

        {/* 16. Monetization */}
        <Section icon="💰" title="16. Monetization Strategy">
          <Row label="Revenue Model" value={v.monetizationStrategy?.revenueModelAssessment} />
          <div>
            <span className="text-xs text-[#71717a]">Direct</span>
            <Tags items={v.monetizationStrategy?.directMonetization} />
          </div>
          <div>
            <span className="text-xs text-[#71717a]">Indirect</span>
            <Tags items={v.monetizationStrategy?.indirectMonetization} />
          </div>
        </Section>

        {/* 17. Consistency */}
        <Section icon="🔁" title="17. Consistency & Channel Strategy">
          <Row label="Repeatability" value={v.channelConsistency?.formatRepeatability} />
          <Row label="Format Nature" value={v.channelConsistency?.seriesOrEpisodicNature} />
          <Row label="Upload Implication" value={v.channelConsistency?.uploadFrequencyImplication} />
        </Section>

        {/* 18. Differentiation */}
        <Section icon="⚡" title="18. Differentiation">
          <Row label="vs Competitors" value={v.differentiation?.vsCompetitors} />
          <Row label="Voice & Personality" value={v.differentiation?.voiceAndPersonality} />
          <Row label="Defensible Advantage" value={v.differentiation?.defensibleAdvantage} />
          <div>
            <span className="text-xs text-[#71717a]">Unique Elements</span>
            <Tags items={v.differentiation?.uniqueElements} />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Channel Insights tab ───────────────────────────────────────────────────

function ChannelInsightsView({ analysis }: { analysis: Analysis }) {
  const ci = analysis.channelInsights;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="md:col-span-2 rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h3 className="font-semibold text-sm mb-2">Channel Overview</h3>
        <p className="text-sm text-[#a1a1aa]">{ci.channelOverview}</p>
        {ci.replicationFormula && (
          <div className="mt-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-600/20">
            <p className="text-[10px] text-indigo-300 uppercase tracking-wider mb-1">Replication Formula</p>
            <p className="text-xs text-[#d4d4d8]">{ci.replicationFormula}</p>
          </div>
        )}
      </div>

      <Section icon="🏆" title="Things to Steal">
        {ci.thingsToSteal?.map((t, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-indigo-300 text-xs font-bold flex-shrink-0">{i + 1}.</span>
            <p className="text-xs text-[#a1a1aa]">{t}</p>
          </div>
        ))}
      </Section>

      <Section icon="🎯" title="Content Pillars">
        <Tags items={ci.contentPillars} />
      </Section>

      <Section icon="📝" title="Title Formulas">
        {ci.titleFormulas?.map((f, i) => (
          <p key={i} className="text-xs text-[#a1a1aa] border-l-2 border-yellow-500 pl-2">{f}</p>
        ))}
      </Section>

      <Section icon="🪝" title="Hook Strategies">
        {ci.hookStrategies?.map((s, i) => (
          <p key={i} className="text-xs text-[#a1a1aa] border-l-2 border-green-500 pl-2">{s}</p>
        ))}
      </Section>

      <Section icon="🏗" title="Script Structure Template">
        <Row label="Intro" value={ci.scriptStructureTemplate?.intro} />
        <Row label="Body" value={ci.scriptStructureTemplate?.body} />
        <Row label="Outro" value={ci.scriptStructureTemplate?.outro} />
      </Section>

      <Section icon="🖼" title="Visual Brand">
        <Row label="Thumbnail Style" value={ci.visualBrand?.thumbnailStyle} />
        <Row label="Color Scheme" value={ci.visualBrand?.colorScheme} />
        <Row label="Typography" value={ci.visualBrand?.typography} />
        <Row label="Face in Thumbnail" value={ci.visualBrand?.faceInThumbnail} />
      </Section>

      <Section icon="👥" title="Audience Profile">
        <Row label="Demographics" value={ci.audienceProfile?.demographics} />
        <div>
          <span className="text-xs text-[#71717a]">Pain Points</span>
          <Tags items={ci.audienceProfile?.painPoints} />
        </div>
        <div>
          <span className="text-xs text-[#71717a]">Desired Outcomes</span>
          <Tags items={ci.audienceProfile?.desiredOutcomes} />
        </div>
      </Section>

      <Section icon="⭐" title="Unique Value Proposition">
        <p className="text-xs text-[#a1a1aa]">{ci.uniqueValueProposition}</p>
      </Section>

      <Section icon="📊" title="Content Style">
        <Row label="Tone" value={ci.contentStyle?.tone} />
        <Row label="Energy" value={ci.contentStyle?.energy} />
        <Row label="Expertise Level" value={ci.contentStyle?.expertise} />
        <Row label="Typical Length" value={ci.videoLength?.typical} />
        <Row label="Length Reasoning" value={ci.videoLength?.reasoning} />
      </Section>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function AnalysisDetailPage() {
  const { id, analysisId } = useParams<{ id: string; analysisId: string }>();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('channel');

  useEffect(() => {
    fetch(`/api/projects/${id}/analyses/${analysisId}`)
      .then(r => r.json())
      .then(data => { setAnalysis(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, analysisId]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-[#52525b]">Loading…</div>;
  }
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[#a1a1aa] mb-4">Analysis not found</p>
        <Link href={`/projects/${id}`} className="text-indigo-300 text-sm">← Back</Link>
      </div>
    );
  }

  const tabs = [
    { id: 'channel', label: 'Channel Strategy' },
    ...analysis.videoAnalyses.map((v, i) => ({
      id: v.videoId,
      label: `Video ${i + 1}`,
    })),
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#52525b] mb-6">
        <Link href={`/projects/${id}`} className="hover:text-white transition-colors">← {analysis.channelName || 'Project'}</Link>
        <span>/</span>
        <span>{analysis.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{analysis.name}</h1>
          <p className="text-sm text-[#52525b] mt-1">
            {analysis.channelName} · {analysis.videoAnalyses.length} videos · {new Date(analysis.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Link
          href={`/projects/${id}/scripts/new?analysisId=${analysisId}`}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
        >
          ✍️ Write Script from This
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(tab => {
          const video = analysis.videoAnalyses.find(v => v.videoId === tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-indigo-400 text-white'
                  : 'border-transparent text-[#71717a] hover:text-white'
              }`}
            >
              {video && (
                <Image
                  src={video.thumbnail}
                  alt=""
                  width={24}
                  height={14}
                  className="rounded object-cover"
                  unoptimized
                />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'channel' ? (
        <ChannelInsightsView analysis={analysis} />
      ) : (
        (() => {
          const video = analysis.videoAnalyses.find(v => v.videoId === activeTab);
          if (!video) return null;
          return (
            <div>
              <div className="flex items-center gap-4 mb-5 p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <Image
                  src={video.thumbnail}
                  alt={video.videoTitle}
                  width={160}
                  height={90}
                  className="rounded-lg object-cover flex-shrink-0"
                  unoptimized
                />
                <div>
                  <h2 className="font-semibold text-sm">{video.videoTitle}</h2>
                  <a
                    href={video.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-300 hover:text-indigo-300 mt-1 inline-block"
                  >
                    Watch on YouTube ↗
                  </a>
                </div>
              </div>
              <VideoDeepDive v={video} />
            </div>
          );
        })()
      )}
    </div>
  );
}
