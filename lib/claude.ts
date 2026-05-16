import Anthropic from '@anthropic-ai/sdk';
import type {
  ChannelVideo,
  VideoAnalysis,
  ChannelInsights,
  Analysis,
  Scene,
  ScriptSettings,
} from './types';
import { resolvePromptLock } from './visual-styles';

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

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
  apiKey: string,
  video: ChannelVideo,
  transcript: string,
  thumbnailBase64: string
): Promise<{ result: VideoAnalysis; inputTokens: number; outputTokens: number }> {
  const ai = client(apiKey);

  const transcriptExcerpt = transcript
    ? `${transcript.slice(0, 60000)}${transcript.length > 60000 ? '\n...[transcript truncated]' : ''}`
    : 'No transcript available — infer from title, description, and thumbnail.';

  const contentBlocks: Anthropic.ContentBlockParam[] = [];

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
  "scriptAndLanguage": {
    "sentenceStyle": "Short punchy (under 10 words) | long flowing | mixed — with example from transcript",
    "technicalDepth": "No prior knowledge assumed | some familiarity expected | expert vocabulary used",
    "directnessLevel": "Direct command-style | conversational | narrative | academic",
    "rhetoricalDevices": ["Device: specific example from transcript", "Device: example"],
    "standoutPhrases": ["Most memorable phrase from transcript", "Second strong phrase"],
    "languageScore": 8
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
  "callToAction": {
    "ctaPlacements": ["Beginning: what is said", "End: what is said", "Mid-video: if detected"],
    "ctaTypes": ["Subscribe", "Comment with specific prompt", "Watch next video"],
    "frictionLevel": "Low (passive next-video) | medium (subscribe/comment) | high (external click)",
    "integrationQuality": "Natural and earned | forced/jarring | completely absent"
  },
  "audienceTargeting": {
    "primaryTargetViewer": "Specific description of exactly who this was made for — age, context, mindset",
    "assumedKnowledgeLevel": "No prior knowledge | familiar with basics | niche expertise expected",
    "demographicSignals": ["Age signal: specific evidence", "Interest signal: specific reference", "Cultural signal"],
    "communityIdentityMarkers": ["Phrase/reference signaling in-group identity", "Another identity marker"]
  },
  "engagementSignals": {
    "predictedCommentTypes": ["Type 1: emotional reactions", "Type 2: debate about a claim", "Type 3"],
    "shareabilityFactors": ["Specific reason someone would share this", "Another reason"],
    "communityBuildingElements": ["Element creating belonging or shared identity", "Another element"],
    "engagementPotentialScore": 8
  },
  "algorithmFit": {
    "watchTimePotential": "High | Medium | Low — with the specific structural reason why",
    "ctrDrivers": ["Title driver: specific element", "Thumbnail driver: specific element", "Synergy effect"],
    "sessionContinuationStrategy": "How this video leads the viewer to continue watching more content",
    "algorithmScore": 8
  },
  "monetizationStrategy": {
    "directMonetization": ["AdSense: CPM estimate for this niche", "Sponsorship type that fits"],
    "indirectMonetization": ["Audience asset being built", "Authority positioning for future product"],
    "revenueModelAssessment": "Primary estimated revenue path and how this video contributes"
  },
  "channelConsistency": {
    "formatRepeatability": "Can this format be templated and repeated at scale — and how",
    "seriesOrEpisodicNature": "Standalone | part of a series | anthology format",
    "uploadFrequencyImplication": "What production complexity implies about sustainable upload cadence"
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

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system:
      'You are an elite YouTube content strategy expert. Respond ONLY with valid JSON — no markdown fences, no prose. Be specific and concrete in every field. Keep each field value to 1–2 sentences max.',
    messages: [{ role: 'user', content: contentBlocks }],
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'Analysis response was truncated (too long). This is rare — please try again, or reduce the number of videos being analysed simultaneously.'
    );
  }

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }

  if (!cleaned.startsWith('{')) {
    throw new Error(
      `"${video.title}" could not be analysed — the content was declined by the AI. Try a different video.`
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
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ─── Channel Synthesis ──────────────────────────────────────────────────────

export async function synthesizeChannelInsights(
  apiKey: string,
  videoAnalyses: VideoAnalysis[]
): Promise<{ result: ChannelInsights; inputTokens: number; outputTokens: number }> {
  const ai = client(apiKey);

  // Slim summary — only the fields needed to identify cross-video patterns
  const summaries = videoAnalyses.map(v => ({
    title: v.videoTitle,
    coreIdea: v.topicPositioning?.coreIdea,
    angle: v.topicPositioning?.angle,
    hookType: v.hook?.type,
    hookOpeningLines: v.hook?.openingLines,
    openLoop: v.hook?.openLoopDescription,
    retentionIntent: v.hook?.retentionIntent,
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
    // Writing mechanics — critical for imitating the channel's actual prose
    sentenceStyle: v.scriptAndLanguage?.sentenceStyle,
    technicalDepth: v.scriptAndLanguage?.technicalDepth,
    directnessLevel: v.scriptAndLanguage?.directnessLevel,
    rhetoricalDevices: v.scriptAndLanguage?.rhetoricalDevices,
    standoutPhrases: v.scriptAndLanguage?.standoutPhrases,
    // Pacing at the language level
    narrativeSpeed: v.pacing?.narrativeSpeed,
    ideaDensity: v.pacing?.ideaDensity,
    breathingRoom: v.pacing?.breathingRoom,
    // Voice
    voiceAndPersonality: v.differentiation?.voiceAndPersonality,
    uniqueElements: v.differentiation?.uniqueElements,
    defensibleAdvantage: v.differentiation?.defensibleAdvantage,
    ctaTypes: v.callToAction?.ctaTypes,
    algorithmScore: v.algorithmFit?.algorithmScore,
    overallScore: v.overallScores?.overall,
    keyStrengths: v.overallScores?.keyStrengths,
    topRecommendation: v.overallScores?.topRecommendation,
  }));

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system:
      'You are a YouTube content strategy expert. Respond ONLY with valid JSON, no markdown fences, no prose.',
    messages: [
      {
        role: 'user',
        content: `Synthesise a channel strategy profile from these ${videoAnalyses.length} detailed video analyses. A creator wants to model their channel on this one.

CRITICAL INSTRUCTION: For most fields, extract PRINCIPLES and PSYCHOLOGICAL MECHANISMS — describe WHY each technique works and WHAT effect it creates, so a writer can apply the same intent to any topic with fresh language. Avoid reusable sentence starters or copy-paste templates for fields like hookStrategies, scriptStructureTemplate, and replicationFormula.
EXCEPTION: The writingStyle.openingFormula field is deliberately mechanical — for that field only, describe the structural pattern as a formula with slots and show it filled with a placeholder example. This is the one place where structural specificity matters more than abstract principles.

VIDEO ANALYSES:
${JSON.stringify(summaries, null, 2)}

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
  "writingStyle": {
    "sentenceStructure": "Describe the dominant sentence rhythm across the channel — e.g. 'predominantly short declarative sentences under 12 words, with occasional long compound sentences used only at emotional peaks'. Include what effect this creates on the reader/listener.",
    "vocabularyLevel": "The register and technicality — e.g. 'accessible everyday language with selective use of domain-specific terms to signal authority without alienating casual viewers'. Describe how vocabulary signals the creator's relationship with the audience.",
    "directnessLevel": "How the channel addresses the viewer — command-style, conversational, narrative, Socratic, academic. Describe the psychological effect of this choice.",
    "rhetoricalDevices": ["Device name: describe how this channel specifically deploys it and what effect it produces — not a textbook definition", "Device 2", "Device 3"],
    "paceAndRhythm": "How language density and speed modulate — where the script accelerates, where it slows, and what triggers those shifts. Describe the underlying cadence pattern.",
    "voiceAndPersonality": "The distinct creator persona — what the voice sounds like on the page, what makes it immediately recognisable, what it projects about the creator's identity and values.",
    "openingFormula": "The exact mechanical structure this channel uses to open every script — describe the pattern as a formula with slots, then show it filled in with a structural example using placeholder content. E.g. '[Specific date], [named person] [did specific action]. What [they did next / was found / happened after] would [consequence that opens the mystery].' This must be mechanical and structural enough that a writer could follow it to produce an opening that is indistinguishable from the channel's real intros. Note what the channel NEVER does in its openings (e.g. never starts with a concept or question, never addresses the viewer directly, never opens with statistics).",
    "signatureExpressions": ["A constructed example sentence in this channel's exact voice — not a copied quote, but a freshly written sentence that demonstrates the vocabulary level, rhythm, and personality. Topic: something generic like 'a disappearance in winter'. Write it exactly as this channel would.", "A second example on a different generic topic showing the same voice.", "A third example showing how this channel handles an emotional peak or revelation moment."]
  },
  "videoLength": {
    "typical": "Duration range in minutes",
    "reasoning": "Why this length serves this audience and content type"
  },
  "styleFingerprint": ["Distinctive quality 1 — something a reader could identify in a blind test as belonging to this channel", "Quality 2", "Quality 3", "Quality 4"],
  "replicationFormula": "Describe the creative PROCESS — how to find the right angle, how to open the narrative tension, how to sustain it. Focus on decisions a writer makes, not sentence-level patterns.",
  "thingsToSteal": ["Principle 1: describe what makes it effective and how to apply it to a new topic — not what it looks like on the surface", "Principle 2", "Principle 3", "Principle 4", "Principle 5"]
}`,
      },
    ],
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Channel synthesis response was truncated. Please try again.');
  }
  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }
  try {
    return {
      result: JSON.parse(cleaned) as ChannelInsights,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch {
    throw new Error('Failed to parse channel insights. Please try again.');
  }
}

// ─── Script Generation ──────────────────────────────────────────────────────

interface GeneratedScriptPayload {
  title: string;
  thumbnailConcept: string;
  scenes: Array<{
    number: number;
    title: string;
    narration: string;
    sceneDescription: string;
    estimatedDurationSeconds: number;
    wordCount: number;
  }>;
  totalEstimatedDuration: number;
  totalWordCount: number;
}

export async function generateScript(
  apiKey: string,
  analysis: Analysis,
  settings: ScriptSettings,
  topic: string,
  targetAudience: string,
  additionalInstructions: string
): Promise<{ result: GeneratedScriptPayload; inputTokens: number; outputTokens: number }> {
  const ai = client(apiKey);

  // Send only the strategy fields needed for scripting — not the full insights object
  const strategy = {
    channelOverview: analysis.channelInsights.channelOverview,
    titleFormulas: analysis.channelInsights.titleFormulas,
    hookStrategies: analysis.channelInsights.hookStrategies,
    scriptStructureTemplate: analysis.channelInsights.scriptStructureTemplate,
    contentStyle: analysis.channelInsights.contentStyle,
    audienceProfile: analysis.channelInsights.audienceProfile,
    engagementPatterns: analysis.channelInsights.engagementPatterns,
    replicationFormula: analysis.channelInsights.replicationFormula,
    thingsToSteal: analysis.channelInsights.thingsToSteal,
    writingStyle: analysis.channelInsights.writingStyle,
    productionStyle: analysis.channelInsights.visualBrand?.productionStyle,
    contentNature: analysis.channelInsights.contentNature,
  };

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system:
      'You are an expert YouTube scriptwriter. Respond ONLY with valid JSON, no markdown code blocks, no prose.',
    messages: [
      {
        role: 'user',
        content: `Create a complete YouTube video script for the topic below, written in the style of the analysed channel.

CHANNEL STRATEGY (principles and mechanisms — not templates):
${JSON.stringify(strategy, null, 2)}

SCRIPT PARAMETERS:
Topic: ${topic}
Target Audience: ${targetAudience || analysis.channelInsights.audienceProfile.demographics}
Video Length: ${settings.videoLength} minutes
Narration Speed: ${settings.wpm} words per minute
Target Word Count: ${settings.targetWordCount} words (±10%)
Additional Instructions: ${additionalInstructions || 'None'}

${strategy.productionStyle ? `PRODUCTION MEDIUM: ${strategy.productionStyle}
All sceneDescriptions and thumbnailConcept must be written assuming this visual medium. Do not describe scenes using language that belongs to a different medium (e.g. don't say "camera pans" for an animated channel, or "cartoon character" for a photorealistic one).

` : ''}${strategy.writingStyle ? `WRITING STYLE — MATCH THIS EXACTLY IN EVERY SENTENCE OF NARRATION:
- Sentence structure: ${strategy.writingStyle.sentenceStructure}
- Vocabulary level: ${strategy.writingStyle.vocabularyLevel}
- Directness: ${strategy.writingStyle.directnessLevel}
- Pace and rhythm: ${strategy.writingStyle.paceAndRhythm}
- Voice and personality: ${strategy.writingStyle.voiceAndPersonality}
- Rhetorical devices to use: ${strategy.writingStyle.rhetoricalDevices?.join('; ')}
${strategy.writingStyle.signatureExpressions?.length ? `- Sentences written in this channel's exact voice (study and match these at the word level):
${strategy.writingStyle.signatureExpressions.map(e => `  "${e}"`).join('\n')}` : ''}
${strategy.writingStyle.openingFormula ? `
OPENING FORMULA — the very first words of Scene 1 MUST follow this exact mechanical structure:
${strategy.writingStyle.openingFormula}
This overrides the general "no templates" rule below. The opening formula IS the template for Scene 1.` : ''}

The narration must sound indistinguishable from this channel's actual scripts at the sentence level — same rhythm, same vocabulary register, same personality coming through the words. A reader who knows the channel should recognise the voice immediately.

` : ''}${strategy.scriptStructureTemplate?.loopMechanism ? `CARRY-FORWARD LOOPS — this channel uses inter-scene tension hooks. Apply this pattern at the end of every scene except the last:
${strategy.scriptStructureTemplate.loopMechanism}

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
- Instead of inventing specifics, write around them using general language: "a man serving forty years" not a fabricated name; "in the late 1980s" not an invented year; "a prison in the Midwest" not a specific facility unless stated.
- You may describe documented patterns, systemic failures, emotional truths, and general timelines without inventing the specific details that fill them.
- The script must be compelling without fabricating a single verifiable fact.
` : `PARTIAL RULES — apply to real-world segments only:
- Do not invent specific names, dates, or case details for factual segments. Write around them with general language.
- For fictional segments, invent freely.
`}
`;
})()}STYLE RULES — READ CAREFULLY:
- The OPENING FORMULA and CARRY-FORWARD LOOPS above are exceptions — follow those mechanically. Everything else below applies.
- The channel strategy describes PRINCIPLES and PSYCHOLOGICAL MECHANISMS. Your job is to find fresh, topic-specific expressions of those principles — not to copy phrasing or templates from the strategy description itself.
- FORBIDDEN: reproducing sentence structures or grammatical templates from the strategy description text. The strategy describes the style; it is not a writing sample to copy from.
- Every scene must find its own unique entry point into the material. Do NOT open multiple scenes with the same grammatical structure.
- The hook must be built from what is specifically surprising, counterintuitive, or emotionally charged about THIS topic — not a generic formula applied to any topic.
- Apply the tone, pacing, and structural intent described in the strategy, but execute them through language that is entirely native to this specific subject.
- Total narration word count across ALL scenes must total approximately ${settings.targetWordCount} words
- For each scene: estimatedDurationSeconds = (wordCount / ${settings.wpm}) × 60, rounded to nearest second
- sceneDescription is a brief visual note (1 sentence) — NOT the narration
- Do NOT include image prompts or video prompts — those are generated separately on demand
- Keep sceneDescription short (1 sentence max)

Return ONLY valid JSON:
{
  "title": "Video title following the channel's exact title formula",
  "thumbnailConcept": "1-2 sentence description of what the thumbnail should look like",
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
}`,
      },
    ],
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'Script generation was truncated — try a shorter video length or fewer scenes. Alternatively, try again.'
    );
  }

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return {
      result: JSON.parse(cleaned) as GeneratedScriptPayload,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch {
    throw new Error(
      `Failed to parse script JSON. Raw response starts with: ${cleaned.slice(0, 300)}`
    );
  }
}

// ─── Generate Scene Assets ──────────────────────────────────────────────────

export async function generateSceneAssets(
  apiKey: string,
  scene: Scene,
  channelInsights: ChannelInsights,
  options: { image: boolean; video: boolean; stock: boolean; stockPhotos: boolean; realImages: boolean; stockVideos: boolean },
  analysis?: Analysis,
  granularity = 2,
  characters: import('./types').CharacterSheet[] = [],
  promptDetail: import('./types').PromptDetail = 'auto',
  scriptTopic?: string,
  visualStyle?: string,
  usedFingerprints?: string[]
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
  const ai = client(apiKey);

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

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
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

DIRECTOR'S MANDATE: Do not merely vary camera angle — vary what you SHOW. If history shows a desk of documents, show the person who wrote them. If it shows a location, show who inhabits it with emotion. If it shows an action, show its consequence on a face. A room of evidence → the suspect's cold eyes. A crime scene → the investigator's hands trembling. A battlefield → a single soldier's silent grief. You are building visual tension through contrast. Surprise within the channel's visual DNA — never outside it.

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

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Asset generation response was too long and got cut off. Try selecting fewer asset types at once.');
  }
  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}';
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
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ─── YouTube Description ─────────────────────────────────────────────────────

export async function generateYoutubeDescription(
  apiKey: string,
  title: string,
  fullScript: string,
  channelStyle?: string,
): Promise<{ description: string; inputTokens: number; outputTokens: number }> {
  const ai = client(apiKey);

  const response = await ai.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
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

  const description = (response.content[0] as { type: string; text: string }).text.trim();
  return {
    description,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
