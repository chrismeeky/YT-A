// ─── Projects ──────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

// ─── YouTube / Channel ──────────────────────────────────────────────────────

export interface ChannelVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  duration: string;
  viewCount: number;
  uploadDate: string;
  description: string;
  channelName: string;
}

// ─── Analysis — 18 Dimensions ──────────────────────────────────────────────

export interface VideoAnalysis {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  thumbnail: string;
  channelName: string;
  transcriptExcerpt?: string;  // body setup: 15–30% of transcript
  transcriptHook?: string;     // opening: first ~800 chars
  transcriptClimax?: string;   // peak tension: 60–75% of transcript
  transcriptOutro?: string;    // closing: last ~600 chars

  // 1. Topic & Positioning
  topicPositioning: {
    coreIdea: string;
    nicheSpecificity: string;
    angle: string;
    competitivePosition: string;
  };

  // 2. Hook
  hook: {
    type: string;
    openingLines: string;
    clarity: string;
    retentionIntent: string;
    createsOpenLoop: boolean;
    openLoopDescription: string;
  };

  // 3. Title Structure
  titleStructure: {
    keywords: string[];
    emotionalTriggers: string[];
    formatPattern: string;
    searchIntentAlignment: string;
  };

  // 4. Thumbnail Design
  thumbnailDesign: {
    visualComplexity: string;
    facialExpression: string;
    colorAndContrast: string;
    textOverlay: string;
    curiosityGapAlignment: string;
    titleThumbnailSynergy: string;
    effectivenessRating: number;
  };

  // 5. Content Structure
  contentStructure: {
    segments: string[];
    usesCarryForwardLoops: boolean;
    loopMechanism: string;
    newStimulusFrequency: string;
    overallFlowRating: number;
  };

  // 6. Retention Mechanics
  retentionMechanics: {
    patternInterrupts: string[];
    visualChangeFrequency: string;
    storyProgressionStyle: string;
    mainDropOffRisk: string;
    retentionStrengths: string[];
  };

  // 7. Script & Language
  scriptAndLanguage: {
    sentenceStyle: string;
    technicalDepth: string;
    directnessLevel: string;
    rhetoricalDevices: string[];
    standoutPhrases: string[];
    languageScore: number;
  };

  // 8. Emotional Triggers
  emotionalTriggers: {
    primaryEmotions: string[];
    emotionalArc: string;
    intensityProgression: string;
    payoffQuality: string;
    emotionalScore: number;
  };

  // 9. Visual Style & Editing
  visualStyleEditing: {
    inferredCameraStyle: string;
    brollEstimate: string;
    graphicsAndText: string;
    editingPace: string;
    brandingConsistency: string;
  };

  // 10. Audio Design
  audioDesign: {
    voiceToneAndClarity: string;
    backgroundMusicStyle: string;
    soundDesignRole: string;
    audioProductionLevel: string;
  };

  // 11. Pacing
  pacing: {
    narrativeSpeed: string;
    ideaDensity: string;
    breathingRoom: string;
    pacingScore: number;
  };

  // 12. Call-to-Action
  callToAction: {
    ctaPlacements: string[];
    ctaTypes: string[];
    frictionLevel: string;
    integrationQuality: string;
  };

  // 13. Audience Targeting
  audienceTargeting: {
    primaryTargetViewer: string;
    assumedKnowledgeLevel: string;
    demographicSignals: string[];
    communityIdentityMarkers: string[];
  };

  // 14. Engagement Signals
  engagementSignals: {
    predictedCommentTypes: string[];
    shareabilityFactors: string[];
    communityBuildingElements: string[];
    engagementPotentialScore: number;
  };

  // 15. Algorithm Fit
  algorithmFit: {
    watchTimePotential: string;
    ctrDrivers: string[];
    sessionContinuationStrategy: string;
    algorithmScore: number;
  };

  // 16. Monetization Strategy
  monetizationStrategy: {
    directMonetization: string[];
    indirectMonetization: string[];
    revenueModelAssessment: string;
  };

  // 17. Consistency & Channel Strategy
  channelConsistency: {
    formatRepeatability: string;
    seriesOrEpisodicNature: string;
    uploadFrequencyImplication: string;
  };

