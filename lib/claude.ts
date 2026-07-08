import { v4 as uuid } from 'uuid';
import type {
  ChannelVideo,
  VideoAnalysis,
  ChannelInsights,
  Analysis,
  Scene,
  ScriptSettings,
  DirectorScene,
  DirectorAsset,
  DirectorSegment,
} from './types';
import { resolvePromptLock } from './visual-styles';
import { llmComplete, type LLMConfig, type LLMContentBlock } from './llm';

// Honorifics and abbreviations that end with "." but are NOT sentence terminators.
const ABBREV = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'sgt', 'lt', 'capt', 'gen',
  'sen', 'rep', 'gov', 'pres', 'corp', 'inc', 'ltd', 'co', 'vs', 'etc', 'no',
  'vol', 'pp', 'est', 'approx', 'dept', 'ave', 'blvd', 'rd',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]);

function splitSentences(text: string): string[] {
  const results: string[] = [];
  // Match potential sentence boundaries: [.!?] followed by whitespace + uppercase/quote/bracket
  const boundary = /([.!?])\s+(?=[A-Z"'"‘“(\[])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text)) !== null) {
    if (m[1] === '.') {
      // Check the word immediately before this period — skip if it's a known abbreviation
      const preceding = text.slice(0, m.index + 1).match(/\b([A-Za-z]+)\.$/);
      if (preceding && ABBREV.has(preceding[1].toLowerCase())) continue;
    }
    results.push(text.slice(last, m.index + 1).trim());
    last = m.index + m[1].length + 1; // skip past the punctuation + one space
  }
  const tail = text.slice(last).trim();
  if (tail) results.push(tail);
  return results.filter(s => s.length > 0);
}

// ─── Video Analysis ─────────────────────────────────────────────────────────

export async function analyzeVideo(
  llm: LLMConfig,
  video: ChannelVideo,
  transcript: string,
  thumbnailBase64: string,
  claudeModelOverride?: string,
): Promise<{ result: VideoAnalysis; inputTokens: number; outputTokens: number }> {
  const transcriptExcerpt = transcript
    ? `${transcript.slice(0, 60000)}${transcript.length > 60000 ? '\n...[transcript truncated]' : ''}`
    : 'No transcript available — infer from title, description, and thumbnail.';

  const contentBlocks: LLMContentBlock[] = [];

  if (thumbnailBase64) {
    contentBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: thumbnailBase64 },
    });
  }

  const prompt = `You are an elite YouTube content strategist. Analyze this video across 18 strategic dimensions with maximum specificity. Never be generic — use actual details from the transcript, title, and thumbnail image.

VIDEO DATA:
Title: ${video.title}
Channel: ${video.channelName}
Views: ${video.viewCount.toLocaleString()}
Duration: ${video.duration}
Upload Date: ${video.uploadDate}
Description: ${video.description.slice(0, 800)}

TRANSCRIPT:
${transcriptExcerpt}

[THUMBNAIL IMAGE IS ATTACHED ABOVE — describe EXACTLY what you see: every element, color, text, face, layout, background]

RULES:
- Thumbnail fields: describe what you literally see in the image, not what you imagine
- Visual/audio/editing fields: make expert inferences from transcript density, tone, and content type
- Quote from transcript where relevant
- All scores are integers 1–10
- Return ONLY valid JSON, no markdown fences

{
  "topicPositioning": {
    "coreIdea": "One precise sentence: the exact problem/story/curiosity gap this video addresses",
    "nicheSpecificity": "How tight the targeting is — broad vs micro-niche, with specifics",
    "angle": "Primary approach: educational | entertainment | shock | storytelling | controversy | investigative",
    "competitivePosition": "How this sits vs typical content in this niche — what makes the angle distinct"
  },
  "hook": {
    "type": "Specific type: question | bold claim | preview | emotional trigger | statistic | story-in-progress",
    "openingLines": "First 2–3 sentences verbatim from transcript",
    "clarity": "Whether viewer is immediately oriented or intentionally disoriented — and why",
    "retentionIntent": "Specific psychological mechanism keeping the viewer watching",
    "createsOpenLoop": true,
    "openLoopDescription": "Exactly what unresolved question or tension is planted"
  },
  "titleStructure": {
    "keywords": ["keyword1 (search intent)", "keyword2 (topic signal)"],
    "emotionalTriggers": ["trigger1: how it works psychologically", "trigger2: mechanism"],
    "formatPattern": "Exact formula e.g. 'The [NOUN] That [DRAMATIC VERB]ed [TARGET]'",
    "searchIntentAlignment": "Discovery vs search traffic split, and how well title captures each"
  },
  "thumbnailDesign": {
    "visualComplexity": "Simple | moderate | cluttered — list every visible element you see",
    "facialExpression": "Describe exact expression and emotion if face present, or 'no face used'",
    "colorAndContrast": "Name dominant 2–3 colors and explain the contrast strategy",
    "textOverlay": "Exact text on thumbnail, font style, color, size, placement",
    "curiosityGapAlignment": "How thumbnail + title together create or close a curiosity gap",
    "titleThumbnailSynergy": "Do they complement (add info) or repeat (waste space) each other?",
    "effectivenessRating": 8
  },
  "contentStructure": {
    "segments": [
      "Hook (0:00–0:30): specific description of what happens",
      "Setup (0:30–2:00): what is established for the viewer",
      "Development (2:00–X:XX): how main content unfolds — specifics",
      "Climax (X:XX–X:XX): peak tension or reveal moment",
      "Resolution (X:XX–end): how it wraps and what viewer leaves with"
    ],
    "usesCarryForwardLoops": true,
    "loopMechanism": "How unresolved questions are planted mid-video to prevent drop-off",
    "newStimulusFrequency": "How often a new idea, scene, or piece of information is introduced",
    "overallFlowRating": 8
  },
  "retentionMechanics": {
    "patternInterrupts": ["Specific technique e.g. abrupt scene cut to B-roll", "Specific technique 2"],
    "visualChangeFrequency": "Estimated seconds between cuts/visual changes for this content type",
    "storyProgressionStyle": "Linear | non-linear | anthology | case-study | escalating revelation",
    "mainDropOffRisk": "The exact point where viewers likely leave and the specific reason why",
    "retentionStrengths": ["Specific strength 1", "Specific strength 2", "Specific strength 3"]
  },
  "emotionalTriggers": {
    "primaryEmotions": ["Emotion1", "Emotion2", "Emotion3"],
    "emotionalArc": "How emotions build e.g. 'opens with curiosity → builds dread → delivers resolution'",
    "intensityProgression": "Flat | slow-build | rollercoaster | front-loaded — describe the pattern",
    "payoffQuality": "Whether the emotional tension is satisfyingly resolved or left intentionally open",
    "emotionalScore": 8
  },
  "visualStyleEditing": {
    "inferredCameraStyle": "Static talking head | dynamic B-roll heavy | documentary | animated | screen-record",
    "brollEstimate": "Heavy | moderate | minimal — inferred from content type and transcript density",
    "graphicsAndText": "Inferred use of on-screen text, lower thirds, graphics, recreations",
    "editingPace": "Fast-paced (cuts every 2–3s) | methodical (5–10s) | cinematic (long takes)",
    "brandingConsistency": "Consistent intro/outro | color grading | format structure evidence"
  },
  "audioDesign": {
    "voiceToneAndClarity": "Tone descriptor (e.g. authoritative/ominous/warm) and estimated production quality",
    "backgroundMusicStyle": "Music type inferred from content e.g. 'dark ambient thriller score'",
    "soundDesignRole": "Functional (barely noticeable) | atmospheric (sets mood) | emphasis-heavy (punctuates moments)",
    "audioProductionLevel": "Professional studio | home studio with treatment | raw — inferred from content type"
  },
  "pacing": {
    "narrativeSpeed": "Estimated WPM range based on transcript length vs video duration",
    "ideaDensity": "Information-dense (new concept every few seconds) | breathing room | mixed",
    "breathingRoom": "Does the script give time to absorb each idea, or constantly push forward?",
    "pacingScore": 8
  },
  "audienceTargeting": {
    "primaryTargetViewer": "Specific description of exactly who this was made for — age, context, mindset",
    "assumedKnowledgeLevel": "No prior knowledge | familiar with basics | niche expertise expected",
    "demographicSignals": ["Age signal: specific evidence", "Interest signal: specific reference", "Cultural signal"],
    "communityIdentityMarkers": ["Phrase/reference signaling in-group identity", "Another identity marker"]
  },
  "algorithmFit": {
    "watchTimePotential": "High | Medium | Low — with the specific structural reason why",
    "ctrDrivers": ["Title driver: specific element", "Thumbnail driver: specific element", "Synergy effect"],
    "sessionContinuationStrategy": "How this video leads the viewer to continue watching more content",
    "algorithmScore": 8
  },
  "differentiation": {
    "uniqueElements": ["Specific element distinguishing this from standard niche content", "Another differentiator"],
    "vsCompetitors": "How this stands out from the typical 10 videos YouTube shows on this topic",
    "voiceAndPersonality": "The distinct creator voice/persona being built and its appeal",
    "defensibleAdvantage": "What is genuinely difficult to copy about this creator's approach"
  },
  "overallScores": {
    "hookStrength": 8,
    "retentionPotential": 8,
    "productionValue": 7,
    "algorithmOptimization": 9,
    "scriptQuality": 8,
    "thumbnailEffectiveness": 8,
    "overall": 8,
    "keyStrengths": ["Most impactful strength", "Second strength", "Third strength"],
    "keyWeaknesses": ["Most significant weakness", "Second weakness"],
    "topRecommendation": "The single most valuable thing to replicate from this video's strategy"
  }
}`;

  contentBlocks.push({ type: 'text', text: prompt });

  const result = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-opus-4-8',
    maxTokens: 8000,
    system:
      'You are an elite YouTube content strategy expert. Respond ONLY with valid JSON — no markdown fences, no prose. Be specific and concrete in every field. Keep each field value to 1–2 sentences max.',
    messages: [{ role: 'user', content: contentBlocks }],
  });

  if (result.stopReason === 'max_tokens') {
    throw new Error(
      'Analysis response was truncated (too long). This is rare — please try again, or reduce the number of videos being analysed simultaneously.'
    );
  }

  const text = result.text || '{}';

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }

  if (!cleaned.startsWith('{')) {
    throw new Error(
      `"${video.title}" could not be analysed — the AI declined to process this content. This can happen with sensitive topics; retrying usually works.`
    );
  }

  let parsed: Omit<VideoAnalysis, 'videoId' | 'videoTitle' | 'videoUrl' | 'thumbnail' | 'channelName'>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Failed to parse analysis JSON for "${video.title}". Raw response starts with: ${cleaned.slice(0, 200)}`
    );
  }

  return {
    result: {
      videoId: video.id,
      videoTitle: video.title,
      videoUrl: video.url,
      thumbnail: video.thumbnail,
      channelName: video.channelName,
      ...parsed,
    },
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// ─── Channel Synthesis ──────────────────────────────────────────────────────

export async function synthesizeChannelInsights(
  llm: LLMConfig,
  videoAnalyses: VideoAnalysis[],
  claudeModelOverride?: string,
): Promise<{ result: ChannelInsights; inputTokens: number; outputTokens: number }> {

  // Slim summary — only the fields needed to identify cross-video patterns
  const summaries = videoAnalyses.map(v => ({
    title: v.videoTitle,
    coreIdea: v.topicPositioning?.coreIdea,
    angle: v.topicPositioning?.angle,
    hookType: v.hook?.type,
    hookOpeningLines: v.hook?.openingLines,
    openLoop: v.hook?.openLoopDescription,
    retentionIntent: v.hook?.retentionIntent,
    // Full transcript — 100% of spoken content for accurate voice and structure extraction
    fullTranscript: v.fullTranscript,
    // Section markers so synthesis can locate hook/climax/outro within the full text
    transcriptHook: v.transcriptHook,
    transcriptClimax: v.transcriptClimax,
    transcriptOutro: v.transcriptOutro,
    // Content structure — how body holds attention across scenes
    usesCarryForwardLoops: v.contentStructure?.usesCarryForwardLoops,
    loopMechanism: v.contentStructure?.loopMechanism,
    newStimulusFrequency: v.contentStructure?.newStimulusFrequency,
    titlePattern: v.titleStructure?.formatPattern,
    titleTriggers: v.titleStructure?.emotionalTriggers,
    thumbnailStyle: v.thumbnailDesign?.visualComplexity,
    thumbnailColors: v.thumbnailDesign?.colorAndContrast,
    thumbnailText: v.thumbnailDesign?.textOverlay,
    thumbnailSynergy: v.thumbnailDesign?.titleThumbnailSynergy,
    // Production medium — critical for AI video prompt generation
    inferredCameraStyle: v.visualStyleEditing?.inferredCameraStyle,
    brollEstimate: v.visualStyleEditing?.brollEstimate,
    graphicsAndText: v.visualStyleEditing?.graphicsAndText,
    editingPace: v.visualStyleEditing?.editingPace,
    brandingConsistency: v.visualStyleEditing?.brandingConsistency,
    patternInterrupts: v.retentionMechanics?.patternInterrupts,
    retentionStrengths: v.retentionMechanics?.retentionStrengths,
    storyProgressionStyle: v.retentionMechanics?.storyProgressionStyle,
    primaryEmotions: v.emotionalTriggers?.primaryEmotions,
    emotionalArc: v.emotionalTriggers?.emotionalArc,
    emotionalIntensityProgression: v.emotionalTriggers?.intensityProgression,
    targetViewer: v.audienceTargeting?.primaryTargetViewer,
    assumedKnowledgeLevel: v.audienceTargeting?.assumedKnowledgeLevel,
    voiceAndPersonality: v.differentiation?.voiceAndPersonality,
    uniqueElements: v.differentiation?.uniqueElements,
    defensibleAdvantage: v.differentiation?.defensibleAdvantage,
    algorithmScore: v.algorithmFit?.algorithmScore,
    overallScore: v.overallScores?.overall,
    keyStrengths: v.overallScores?.keyStrengths,
    topRecommendation: v.overallScores?.topRecommendation,
  }));

  const result = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-opus-4-8',
    maxTokens: 16000,
    system:
      'You are a YouTube content strategy expert. Respond ONLY with valid JSON, no markdown fences, no prose.',
    messages: [
      {
        role: 'user',
        content: [
          {
            // Full transcripts + metadata — large and stable, cache so retries are free
            type: 'text' as const,
            text: `VIDEO ANALYSES — ${videoAnalyses.length} videos including full transcripts:\n${JSON.stringify(summaries, null, 2)}`,
            cache_control: { type: 'ephemeral' as const },
          },
          {
            type: 'text' as const,
            text: `Synthesise a channel strategy profile from the video analyses above. A creator wants to model their channel on this one.

CRITICAL INSTRUCTION: Extract PRINCIPLES and PSYCHOLOGICAL MECHANISMS — describe WHY each technique works and WHAT effect it creates. Focus on structure, strategy, visual style, and narrative architecture. Writing voice is captured from raw transcripts during script generation, not here.

Also estimate visualSceneGuide.cutRateShotsPerMinute from the editingPace and brollEstimate descriptions — fast-cut channels = 10–20 shots/min; moderate documentary style = 5–8 shots/min; slow atmospheric/cinematic = 2–4 shots/min. Return it as an integer greater than 0.

