export interface VisualStylePreset {
  tag: string;
  label: string;
  emoji: string;
  description: string;
  // Injected verbatim into every generated prompt as a style lock
  promptLock: string;
}

export const VISUAL_STYLE_PRESETS: VisualStylePreset[] = [
  {
    tag: 'photoreal',
    label: 'Photorealistic',
    emoji: '📷',
    description: 'Real-looking footage, natural lighting, cinematic photography',
    promptLock:
      'Photorealistic cinematic style. High-fidelity natural lighting, shot on 35mm film, 8K detail. Every frame looks like real footage or a photo-real CGI render.',
  },
  {
    tag: '3d-animated',
    label: '3D Animated',
    emoji: '🎬',
    description: 'Stylized CGI animation — Pixar / DreamWorks quality',
    promptLock:
      'Stylized 3D CGI animation — NOT photorealistic, NOT live action, NOT a photograph. Pixar / DreamWorks production quality. Every subject — people, objects, environments — is a smooth three-dimensional animated model with warm studio lighting, expressive sculpted faces, rich saturated colors, and soft-focus depth-of-field backgrounds. Include the phrase "stylized 3D CGI animation" explicitly in every image and video prompt description, and describe all elements as animated 3D renders.',
  },
  {
    tag: 'hand-drawn',
    label: 'Hand-drawn',
    emoji: '✏️',
    description: 'Studio Ghibli / classic Disney illustrated look',
    promptLock:
      'Hand-drawn 2D animation style. Studio Ghibli / classic Disney aesthetic. Painted watercolor backgrounds, expressive ink line art, visible brush strokes, layered gouache textures. Characters and environments are fully illustrated — not rendered or photographic. Every prompt must describe the scene as a 2D hand-drawn animation frame.',
  },
  {
    tag: 'anime',
    label: 'Anime',
    emoji: '⛩️',
    description: 'Cinematic anime film aesthetic',
    promptLock:
      'Cinematic anime style — the quality of a theatrical anime film (Makoto Shinkai / Ufotable). 2D cel shading, vibrant saturated palette, dramatic rim lighting, expressive anime character proportions and faces. Every prompt must describe the visual as a high-quality anime animation frame.',
  },
  {
    tag: 'documentary',
    label: 'Documentary',
    emoji: '🎥',
    description: 'Handheld, raw, cinéma vérité look',
    promptLock:
      'Documentary film aesthetic. Handheld camera feel, available natural light, candid framing, cinéma vérité quality. Raw, unpolished, not stylized. The look of a real-world documentary production.',
  },
  {
    tag: 'watercolor',
    label: 'Watercolor',
    emoji: '🎨',
    description: 'Soft painted illustration, paper texture',
    promptLock:
      'Watercolor illustration style. Soft washes of pigment, paper grain texture visible, impressionistic edges, flowing color bleeds, loose painterly strokes. Every frame should look like a high-quality watercolor painting or illustrated storybook page.',
  },
];

export const STYLE_PRESET_MAP = new Map(VISUAL_STYLE_PRESETS.map(p => [p.tag, p]));

/** Resolve a visual style tag or free-text string into the prompt lock text. */
export function resolvePromptLock(visualStyle: string | undefined): string | null {
  if (!visualStyle?.trim()) return null;
  const preset = STYLE_PRESET_MAP.get(visualStyle);
  return preset ? preset.promptLock : visualStyle; // fall back to raw custom text
}
