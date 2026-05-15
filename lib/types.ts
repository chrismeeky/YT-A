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
  sentenceStructure: string;       // rhythm and length patterns
  vocabularyLevel: string;         // register, technicality, accessibility
  directnessLevel: string;         // command-style, conversational, narrative, academic
  rhetoricalDevices: string[];     // devices with descriptions of how they're used
  paceAndRhythm: string;           // how language density and speed modulate across the video
  voiceAndPersonality: string;     // the distinct creator persona and what makes it recognisable
  openingFormula: string;          // the exact mechanical pattern used to open scripts, with a concrete structural example
  signatureExpressions?: string[]; // representative language patterns native to this channel — not copied quotes, but structural examples that show vocabulary, rhythm, and tone in action
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

export type ContentNature = 'fictional' | 'non-fictional' | 'mixed';

export interface ChannelInsights {
  channelOverview: string;
  contentPillars: string[];
  titleFormulas: string[];
  hookStrategies: string[];
  scriptStructureTemplate: ScriptStructureTemplate;
  visualBrand: VisualBrand;
  audienceProfile: AudienceProfile;
  uniqueValueProposition: string;
  engagementPatterns: string[];
  contentStyle: ContentStyle;
  writingStyle?: WritingStyle;
  contentNature?: {
    classification: ContentNature;
    reasoning: string; // why this classification was chosen
  };
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
  pexelsApiKey: '',
  braveApiKey: '',
  realImageProvider: 'brave',
  youtubeApiKey: '',
  defaultVideoLength: 5,
  defaultWpm: 150,
  storagePath: '',
};