  // 18. Differentiation
  differentiation: {
    uniqueElements: string[];
    vsCompetitors: string;
    voiceAndPersonality: string;
    defensibleAdvantage: string;
  };

  // Overall scores
  overallScores: {
    hookStrength: number;
    retentionPotential: number;
    productionValue: number;
    algorithmOptimization: number;
    scriptQuality: number;
    thumbnailEffectiveness: number;
    overall: number;
    keyStrengths: string[];
    keyWeaknesses: string[];
    topRecommendation: string;
  };
}

// ─── Channel Synthesis ─────────────────────────────────────────────────────

export interface ContentStyle {
  tone: string;
  energy: string;
  expertise: string;
}

export interface WritingStyle {
  sentenceStructure: string;
  vocabularyLevel: string;
  directnessLevel: string;
  rhetoricalDevices: string[];
  paceAndRhythm: string;
  voiceAndPersonality: string;
  openingFormula: string;
  bodySceneOpenings?: string;
  sceneTransitionLanguage?: string;
  signatureExpressions?: string[];
  proseFingerprint?: string;    // prose quality: show vs tell, editorial restraint, vocabulary precision, forbidden moves
  // Quantitative voice fingerprint
  avgSentenceLengthWords?: number;
  sentenceLengthVariance?: string;
  directAddressFrequency?: string;
  rhetoricalQuestionRate?: string;
  readingLevel?: string;
  beatLength?: string;
  microRhythmBlueprint?: string;
}

export interface VisualSceneGuide {
  sceneDescriptionStyle: string; // how to write scene descriptions for this channel
  brollPattern: string;          // what the channel cuts to during narration
  editingRhythm: string;         // pace and triggers of visual cuts
  graphicsAndTextUsage: string;  // when/how on-screen text and graphics are used
  audioMood: string;             // background music and sound design character
  cutRateShotsPerMinute?: number; // average distinct shots per minute across this channel's videos
}

export interface VisualBrand {
  thumbnailStyle: string;
  colorScheme: string;
  typography: string;
  faceInThumbnail: boolean;
  productionStyle: string; // the visual medium — e.g. "Pixar-style 3D CGI animation", "photorealistic documentary", "hand-drawn 2D animation"
}

export interface AudienceProfile {
  demographics: string;
  painPoints: string[];
  desiredOutcomes: string[];
}

export interface ScriptStructureTemplate {
  intro: string;
  body: string;
  outro: string;
  loopMechanism?: string; // how carry-forward loops are constructed between scenes, if used
}

export interface NarrativeStructure {
  hookAnchorType: string;           // what the FIRST sentence anchors on — physical object, in-progress moment, ironic contrast, pattern/trend, question
  hookNameRevealTiming: string;     // when/how the central subject's name or identity first appears — immediate, withheld X words, revealed via specific formula
  hookCloseFormula: string;         // how hooks close before moving into the story body — stakes, scale, time span, question, promise
  backstoryBlueprint: string;       // how this channel structures backstory/origin sections: what information appears and in what order
  settingFunctionBlueprint: string; // whether settings serve as atmosphere/mood OR as mechanisms/systems — and the structural formula used
  subjectIntroBlueprint: string;    // how individual people (subjects, guests, case studies, etc.) are introduced: what data points and in what order
  institutionalBeat?: string;       // does this channel use a beat involving organisations, systems, or processes (success/failure/irony)? How is it structured?
  bodySceneTypeFormulas?: string;   // additional scene-type structural formulas specific to this channel's content type
}

export type ContentNature = 'fictional' | 'non-fictional' | 'mixed';

export interface VisualAssetMix {
  'ai-video': number;
  'ai-image': number;
  'stock-video': number;
  'stock-photo': number;
  'real-image': number;
  reasoning: string; // 1-sentence explanation of the mix
}

export interface OpenLoopProfile {
  peakSimultaneousLoops: number;
  avgResolutionPoint: string;
  loopTypes: string[];
}

