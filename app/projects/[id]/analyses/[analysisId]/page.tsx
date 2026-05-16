'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Analysis, VideoAnalysis } from '@/lib/types';
import { useStorage } from '@/components/StorageProvider';

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
        <Section icon="🎯" title="1. Topic & Positioning">
          <Row label="Core Idea" value={v.topicPositioning?.coreIdea} />
          <Row label="Niche Specificity" value={v.topicPositioning?.nicheSpecificity} />
          <Row label="Angle" value={v.topicPositioning?.angle} />
          <Row label="Competitive Position" value={v.topicPositioning?.competitivePosition} />
        </Section>

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

        <Section icon="💥" title="8. Emotional Triggers">
          <Row label="Emotional Arc" value={v.emotionalTriggers?.emotionalArc} />
          <Row label="Intensity" value={v.emotionalTriggers?.intensityProgression} />
          <Row label="Payoff Quality" value={v.emotionalTriggers?.payoffQuality} />
          <div>
            <span className="text-xs text-[#71717a]">Primary Emotions</span>
            <Tags items={v.emotionalTriggers?.primaryEmotions} />
          </div>
        </Section>

        <Section icon="🎬" title="9. Visual Style & Editing">
          <Row label="Camera Style" value={v.visualStyleEditing?.inferredCameraStyle} />
          <Row label="B-Roll" value={v.visualStyleEditing?.brollEstimate} />
          <Row label="Graphics & Text" value={v.visualStyleEditing?.graphicsAndText} />
          <Row label="Editing Pace" value={v.visualStyleEditing?.editingPace} />
          <Row label="Branding" value={v.visualStyleEditing?.brandingConsistency} />
        </Section>

        <Section icon="🎵" title="10. Audio Design">
          <Row label="Voice Tone" value={v.audioDesign?.voiceToneAndClarity} />
          <Row label="Music Style" value={v.audioDesign?.backgroundMusicStyle} />
          <Row label="Sound Design" value={v.audioDesign?.soundDesignRole} />
          <Row label="Production Level" value={v.audioDesign?.audioProductionLevel} />
        </Section>

        <Section icon="⏱" title="11. Pacing">
          <Row label="Narrative Speed" value={v.pacing?.narrativeSpeed} />
          <Row label="Idea Density" value={v.pacing?.ideaDensity} />
          <Row label="Breathing Room" value={v.pacing?.breathingRoom} />
        </Section>

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

        <Section icon="📈" title="15. Algorithm Fit">
          <Row label="Watch Time Potential" value={v.algorithmFit?.watchTimePotential} />
          <Row label="Session Continuation" value={v.algorithmFit?.sessionContinuationStrategy} />
          <div>
            <span className="text-xs text-[#71717a]">CTR Drivers</span>
            <Tags items={v.algorithmFit?.ctrDrivers} />
          </div>
        </Section>

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

        <Section icon="🔁" title="17. Consistency & Channel Strategy">
          <Row label="Repeatability" value={v.channelConsistency?.formatRepeatability} />
          <Row label="Format Nature" value={v.channelConsistency?.seriesOrEpisodicNature} />
          <Row label="Upload Implication" value={v.channelConsistency?.uploadFrequencyImplication} />
        </Section>

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
  const storage = useStorage();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('channel');

  useEffect(() => {
    storage.getAnalysis(id, analysisId)
      .then(data => { setAnalysis(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id, analysisId, storage]);

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

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysis.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.reeliq.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const ci = analysis.channelInsights;

    const section = (title: string, content: string) =>
      content ? `<div class="section"><div class="section-title">${title}</div>${content}</div>` : '';

    const list = (items?: string[]) =>
      items?.length ? `<ul>${items.map(i => `<li>${i.replace(/</g,'&lt;')}</li>`).join('')}</ul>` : '';

    const tags = (items?: string[]) =>
      items?.length ? `<div class="tags">${items.map(i => `<span class="tag">${i.replace(/</g,'&lt;')}</span>`).join('')}</div>` : '';

    const row = (label: string, value?: string | boolean | null) =>
      value != null && value !== '' ? `<div class="row"><span class="row-label">${label}</span><span class="row-value">${String(value).replace(/</g,'&lt;')}</span></div>` : '';

    const scoreBar = (v: VideoAnalysis) => {
      const s = v.overallScores;
      const scores = [
        ['Hook', s?.hookStrength], ['Retention', s?.retentionPotential],
        ['Script', s?.scriptQuality], ['Thumbnail', s?.thumbnailEffectiveness],
        ['Algorithm', s?.algorithmOptimization], ['Production', s?.productionValue],
        ['Overall', s?.overall],
      ] as [string, number][];
      return `<div class="scores">${scores.map(([l, n]) => {
        const color = n >= 8 ? '#22c55e' : n >= 6 ? '#eab308' : '#ef4444';
        return `<div class="score-pill" style="border-color:${color};color:${color}"><strong>${n}</strong><span>${l}</span></div>`;
      }).join('')}</div>`;
    };

    const videoSections = analysis.videoAnalyses.map((v, idx) => `
      <div class="page-break">
        <h2 style="font-size:18px;margin:0 0 4px">Video ${idx + 1}: ${v.videoTitle.replace(/</g,'&lt;')}</h2>
        <a href="${v.videoUrl}" style="font-size:12px;color:#6366f1;">${v.videoUrl}</a>
        <div style="margin-top:16px">${scoreBar(v)}</div>
        ${v.overallScores?.keyStrengths?.length ? `<div class="section"><div class="section-title">Key Strengths</div>${list(v.overallScores.keyStrengths)}</div>` : ''}
        ${v.overallScores?.keyWeaknesses?.length ? `<div class="section"><div class="section-title">Weaknesses</div>${list(v.overallScores.keyWeaknesses)}</div>` : ''}
        ${v.overallScores?.topRecommendation ? `<div class="callout">${v.overallScores.topRecommendation.replace(/</g,'&lt;')}</div>` : ''}
        <div class="grid2">
          ${section('Hook', row('Type', v.hook?.type) + row('Opening Lines', v.hook?.openingLines) + row('Loop Description', v.hook?.openLoopDescription))}
          ${section('Title Structure', row('Format Pattern', v.titleStructure?.formatPattern) + row('Search Intent', v.titleStructure?.searchIntentAlignment) + tags(v.titleStructure?.keywords))}
          ${section('Content Structure', row('Loop Mechanism', v.contentStructure?.loopMechanism) + row('Stimulus Frequency', v.contentStructure?.newStimulusFrequency))}
          ${section('Script & Language', row('Sentence Style', v.scriptAndLanguage?.sentenceStyle) + row('Technical Depth', v.scriptAndLanguage?.technicalDepth) + (v.scriptAndLanguage?.standoutPhrases?.length ? `<ul>${v.scriptAndLanguage.standoutPhrases.map(p => `<li><em>"${p.replace(/</g,'&lt;')}"</em></li>`).join('')}</ul>` : ''))}
          ${section('Emotional Triggers', row('Arc', v.emotionalTriggers?.emotionalArc) + tags(v.emotionalTriggers?.primaryEmotions))}
          ${section('Audience', row('Target Viewer', v.audienceTargeting?.primaryTargetViewer) + row('Knowledge Level', v.audienceTargeting?.assumedKnowledgeLevel))}
        </div>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${analysis.name.replace(/</g,'&lt;')} — Analysis Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: #fff; padding: 36px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 24px; font-weight: 700; }
  h2 { font-size: 16px; font-weight: 700; margin: 24px 0 12px; }
  .meta { color: #6b7280; font-size: 12px; margin-top: 4px; }
  .header-bar { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 20px; margin-bottom: 24px; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; padding-bottom: 3px; }
  .callout { background: #eef2ff; border-left: 4px solid #6366f1; padding: 10px 14px; font-size: 12px; margin: 12px 0; border-radius: 4px; }
  .callout-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6366f1; margin-bottom: 4px; }
  .row { display: flex; gap: 12px; margin-bottom: 4px; }
  .row-label { font-size: 11px; color: #9ca3af; flex-shrink: 0; width: 130px; padding-top: 1px; }
  .row-value { font-size: 12px; color: #374151; flex: 1; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .tag { font-size: 11px; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px 7px; color: #374151; }
  ul { padding-left: 16px; }
  ul li { font-size: 12px; color: #374151; margin-bottom: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  .scores { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .score-pill { display: flex; flex-direction: column; align-items: center; border: 2px solid; border-radius: 8px; padding: 6px 12px; min-width: 60px; }
  .score-pill strong { font-size: 20px; font-weight: 700; line-height: 1; }
  .score-pill span { font-size: 10px; margin-top: 2px; opacity: 0.8; }
  .page-break { margin-top: 40px; padding-top: 32px; border-top: 2px solid #e5e7eb; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { body { padding: 16px; } .page-break { page-break-before: always; } }
</style>
</head>
<body>

<div class="header-bar">
  <div>
    <h1>${analysis.name.replace(/</g,'&lt;')}</h1>
    <div class="meta">${analysis.channelName} · ${analysis.videoAnalyses.length} video${analysis.videoAnalyses.length !== 1 ? 's' : ''} · ${new Date(analysis.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    ${analysis.channelUrl ? `<div class="meta" style="margin-top:4px">${analysis.channelUrl}</div>` : ''}
  </div>
  <div style="font-size:20px;font-weight:700;color:#6366f1">ReelIQ</div>
</div>

<h2 style="font-size:18px;margin:0 0 16px">Channel Strategy</h2>

<div class="section">
  <div class="section-title">Channel Overview</div>
  <p style="font-size:13px;color:#374151;">${(ci.channelOverview ?? '').replace(/</g,'&lt;')}</p>
</div>

${ci.replicationFormula ? `<div class="callout"><div class="callout-label">Replication Formula</div>${ci.replicationFormula.replace(/</g,'&lt;')}</div>` : ''}

<div class="grid2">
  ${ci.thingsToSteal?.length ? section('Things to Steal', `<ol style="padding-left:16px">${ci.thingsToSteal.map(t => `<li style="margin-bottom:6px;font-size:12px;color:#374151">${t.replace(/</g,'&lt;')}</li>`).join('')}</ol>`) : ''}
  ${ci.contentPillars?.length ? section('Content Pillars', tags(ci.contentPillars)) : ''}
  ${ci.titleFormulas?.length ? section('Title Formulas', list(ci.titleFormulas)) : ''}
  ${ci.hookStrategies?.length ? section('Hook Strategies', list(ci.hookStrategies)) : ''}
  ${section('Script Structure', row('Intro', ci.scriptStructureTemplate?.intro) + row('Body', ci.scriptStructureTemplate?.body) + row('Outro', ci.scriptStructureTemplate?.outro))}
  ${section('Visual Brand', row('Thumbnail Style', ci.visualBrand?.thumbnailStyle) + row('Color Scheme', ci.visualBrand?.colorScheme) + row('Typography', ci.visualBrand?.typography))}
  ${section('Audience Profile', row('Demographics', ci.audienceProfile?.demographics) + tags(ci.audienceProfile?.painPoints) + tags(ci.audienceProfile?.desiredOutcomes))}
  ${section('Content Style', row('Tone', ci.contentStyle?.tone) + row('Energy', ci.contentStyle?.energy) + row('Expertise', ci.contentStyle?.expertise) + row('Typical Length', ci.videoLength?.typical))}
  ${ci.uniqueValueProposition ? section('Unique Value Proposition', `<p style="font-size:12px;color:#374151">${ci.uniqueValueProposition.replace(/</g,'&lt;')}</p>`) : ''}
</div>

${videoSections}

<div class="footer">
  <span>Generated by ReelIQ · ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
  <span>${analysis.channelName}</span>
</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups for this site to export PDF.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            title="Download analysis as JSON — can be re-imported into any project"
          >
            ⬇ Export JSON
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            ⬇ Export PDF
          </button>
          <Link
            href={`/projects/${id}/scripts/new?analysisId=${analysisId}`}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-medium transition-colors"
          >
            ✍️ Write Script from This
          </Link>
        </div>
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