Return ONLY valid JSON:
{
  "contentNature": {
    "classification": "fictional | non-fictional | mixed",
    "reasoning": "1-2 sentences explaining the classification — e.g. 'Channel produces animated folktales and original fictional narratives' or 'Channel covers real documented crimes, historical events, and investigative journalism. All content references verifiable real-world people and events.' or 'Channel mixes fictional drama with real historical context.'"
  },
  "channelOverview": "3-sentence strategic summary of what makes this channel work — focus on the psychological contract with the viewer",
  "contentPillars": ["Pillar 1: specific theme with the emotional angle it exploits", "Pillar 2", "Pillar 3"],
  "titleFormulas": ["Formula 1: describe the structural pattern and the psychological trigger it activates — e.g. 'contrast between official narrative and hidden truth, creates cognitive dissonance'", "Formula 2"],
  "hookStrategies": ["Strategy 1: describe the PSYCHOLOGICAL MECHANISM — what assumption it exploits, what gap it opens, what emotion it triggers, and why viewers cannot stop watching. Do NOT write example sentences or templates.", "Strategy 2", "Strategy 3"],
  "scriptStructureTemplate": {
    "intro": "Describe the INTENT and EFFECT of the opening — what the viewer feels, what question gets planted, what commitment is created. No example sentences.",
    "body": "Describe the pacing rhythm, how tension is built and released, how information is sequenced to maintain curiosity. Focus on the underlying architecture.",
    "outro": "Describe the emotional resolution the channel typically delivers and how the CTA is integrated into that resolution.",
    "loopMechanism": "If this channel uses carry-forward loops between scenes: describe exactly how each scene ends (what hook, question, or unresolved tension it plants) and how the next scene opens to pay it off. If the channel does not use carry-forward loops, write null."
  },
  "visualBrand": {
    "thumbnailStyle": "Specific repeatable thumbnail formula this channel uses",
    "colorScheme": "Brand colours with purpose",
    "typography": "Text style and placement pattern",
    "faceInThumbnail": true,
    "productionStyle": "The exact visual production medium — be specific enough for an AI video generator to reproduce it. Examples: 'Pixar-style 3D CGI animation with soft lighting and expressive characters', 'DreamWorks 3D animated feature film style', 'hand-drawn 2D animation with watercolor backgrounds', 'photorealistic cinematic documentary', 'anime-style 2D animation with cel shading', 'live-action talking head with motion-graphic B-roll'. Do NOT use vague terms like '3D animated' or 'animated' alone — always include the studio reference or rendering style so AI generators produce the right output."
  },
  "visualSceneGuide": {
    "sceneDescriptionStyle": "How to write a scene description for this channel — what to mention (location, lighting, action, camera angle), what level of detail, and what to omit. Base this on the inferred visual style across all analyzed videos.",
    "brollPattern": "What this channel typically cuts to during narration — e.g. 'close-ups of documents and evidence', 'aerial establishing shots of locations', 'character close-ups with shallow DOF', 'archival-style recreations'. Be specific enough that a director could brief a videographer.",
    "editingRhythm": "The pace of visual cuts for this channel — how long a shot typically holds, what triggers a cut (new sentence? new beat? keyword?), and how editing pace changes across the emotional arc of a video.",
    "graphicsAndTextUsage": "When and how this channel uses on-screen text, lower thirds, titles, or motion graphics — specific triggers and purposes.",
    "audioMood": "The background music and sound design character this channel uses — genre, emotional tone, when it swells or drops, how it supports the narration.",
    "cutRateShotsPerMinute": 5
  },
  "visualAssetMix": {
    "ai-video": 0,
    "ai-image": 0,
    "stock-video": 0,
    "stock-photo": 0,
    "real-image": 0,
    "reasoning": "1-sentence explanation of this channel's visual approach — e.g. 'Heavily archival with real documentary footage (real-image 50%, stock-video 30%) reflecting its non-fictional investigative style' or 'Fully AI-generated animation with no real footage, relying on ai-video and ai-image exclusively'. The five numbers must sum to 100. Map the channel's actual observed footage types to these categories: real-image = archival/documentary/actual photos of real people/events; stock-video = licensed footage, B-roll, generic atmospheric clips; stock-photo = licensed still photos, Getty-style imagery; ai-video = AI-generated video, animated sequences, motion graphics, CGI; ai-image = AI-generated stills, illustrated frames, graphic cards."
  },
  "audienceProfile": {
    "demographics": "Specific age range, background, what they are seeking",
    "painPoints": ["Specific pain 1", "Specific pain 2"],
    "desiredOutcomes": ["What they want to feel/know/have after watching 1", "Outcome 2"]
  },
  "uniqueValueProposition": "What this channel delivers that most channels in the niche do not",
  "engagementPatterns": ["Specific pattern 1 — describe the mechanism, not the surface behaviour", "Pattern 2", "Pattern 3"],
  "contentStyle": {
    "tone": "Describe the voice character — what adjectives define it, what it deliberately avoids, what relationship it builds with the viewer",
    "energy": "Energy level, delivery pace, and how it modulates across the video",
    "expertise": "What level of prior knowledge the viewer is assumed to have, and how the channel signals its own authority"
  },
  "narrativeLens": "1-2 sentences describing WHO the camera stays on and WHY. Identify the primary subject of every script this channel produces (e.g. 'The founder is always the primary subject — their decision-making, blind spots, and personality. Market forces and competitors exist as backdrop.' or 'The dish is always the primary subject — its ingredients, technique, and cultural origin. The chef exists to illuminate the food, not the reverse.'). Be specific enough that a writer knows immediately whose interiority or story to inhabit and what question the script is fundamentally trying to answer. Include what the channel NEVER centres.",
  "openLoopProfile": {
    "peakSimultaneousLoops": 2,
    "avgResolutionPoint": "X% through the video — describe when and how loops planted in the hook are resolved (e.g. 'questions planted at 0–1 min resolve at ~65–75% mark in the final act')",
    "loopTypes": ["Specific type of loop this channel plants — e.g. 'unresolved character fate', 'withheld causal explanation', 'foreshadowed consequence that is teased but not named'", "Second loop type", "Third loop type if applicable"]
  },
  "videoLength": {
    "typical": "Duration range in minutes",
    "reasoning": "Why this length serves this audience and content type"
  },
  "styleFingerprint": ["Distinctive quality 1 — something a reader could identify in a blind test as belonging to this channel", "Quality 2", "Quality 3", "Quality 4"],
  "replicationFormula": "Describe the creative PROCESS — how to find the right angle, how to open the narrative tension, how to sustain it. Focus on decisions a writer makes, not sentence-level patterns.",
  "thingsToSteal": ["Principle 1: describe what makes it effective and how to apply it to a new topic — not what it looks like on the surface", "Principle 2", "Principle 3", "Principle 4", "Principle 5"],
  "voiceInjectionPrompt": "A direct style directive (4-6 sentences) a writer can paste in front of their topic to immediately write in this channel's voice. Cover: the emotional register and tone, the hook architecture (what the first sentence must do), the narrative rhythm (sentence length, pacing, compression), the vocabulary character (word choice style), and what makes this channel's scripts immediately recognisable. Write it as imperative commands directed at the writer — 'Open with...', 'Use...', 'Never...'. Be specific to this channel's actual observable patterns, not generic YouTube advice.",
  "narrativeStructure": {
    "hookAnchorType": "What does the FIRST SENTENCE of every hook anchor on in these transcripts? Options include: a physical object or artifact, a concrete moment-in-progress, a stark ironic contrast, a pattern or trend being observed, a provocative question, a data point or statistic. Name the exact type this channel uses and explain why it works — what psychological gap does it open? Be specific to what you actually see in the transcripts.",
    "hookNameRevealTiming": "When and exactly how does the central subject's name or identity first appear? Is it in the first sentence, withheld for ~X words, or revealed via a specific formula? Quote the reveal pattern verbatim if it appears consistently (e.g. 'His name was X. And by the time...' or 'That company was [name].'). If there is no consistent pattern, describe what varies and why.",
    "hookCloseFormula": "How do hooks close before the story body begins? Does this channel end hooks with a scale statement (number of people, time span, money, geography), a question, a stakes promise, an ironic reversal, or something else? Extract the structural closing move from what you actually see in the transcripts.",
    "backstoryBlueprint": "How does this channel structure backstory or origin sections? What information appears and in what order — founding date, place, key people (ordinary or notable), the first sign of the central tension, how development is tracked over time? How specific are the anchors (exact dates, ages, incidents)? Be prescriptive enough that a writer can replicate the architecture for any topic.",
    "settingFunctionBlueprint": "Does this channel describe settings as atmosphere/mood — sensory details for immersion — OR as systems/mechanisms that explain how or why events happened? If the latter, what is the structural formula? Quote an example pattern if visible: e.g. '[Place] in [year] was [condition] — [how this condition shaped events]'. Describe the approach precisely.",
    "subjectIntroBlueprint": "How are individual people (subjects, case studies, interviewees, companies, etc.) introduced? What is the data set — name, age/year-founded, what they were doing at the time, a temporal anchor, their intersection with the central story? Is there a consistent sentence-structure formula? Extract it from the transcripts.",
    "institutionalBeat": "Does this channel use a beat involving an organisation, system, institution, or process — for example: a report that existed but was ignored, a company that succeeded where others failed, a regulatory failure, a bureaucratic irony? If so, what is the structural formula — how is the institutional moment set up and paid off? If this channel does not use such beats, write null.",
    "bodySceneTypeFormulas": "Using the fullTranscript fields, identify the distinct scene TYPES this channel uses in its body sections (e.g. origin/backstory, setting/context, victim introduction, incident sequence, institutional beat, double-life reveal, resolution/outcome, legacy). For each type found, describe the exact structural formula derived from the actual transcript text: what the scene opens with (exact sentence structure), what information it delivers and in what order, and how it ends. Quote at least one verbatim example sentence per scene type. Focus on architecture and exact opening sentence patterns."
  }
}`,
          },
        ],
      },
    ],
  });

  if (result.stopReason === 'max_tokens') {
    throw new Error('Channel synthesis response was truncated. Please try again.');
  }
  const raw = result.text || '{}';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return {
      result: JSON.parse(cleaned) as ChannelInsights,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  } catch {
    throw new Error('Failed to parse channel insights. Please try again.');
  }
}

// ─── Search Query Generation ─────────────────────────────────────────────────

export async function generateSearchQuery(
  llm: LLMConfig,
  narration: string,
  assetType: 'stock-photo' | 'stock-video' | 'real-image',
  ctx?: {
    scriptTitle?: string;
    sceneTitle?: string;
    sceneDescription?: string;
    characters?: Array<{ name: string; fullDescription: string }>;
    contentNature?: string;
    productionStyle?: string;
    channelBrollPattern?: string;
    siblingVisuals?: string[]; // other assets in the same segment, for visual cohesion
    directorNote?: string;    // selected variation concept — overrides narration as the visual anchor
    footageStyle?: string;    // era/look bias for stock search, e.g. "vintage Super 8 film grain"
  },
  claudeModelOverride?: string,
): Promise<string> {
  const characterBlock = ctx?.characters?.length
    ? `CHARACTERS: ${ctx.characters.map(c => `${c.name} — ${c.fullDescription}`).join('; ')}`
    : null;

  const siblingBlock = ctx?.siblingVisuals?.length
    ? `EXISTING VISUALS IN THIS SEGMENT (complement, don't duplicate): ${ctx.siblingVisuals.join(' | ')}`
    : null;

  // When a director note (variation concept) is present, it is the direct visual brief.
  // Build the query to realise that concept, using narration only as supporting context.
  const hasNote = !!ctx?.directorNote;

  const instruction = {
    'stock-photo': hasNote
      ? `Write a 3–5 word Pexels stock photo search query (generic evocative terms only, no names or specific events) that finds imagery matching the VISUAL BRIEF exactly.`
      : 'Write a 3–5 word Pexels stock photo search query. ANCHOR ON THE NARRATION — describe the specific action, scene, or object visible in those sentences. Do not use story locations or names unless they are the visual subject.',
    'stock-video': hasNote
      ? `Write a 3–5 word Pexels stock video search query (generic evocative terms only, no names or specific events) that finds footage matching the VISUAL BRIEF exactly.`
      : 'Write a 3–5 word Pexels stock video search query. ANCHOR ON THE NARRATION — describe what is literally happening in those sentences (action, mood, setting). Do not drift to story backstory or location names.',
    'real-image': hasNote
      ? `Write a 3–6 word archival/historical image search query that finds imagery matching the VISUAL BRIEF. Use the correct subject name from CHARACTERS if relevant.`
      : (characterBlock
          ? 'Write a 3–6 word archival/historical image search query. Use the correct character name from the context and anchor it to the specific moment described in the narration.'
          : 'Write a 3–6 word archival image search query anchored to the specific moment in the narration. Resolve any pronouns to the named subject using the context.'),
  }[assetType];

  // Director note (variation) is the primary anchor when present; otherwise narration leads
  const lines = [
    ctx?.directorNote && `VISUAL BRIEF (primary anchor — build the query to realise this exactly): "${ctx.directorNote}"`,
    `NARRATION${hasNote ? ' (context only)' : ' (primary anchor — query must visualise THIS)'}: "${narration.slice(0, 500)}"`,
    siblingBlock,
    ctx?.scriptTitle       && `STORY TITLE: ${ctx.scriptTitle}`,
    ctx?.sceneTitle        && `SCENE: ${ctx.sceneTitle}`,
    characterBlock,
    ctx?.contentNature     && `CONTENT NATURE: ${ctx.contentNature}`,
    ctx?.productionStyle   && `PRODUCTION STYLE: ${ctx.productionStyle}`,
    ctx?.channelBrollPattern && `BROLL PATTERN: ${ctx.channelBrollPattern}`,
    ctx?.footageStyle && (assetType !== 'real-image')
      && `FOOTAGE LOOK: ${ctx.footageStyle} — work terms for this look into the query so results match it.`,
  ].filter(Boolean);

  const result = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-sonnet-4-6',
    maxTokens: 30,
    system: 'You are a stock footage researcher. Output ONLY a concise search query (3–6 words) that would find footage matching what the narration describes. No explanation, no punctuation at the end, no quotes.',
    messages: [{ role: 'user', content: `${lines.join('\n')}\n\n${instruction}` }],
  });
  const raw = result.text.trim();
  return raw.replace(/^["']|["']$/g, '').replace(/[.]+$/, '') || narration.slice(0, 40);
}

// ─── Script Generation ──────────────────────────────────────────────────────

interface RawDirectorChunkAsset {
  rank: 1 | 2;
  type: string;
  note: string;
  searchQuery?: string;
  slot?: number;
  narrationSlice?: string;
}

interface RawScriptSlice {
  narrationExcerpt: string;
  durationSeconds: number;
  assets: RawDirectorChunkAsset[];
}

interface GeneratedScriptPayload {
  title: string;
  thumbnailConcept: string;
  fullScript: string;
  // regular mode
  scenes?: Array<{
    number: number;
    title: string;
    narration?: string;
    sceneDescription: string;
    estimatedDurationSeconds: number;
    wordCount: number;
  }>;
  // director mode — flat slices referencing fullScript text directly
  scriptSlices?: RawScriptSlice[];
  totalEstimatedDuration: number;
  totalWordCount: number;
}

function buildVoiceBible(videoAnalyses: Analysis['videoAnalyses']): string {
  const videos = videoAnalyses
    .filter(v => v.transcriptHook || v.transcriptExcerpt || v.transcriptClimax || v.transcriptOutro)
    .slice(0, 4);
  if (videos.length === 0) return '';

  const phases: Array<{ key: keyof typeof videos[0]; label: string }> = [
    { key: 'transcriptHook',    label: 'OPENING / HOOK — how this channel opens a video. Follow this when writing Scene 1.' },
    { key: 'transcriptExcerpt', label: 'BODY SETUP — how this channel establishes context. Follow this in early body scenes.' },
    { key: 'transcriptClimax',  label: 'ESCALATION / CLIMAX — how this channel writes peak tension. Follow this in your most intense scenes.' },
    { key: 'transcriptOutro',   label: 'OUTRO / CLOSING — how this channel closes. Follow this in the final scene.' },
  ];

  const sections = phases.map(({ key, label }) => {
    const excerpts = videos
      .map(v => v[key] as string | undefined)
      .filter((t): t is string => !!t)
      .slice(0, 3)
      .map((text, i) => `[Example ${i + 1}]\n${text}`);
    if (excerpts.length === 0) return null;
    return `--- ${label} ---\n${excerpts.join('\n\n')}`;
  }).filter((s): s is string => s !== null);

  if (sections.length === 0) return '';
  return sections.join('\n\n');
}

export async function extractVoicePrinciples(
  llm: LLMConfig,
  transcripts: string[],
): Promise<string> {
  const combined = transcripts
    .map((t, i) => `--- TRANSCRIPT ${i + 1} ---\n${t.slice(0, 20000)}`)
    .join('\n\n');

  const result = await llmComplete(llm, {
    claudeModel: 'claude-fable-5',
    maxTokens: 3000,
    system: 'You are a master prose analyst. Your job is to identify the generative craft principles behind a writer\'s voice — not surface patterns, but the underlying mechanisms that produce the effect. Be precise, specific, and practical. Every statement you make must be actionable by a writer.',
    messages: [{
      role: 'user',
      content: `Study these transcripts and extract the author's core craft principles. For each principle, identify:
1. The MECHANISM — what the author does at the sentence/paragraph level
2. The PSYCHOLOGICAL EFFECT — why it works on the audience
3. One SHORT verbatim example from the transcript (15 words max) showing it in action
4. A PROHIBITION — one specific thing a writer must NOT do when applying this, to prevent mechanical copying or template-filling

Identify exactly these 9 principles:

1. SENTENCE RHYTHM — how sentence length variation is used as a narrative instrument; when and why compression happens
2. HOOK ARCHITECTURE — the exact emotional entry point technique; what kind of injustice, surprise, or consequence opens the piece and why it produces immediate engagement
3. DETAIL SELECTION — the precise criteria for which specifics get included; how many jobs each detail must do simultaneously; what single-function details get cut
4. CHARACTER INTERIORITY — how the inner life of subjects is rendered without psychological adjectives; what physical or behavioural specifics stand in for stated emotions
5. WITHHOLDING — how information is sequenced to manufacture dread or anticipation; when exactly a revelation is delayed and what the reader feels in the gap
6. DIRECT ADDRESS — how and when this author speaks directly to the listener as "you"; the exact emotional contexts where it appears (revelation, moral weight, discomfort, challenge — whatever this author uses it for); what it achieves that third-person narration cannot; count how many times per piece it occurs and note the pattern
7. SUBJECT OR CONCEPT DEPTH — the specific technique for introducing a person, organisation, idea, or system with depth; how physical, environmental, biographical, or structural specifics accumulate to produce understanding in the reader before they have consciously processed it; applicable to any subject — a person's formation, a company's culture, a concept's origin
8. NARRATIVE VOICE — the author's register, tone, and positioning relative to the listener; how conspiratorial, intimate, or authoritative; how opinion is occasionally inserted and what effect that has
9. EMOTIONAL ARCHITECTURE — how the emotional journey is paced across the full piece; where intensity peaks, where it deliberately releases, and what the final emotional note leaves the listener with

Return ONLY a plain text block — no JSON, no headers, no markdown. Write each principle as a paragraph starting with its name in caps. Be ruthlessly specific to THIS author's actual techniques. Describe generative mechanisms, not templates.

TRANSCRIPTS:
${combined}`,
    }],
  });

  return result.text.trim();
}

export async function generateScript(
  llm: LLMConfig,
  analysis: Analysis,
  settings: ScriptSettings,
  instruction: string,
  targetAudience: string,
  directorMode = false,
  assetMixOverride?: Record<string, number>,
  blueprintTranscripts?: string[],
  useChannelStrategy = true,
  claudeModelOverride?: string,
): Promise<{ result: GeneratedScriptPayload; inputTokens: number; outputTokens: number }> {
  // Send only the strategy fields needed for scripting — not the full insights object.
  // In director mode, contentStyle/visualSceneGuide/contentNature/productionStyle are omitted
  // here because directorSection already injects them explicitly, avoiding duplication.
  const strategy = {
    channelOverview: analysis.channelInsights.channelOverview,
    titleFormulas: analysis.channelInsights.titleFormulas,
    hookStrategies: analysis.channelInsights.hookStrategies,
    scriptStructureTemplate: analysis.channelInsights.scriptStructureTemplate,
    ...(!directorMode && { contentStyle: analysis.channelInsights.contentStyle }),
    audienceProfile: analysis.channelInsights.audienceProfile,
    engagementPatterns: analysis.channelInsights.engagementPatterns,
    replicationFormula: analysis.channelInsights.replicationFormula,
    thingsToSteal: analysis.channelInsights.thingsToSteal,
    narrativeLens: analysis.channelInsights.narrativeLens,
    openLoopProfile: analysis.channelInsights.openLoopProfile,
    narrativeStructure: analysis.channelInsights.narrativeStructure,
    ...(!directorMode && { productionStyle: analysis.channelInsights.visualBrand?.productionStyle }),
    ...(!directorMode && { visualSceneGuide: analysis.channelInsights.visualSceneGuide }),
    ...(!directorMode && { contentNature: analysis.channelInsights.contentNature }),
  };

  // For Grok in director mode, we always use two passes:
  //   Pass 1 — write fullScript only (no slices). This avoids the model self-regulating
  //             to a short script because it needs to fit both the prose AND 80+ slices
  //             within grok-4.3's ~16k output token ceiling.
  //   Pass 2 — send the fullScript back and ask Grok to slice it.
  // Claude handles director mode in a single pass as before.
  const grokDirectorMode = directorMode && llm.provider === 'grok';

  // Pre-compute director mode section outside the template literal to avoid IIFE complexity
  const directorSection = (() => {
    // Grok Pass 1 writes prose only — no slicing instruction needed here
    if (!directorMode || grokDirectorMode) return '';
    const di = analysis.channelInsights;
    const vg = di.visualSceneGuide;
    const cn = di.contentNature?.classification ?? 'unknown';
    const ps = di.visualBrand?.productionStyle ?? 'not specified';
    return `
DIRECTOR MODE — after writing fullScript, partition it into visual slices and assign assets.

CHANNEL VISUAL DNA — match exactly:
- Production style: ${ps}
- Content nature: ${cn}${di.contentNature?.reasoning ? ` — ${di.contentNature.reasoning}` : ''}
- Energy / tone: ${di.contentStyle?.energy ?? ''}${di.contentStyle?.tone ? ` · ${di.contentStyle.tone}` : ''}
${vg?.brollPattern ? `- How this channel cuts visually: ${vg.brollPattern}` : ''}
${vg?.editingRhythm ? `- Editing rhythm: ${vg.editingRhythm}` : ''}

AVAILABLE ASSET TYPES:
- "real-image"  → named real people, documented events, specific locations. searchQuery = "Steve Jobs 2007 iPhone keynote"
- "stock-video" → moving B-roll evoking motion, atmosphere, passage of time. searchQuery = visual mood NOT narration subject — "crowded city street night"
- "stock-photo" → a single still establishing place, object, or mood. searchQuery = "empty boardroom glass table"
- "ai-video"    → cinematic pans, abstract/impossible visuals, dramatic reconstructions
- "ai-image"    → illustrated or stylised stills for concepts too specific/abstract for stock

STOCK SEARCH QUERIES: never write the narration subject literally. Think: what would a documentary editor cut to here?
${(assetMixOverride ?? di.visualAssetMix) ? (() => {
    const estimatedSlices = Math.max(10, Math.round(settings.targetWordCount / 55));
    const rawMix = assetMixOverride ?? di.visualAssetMix!;
    const reasoning = !assetMixOverride && di.visualAssetMix ? di.visualAssetMix.reasoning : 'Custom mix set by the user.';
    const types = (['ai-video', 'ai-image', 'stock-video', 'stock-photo', 'real-image'] as const).filter(t => (rawMix[t] ?? 0) > 0);
    return `
TARGET ASSET MIX — your rank-1 choices must hit approximately:
Estimated slices: ~${estimatedSlices}
${types.map(t => `  • ${t}: ${rawMix[t]}%  →  ~${Math.round(estimatedSlices * (rawMix[t] as number) / 100)} slices`).join('\n')}
Reasoning: ${reasoning}
Tally rank-1 choices as you write. Adjust if running over target for any type.`;
  })() : ''}

SLICE RULES:
- Write fullScript first as a complete independent piece of prose (paragraph breaks your decision).
- Then partition fullScript into scriptSlices. Each slice's "narrationExcerpt" MUST be an EXACT verbatim consecutive substring of fullScript — copy the text character-for-character.
- Slices are ordered, non-overlapping, and together cover the ENTIRE fullScript text with NO gaps.
- Each slice = 1–4 complete sentences forming one coherent visual idea. Boundaries fall at sentence ends only.
- EVERY slice MUST have exactly 2 assets (rank 1, rank 2). No exceptions.
- Asset "note": ≤5 words — the director's brief for this shot.
- "searchQuery": required for stock-video, stock-photo, real-image; omit for ai-video and ai-image.
- durationSeconds = round((sliceWordCount / ${settings.wpm}) × 60)

WORD COUNT REQUIREMENT (director mode): fullScript MUST contain exactly ${settings.targetWordCount} words (±5%). That is ${settings.videoLength} minutes × ${settings.wpm} WPM. Do not stop writing until you hit this count.

Return ONLY valid JSON:
{
  "title": "Video title following the channel's exact title formula",
  "thumbnailConcept": "1-2 sentence description of what the thumbnail should look like",
  "fullScript": "The complete narration as a single continuous piece of prose — MUST be ${settings.targetWordCount} words total (±5%). Begin with the hook. Do NOT stop early. Paragraph breaks are your editorial decision. Use \\n\\n between paragraphs.",
  "scriptSlices": [
    {
      "narrationExcerpt": "Exact verbatim text from fullScript — copied character for character.",
      "durationSeconds": 10,
      "assets": [
        { "rank": 1, "type": "real-image", "note": "archival photo subject 1961", "searchQuery": "subject name 1961" },
        { "rank": 2, "type": "stock-photo", "note": "mountain winter atmospheric", "searchQuery": "ural mountains snow winter" }
      ]
    },
    {
      "narrationExcerpt": "Next consecutive sentences from fullScript.",
      "durationSeconds": 8,
      "assets": [
        { "rank": 1, "type": "stock-video", "note": "city street night", "searchQuery": "crowded city street night" },
        { "rank": 2, "type": "ai-image", "note": "atmospheric mood dark" }
      ]
    }
  ],
  "totalEstimatedDuration": 300,
  "totalWordCount": 750
}`;
  })();

  // Pre-compute the Grok Pass 1 JSON schema block (avoids IIFE inside template literal)
  const grokPass1Schema = `Return ONLY valid JSON (no scriptSlices — slicing is a separate step):
{
  "title": "Video title",
  "thumbnailConcept": "1-2 sentence description of what the thumbnail should look like",
  "fullScript": "The complete narration — AT LEAST ${settings.targetWordCount} words. Write it as flowing prose, exactly as the sample scripts above are written. Do NOT stop early. Use \\n\\n between paragraphs.",
  "totalEstimatedDuration": ${settings.videoLength * 60},
  "totalWordCount": 0
}
(Replace totalWordCount with the actual integer word count of fullScript before returning.)`;

  const result = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-fable-5',
    // Director mode: fullScript (~1× words) + scriptSlices JSON (~8× words in structure overhead).
    // Regular mode: fullScript + scenes JSON (~5× words).
    maxTokens: grokDirectorMode
      // Grok Pass 1: prose only, reasoning: 'none' → multiplier 1×, so maxOutputTokens = maxTokens.
      // All 29,000 tokens go to prose — reasoning: 'high' consumes ~25k on thinking, leaving too little for text.
      ? 29000
      : directorMode
      ? Math.min(100000, Math.max(32000, Math.round(settings.targetWordCount * 30)))
      : Math.min(60000, Math.max(8000, Math.round(settings.targetWordCount * 10))),
    // 'none' reasoning: no tokens consumed on thinking, all 29k go to prose output.
    grokReasoningEffort: 'none',
    system: `You are an expert YouTube scriptwriter. Respond ONLY with valid JSON — no markdown fences, no prose outside the JSON.

CRITICAL WORD COUNT RULE: The fullScript field MUST contain AT LEAST ${settings.targetWordCount} words. This is non-negotiable.
- Target: ${settings.targetWordCount} words (${settings.videoLength} min × ${settings.wpm} WPM)
- Minimum acceptable: ${Math.round(settings.targetWordCount * 0.95)} words
- A short script is a broken script. Do NOT stop early. Do NOT summarise. Write every section in full.
- The JSON must include a "totalWordCount" integer field with the actual word count of fullScript.`,
    messages: [
      {
        role: 'user',
        content: grokDirectorMode ? `${blueprintTranscripts?.length
  ? blueprintTranscripts.map((t, i) => `--- TRANSCRIPT ${i + 1} ---\n${t}`).join('\n\n') + '\n\n'
  : ''}${instruction}

Video length: ${settings.videoLength} minutes (${settings.targetWordCount} words at ${settings.wpm} WPM)

${grokPass1Schema}` : `Create a complete YouTube video script for the topic below, written in the style of the channel shown by the blueprint transcripts.
${blueprintTranscripts?.length ? `================================================================
VOICE REFERENCE TRANSCRIPTS — study the rhythm, detail selection, and sentence architecture.
================================================================
${blueprintTranscripts.map((t, i) => `--- TRANSCRIPT ${i + 1} ---\n${t}`).join('\n\n')}
================================================================
` : ''}
${useChannelStrategy ? `CHANNEL STRATEGY (structure, hooks, and narrative architecture — not writing style):
${directorMode ? JSON.stringify(strategy) : JSON.stringify(strategy, null, 2)}` : ''}

SCRIPT PARAMETERS:
Instruction: ${instruction}
Target Audience: ${targetAudience || analysis.channelInsights.audienceProfile.demographics}
Video Length: ${settings.videoLength} minutes
Narration Speed: ${settings.wpm} words per minute
Target Word Count: ${settings.targetWordCount} words (±10%)

${strategy.productionStyle ? `PRODUCTION MEDIUM: ${strategy.productionStyle}
All sceneDescriptions and thumbnailConcept must be written assuming this visual medium. Do not describe scenes using language that belongs to a different medium (e.g. don't say "camera pans" for an animated channel, or "cartoon character" for a photorealistic one).

` : ''}${strategy.narrativeLens ? `NARRATIVE LENS — this defines the channel's primary subject and default perspective:
${strategy.narrativeLens}
When the narration is ambiguous about whose perspective or interiority to inhabit, default to this subject. When the narration explicitly describes another person or place, follow the narration — do not force the primary subject into scenes where they are not present. The lens is a default, not an override.

` : ''}${(() => {
  const ns = analysis.channelInsights.narrativeStructure;
  if (!ns) return '';
  const trp1 = (s: string, max: number) => s.length > max ? s.slice(0, max).trimEnd() + '…' : s;
  const parts = [
    ns.bodySceneTypeFormulas  ? `SCENE TYPE FORMULAS — identify each scene's type and apply the full structural formula (opening, information order, closing):\n${trp1(ns.bodySceneTypeFormulas, 2000)}` : '',
    ns.backstoryBlueprint     ? `BACKSTORY FORMULA:\n${trp1(ns.backstoryBlueprint, 800)}` : '',
    ns.subjectIntroBlueprint  ? `SUBJECT INTRO FORMULA:\n${trp1(ns.subjectIntroBlueprint, 500)}` : '',
    ns.settingFunctionBlueprint ? `SETTING FORMULA:\n${trp1(ns.settingFunctionBlueprint, 500)}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('\n\n') + '\n\n' : '';
})()}${strategy.scriptStructureTemplate?.loopMechanism ? `CARRY-FORWARD LOOPS — this channel uses inter-scene tension hooks. Apply this pattern at the end of every scene except the last:
${strategy.scriptStructureTemplate.loopMechanism}

` : ''}${strategy.openLoopProfile ? `OPEN LOOP DENSITY — this channel's measured loop pattern (replicate it exactly):
- Peak simultaneous open loops: ${strategy.openLoopProfile.peakSimultaneousLoops} (never have more than this many unresolved questions active at once)
- Average resolution point: ${strategy.openLoopProfile.avgResolutionPoint}
- Loop types this channel uses: ${strategy.openLoopProfile.loopTypes.join('; ')}
Plant loops using these exact types, resolve them at the measured point, and maintain the same peak count.

` : ''}${strategy.engagementPatterns?.length ? `ENGAGEMENT PATTERNS — embed these mechanisms in the body of the script:
${strategy.engagementPatterns.map((p: string) => `- ${p}`).join('\n')}

` : ''}${(() => {
  const nature = strategy.contentNature?.classification;
  if (!nature || nature === 'fictional') return '';
  const isStrict = nature === 'non-fictional';
  return `FACTUAL INTEGRITY — ${isStrict ? 'STRICT' : 'PARTIAL'} MODE:
This channel covers ${isStrict ? 'real documented events and real people' : 'a mix of real events and fictional content'}.
${isStrict ? `STRICT RULES — violation of these makes the script dangerous to publish:
- Do NOT invent any specific person's name, date, case number, exhibit label, court name, quote, or location that is not explicitly provided in the topic or additional instructions above.
- Instead of inventing specifics, write around them using general language: "a company founded in the 1980s" not a fabricated name; "in the late 1980s" not an invented year; "a facility in the Midwest" not a specific location unless stated.
- You may describe documented patterns, systemic failures, emotional truths, and general timelines without inventing the specific details that fill them.
- The script must be compelling without fabricating a single verifiable fact.
` : `PARTIAL RULES — apply to real-world segments only:
- Do not invent specific names, dates, or case details for factual segments. Write around them with general language.
- For fictional segments, invent freely.
`}
`;
})()}STYLE RULES — READ CAREFULLY:
- The CARRY-FORWARD LOOPS above are a structural exception — follow those mechanically.
- The channel strategy describes PRINCIPLES and PSYCHOLOGICAL MECHANISMS. Your job is to find fresh, topic-specific expressions of those principles through the voice shown in the blueprint transcripts.
- Scene titles are labels only — do NOT open a scene by echoing or restating its title.
- Every scene must find its own unique entry point into the material. Do NOT open multiple scenes with the same grammatical structure.
- The hook must be built from what is specifically surprising, counterintuitive, or emotionally charged about THIS topic — not a generic formula applied to any topic.
- WORD COUNT IS MANDATORY: total narration MUST reach ${settings.targetWordCount} words (±5%) — this applies to fullScript in all modes, and to the combined narration across all scenes/slices. Count as you write. Do NOT stop early. A ${settings.videoLength}-minute video at ${settings.wpm} wpm requires exactly this length — a short script is a broken script.
- For each scene: estimatedDurationSeconds = (wordCount / ${settings.wpm}) × 60, rounded to nearest second
- sceneDescription is a brief visual note (1 sentence) — NOT the narration${strategy.visualSceneGuide ? `; write it following this channel's visual style: ${strategy.visualSceneGuide.sceneDescriptionStyle}` : ''}
- Keep sceneDescription short (1 sentence max)
- VISUAL SUBJECT: sceneDescriptions and thumbnailConcept should default to the narrative lens subject${strategy.narrativeLens ? ` — ${strategy.narrativeLens.split('.')[0]}` : ''}. When the narration explicitly focuses on another person or place, the visual follows the narration. Only default to the primary subject when the narration is ambiguous.
${!directorMode ? '- Do NOT include image prompts or video prompts — those are generated separately on demand' : ''}

${directorSection}${!directorMode ? `Return ONLY valid JSON:
{
  "title": "Video title following the channel's exact title formula",
  "thumbnailConcept": "1-2 sentence description of what the thumbnail should look like",
  "fullScript": "The complete narration as a single continuous piece of prose, ${settings.targetWordCount} words total. MUST begin with the hook — do not skip straight to background or setup. Write this INDEPENDENTLY — do not assemble it from the scenes array. Paragraph breaks are your editorial decision based on narrative rhythm, topic shifts, and pacing. Use \\n\\n between paragraphs. This is the reader-facing script; it must read as a cohesive piece of writing, not a stitched list.",
  "scenes": [
    {
      "number": 1,
      "title": "Scene label (Hook | Setup | Main Point 1 | CTA etc.)",
      "narration": "Exact word-for-word narration text the presenter will say",
      "sceneDescription": "One sentence: what the viewer sees during this narration",
      "estimatedDurationSeconds": 20,
      "wordCount": 50
    }
  ],
  "totalEstimatedDuration": 300,
  "totalWordCount": 750
}` : ''}`,
      },
    ],
  });

  if (result.stopReason === 'max_tokens') {
    throw new Error(
      `Script generation was truncated (output_tokens: ${result.outputTokens}) — try a shorter video length or try again.`
    );
  }

  const parsed = parseScriptJSON(result.text);

  // Grok director mode: Pass 1 produced prose only — now run Pass 2 to slice it.
  if (grokDirectorMode) {
    const sliceResult = await grokSliceScript(llm, parsed, settings, analysis, assetMixOverride);
    return {
      result: { ...parsed, scriptSlices: sliceResult.scriptSlices },
      inputTokens: result.inputTokens + sliceResult.inputTokens,
      outputTokens: result.outputTokens + sliceResult.outputTokens,
    };
  }

  return {
    result: parsed,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

function buildSlicePromptAndTokens(
  fullScript: string,
  settings: ScriptSettings,
  analysis: Analysis,
  assetMixOverride?: Record<string, number>,
): { userPrompt: string; maxTokens: number } {
  const di = analysis.channelInsights;
  const rawMix = assetMixOverride ?? di.visualAssetMix;
  const types = rawMix
    ? (['ai-video', 'ai-image', 'stock-video', 'stock-photo', 'real-image'] as const).filter(t => (rawMix[t] ?? 0) > 0)
    : (['stock-video', 'ai-image', 'real-image'] as const);
  const mixInstruction = rawMix
    ? `TARGET ASSET MIX — across all slices, rank-1 choices should approximate:\n${types.map(t => `  • ${t}: ${rawMix[t]}%`).join('\n')}`
    : '';

  const sentences = fullScript.match(/[^.!?]+[.!?]+/g) ?? [];
  const lastSentence = sentences.at(-1)?.trim() ?? fullScript.slice(-100).trim() ?? '';

  const wordCount = fullScript.trim().split(/\s+/).filter(Boolean).length;
  const totalSeconds = Math.round((wordCount / settings.wpm) * 60);

  // Use channel's cut rate if available; fall back to a moderate documentary default (5 shots/min)
  const cutRateShotsPerMinute = di.visualSceneGuide?.cutRateShotsPerMinute ?? 5;
  const editingRhythm = di.visualSceneGuide?.editingRhythm ?? '';
  const brollPattern = di.visualSceneGuide?.brollPattern ?? '';

  // Estimated slice count from cut rate — used only for token budget, not prescribed to the model
  const estimatedSliceCount = Math.max(10, Math.round((totalSeconds / 60) * cutRateShotsPerMinute));
  // ~500 tokens per slice (narration + 2 assets) + 20% buffer
  const maxTokens = Math.min(100000, Math.max(16000, Math.round(estimatedSliceCount * 500 * 1.2)));

  const userPrompt = `You are directing the visuals for the following narration script. Read it fully first, then make your directorial decisions.

FULL SCRIPT:
${fullScript}

YOUR JOB AS DIRECTOR:
Read the full script, then decide where each visual cut happens. A cut is needed when the visual must change — a new person enters, the location shifts, the emotional register changes, or a new phase of the story begins. Hold a shot as long as it serves the story; cut when it no longer does.

CHANNEL EDITING STYLE — match this channel's established rhythm:
- Cut rate: ~${cutRateShotsPerMinute} shots per minute${editingRhythm ? `\n- Editing rhythm: ${editingRhythm}` : ''}${brollPattern ? `\n- B-roll pattern: ${brollPattern}` : ''}

Use that cut rate as your guide for how much narration belongs under each shot. Do not split at paragraph breaks — paragraphs are just text formatting, not visual cuts. A single visual idea may span several paragraphs; multiple short paragraphs about the same subject/scene should stay in one slice.

MANDATORY COVERAGE:
- narrationExcerpt must be EXACT verbatim text from the script, copied character-for-character.
- Every word of the script must appear in exactly one slice. No gaps. No overlaps.
- The FINAL slice must end with this exact text: "${lastSentence}"
- Work through the script from start to finish. Do not stop early.

FOR EACH SLICE, assign exactly 2 assets (rank 1 = primary, rank 2 = backup):
- "real-image"  → use when narration names a real person, place, or documented event. searchQuery = specific name/event/year.
- "stock-video" → use for atmosphere, motion, tension, setting. searchQuery = the visual mood or environment, not the narration subject.
- "stock-photo" → a single still: one object, one place, one face.
- "ai-video"    → cinematic reconstruction, abstract concept, dramatic scene.
- "ai-image"    → illustrated or stylised still.
- searchQuery required for: stock-video, stock-photo, real-image. Omit for: ai-video, ai-image.
- note = your director's brief for this shot, ≤5 words.
- durationSeconds = round((word count of this slice / ${settings.wpm}) × 60)

${mixInstruction}

PRODUCTION CONTEXT:
- Style: ${di.visualBrand?.productionStyle ?? 'not specified'}
- Content: ${di.contentNature?.classification ?? 'unknown'}

Return ONLY valid JSON:
{
  "scriptSlices": [
    {
      "narrationExcerpt": "Exact verbatim text from the script.",
      "durationSeconds": 10,
      "assets": [
        { "rank": 1, "type": "real-image", "note": "subject photo 1981", "searchQuery": "Wayne Williams Atlanta 1981" },
        { "rank": 2, "type": "stock-video", "note": "river at dawn", "searchQuery": "river mist early morning" }
      ]
    }
  ]
}`;

  return { userPrompt, maxTokens };
}

async function grokSliceScript(
  llm: LLMConfig,
  parsed: GeneratedScriptPayload,
  settings: ScriptSettings,
  analysis: Analysis,
  assetMixOverride?: Record<string, number>,
): Promise<{ scriptSlices: RawScriptSlice[]; inputTokens: number; outputTokens: number }> {
  const { userPrompt, maxTokens } = buildSlicePromptAndTokens(
    parsed.fullScript ?? '',
    settings,
    analysis,
    assetMixOverride,
  );

  const result = await llmComplete(llm, {
    claudeModel: 'claude-fable-5',
    maxTokens,
    grokReasoningEffort: 'none',
    system: `You are a documentary film director. You read a narration script and decide exactly which visual should play under each section of it — not by counting sentences, but by thinking about what the viewer needs to see and for how long. Respond ONLY with valid JSON, no markdown, no prose.`,
    messages: [{ role: 'user', content: userPrompt }],
  });

  if (result.stopReason === 'max_tokens') {
    throw new Error('Slice generation was truncated — try again.');
  }

  const sliceParsed = parseScriptJSON(result.text) as unknown as { scriptSlices: RawScriptSlice[] };
  return {
    scriptSlices: sliceParsed.scriptSlices ?? [],
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// ─── Slice an externally-provided script (Import mode) ───────────────────────

export async function sliceScript(
  llm: LLMConfig,
  fullScript: string,
  settings: ScriptSettings,
  analysis: Analysis,
  assetMixOverride?: Record<string, number>,
  claudeModelOverride?: string,
): Promise<{ result: GeneratedScriptPayload; inputTokens: number; outputTokens: number }> {
  const syntheticPayload: GeneratedScriptPayload = {
    title: '',
    thumbnailConcept: '',
    fullScript,
    totalEstimatedDuration: settings.videoLength * 60,
    totalWordCount: settings.targetWordCount,
  };

  const resolvedModel = llm.provider === 'grok' ? 'claude-fable-5' : (claudeModelOverride ?? 'claude-opus-4-8');
  const { userPrompt, maxTokens } = buildSlicePromptAndTokens(fullScript, settings, analysis, assetMixOverride);

  const result = await llmComplete(llm, {
    claudeModel: resolvedModel,
    maxTokens,
    grokReasoningEffort: 'none',
    system: `You are a documentary film director. You read a narration script and decide exactly which visual should play under each section of it — not by counting sentences, but by thinking about what the viewer needs to see and for how long. Respond ONLY with valid JSON, no markdown, no prose.`,
    messages: [{ role: 'user', content: userPrompt }],
  });

  if (result.stopReason === 'max_tokens') {
    throw new Error('Slice generation was truncated — try again.');
  }

  const sliceParsed = parseScriptJSON(result.text) as unknown as { scriptSlices: RawScriptSlice[] };
  return {
    result: { ...syntheticPayload, scriptSlices: sliceParsed.scriptSlices ?? [] },
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

function parseScriptJSON(raw: string): GeneratedScriptPayload {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }

  // First attempt — raw parse
  try {
    return JSON.parse(cleaned) as GeneratedScriptPayload;
  } catch { /* fall through to repair */ }

  // Second attempt — repair literal control characters inside JSON string values
  try {
    const repaired = cleaned.replace(
      /"((?:[^"\\]|\\.)*)"/gs,
      (_match: string, inner: string) =>
        `"${inner.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`,
    );
    return JSON.parse(repaired) as GeneratedScriptPayload;
  } catch { /* fall through to error */ }

  throw new Error(
    `Failed to parse script JSON. Raw response starts with: ${cleaned.slice(0, 300)}`
  );
}

// ─── Voice Refinement (Pass 2) ───────────────────────────────────────────────

// Segment format returned by Pass 2 director mode — mirrors the raw JSON Claude outputs
export interface DirectorScriptSegment {
  text: string;
  durationSeconds: number;
  assets: Array<{
    rank: 1 | 2;
    type: string;
    note: string;
    searchQuery?: string;
    slot?: number;
    narrationSlice?: string;
  }>;
}

export interface RefinedSceneNarration {
  number: number;
  narration: string;                   // regular mode
  segments?: DirectorScriptSegment[];  // director mode
}

export async function refineScriptVoice(
  llm: LLMConfig,
  topic: string,
  analysis: Analysis,
  scenes: Scene[],
  settings: ScriptSettings,
  directorMode = false,
  assetMixOverride?: Record<string, number>,
  claudeModelOverride?: string,
): Promise<{ result: RefinedSceneNarration[]; inputTokens: number; outputTokens: number } | null> {
  const rawBible = buildVoiceBible(analysis.videoAnalyses);
  const voiceExcerpts = analysis.channelInsights.voiceExcerpts ?? [];

  const VOICE_CAP = 8000;
  let voiceMaterial = '';
  if (voiceExcerpts.length > 0) {
    const block = voiceExcerpts.map((e, i) => `[Excerpt ${i + 1}]\n${e}`).join('\n\n');
    const excerptText = `SYNTHESIZED VOICE EXAMPLES:\n${block}`;
    voiceMaterial = excerptText.slice(0, VOICE_CAP);
    const remaining = VOICE_CAP - voiceMaterial.length;
    if (rawBible && remaining > 500) {
      voiceMaterial = `RAW TRANSCRIPT PASSAGES:\n${rawBible.slice(0, remaining - 30)}\n\n` + voiceMaterial;
    }
  } else if (rawBible) {
    voiceMaterial = `RAW TRANSCRIPT PASSAGES — copied verbatim from published videos:\n${rawBible.slice(0, VOICE_CAP)}`;
  }
  if (!voiceMaterial) return null;

  const ws = analysis.channelInsights.writingStyle;
  const proseFingerprint = ws?.proseFingerprint ?? '';
  const openingFormula = ws?.openingFormula ?? '';

  const writingStyleBlock = ws ? `\nWRITING STYLE:
- Sentence structure: ${ws.sentenceStructure}
- Vocabulary: ${ws.vocabularyLevel}
- Directness: ${ws.directnessLevel}
- Pace and rhythm: ${ws.paceAndRhythm}
${ws.avgSentenceLengthWords ? `- Target avg sentence length: ~${ws.avgSentenceLengthWords} words` : ''}
${ws.sentenceLengthVariance ? `- Sentence length variance: ${ws.sentenceLengthVariance}` : ''}
${ws.microRhythmBlueprint ? `- Micro-rhythm blueprint: ${ws.microRhythmBlueprint}` : ''}
${ws.bodySceneOpenings ? `- Body scene opening pattern (Scenes 2+): ${ws.bodySceneOpenings}` : ''}
${ws.revelationFormula ? `- Revelation/contrast formula: ${ws.revelationFormula}` : ''}
${ws.withinSceneTransitionPattern ? `- Within-scene transition pattern: ${ws.withinSceneTransitionPattern}` : ''}
${ws.evidencePresentationStyle ? `- Evidence/fact presentation style: ${ws.evidencePresentationStyle}` : ''}` : '';

  const hookInstruction = openingFormula
    ? `\nSCENE 1 HOOK — HARD STRUCTURAL RULES (override everything else for Scene 1):
${openingFormula}`
    : `\nINSTRUCTION FOR SCENE 1: Read the entire draft. Find the single most defining, specific detail in this story. Anchor Scene 1's opening on that detail — not a generic formula.`;

  const voiceBlock = `================================================================
CHANNEL VOICE — these are the channel's actual words. Your output must be INDISTINGUISHABLE from these.
================================================================
${voiceMaterial}
================================================================
END OF CHANNEL VOICE
================================================================`;

  const draftScript = scenes
    .map(s => `SCENE ${s.number}: ${s.title}\n${s.narration}`)
    .join('\n\n---\n\n');

  const ns2 = analysis.channelInsights.narrativeStructure;
  const hs2 = analysis.channelInsights.hookStrategies;
  const sst2 = analysis.channelInsights.scriptStructureTemplate;

  const tr2 = (s: string, max = 500) => s.length > max ? s.slice(0, max).trimEnd() + '…' : s;

  const structuralBlock2 = (() => {
    const parts: string[] = [];
    if (ns2) {
      const lines = [
        `STRUCTURAL BLUEPRINTS:`,
        ns2.hookAnchorType           ? `HOOK ANCHOR: ${tr2(ns2.hookAnchorType)}` : '',
        ns2.hookNameRevealTiming     ? `NAME REVEAL: ${tr2(ns2.hookNameRevealTiming)}` : '',
        ns2.hookCloseFormula         ? `HOOK CLOSE: ${tr2(ns2.hookCloseFormula)}` : '',
        ns2.backstoryBlueprint       ? `BACKSTORY FORMULA: ${tr2(ns2.backstoryBlueprint, 800)}` : '',
        ns2.settingFunctionBlueprint ? `SETTING PATTERN: ${tr2(ns2.settingFunctionBlueprint)}` : '',
        ns2.subjectIntroBlueprint    ? `SUBJECT INTRO: ${tr2(ns2.subjectIntroBlueprint)}` : '',
        ns2.institutionalBeat && ns2.institutionalBeat !== 'null' ? `INSTITUTIONAL BEAT: ${tr2(ns2.institutionalBeat)}` : '',
        ns2.bodySceneTypeFormulas    ? `SCENE TYPE FORMULAS:\n${tr2(ns2.bodySceneTypeFormulas, 2000)}` : '',
      ].filter(Boolean).join('\n');
      parts.push(lines);
    } else {
      if (hs2?.length) parts.push(`HOOK STRATEGIES:\n${hs2.slice(0, 2).map((s, i) => `${i + 1}. ${tr2(s)}`).join('\n')}`);
      if (sst2?.intro) parts.push(`HOOK ARCHITECTURE: ${tr2(sst2.intro)}`);
      if (sst2?.body)  parts.push(`BODY ARCHITECTURE: ${tr2(sst2.body)}`);
    }
    return parts.length ? `\n\n${parts.join('\n\n')}` : '';
  })();

  const commonRules = `TOPIC: ${topic}
${proseFingerprint ? `\nPROSE FINGERPRINT — enforce every rule at the sentence level:\n${proseFingerprint}` : ''}${writingStyleBlock}${hookInstruction}${structuralBlock2}

REWRITE RULES — STRUCTURAL first, then sentence-level:
1. ARCHITECTURE MATCH (most important): For each scene, identify its type (hook, backstory, setting, subject-intro, escalation, resolution, etc.) and apply the structural blueprint for that type from the section above. Match what each scene DOES before matching how it sounds.
2. Hook (Scene 1): Anchor on the channel's hook anchor type. Apply name-reveal timing. Close with the hook-close formula.
3. Settings: Apply the SETTING PATTERN from the structural blueprints above — match exactly how this channel uses location and context.
4. Preserve all facts and story beats — do NOT add, remove, invent, or reorder any narrative events, people, dates, or revelations from the draft. Rhetorical devices and meta-commentary that align with the channel's voice must be kept and amplified, not stripped. Scene-opening patterns are NOT protected by this rule — rewrite them to match the channel's structural blueprints.
5. Full scene structure (Scenes 2+): For each non-hook scene, identify its type using the SCENE TYPE FORMULAS above and rewrite its full structure — opening, information order, and closing — to match the formula for that type. The body scene opening pattern in WRITING STYLE above governs the first sentence. The scene title is a label only.
6. Every sentence must pass this test: could it appear in the Voice Bible above without standing out?
7. Match rhythm, vocabulary register, and restraint exactly. Not "inspired by" — INDISTINGUISHABLE. Vary sentence length according to the Micro-Rhythm Blueprint above.
8. Keep approximately the same word count per scene as the draft (within ±20%). Structural rewrites that align the scene more closely with the channel's scene type formula may expand or contract beyond this — accuracy to the channel's structure takes precedence over word count preservation.
9. Do NOT change scene numbers or titles.
10. Make the narration feel like it was written by the same person who wrote the Voice Bible passages — same restraint, same way of letting specific details do the work.`;

  // ── Director mode: rewrite narration AND generate all segments + assets + slots ──
  if (directorMode) {
    const di = analysis.channelInsights;
    const vg = di.visualSceneGuide;
    const cn = di.contentNature?.classification ?? 'unknown';
    const ps = di.visualBrand?.productionStyle ?? 'not specified';
    const cutRate = vg?.cutRateShotsPerMinute;
    const secsPerShot = cutRate ? Math.round(60 / cutRate) : 12;
    const triggerSecs = Math.round(secsPerShot * 1.8);

    const assetMixBlock = (() => {
      const rawMix = assetMixOverride ?? di.visualAssetMix;
      if (!rawMix) return '';
      const estimatedSegments = Math.max(10, Math.round(settings.targetWordCount / 55));
      const reasoning = !assetMixOverride && di.visualAssetMix ? di.visualAssetMix.reasoning : 'Custom mix set by the user.';
      const types = (['ai-video', 'ai-image', 'stock-video', 'stock-photo', 'real-image'] as const).filter(t => (rawMix[t] ?? 0) > 0);
      return `
TARGET ASSET MIX${assetMixOverride ? ' (user-specified)' : ' — match this channel distribution'}. APPLY IT:
Estimated segments in this script: ~${estimatedSegments}. Your rank-1 choices must hit approximately:
${types.map(t => `  • ${t}: ${rawMix[t]}%  →  ~${Math.round(estimatedSegments * (rawMix[t] as number) / 100)} segments`).join('\n')}
Reasoning: ${reasoning}

RULES:
1. Tally your rank-1 choices as you write. After every scene check cumulative counts against targets.
2. ai-video must appear. stock-photo must appear. ai-image must not crowd out other types.`;
    })();

    const result = await llmComplete(llm, {
      claudeModel: claudeModelOverride ?? 'claude-opus-4-8',
      maxTokens: 64000,
      grokReasoningEffort: 'none',
      system: 'You are an expert YouTube scriptwriter and visual director. Respond ONLY with valid JSON, no markdown fences, no prose.',
      messages: [{
        role: 'user',
        content: `Rewrite this YouTube script to match the channel's voice exactly, and simultaneously break each scene into director-mode visual segments with asset assignments.

${voiceBlock}

STORY BLUEPRINT — the complete draft narrative (use this to understand the full arc before rewriting):
${draftScript}

${commonRules}

CHANNEL VISUAL DNA — match this exactly when assigning assets:
- Production style: ${ps}
- Content nature: ${cn}${di.contentNature?.reasoning ? ` — ${di.contentNature.reasoning}` : ''}
- Energy / tone: ${di.contentStyle?.energy ?? ''}${di.contentStyle?.tone ? ` · ${di.contentStyle.tone}` : ''}
${vg?.brollPattern ? `- Broll pattern: ${vg.brollPattern}` : ''}
${vg?.editingRhythm ? `- Editing rhythm: ${vg.editingRhythm}` : ''}
${vg?.graphicsAndTextUsage ? `- Graphics/text: ${vg.graphicsAndTextUsage}` : ''}
${di.narrativeLens ? `- Narrative lens (default visual subject when narration is ambiguous): ${di.narrativeLens}` : ''}
${assetMixBlock}

AVAILABLE ASSET TYPES:
- "real-image"  → named real people, documented events, specific locations. searchQuery = "Steve Jobs 2007 keynote" / "Chernobyl reactor 1986 aerial"
- "stock-video" → moving B-roll — atmosphere, motion, passage of time. searchQuery = visual mood, NOT narration subject — "empty highway dusk", "factory floor workers night shift"
- "stock-photo" → a single still for place, object, or mood. searchQuery = "vintage stock ticker 1970s", "abandoned office building"
- "ai-video"    → cinematic pans, abstract/impossible visuals, dramatic reconstructions
- "ai-image"    → illustrated or stylised stills when stock or real won't fit

SEGMENT RULES:
- Each segment = 1–4 complete sentences forming one coherent visual idea.
- Segment boundaries MUST fall at sentence ends — never mid-sentence.
- Segments concatenated = the full scene narration with no gaps or added words.
- Every segment MUST have exactly 2 assets (rank 1, rank 2).
- Asset "note": ≤5 words — the director's brief.
- "searchQuery": required for stock-video, stock-photo, real-image; omit for ai-video and ai-image.
- durationSeconds = round((segmentWordCount / ${settings.wpm}) × 60)

MULTI-SHOT SLOTS — this channel cuts every ~${secsPerShot}s:
  IF durationSeconds < ${triggerSecs}  →  single-shot. 2 assets, no "slot" or "narrationSlice".
  IF durationSeconds ≥ ${triggerSecs}  →  multi-shot. REQUIRED.
    - slots = floor(durationSeconds ÷ ${secsPerShot}), minimum 2.
    - Divide the segment's text into that many groups of consecutive sentences at natural thought breaks.
    - Every asset gets "slot" (0-indexed) and "narrationSlice" (exact verbatim sentences from that slot's text).
    - 2 assets per slot. Every sentence covered exactly once.

Return ONLY valid JSON:
{
  "scenes": [
    {
      "number": 1,
      "segments": [
        {
          "text": "Voice-matched narration for this segment.",
          "durationSeconds": 10,
          "assets": [
            { "rank": 1, "type": "real-image", "note": "subject early career portrait", "searchQuery": "Steve Jobs 1984 Macintosh launch" },
            { "rank": 2, "type": "stock-photo", "note": "suburban street 1960s", "searchQuery": "suburban California 1960s street" }
          ]
        },
        {
          "text": "First sentence here. Second sentence here. Third sentence here.",
          "durationSeconds": 22,
          "assets": [
            { "rank": 1, "type": "real-image", "note": "location establishing shot", "searchQuery": "downtown Chicago 1972", "slot": 0, "narrationSlice": "First sentence here." },
            { "rank": 2, "type": "stock-photo", "note": "rural road dusk", "searchQuery": "rural highway dusk", "slot": 0, "narrationSlice": "First sentence here." },
            { "rank": 1, "type": "stock-video", "note": "police lights night", "searchQuery": "police lights night highway", "slot": 1, "narrationSlice": "Second sentence here. Third sentence here." },
            { "rank": 2, "type": "ai-image", "note": "mood atmospheric", "slot": 1, "narrationSlice": "Second sentence here. Third sentence here." }
          ]
        }
      ]
    }
  ]
}`,
      }],
    });

    if (result.stopReason === 'max_tokens') {
      throw new Error('Script refinement (director) was truncated — using Pass 1 draft.');
    }

    const raw = result.text;
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');

    const parsed = JSON.parse(cleaned) as { scenes: Array<{ number: number; segments: DirectorScriptSegment[] }> };
    return {
      result: parsed.scenes.map(s => ({ number: s.number, narration: '', segments: s.segments })),
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  }

  // ── Regular mode: scene-level narration rewrite ───────────────────────────
  const result2 = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-opus-4-8',
    maxTokens: 64000,
    grokReasoningEffort: 'none',
    system: 'You are a voice editor. Respond ONLY with valid JSON, no markdown fences, no prose.',
    messages: [{
      role: 'user',
      content: `Rewrite every scene's narration so it is INDISTINGUISHABLE from the channel's real content.

${voiceBlock}

FULL DRAFT SCRIPT:
${draftScript}

${commonRules}

Return ONLY valid JSON:
{
  "scenes": [
    { "number": 1, "narration": "Rewritten Scene 1 narration..." },
    { "number": 2, "narration": "Rewritten Scene 2 narration..." }
  ]
}`,
    }],
  });

  if (result2.stopReason === 'max_tokens') {
    throw new Error('Voice refinement was truncated — using Pass 1 draft.');
  }

  const raw2 = result2.text;
  let cleaned2 = raw2.trim();
  if (cleaned2.startsWith('```')) cleaned2 = cleaned2.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');

  const parsed2 = JSON.parse(cleaned2) as { scenes: RefinedSceneNarration[] };
  return {
    result: parsed2.scenes,
    inputTokens: result2.inputTokens,
    outputTokens: result2.outputTokens,
  };
}

// ─── Voice Refinement — single scene (Pass 2, per-scene) ────────────────────

export async function refineSceneVoice(
  llm: LLMConfig,
  topic: string,
  analysis: Analysis,
  targetScene: Scene,
  allScenes: Scene[],
  settings: ScriptSettings,
  directorMode = false,
  assetMixOverride?: Record<string, number>,
  claudeModelOverride?: string,
): Promise<{ result: RefinedSceneNarration; inputTokens: number; outputTokens: number } | null> {
  const rawBible = buildVoiceBible(analysis.videoAnalyses);
  const voiceExcerpts = analysis.channelInsights.voiceExcerpts ?? [];

  // Cap voice material at ~8 000 chars so the cached block stays lean.
  // Synthesized excerpts are higher quality than raw captions — prefer them first.
  const VOICE_CAP = 8000;
  let voiceMaterial = '';
  if (voiceExcerpts.length > 0) {
    const block = voiceExcerpts.map((e, i) => `[Excerpt ${i + 1}]\n${e}`).join('\n\n');
    const excerptText = `SYNTHESIZED VOICE EXAMPLES:\n${block}`;
    voiceMaterial = excerptText.slice(0, VOICE_CAP);
    const remaining = VOICE_CAP - voiceMaterial.length;
    if (rawBible && remaining > 500) {
      voiceMaterial = `RAW TRANSCRIPT PASSAGES:\n${rawBible.slice(0, remaining - 30)}\n\n` + voiceMaterial;
    }
  } else if (rawBible) {
    voiceMaterial = `RAW TRANSCRIPT PASSAGES — copied verbatim from published videos:\n${rawBible.slice(0, VOICE_CAP)}`;
  }
  if (!voiceMaterial) return null;

  const ws = analysis.channelInsights.writingStyle;
  const proseFingerprint = ws?.proseFingerprint ?? '';
  const openingFormula = ws?.openingFormula ?? '';

  const writingStyleBlock = ws ? `\nWRITING STYLE:
- Sentence structure: ${ws.sentenceStructure}
- Vocabulary: ${ws.vocabularyLevel}
- Directness: ${ws.directnessLevel}
- Pace and rhythm: ${ws.paceAndRhythm}
${ws.avgSentenceLengthWords ? `- Target avg sentence length: ~${ws.avgSentenceLengthWords} words` : ''}
${ws.sentenceLengthVariance ? `- Sentence length variance: ${ws.sentenceLengthVariance}` : ''}
${ws.microRhythmBlueprint ? `- Micro-rhythm blueprint: ${ws.microRhythmBlueprint}` : ''}
${ws.bodySceneOpenings ? `- Body scene opening pattern (Scenes 2+): ${ws.bodySceneOpenings}` : ''}
${ws.revelationFormula ? `- Revelation/contrast formula: ${ws.revelationFormula}` : ''}
${ws.withinSceneTransitionPattern ? `- Within-scene transition pattern: ${ws.withinSceneTransitionPattern}` : ''}
${ws.evidencePresentationStyle ? `- Evidence/fact presentation style: ${ws.evidencePresentationStyle}` : ''}` : '';

  const hookInstruction = targetScene.number === 1
    ? (openingFormula
        ? `\nSCENE 1 HOOK — HARD STRUCTURAL RULES (override everything else for Scene 1):
${openingFormula}`
        : `\nINSTRUCTION FOR SCENE 1: Find the single most defining, specific detail in this scene. Anchor the opening on that — not a generic formula.`)
    : '';

  const voiceBlock = `================================================================
CHANNEL VOICE — these are the channel's actual words. Your output must be INDISTINGUISHABLE from these.
================================================================
${voiceMaterial}
================================================================
END OF CHANNEL VOICE
================================================================`;

  const otherScenes = allScenes.filter(s => s.id !== targetScene.id);
  const narrativeContext = otherScenes.length > 0
    ? `STORY CONTEXT — other scenes for narrative continuity (do NOT rewrite these):
${otherScenes.map(s => `Scene ${s.number}: ${s.title} — ${s.narration}`).join('\n')}`
    : '';

  // ── Split prompt: stable prefix (cached) vs per-scene suffix (not cached) ──
  // The Voice Bible + channel analysis are identical across all scene calls — cache them.
  // Only the hook instruction (scene 1), narrative context, and target scene vary per call.

  const ns = analysis.channelInsights.narrativeStructure;
  const hs = analysis.channelInsights.hookStrategies;
  const sst = analysis.channelInsights.scriptStructureTemplate;

  // Truncate helper — keeps the structural block concise to avoid oversized prompts
  const tr = (s: string, max = 500) => s.length > max ? s.slice(0, max).trimEnd() + '…' : s;

  const structuralBlueprintBlock = (() => {
    const parts: string[] = [];
    // Use narrativeStructure (precise) if available; fall back to hookStrategies / scriptStructureTemplate
    if (ns) {
      const nsLines = [
        `STRUCTURAL BLUEPRINTS:`,
        ns.hookAnchorType           ? `HOOK ANCHOR: ${tr(ns.hookAnchorType)}` : '',
        ns.hookNameRevealTiming     ? `NAME REVEAL: ${tr(ns.hookNameRevealTiming)}` : '',
        ns.hookCloseFormula         ? `HOOK CLOSE: ${tr(ns.hookCloseFormula)}` : '',
        ns.backstoryBlueprint       ? `BACKSTORY FORMULA: ${tr(ns.backstoryBlueprint, 800)}` : '',
        ns.settingFunctionBlueprint ? `SETTING PATTERN: ${tr(ns.settingFunctionBlueprint)}` : '',
        ns.subjectIntroBlueprint    ? `SUBJECT INTRO: ${tr(ns.subjectIntroBlueprint)}` : '',
        ns.institutionalBeat && ns.institutionalBeat !== 'null' ? `INSTITUTIONAL BEAT: ${tr(ns.institutionalBeat)}` : '',
        ns.bodySceneTypeFormulas    ? `SCENE TYPE FORMULAS:\n${tr(ns.bodySceneTypeFormulas, 2000)}` : '',
      ].filter(Boolean).join('\n');
      parts.push(nsLines);
    } else {
      // Fall back to coarser fields only when narrativeStructure isn't available
      if (hs?.length) parts.push(`HOOK STRATEGIES:\n${hs.slice(0, 2).map((s, i) => `${i + 1}. ${tr(s)}`).join('\n')}`);
      if (sst?.intro) parts.push(`HOOK ARCHITECTURE: ${tr(sst.intro)}`);
      if (sst?.body)  parts.push(`BODY ARCHITECTURE: ${tr(sst.body)}`);
    }
    return parts.length ? `\n\n${parts.join('\n\n')}` : '';
  })();

  const baseRules = `TOPIC: ${topic}
${proseFingerprint ? `\nPROSE FINGERPRINT — enforce every rule at the sentence level:\n${proseFingerprint}` : ''}${writingStyleBlock}${structuralBlueprintBlock}

REWRITE RULES — STRUCTURAL first, then sentence-level:
1. ARCHITECTURE MATCH (most important): Identify what TYPE of scene this is (hook, backstory, setting, subject-intro, escalation, resolution, etc.). Apply the structural blueprint for that scene type from the section above. Match what the scene DOES architecturally, not just how it sounds.
2. Hook scenes (Scene 1): Anchor on the channel's hook anchor type. Apply the name-reveal timing. Close with the hook-close formula.
3. Setting scenes: Apply the SETTING PATTERN from the structural blueprints above — match exactly how this channel uses location and context.
4. Preserve all facts and story beats — do NOT add, remove, invent, or reorder any narrative events, people, dates, or revelations from the draft. Rhetorical devices and meta-commentary that align with the channel's voice must be kept and amplified, not stripped. Scene-opening patterns are NOT protected by this rule — rewrite them to match the channel's structural blueprints.
5. Full scene structure (Scenes 2+): Identify this scene's type using the SCENE TYPE FORMULAS above and rewrite its full structure — opening, information order, and closing — to match the formula for that type. The body scene opening pattern in WRITING STYLE above governs the first sentence. The scene title is a label only.
6. Every sentence must pass this test: could it appear in the Voice Bible above without standing out?
7. Match rhythm, vocabulary register, and restraint exactly. Not "inspired by" — INDISTINGUISHABLE. Vary sentence length according to the Micro-Rhythm Blueprint above.
8. Keep approximately the same word count as the draft (within ±15%). Adjust phrasing to serve the rhythm even if it means slight expansion or contraction.
9. Do NOT change the scene number or title.
10. Make the narration feel like it was written by the same person who wrote the Voice Bible passages — same restraint, same way of letting specific details do the work.`;

  if (directorMode) {
    const di = analysis.channelInsights;
    const vg = di.visualSceneGuide;
    const cn = di.contentNature?.classification ?? 'unknown';
    const ps = di.visualBrand?.productionStyle ?? 'not specified';
    const cutRate = vg?.cutRateShotsPerMinute;
    const secsPerShot = cutRate ? Math.round(60 / cutRate) : 12;
    const triggerSecs = Math.round(secsPerShot * 1.8);

    // Stable across all scenes — put in cached block
    const staticDirectorBlock = `CHANNEL VISUAL DNA:
- Production style: ${ps}
- Content nature: ${cn}${di.contentNature?.reasoning ? ` — ${di.contentNature.reasoning}` : ''}
- Energy / tone: ${di.contentStyle?.energy ?? ''}${di.contentStyle?.tone ? ` · ${di.contentStyle.tone}` : ''}
${vg?.brollPattern ? `- Broll pattern: ${vg.brollPattern}` : ''}
${vg?.editingRhythm ? `- Editing rhythm: ${vg.editingRhythm}` : ''}
${di.narrativeLens ? `- Narrative lens: ${di.narrativeLens}` : ''}

AVAILABLE ASSET TYPES:
- "real-image"  → named real people, documented events, specific locations. searchQuery = "Neil Armstrong moon landing 1969"
- "stock-video" → moving B-roll — atmosphere, motion, passage of time. searchQuery = visual mood, NOT narration subject — "empty highway dusk"
- "stock-photo" → a single still for place, object, or mood. searchQuery = "empty boardroom glass table"
- "ai-video"    → cinematic pans, abstract/impossible visuals, dramatic reconstructions
- "ai-image"    → illustrated or stylised stills

SEGMENT RULES:
- Each segment = 1–4 complete sentences forming one coherent visual idea.
- Segment boundaries MUST fall at sentence ends — never mid-sentence.
- Segments concatenated = the full rewritten scene narration with no gaps or added words.
- Every segment MUST have exactly 2 assets (rank 1, rank 2).
- Asset "note": ≤5 words — the director's brief.
- "searchQuery": required for stock-video, stock-photo, real-image; omit for ai-video and ai-image.
- durationSeconds = round((segmentWordCount / ${settings.wpm}) × 60)

MULTI-SHOT SLOTS — this channel cuts every ~${secsPerShot}s:
  IF durationSeconds < ${triggerSecs}  →  single-shot. 2 assets, no "slot" or "narrationSlice".
  IF durationSeconds ≥ ${triggerSecs}  →  multi-shot. REQUIRED.
    - slots = floor(durationSeconds ÷ ${secsPerShot}), minimum 2.
    - Divide the segment's text into that many groups of consecutive sentences at natural thought breaks.
    - Every asset gets "slot" (0-indexed) and "narrationSlice" (exact verbatim sentences from that slot).
    - 2 assets per slot. Every sentence covered exactly once.`;

    // Per-scene asset mix (varies: estimatedSegments differs per scene)
    const rawMix = assetMixOverride ?? di.visualAssetMix;
    const assetMixBlock = rawMix ? (() => {
      const sceneWords = targetScene.wordCount ?? Math.round(settings.targetWordCount / Math.max(1, allScenes.length));
      const estimatedSegments = Math.max(3, Math.round(sceneWords / 55));
      const types = (['ai-video', 'ai-image', 'stock-video', 'stock-photo', 'real-image'] as const).filter(t => (rawMix[t] ?? 0) > 0);
      const reasoning = !assetMixOverride && di.visualAssetMix ? di.visualAssetMix.reasoning : 'Custom mix set by the user.';
      return `
TARGET ASSET MIX${assetMixOverride ? ' (user-specified)' : ' — match this channel distribution'}:
Estimated segments in this scene: ~${estimatedSegments}. Your rank-1 choices must hit approximately:
${types.map(t => `  • ${t}: ${rawMix[t]}%  →  ~${Math.round(estimatedSegments * (rawMix[t] as number) / 100)} segments`).join('\n')}
Reasoning: ${reasoning}

RULES: ai-video must appear. stock-photo must appear. ai-image must not crowd out other types.`;
    })() : '';

    const dirResult = await llmComplete(llm, {
      claudeModel: claudeModelOverride ?? 'claude-opus-4-8',
      maxTokens: 16000,
      system: 'You are an expert YouTube scriptwriter and visual director. Respond ONLY with valid JSON, no markdown fences, no prose.',
      timeout: 100_000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text' as const,
            text: `Rewrite a scene to match the channel's voice exactly, and break it into director-mode visual segments with asset assignments.\n\n${voiceBlock}\n\n${baseRules}\n\n${staticDirectorBlock}`,
            cache_control: { type: 'ephemeral' as const },
          },
          {
            type: 'text' as const,
            text: `${hookInstruction ? hookInstruction + '\n\n' : ''}${assetMixBlock ? assetMixBlock + '\n\n' : ''}${narrativeContext ? narrativeContext + '\n\n' : ''}TARGET SCENE TO REWRITE:
SCENE ${targetScene.number}: ${targetScene.title}
${targetScene.narration}

Return ONLY valid JSON:
{
  "number": ${targetScene.number},
  "segments": [
    {
      "text": "Voice-matched narration for this segment.",
      "durationSeconds": 10,
      "assets": [
        { "rank": 1, "type": "real-image", "note": "subject portrait", "searchQuery": "..." },
        { "rank": 2, "type": "stock-photo", "note": "location exterior", "searchQuery": "..." }
      ]
    }
  ]
}`,
          },
        ],
      }],
    });

    if (dirResult.stopReason === 'max_tokens') {
      throw new Error(`Scene ${targetScene.number} refinement was truncated.`);
    }

    const dirRaw = dirResult.text;
    let dirCleaned = dirRaw.trim();
    if (dirCleaned.startsWith('```')) dirCleaned = dirCleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
    const dirParsed = JSON.parse(dirCleaned) as { number: number; segments: DirectorScriptSegment[] };
    return {
      result: { number: dirParsed.number, narration: '', segments: dirParsed.segments },
      inputTokens: dirResult.inputTokens,
      outputTokens: dirResult.outputTokens,
    };
  }

  // ── Regular mode: narration rewrite only ──────────────────────────────────
  const regResult = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-opus-4-8',
    maxTokens: 8000,
    system: 'You are a voice editor. Respond ONLY with valid JSON, no markdown fences, no prose.',
    timeout: 100_000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text' as const,
          text: `Rewrite a scene so it is INDISTINGUISHABLE from the channel's voice.\n\n${voiceBlock}\n\n${baseRules}`,
          cache_control: { type: 'ephemeral' as const },
        },
        {
          type: 'text' as const,
          text: `${hookInstruction ? hookInstruction + '\n\n' : ''}${narrativeContext ? narrativeContext + '\n\n' : ''}TARGET SCENE TO REWRITE:
SCENE ${targetScene.number}: ${targetScene.title}
${targetScene.narration}

Return ONLY valid JSON:
{ "number": ${targetScene.number}, "narration": "Rewritten narration..." }`,
        },
      ],
    }],
  });

  if (regResult.stopReason === 'max_tokens') {
    throw new Error(`Scene ${targetScene.number} refinement was truncated.`);
  }

  const regRaw = regResult.text;
  let regCleaned = regRaw.trim();
  if (regCleaned.startsWith('```')) regCleaned = regCleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  const regParsed = JSON.parse(regCleaned) as { number: number; narration: string };
  return {
    result: { number: regParsed.number, narration: regParsed.narration },
    inputTokens: regResult.inputTokens,
    outputTokens: regResult.outputTokens,
  };
}