export interface ChannelInsights {
  channelOverview: string;
  contentPillars: string[];
  titleFormulas: string[];
  hookStrategies: string[];
  scriptStructureTemplate: ScriptStructureTemplate;
  visualBrand: VisualBrand;
  visualSceneGuide?: VisualSceneGuide;
  visualAssetMix?: VisualAssetMix;
  audienceProfile: AudienceProfile;
  uniqueValueProposition: string;
  engagementPatterns: string[];
  contentStyle: ContentStyle;
  writingStyle?: WritingStyle;
  contentNature?: {
    classification: ContentNature;
    reasoning: string;
  };
  narrativeLens?: string;        // who the camera stays on and why — the channel's primary subject and perspective
  narrativeStructure?: NarrativeStructure; // structural blueprints: hook architecture, scene-type formulas, setting function, subject intro pattern
  voiceExcerpts?: string[];      // 2-3 verbatim transcript passages (200-300 words) showing the channel's actual voice
  openLoopProfile?: OpenLoopProfile;
  videoLength: { typical: string; reasoning: string };
  replicationFormula: string;
  thingsToSteal: string[];
}

export interface Analysis {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  channelUrl: string;
  channelName: string;
  videoAnalyses: VideoAnalysis[];
  channelInsights: ChannelInsights;
}

// ─── Scripts ───────────────────────────────────────────────────────────────

export interface MediaFile {
  id: string;
  type: 'image' | 'video' | 'audio';
  filename: string;
  originalName: string;
  uploadedAt: string;
  absolutePath?: string;
}

export interface StockPhoto {
  id: string;
  thumb: string;
  full: string;
  pageUrl: string;
  photographer: string;
  alt: string;
}

export interface RealImage {
  title: string;
  thumb: string;
  full: string;
  sourceUrl: string;
}

export interface StockPhotoSegment {
  query: string;
  narrationExcerpt: string;
  photos: StockPhoto[];
}

export interface RealImageSegment {
  query: string;
  narrationExcerpt: string;
  images: RealImage[];
}

export interface StockVideo {
  id: string;
  thumb: string;
  previewUrl: string;
  sdUrl: string;
  pageUrl: string;
  duration: number;
  user: string;
}

export interface StockVideoSegment {
  query: string;
  narrationExcerpt: string;
  videos: StockVideo[];
}

export type PromptDetail = 'auto' | 'brief' | 'standard' | 'detailed' | 'verbose';

export interface Scene {
  id: string;
  number: number;
  title: string;
  narration: string;
  sceneDescription: string;
  estimatedDurationSeconds: number;
  wordCount: number;

  includeImagePrompt: boolean;
  includeVideoPrompt: boolean;
  includeStockUrl: boolean;
  includeStockPhotos: boolean;
  includeRealImages: boolean;
  includeStockVideos: boolean;
  assetGranularity?: number; // 1=Minimal 2=Balanced 3=Detailed 4=Cinematic
  promptDetail?: PromptDetail; // Controls prompt verbosity; undefined = 'auto'

  imagePrompts?: string[];
  imagePromptExcerpts?: string[];
  videoPrompts?: string[];
  videoPromptExcerpts?: string[];
  videoPromptIsExtension?: boolean[]; // parallel to videoPrompts; true = AI-generated continuation
  videoPromptPriorVersions?: (string | null)[]; // parallel to videoPrompts; stores pre-tweak original for revert
  stockUrl?: string;
  stockPhotoSegments?: StockPhotoSegment[];
  realImageSegments?: RealImageSegment[];
  stockVideoSegments?: StockVideoSegment[];

  videoPromptFingerprints?: string[]; // compact visual tags parallel to videoPrompts — cross-scene variety
  imagePromptFingerprints?: string[]; // compact visual tags parallel to imagePrompts

  audioFile?: string;
  mediaFiles: MediaFile[];
  directorMediaFiles?: MediaFile[];  // separate from regular mediaFiles — used only in Director mode
  directorSegments?: DirectorSegment[]; // generated at script-creation time in director mode; replaces directorPlan lookup
}

export interface ScriptSettings {
  videoLength: number;
  wpm: number;
  targetWordCount: number;
}

// ─── Character Sheets ───────────────────────────────────────────────────────

