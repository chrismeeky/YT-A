import Anthropic from '@anthropic-ai/sdk';
import type {
  ChannelVideo,
  VideoAnalysis,
  ChannelInsights,
  Analysis,
  Scene,
  ScriptSettings,
} from './types';

function client(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
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
    ? `${transcript.slice(0, 8000)}${transcript.length > 8000 ? '\n...[transcript truncated]' : ''}`
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
    openLoop: v.hook?.openLoopDescription,
    titlePattern: v.titleStructure?.formatPattern,
    titleTriggers: v.titleStructure?.emotionalTriggers,
    thumbnailStyle: v.thumbnailDesign?.visualComplexity,
    thumbnailColors: v.thumbnailDesign?.colorAndContrast,
    thumbnailText: v.thumbnailDesign?.textOverlay,
    thumbnailSynergy: v.thumbnailDesign?.titleThumbnailSynergy,
    patternInterrupts: v.retentionMechanics?.patternInterrupts,
    primaryEmotions: v.emotionalTriggers?.primaryEmotions,
    emotionalArc: v.emotionalTriggers?.emotionalArc,
    targetViewer: v.audienceTargeting?.primaryTargetViewer,
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
    max_tokens: 5000,
    system:
      'You are a YouTube content strategy expert. Respond ONLY with valid JSON, no markdown fences, no prose.',
    messages: [
      {
        role: 'user',
        content: `Synthesise a replication-ready channel strategy profile from these ${videoAnalyses.length} detailed video analyses. A creator wants to model their channel on this one — give them a concrete playbook.

VIDEO ANALYSES:
${JSON.stringify(summaries, null, 2)}

Return ONLY valid JSON:
{
  "channelOverview": "3-sentence strategic summary of what makes this channel work",
  "contentPillars": ["Pillar 1: specific theme with angle", "Pillar 2", "Pillar 3"],
  "titleFormulas": ["Formula 1 with example: e.g. 'The [NOUN] That [VERB]ed [TARGET] — The Zodiac Killer That Vanished'", "Formula 2"],
  "hookStrategies": ["Strategy 1: specific technique with example", "Strategy 2", "Strategy 3"],
  "scriptStructureTemplate": {
    "intro": "Precise description of how the first 60 seconds are typically structured",
    "body": "How main content is organised, paced, and delivered",
    "outro": "How videos typically end — CTA style and wrap-up approach"
  },
  "visualBrand": {
    "thumbnailStyle": "Specific repeatable thumbnail formula this channel uses",
    "colorScheme": "Brand colours with purpose",
    "typography": "Text style and placement pattern",
    "faceInThumbnail": true
  },
  "audienceProfile": {
    "demographics": "Specific age range, background, what they are seeking",
    "painPoints": ["Specific pain 1", "Specific pain 2"],
    "desiredOutcomes": ["What they want to feel/know/have after watching 1", "Outcome 2"]
  },
  "uniqueValueProposition": "What this channel delivers that most channels in the niche do not",
  "engagementPatterns": ["Specific pattern 1", "Pattern 2", "Pattern 3"],
  "contentStyle": {
    "tone": "Specific tonal description",
    "energy": "Energy level and delivery style",
    "expertise": "Knowledge level assumed and demonstrated"
  },
  "videoLength": {
    "typical": "Duration range in minutes",
    "reasoning": "Why this length serves this audience and content type"
  },
  "replicationFormula": "Step-by-step formula someone could follow to create a video in this channel's exact style",
  "thingsToSteal": ["Most impactful technique to adopt 1", "Technique 2", "Technique 3", "Technique 4", "Technique 5"]
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
  };

  const response = await ai.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system:
      'You are an expert YouTube scriptwriter. Respond ONLY with valid JSON, no markdown code blocks, no prose.',
    messages: [
      {
        role: 'user',
        content: `Create a complete YouTube video script modelled on this channel's proven strategy.

CHANNEL STRATEGY:
${JSON.stringify(strategy, null, 2)}

SCRIPT PARAMETERS:
Topic: ${topic}
Target Audience: ${targetAudience || analysis.channelInsights.audienceProfile.demographics}
Video Length: ${settings.videoLength} minutes
Narration Speed: ${settings.wpm} words per minute
Target Word Count: ${settings.targetWordCount} words (±10%)
Additional Instructions: ${additionalInstructions || 'None'}

INSTRUCTIONS:
- Follow the channel's title formula, hook strategy, script structure template, and content style exactly
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
  granularity = 2
): Promise<{
  result: {
    imagePrompts?: string[];
    imagePromptExcerpts?: string[];
    videoPrompts?: string[];
    videoPromptExcerpts?: string[];
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
  const narrationSentences = (scene.narration || '')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
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
  const promptObj = `{ "prompt": "detailed prompt text", "excerpt": "verbatim narration this segment covers" }`;

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
    system: 'You are an expert YouTube content creator. Respond ONLY with valid JSON, no markdown.',
    messages: [
      {
        role: 'user',
        content: `Generate: ${wantedParts.join(', ')}

SCENE:
Title: ${scene.title}
Full Narration: ${scene.narration}
Visual Description: ${scene.sceneDescription}
Duration: ~${estimatedSeconds}s

NARRATION PRE-DIVIDED INTO ${chunks} SEQUENTIAL SEGMENTS (all asset types use these same segments):
${narrationChunks.map((c, i) => `[${i + 1}] "${c}"`).join('\n')}

CHANNEL VISUAL DNA (match this exactly):
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
- Graphics/text overlays: ${analysis.videoAnalyses[0].visualStyleEditing.graphicsAndText}
- Emotional triggers used: ${analysis.videoAnalyses[0].emotionalTriggers.primaryEmotions.join(', ')}` : ''}

INSTRUCTIONS:
- The narration is already divided into ${chunks} segments above — do NOT re-divide it yourself.
- ALL asset types (imagePrompts, videoPrompts, stockPhotoQueries, realImageQueries, stockVideoQueries): produce EXACTLY ${chunks} items, one per segment [1]–[${chunks}] in order.
- "excerpt" for each item MUST be copied verbatim from the corresponding pre-divided segment above (item i → segment [i+1]).

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
  const unpack = (arr: Array<{ prompt: string; excerpt: string }> | string[] | undefined) => {
    if (!arr?.length) return { prompts: undefined, excerpts: undefined };
    if (typeof arr[0] === 'string') return { prompts: arr as string[], excerpts: narrationChunks.length ? narrationChunks : undefined };
    const objs = arr as Array<{ prompt: string; excerpt: string }>;
    return {
      prompts: objs.map(o => o.prompt),
      excerpts: objs.map((o, i) => narrationChunks[i] ?? o.excerpt),
    };
  };

  const img = unpack(parsed.imagePrompts);
  const vid = unpack(parsed.videoPrompts);

  return {
    result: {
      imagePrompts: img.prompts,
      imagePromptExcerpts: img.excerpts,
      videoPrompts: vid.prompts,
      videoPromptExcerpts: vid.excerpts,
      stockUrl: parsed.stockUrl,
      stockPhotoQueries: parsed.stockPhotoQueries,
      realImageQueries: parsed.realImageQueries,
      stockVideoQueries: parsed.stockVideoQueries,
    },
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