// ─── Generate Scene Assets ──────────────────────────────────────────────────

export async function generateSceneAssets(
  llm: LLMConfig,
  scene: Scene,
  channelInsights: ChannelInsights,
  options: { image: boolean; video: boolean; stock: boolean; stockPhotos: boolean; realImages: boolean; stockVideos: boolean },
  analysis?: Analysis,
  granularity = 2,
  characters: import('./types').CharacterSheet[] = [],
  promptDetail: import('./types').PromptDetail = 'auto',
  scriptTopic?: string,
  visualStyle?: string,
  usedFingerprints?: string[],
  claudeModelOverride?: string,
): Promise<{
  result: {
    imagePrompts?: string[];
    imagePromptExcerpts?: string[];
    imagePromptFingerprints?: string[];
    videoPrompts?: string[];
    videoPromptExcerpts?: string[];
    videoPromptFingerprints?: string[];
    stockUrl?: string;
    stockPhotoQueries?: Array<{ query: string; excerpt: string }>;
    realImageQueries?: Array<{ query: string; excerpt: string }>;
    stockVideoQueries?: Array<{ query: string; excerpt: string }>;
  };
  inputTokens: number;
  outputTokens: number;
}> {
  const estimatedSeconds = scene.estimatedDurationSeconds || Math.round((scene.wordCount || 0) / 2.5);
  // Seconds per segment per granularity level: 1=Minimal, 2=Balanced, 3=Detailed, 4=Cinematic
  const secsPerChunk = [20, 10, 5, 3][Math.max(0, Math.min(3, granularity - 1))];

  // Split narration into complete sentences first so we can cap chunk counts.
  const narrationSentences = splitSentences((scene.narration || '').trim());
  if (narrationSentences.length === 0) narrationSentences.push((scene.narration || '').trim());

  // Cap chunk count to sentence count — eliminates padding that duplicates the last sentence.
  const sentCount = Math.max(1, narrationSentences.length);
  const chunks = Math.min(sentCount, Math.min(20, Math.max(1, Math.ceil(estimatedSeconds / secsPerChunk))));

  // Index-based distribution: slice sentence array evenly, no accumulation bugs.
  const narrationChunks: string[] = Array.from({ length: chunks }, (_, i) => {
    const m = narrationSentences.length;
    const start = Math.floor((i * m) / chunks);
    const end = Math.floor(((i + 1) * m) / chunks);
    return narrationSentences.slice(start, end).join(' ');
  });

  const segObj = `{ "query": "search term", "excerpt": "verbatim narration sentence(s) this segment covers" }`;
  const promptObj = `{ "prompt": "detailed prompt text", "excerpt": "verbatim narration this segment covers", "fingerprint": "shot_distance | subject/action | location | color+mood" }`;

  const wantedParts = [
    options.image && `imagePrompts (${chunks} objects with prompt + excerpt, one per ~${secsPerChunk}s segment, prompts --ar 16:9)`,
    options.video && `videoPrompts (${chunks} objects with prompt + excerpt, one per ~${secsPerChunk}s segment)`,
    options.stock && 'stockUrl (Pexels search URL)',
    options.stockPhotos &&
      `stockPhotoQueries (${chunks} objects: query = short Pexels photo search term matching that segment visually — no real person names; excerpt = verbatim narration text this segment covers)`,
    options.realImages &&
      `realImageQueries (${chunks} objects: query = specific factual search to find REAL photographs of subjects/events in that segment, must name real people/places; excerpt = verbatim narration text this segment covers)`,
    options.stockVideos &&
      `stockVideoQueries (${chunks} objects: query = short Pexels video search term for that segment — no real person names; excerpt = verbatim narration text this segment covers)`,
  ].filter(Boolean);

  const jsonTemplate = [
    options.image &&
      `"imagePrompts": [${Array.from({ length: chunks }, () => promptObj).join(', ')}]`,
    options.video &&
      `"videoPrompts": [${Array.from({ length: chunks }, () => promptObj).join(', ')}]`,
    options.stock && `"stockUrl": "https://www.pexels.com/search/videos/keywords+here/"`,
    options.stockPhotos &&
      `"stockPhotoQueries": [${Array.from({ length: chunks }, () => segObj).join(', ')}]`,
    options.realImages &&
      `"realImageQueries": [${Array.from({ length: chunks }, () => segObj).join(', ')}]`,
    options.stockVideos &&
      `"stockVideoQueries": [${Array.from({ length: chunks }, () => segObj).join(', ')}]`,
  ]
    .filter(Boolean)
    .join(',\n  ');

  const result = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-sonnet-4-6',
    maxTokens: 8192,
    system: 'You are a film director building a visual sequence for a YouTube production. Your mandate is compelling variety — each shot must show the audience something they have not yet seen in this script. Respond ONLY with valid JSON, no markdown.',
    messages: [
      {
        role: 'user',
        content: `${(() => {
          const lock = resolvePromptLock(visualStyle) || channelInsights.visualBrand?.productionStyle;
          return lock ? `VISUAL STYLE — Primary production style for this channel:
${lock}
Use this as the default visual language across prompts. Real channels naturally vary their look between scenes — wide establishing shots, tight closeups, different lighting moods, cutaway styles — so let the scene content and emotional tone guide the specific treatment of each prompt. Do NOT copy this description literally into prompt text and do NOT force artificial uniformity. Stay within the medium (e.g. if this is animation, keep all prompts animated) but vary composition, mood, and framing naturally.

` : '';
        })()}Generate: ${wantedParts.join(', ')}

SCENE:
Title: ${scene.title}
Full Narration: ${scene.narration}
Visual Description: ${scene.sceneDescription}
Duration: ~${estimatedSeconds}s
${scriptTopic ? `Script Topic: ${scriptTopic}` : ''}

STORY WORLD — EVERY prompt must be set inside this world. No exceptions.
${scriptTopic ? `Topic/Setting: ${scriptTopic}` : ''}
${scene.sceneDescription ? `Scene Atmosphere: ${scene.sceneDescription}` : ''}
${channelInsights.narrativeLens ? `VISUAL SUBJECT — default subject when narration is ambiguous: ${channelInsights.narrativeLens} When the narration explicitly describes a specific person, place, or action, the visual must follow the narration — show exactly who and what is described. Only fall back to the primary subject when the narration does not name a specific visual focus.` : ''}
Infer the time period, geography, architecture, clothing, lighting, and cultural context from the topic and scene description above, and keep them rigidly consistent across ALL ${chunks} segments. Do NOT introduce urban skylines, modern buildings, contemporary clothing, vehicles, or technology unless the narration explicitly requires them. Every visual element — background, props, costumes, lighting — must belong to the same world.

NARRATION PRE-DIVIDED INTO ${chunks} SEQUENTIAL SEGMENTS (all asset types use these same segments):
${narrationChunks.map((c, i) => `[${i + 1}] "${c}"`).join('\n')}

CHANNEL VISUAL DNA (match this exactly):
${(() => {
  const activeLock = resolvePromptLock(visualStyle) || channelInsights.visualBrand?.productionStyle;
  return activeLock ? `Primary production style: ${activeLock}\nStay within this medium but vary composition, lighting, and framing per scene — do not force every prompt into an identical visual treatment.` : '';
})()}
- Thumbnail style: ${channelInsights.visualBrand.thumbnailStyle}
- Color palette: ${channelInsights.visualBrand.colorScheme}
- Typography style: ${channelInsights.visualBrand.typography}
- Content tone: ${channelInsights.contentStyle.tone}
- Energy level: ${channelInsights.contentStyle.energy}
- Replication formula: ${channelInsights.replicationFormula}
- Visual patterns to steal: ${channelInsights.thingsToSteal?.slice(0, 4).join('; ')}${
  analysis?.videoAnalyses?.length ? `
- Camera style (from actual videos): ${analysis.videoAnalyses[0].visualStyleEditing.inferredCameraStyle}
- Editing pace: ${analysis.videoAnalyses[0].visualStyleEditing.editingPace}
- B-roll approach: ${analysis.videoAnalyses[0].visualStyleEditing.brollEstimate}
- Emotional triggers used: ${analysis.videoAnalyses[0].emotionalTriggers.primaryEmotions.join(', ')}` : ''}

${usedFingerprints?.length ? `VISUAL HISTORY — Every shot already committed in this script (${usedFingerprints.length} shots total). You MUST avoid repeating their visual territory:
${usedFingerprints.join('\n')}

DIRECTOR'S MANDATE: Do not merely vary camera angle — vary what you SHOW. If narration describes a place, show who inhabits it with emotion. If it describes a decision, show its consequence on a face. If it describes a system or organisation, show a single person caught inside it. An empty boardroom → the person who was fired. A product launch → the engineer who built it. A historical moment → someone living through its aftermath. You are building visual tension through contrast and specificity. Surprise within the channel's visual DNA — never outside it.

` : ''}${characters.length > 0 ? `
CHARACTER SHEETS — VISUAL CONSISTENCY REFERENCE:
The following characters appear in this story. When any character is mentioned in the narration, use their sheet to ensure visual consistency across all prompts. Their appearance must match these descriptions exactly.
${characters.map(c => `
CHARACTER: ${c.name}
${c.fullDescription}${[
  c.age && `Age: ${c.age}`,
  c.gender && `Gender: ${c.gender}`,
  c.ethnicity && `Ethnicity: ${c.ethnicity}`,
  c.build && `Build: ${c.build}`,
  c.hairColor && c.hairStyle && `Hair: ${c.hairColor}, ${c.hairStyle}`,
  c.eyeColor && `Eyes: ${c.eyeColor}`,
  c.skinTone && `Skin: ${c.skinTone}`,
  c.typicalOutfit && `Outfit: ${c.typicalOutfit}`,
  c.styleNotes && `Notes: ${c.styleNotes}`,
].filter(Boolean).join('\n')}
`).join('\n---\n')}` : ''}

INSTRUCTIONS:
- The narration is already divided into ${chunks} segments above — do NOT re-divide it yourself.
- ALL asset types (imagePrompts, videoPrompts, stockPhotoQueries, realImageQueries, stockVideoQueries): produce EXACTLY ${chunks} items, one per segment [1]–[${chunks}] in order.
- "excerpt" for each item MUST be copied verbatim from the corresponding pre-divided segment above (item i → segment [i+1]).
- "fingerprint" (imagePrompts and videoPrompts only): compact visual tag — exactly this format: "{shot_distance} | {primary subject + action} | {location/environment} | {dominant color + mood}". Shot distance must be one of: extreme_close / close / medium / wide / aerial. Keep total fingerprint under 15 tokens. Example: "close | trembling hand signing document | mahogany desk | harsh fluorescent white".
- STORY WORLD LOCK: Every prompt must be grounded in the same time period, geography, and atmosphere established by the Story World block above. If the story is a folktale, keep mud-brick walls, earthen paths, fire-lit interiors, traditional clothing — never concrete, neon, cars, or urban skylines unless narration demands it.
${characters.length > 0 ? `- CHARACTER CONSISTENCY: When a named character from the CHARACTER SHEETS above appears in the narration segment, their visual description MUST be referenced in the prompt.
  - ALWAYS use the character's actual name in the prompt — never substitute with generic pronouns ("a woman", "a man", "the figure", "they", etc.).
  - Include key identifying traits (hair color/style, build, outfit, skin tone, distinctive features) drawn from their sheet so the output is visually consistent across all scenes.
  - Example: "Elena — tall woman with auburn hair in a braid, wearing a deep-green wool coat — stands at the edge of the cliff" NOT "a woman stands at the edge of the cliff".` : ''}

PROMPT DETAIL LEVEL: ${promptDetail === 'auto' ? 'Determine the appropriate level of detail based on the segment content and duration. More complex/emotional segments warrant richer prompts.' : promptDetail === 'brief' ? 'BRIEF — Keep prompts concise: 20–40 words. Essential subject and style only.' : promptDetail === 'standard' ? 'STANDARD — Moderately detailed: 50–80 words. Cover subject, mood, lighting, and composition.' : promptDetail === 'detailed' ? 'DETAILED — Rich and specific: 80–120 words. Include lighting setup, composition, atmosphere, color palette, and texture details.' : 'VERBOSE — Cinematic-grade: 120–200 words. Specify everything: subject, expression, exact lighting, lens characteristics, color grading, mood, texture, background depth, and stylistic references.'}

NO TEXT OVERLAYS: Never include text overlays, captions, subtitles, watermarks, title cards, lower thirds, or any typographic elements inside image or video prompts. AI image/video generators render these literally and they ruin the output. Describe only visual scenes, subjects, lighting, and atmosphere.

CRITICAL — SUBJECT vs STYLE:
- "B-roll heavy" and "no talking head" refer to the CREATOR not appearing on screen. It does NOT mean the documentary's subject (real people, historical figures) should be hidden.
- In historical documentaries, b-roll routinely includes: archival portraits, period photographs, actors/silhouettes depicting historical figures, crowds, faces in historical settings.
- When the narration is about a PERSON (their appearance, actions, emotions, decisions), SHOW that person — as a period photograph, archival portrait, actor, or historically dressed figure. Do NOT substitute their environment.
- NEVER add "no person visible", "no people", "no human figures", or similar phrases to prompts when the narration describes a human subject. Show people.
- Alternate between close-up portraits/faces and environmental establishing shots — a good documentary mixes both.

- imagePrompts: "prompt" = Midjourney/DALL-E prompt --ar 16:9 matching the channel's color palette and camera style. Subject-first: if narration describes a person, the prompt must depict that person or their direct actions. Environmental shots are for context segments only.
- videoPrompts: "prompt" = Sora/Runway prompt (~8s). Same subject-first rule. Show faces, figures, human drama — in documentary visual style.
- stockPhotoQueries: "query" = Pexels search for what the narration is ACTUALLY about (a person → search a person; a place → search the place). No real person names.
- realImageQueries: "query" = specific factual search naming the real subject — if narration describes a person, search for their actual photograph (e.g. "Shirō Ishii Unit 731 portrait photograph").
- stockVideoQueries: "query" = Pexels video search matching the narration subject. No real person names.

Return ONLY valid JSON:
{
  ${jsonTemplate}
}`,
      },
    ],
  });

  if (result.stopReason === 'max_tokens') {
    throw new Error('Asset generation response was too long and got cut off. Try selecting fewer asset types at once.');
  }
  const raw = result.text || '{}';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }
  const parsed = JSON.parse(cleaned) as {
    imagePrompts?: Array<{ prompt: string; excerpt: string }> | string[];
    videoPrompts?: Array<{ prompt: string; excerpt: string }> | string[];
    stockUrl?: string;
    stockPhotoQueries?: Array<{ query: string; excerpt: string }>;
    realImageQueries?: Array<{ query: string; excerpt: string }>;
    stockVideoQueries?: Array<{ query: string; excerpt: string }>;
  };

  // Override excerpts with our pre-computed narration chunks.
  // This guarantees no duplicates, no missing text, and strict chronological order
  // regardless of how Claude assigned them.
  if (parsed.stockPhotoQueries) {
    parsed.stockPhotoQueries = parsed.stockPhotoQueries.map((q, i) => ({
      ...q, excerpt: narrationChunks[i] ?? q.excerpt,
    }));
  }
  if (parsed.realImageQueries) {
    parsed.realImageQueries = parsed.realImageQueries.map((q, i) => ({
      ...q, excerpt: narrationChunks[i] ?? q.excerpt,
    }));
  }
  if (parsed.stockVideoQueries) {
    parsed.stockVideoQueries = parsed.stockVideoQueries.map((q, i) => ({
      ...q, excerpt: narrationChunks[i] ?? q.excerpt,
    }));
  }

  // Unpack prompt objects into parallel arrays (handle legacy string[] gracefully)
  type PromptItem = { prompt: string; excerpt: string; fingerprint?: string };
  const unpack = (arr: PromptItem[] | string[] | undefined) => {
    if (!arr?.length) return { prompts: undefined, excerpts: undefined, fingerprints: undefined };
    if (typeof arr[0] === 'string') return { prompts: arr as string[], excerpts: narrationChunks.length ? narrationChunks : undefined, fingerprints: undefined };
    const objs = arr as PromptItem[];
    const fps = objs.map(o => o.fingerprint ?? '').filter(Boolean);
    return {
      prompts: objs.map(o => o.prompt),
      excerpts: objs.map((o, i) => narrationChunks[i] ?? o.excerpt),
      fingerprints: fps.length === objs.length ? fps : undefined,
    };
  };

  const img = unpack(parsed.imagePrompts as PromptItem[] | string[] | undefined);
  const vid = unpack(parsed.videoPrompts as PromptItem[] | string[] | undefined);

  return {
    result: {
      imagePrompts: img.prompts,
      imagePromptExcerpts: img.excerpts,
      imagePromptFingerprints: img.fingerprints,
      videoPrompts: vid.prompts,
      videoPromptExcerpts: vid.excerpts,
      videoPromptFingerprints: vid.fingerprints,
      stockUrl: parsed.stockUrl,
      stockPhotoQueries: parsed.stockPhotoQueries,
      realImageQueries: parsed.realImageQueries,
      stockVideoQueries: parsed.stockVideoQueries,
    },
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// ─── YouTube Description ─────────────────────────────────────────────────────

export async function generateYoutubeDescription(
  llm: LLMConfig,
  title: string,
  fullScript: string,
  channelStyle?: string,
  claudeModelOverride?: string,
): Promise<{ description: string; inputTokens: number; outputTokens: number }> {
  const result = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-sonnet-4-6',
    maxTokens: 1024,
    messages: [{
      role: 'user',
      content: `You are an expert YouTube content strategist. Write a compelling YouTube description for this video.

VIDEO TITLE: ${title}

${channelStyle ? `CHANNEL STYLE & AUDIENCE:\n${channelStyle}\n\n` : ''}SCRIPT EXCERPT (first 6000 chars):
${fullScript.slice(0, 6000)}${fullScript.length > 6000 ? '\n...[continues]' : ''}

REQUIREMENTS:
- First 2-3 lines are the hook (visible before "Show more") — make them punchy and curiosity-driving
- Summarise what the viewer will learn or experience
- Include 2-3 relevant timestamps if the script has clear sections (estimate timing from word count at ~150wpm)
- End with a soft CTA (like / subscribe / comment)
- 150–300 words total
- No hashtags
- No emoji unless the channel style clearly uses them
- Plain text only — no markdown, no asterisks

Return ONLY the description text, nothing else.`,
    }],
  });

  return {
    description: result.text.trim(),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// ─── Director Plan Generation ────────────────────────────────────────────────

interface RawDirectorAsset {
  rank: number;
  type: string;
  note: string;
  durationEach?: number;
  searchQuery?: string;
  slot?: number;
  narrationSlice?: string;
}

interface RawDirectorSegment {
  s: number;             // startChar offset into scene narration
  e: number;             // endChar offset
  dur: number;           // durationSeconds
  assets: RawDirectorAsset[];
}

interface RawDirectorScene {
  sceneId: string;
  segments: RawDirectorSegment[];
}

type DirectorSceneInput = { id: string; title: string; narration: string; estimatedDurationSeconds: number };

// Builds the static channel-context + rules block that is identical across all scene calls.
// Returned as a single string so it can be placed in a cached content block.
function buildDirectorStaticPrompt(analysis: Analysis, visualStyle?: string): string {
  const insights = analysis.channelInsights;
  const visualGuide = insights.visualSceneGuide;
  const productionStyle = visualStyle ?? insights.visualBrand?.productionStyle ?? 'not specified';
  const contentNature = insights.contentNature?.classification ?? 'unknown';

  return `You are directing the visual production of a YouTube video. For each scene you receive, break the narration into precise visual segments and rank the 2 best media asset types per segment. Ground every decision in the channel's production style below.

CHANNEL PRODUCTION PROFILE:
- Visual style: ${productionStyle}
- Content nature: ${contentNature}
- Energy: ${insights.contentStyle?.energy ?? 'not specified'}
- Tone: ${insights.contentStyle?.tone ?? 'not specified'}
${insights.narrativeLens ? `- Default visual subject (use when narration is ambiguous): ${insights.narrativeLens}` : ''}
${visualGuide ? `- Broll pattern: ${visualGuide.brollPattern}
- Editing rhythm: ${visualGuide.editingRhythm}
- Graphics/text: ${visualGuide.graphicsAndTextUsage}
- Audio mood: ${visualGuide.audioMood}` : ''}

STRATEGIES TO APPLY:
${insights.thingsToSteal?.slice(0, 5).map(t => `- ${t}`).join('\n') ?? 'None'}

RETENTION PATTERNS:
${insights.engagementPatterns?.slice(0, 3).map(p => `- ${p}`).join('\n') ?? 'None'}

RULES:
- Segment = one coherent visual unit; cut when subject, emotion, or rhythm changes
- Identify segment boundaries by character offsets into the narration string (s=startChar, e=endChar)
- CRITICAL: s and e MUST land on word boundaries — s must be the index of the first character of a word (either 0 or one position after a space), e must be the index one position after the last character of a word (either at a space or at the end of the string). Never split a word across segments.
- Verify: narration[s] is never a partial word; narration[e-1] is never a partial word
- Match channel editing rhythm for segment length
- Asset types: ai-video | ai-image | stock-video | stock-photo | real-image
- Rank exactly 2 assets per segment; rank 1 is primary, rank 2 is fallback
- High-action/kinetic → ai-video rank 1; contemplative/atmospheric → ai-image rank 1
- Non-fictional/real-world references${contentNature === 'non-fictional' ? ' (this channel)' : ''} → real-image ranks high
- ai-video: durationEach = 6 or 8; stock/real: provide searchQuery; ai-image/ai-video: omit searchQuery
- ai-image: omit durationEach
- "note" field: ≤8 words explaining the choice
- Omit any field whose value would be null or 0 — do not output null values

OUTPUT: JSON array, one object per scene, no markdown, no commentary:
[{"sceneId":"<id>","segments":[{"s":<startChar>,"e":<endChar>,"dur":<seconds>,"assets":[{"rank":1,"type":"ai-video","note":"kinetic action suits channel energy","durationEach":7},{"rank":2,"type":"stock-video","note":"generic fallback if AI fails","durationEach":7,"searchQuery":"specific phrase"}]}]}]`;
}

function parseDirectorResponse(raw: string, batchStartIndex: number): RawDirectorScene[] {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  cleaned = arrayMatch ? arrayMatch[0] : cleaned;
  try {
    return JSON.parse(cleaned) as RawDirectorScene[];
  } catch {
    throw new Error(`Failed to parse director plan (scenes starting at ${batchStartIndex + 1}). Response: ${cleaned.slice(0, 200)}`);
  }
}

// Snap s backward to the start of a word (never land mid-word).
function snapWordStart(text: string, s: number): number {
  while (s > 0 && text[s - 1] !== ' ') s--;
  return s;
}

// Snap e forward to the end of a word (never land mid-word).
function snapWordEnd(text: string, e: number): number {
  while (e < text.length && text[e] !== ' ') e++;
  return e;
}

// Guard against incomplete multi-slot segments from the AI.
// If a declared slot has no rank-1 asset: promote its rank-2 if one exists, else collapse
// the whole segment to single-shot by stripping all slot/narrationSlice fields.
export function sanitizeDirectorSegment(segment: DirectorSegment): DirectorSegment {
  // Guarantee every segment has at least a rank-1 asset
  if (segment.assets.length === 0) {
    return {
      ...segment,
      assets: [{
        id: uuid(),
        rank: 1,
        type: 'ai-image',
        rationale: 'auto-fallback — no asset was assigned',
        prompts: [],
        totalDuration: segment.durationSeconds,
        generated: false,
      }],
    };
  }

  const hasSlots = segment.assets.some(a => a.slot !== undefined);
  if (!hasSlots) return segment;

  // Validate every narrationSlice is actually a verbatim substring of this segment's narration.
  // If Claude pulled text from a different scene, strip all slot data and fall back to single-shot
  // so the UI never shows text that doesn't belong to this segment.
  const slicedAssets = segment.assets.filter(a => a.narrationSlice !== undefined);
  if (slicedAssets.length > 0) {
    const narration = segment.narrationExcerpt;
    const allValid = slicedAssets.every(
      a => a.narrationSlice !== undefined && narration.includes(a.narrationSlice.trim()),
    );
    if (!allValid) {
      return {
        ...segment,
        assets: segment.assets.map(a => ({ ...a, slot: undefined, narrationSlice: undefined })),
      };
    }
  }

  const slotMax = Math.max(...segment.assets.map(a => a.slot ?? 0));
  let assets = [...segment.assets];

  for (let slot = 0; slot <= slotMax; slot++) {
    const slotAssets = assets.filter(a => (a.slot ?? 0) === slot);
    if (slotAssets.some(a => a.rank === 1)) continue;
    const rank2 = slotAssets.find(a => a.rank === 2);
    if (rank2) {
      assets = assets.map(a => a.id === rank2.id ? { ...a, rank: 1 } : a);
    } else {
      // Slot is entirely empty — collapse whole segment to single-shot
      return {
        ...segment,
        assets: assets.map(a => ({ ...a, slot: undefined, narrationSlice: undefined })),
      };
    }
  }

  return { ...segment, assets };
}

// Map raw Claude segments to DirectorSegments, respecting Claude's intended s/e offsets
// (snapped to word boundaries) so assets stay aligned with the narration they were designed for.
// Slight overlap between adjacent segments is preferable to shifting content away from its assets.
function mapDirectorScene(rawScene: RawDirectorScene, narration: string): DirectorScene {
  const rawSegs = rawScene.segments ?? [];
  if (rawSegs.length === 0) return { sceneId: rawScene.sceneId, segments: [] };

  const sorted = [...rawSegs].sort((a, b) => a.s - b.s);

  return {
    sceneId: rawScene.sceneId,
    segments: sorted.map((rawSeg, i): DirectorSegment => {
      const s = snapWordStart(narration, Math.max(0, rawSeg.s));
      const e = i === sorted.length - 1
        ? narration.length
        : snapWordEnd(narration, Math.min(rawSeg.e, narration.length));
      const segment: DirectorSegment = {
        id: uuid(),
        narrationExcerpt: narration.slice(s, e).trim(),
        durationSeconds: rawSeg.dur,
        assets: (rawSeg.assets ?? []).map((rawAsset): DirectorAsset => ({
          id: uuid(),
          rank: rawAsset.rank,
          type: rawAsset.type as DirectorAsset['type'],
          rationale: rawAsset.note,
          searchQuery: rawAsset.searchQuery ?? undefined,
          prompts: [],
          durationEach: rawAsset.durationEach ?? undefined,
          totalDuration: rawSeg.dur,
          generated: false,
          slot: rawAsset.slot ?? undefined,
          narrationSlice: rawAsset.narrationSlice ?? undefined,
        })),
      };
      return sanitizeDirectorSegment(segment);
    }),
  };
}

// Yields one DirectorScene at a time so callers can stream progress to the client.
// Internally batches 2 scenes per API call and uses prompt caching on the static context.
export async function* generateDirectorPlanStream(
  llm: LLMConfig,
  scenes: DirectorSceneInput[],
  analysis: Analysis,
  visualStyle?: string,
  claudeModelOverride?: string,
): AsyncGenerator<{ scene: DirectorScene; index: number; total: number; inputTokens: number; outputTokens: number }> {
  const staticPrompt = buildDirectorStaticPrompt(analysis, visualStyle);
  const system = 'You are an expert YouTube video director. Respond ONLY with a JSON array — no markdown, no commentary.';
  const BATCH_SIZE = 2;
  for (let batchStart = 0; batchStart < scenes.length; batchStart += BATCH_SIZE) {
    const batch = scenes.slice(batchStart, batchStart + BATCH_SIZE);

    const sceneBlocks = batch.map((s, j) =>
      `Scene ${batchStart + j + 1} [id: ${s.id}]\nTitle: ${s.title}\nDuration: ~${s.estimatedDurationSeconds}s\nNarration:\n${s.narration}`
    ).join('\n\n---\n\n');

    const batchResult = await llmComplete(llm, {
      claudeModel: claudeModelOverride ?? 'claude-sonnet-4-6',
      maxTokens: 8192,
      system,
      anthropicBeta: 'prompt-caching-2024-07-31',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: staticPrompt, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: `\n\nSCENES TO DIRECT:\n${sceneBlocks}` },
        ],
      }],
    });

    if (batchResult.stopReason === 'max_tokens') {
      const titles = batch.map(s => `"${s.title}"`).join(', ');
      throw new Error(`Director plan hit the output limit on scenes ${titles}. Try reducing video length or breaking long scenes into shorter ones.`);
    }

    const rawScenes = parseDirectorResponse(batchResult.text || '[]', batchStart);

    for (let j = 0; j < rawScenes.length; j++) {
      yield {
        scene: mapDirectorScene(rawScenes[j], batch[j]?.narration ?? ''),
        index: batchStart + j,
        total: scenes.length,
        inputTokens: j === 0 ? batchResult.inputTokens : 0,
        outputTokens: j === 0 ? batchResult.outputTokens : 0,
      };
    }
  }
}