export interface CharacterSheet {
  id: string;
  name: string;
  // Physical description
  age?: string;
  gender?: string;
  ethnicity?: string;
  height?: string;
  build?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  facialFeatures?: string;
  // Style & clothing
  typicalOutfit?: string;
  styleNotes?: string;
  // Full narrative description (used in prompts)
  fullDescription: string;
  // How the sheet was created
  generatedFrom: 'text' | 'image';
  // Thumbnail of the source image (base64 data URL), if created from image
  sourceThumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedCharacter {
  name: string;
  count: number;
}

// ─── Director Mode ──────────────────────────────────────────────────────────

export type DirectorAssetType = 'ai-video' | 'ai-image' | 'stock-video' | 'stock-photo' | 'real-image';

export interface DirectorAsset {
  id: string;
  rank: number;
  type: DirectorAssetType;
  rationale: string;
  searchQuery?: string;   // for stock-video, stock-photo, real-image
  prompts: string[];      // empty until lazily generated (ai-video / ai-image)
  clipLabels?: ('CUT' | 'CONTINUOUS' | null)[];  // parallel to prompts; null = unknown
  durationEach?: number;  // seconds per clip for video types
  totalDuration: number;  // total seconds recommended for this segment
  generated: boolean;
  // Multi-shot support: when a segment is long enough for multiple distinct shots
  slot?: number;          // 0-indexed shot position within the segment (undefined = single shot)
  narrationSlice?: string; // exact substring of the segment narration covered by this shot
  // For stock/real — results from search
  stockPhotos?: StockPhoto[];
  stockVideos?: StockVideo[];
  realImages?: RealImage[];
  // Visual concept variations for this asset (alternative director briefs)
  variations?: string[];
}

export interface DirectorSegment {
  id: string;
  narrationExcerpt: string;
  durationSeconds: number;
  assets: DirectorAsset[];
}

export interface DirectorScene {
  sceneId: string;
  segments: DirectorSegment[];
}

export interface Script {
  id: string;
  projectId: string;
  analysisId: string;
  title: string;
  topic: string;
  targetAudience: string;
  additionalInstructions: string;
  thumbnailConcept: string;
  youtubeDescription?: string;
  createdAt: string;
  updatedAt: string;
  settings: ScriptSettings;
  scenes: Scene[];
  characters?: CharacterSheet[];
  detectedCharacters?: DetectedCharacter[];
  visualStyle?: string; // preset tag or custom text — injected into every prompt
  savedToDisk: boolean;
  directorMode?: boolean;
  directorPlan?: DirectorScene[];
}

// ─── Research ──────────────────────────────────────────────────────────────

export interface ResearchVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
}

export interface ResearchChannel {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  customUrl: string;
  country: string;
  publishedAt: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  uploadsPlaylistId: string;
  outlierScore: number;
  avgRecentViews: number;
  recentVideos: ResearchVideo[];
}

export interface ChannelBookmark {
  channel: ResearchChannel;
  note: string;
  tags: string[];
  savedAt: string;
}

// ─── App Settings ──────────────────────────────────────────────────────────

export interface AppSettings {
  anthropicApiKey: string;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  elevenLabsSpeed: number;
  elevenLabsStability: number;
  elevenLabsSimilarity: number;
  elevenLabsStyle: number;
  cartesiaApiKey: string;
  cartesiaVoiceId: string;
  cartesiaSpeed: number;
  pexelsApiKey: string;
  braveApiKey: string;
  realImageProvider: 'brave' | 'duckduckgo';
  youtubeApiKey: string;
  defaultVideoLength: number;
  defaultWpm: number;
  storagePath: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: '',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
  elevenLabsSpeed: 1.0,
  elevenLabsStability: 0.5,
  elevenLabsSimilarity: 0.75,
  elevenLabsStyle: 0.0,
  cartesiaApiKey: '',
  cartesiaVoiceId: '',
  cartesiaSpeed: 1.0,
  pexelsApiKey: '',
  braveApiKey: '',
  realImageProvider: 'brave',
  youtubeApiKey: '',
  defaultVideoLength: 5,
  defaultWpm: 150,
  storagePath: '',
};