// Non-streaming wrapper used by callers that don't need per-scene progress.
export async function generateDirectorPlan(
  llm: LLMConfig,
  scenes: DirectorSceneInput[],
  analysis: Analysis,
  visualStyle?: string,
): Promise<{ result: DirectorScene[]; inputTokens: number; outputTokens: number }> {
  const result: DirectorScene[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const item of generateDirectorPlanStream(llm, scenes, analysis, visualStyle)) {
    result.push(item.scene);
    inputTokens += item.inputTokens;
    outputTokens += item.outputTokens;
  }
  return { result, inputTokens, outputTokens };
}

// ─── Director Prompt Generation (lazy, per asset) ────────────────────────────

export async function generateDirectorPrompts(
  llm: LLMConfig,
  opts: {
    assetType: 'ai-video' | 'ai-image';
    narrationExcerpt: string;
    durationEach: number;
    clipCount: number;
    sceneTitle: string;
    sceneDescription: string;
    scriptTitle: string;
    productionStyle: string;
    visualStyle?: string;
    characters?: Array<{ name: string; fullDescription: string }>;
    channelBrollPattern?: string;
    channelEditingRhythm?: string;
    contentNature?: string;
    directorNote?: string;
    narrativeLens?: string;
  },
  claudeModelOverride?: string,
): Promise<{ prompts: string[]; clipLabels: ('CUT' | 'CONTINUOUS' | null)[]; inputTokens: number; outputTokens: number }> {
  const { assetType, narrationExcerpt, durationEach, clipCount, sceneTitle, sceneDescription, scriptTitle, productionStyle, visualStyle, characters, channelBrollPattern, channelEditingRhythm, contentNature, directorNote, narrativeLens } = opts;

  const effectiveStyle = resolvePromptLock(visualStyle ?? productionStyle) ?? (visualStyle ?? productionStyle);
  const isVideo = assetType === 'ai-video';
  const characterBlock = characters?.length
    ? `\nCHARACTER CONSISTENCY:\n${characters.map(c => `${c.name}: ${c.fullDescription}`).join('\n')}`
    : '';

  const clipInstruction = isVideo && clipCount > 1
    ? `Generate exactly ${clipCount} sequential video prompts covering the narration segment. Each prompt is a ${durationEach}s clip. Number them with headers in this exact format: [Clip 1/${clipCount} · CUT] or [Clip 1/${clipCount} · CONTINUOUS] — use CUT if this clip starts a new camera setup/angle, CONTINUOUS if it continues the motion or framing from the previous clip. Then write the prompt text below the header.`
    : isVideo
    ? `Generate 1 video prompt for a ${durationEach}s clip.`
    : `Generate 1 still image prompt.`;

  // Static preamble: identical across all asset generation calls for the same script.
  // Marked as cached so repeated clicks within a session pay ~10% input cost for this block.
  const staticBlock = `Write ${isVideo ? 'video' : 'image'} generation prompt(s) for a narration segment.

PRODUCTION STYLE: ${effectiveStyle}
CONTENT NATURE: ${contentNature ?? 'not specified'}
${narrativeLens ? `DEFAULT VISUAL SUBJECT (narrative lens — use when narration is ambiguous): ${narrativeLens} When the narration explicitly names or describes a different person, place, or action, show that instead. The lens is a default, not an override.` : ''}
${channelBrollPattern ? `CHANNEL BROLL PATTERN (match this): ${channelBrollPattern}` : ''}
${channelEditingRhythm ? `EDITING RHYTHM: ${channelEditingRhythm}` : ''}
${characterBlock}

VIDEO TITLE: ${scriptTitle}
SCENE: ${sceneTitle}
SCENE DESCRIPTION: ${sceneDescription}

REQUIREMENTS:
- Written specifically for ${effectiveStyle}
- NARRATION FIDELITY (highest priority): depict EXACTLY what the narration says — the same subject, the same action, the same relationship. If the narration says a person presses their OWN face/temples, the subject must be doing it to themselves — not to another person. If the narration names a specific object, location, or action, it must appear in the prompt. Do NOT substitute, reinterpret, or invent actions or relationships not described.
- Match the mood, pacing, and visual energy of the narration
- Include lighting, composition, action/motion${isVideo ? ', and camera movement' : ''}
${!isVideo ? '- STILL IMAGE ONLY: do NOT include any camera movement, zoom, pan, duration, timing, or animation language (e.g. no "Ken Burns", no "slow zoom", no "8 second hold") — those are video-only directives' : ''}
- Production-ready — no meta-commentary, no caveats, just the prompt`;

  const result = await llmComplete(llm, {
    claudeModel: claudeModelOverride ?? 'claude-sonnet-4-6',
    maxTokens: 1200,
    anthropicBeta: 'prompt-caching-2024-07-31',
    system: `You are a visual prompt engineer for AI ${isVideo ? 'video' : 'image'} generation. Write vivid, production-ready prompts that match the channel's visual style exactly. The single most important rule: every prompt must depict exactly what the narration describes — same subject, same action, same relationships. Never substitute, invent, or reinterpret. Return ONLY the prompt text(s), no explanation.`,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: staticBlock, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `\nNARRATION FOR THIS SEGMENT:\n"${narrationExcerpt}"\n${directorNote ? `\nDIRECTOR'S NOTE (mandatory — this is the primary visual intent, override any conflicting inference):\n"${directorNote}"\n` : ''}\n${clipInstruction}` },
      ],
    }],
  });

  const raw = result.text.trim();

  let prompts: string[];
  let clipLabels: ('CUT' | 'CONTINUOUS' | null)[];

  if (clipCount > 1 && isVideo) {
    // Split on headers like [Clip 1/3 · CUT] or [Clip 1/3 · CONTINUOUS] or plain [Clip 1/3]
    const headerRe = /\[Clip \d+\/\d+(?:\s*[·•]\s*(CUT|CONTINUOUS))?\]/gi;
    const labels: ('CUT' | 'CONTINUOUS' | null)[] = [];
    // Track both where each header starts (end of previous clip) and ends (start of current clip text)
    const boundaries: { headerStart: number; textStart: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = headerRe.exec(raw)) !== null) {
      boundaries.push({ headerStart: m.index, textStart: m.index + m[0].length });
      const tag = m[1]?.toUpperCase();
      labels.push(tag === 'CUT' ? 'CUT' : tag === 'CONTINUOUS' ? 'CONTINUOUS' : null);
    }
    if (boundaries.length === clipCount) {
      prompts = boundaries.map((b, i) =>
        raw.slice(b.textStart, boundaries[i + 1]?.headerStart ?? raw.length).trim()
      );
      clipLabels = labels;
    } else {
      prompts = [raw];
      clipLabels = [null];
    }
  } else {
    prompts = [raw];
    clipLabels = [null];
  }

  return {
    prompts,
    clipLabels,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}
