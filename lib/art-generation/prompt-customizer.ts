/**
 * Multi-Model Prompt Customization System
 * 
 * Different models have different strengths and prompt preferences.
 * This system adapts prompts per model to get the best results.
 */

import { FalImageModel, ModelCategory } from '../fal-models';

export interface ArticleContext {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  excerpt?: string;
  category?: string;  // tech, story, guide, etc.
}

export interface ModelPromptConfig {
  /** Base style prefix for this model */
  stylePrefix: string;
  /** Style suffix */
  styleSuffix: string;
  /** Quality boosters that work well with this model */
  qualityBoosters: string[];
  /** Negative prompt if supported */
  negativePrompt?: string;
  /** Whether to include article keywords */
  includeKeywords: boolean;
  /** Max prompt length (some models have limits) */
  maxPromptLength?: number;
  /** Custom transformation function */
  transformPrompt?: (base: string, context: ArticleContext) => string;
}

// ═══════════════════════════════════════════════════════════════
// MODEL-SPECIFIC PROMPT CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

const PROMPT_CONFIGS: Record<string, Partial<ModelPromptConfig>> = {
  // FLUX models - prefer clean, descriptive prompts
  'fal-ai/flux/schnell': {
    stylePrefix: 'Cinematic wide shot,',
    styleSuffix: ', volumetric lighting, atmospheric depth, professional photography',
    qualityBoosters: ['8k resolution', 'highly detailed', 'sharp focus'],
    includeKeywords: true,
  },
  
  'fal-ai/flux/dev': {
    stylePrefix: 'Award-winning digital art,',
    styleSuffix: ', masterful composition, dramatic lighting, cinematic atmosphere',
    qualityBoosters: ['ultra detailed', 'professional quality', 'stunning visuals'],
    includeKeywords: true,
  },
  
  'fal-ai/flux-2-max': {
    stylePrefix: 'Hyperrealistic digital masterpiece,',
    styleSuffix: ', gallery quality, perfect lighting, incredible detail',
    qualityBoosters: ['photorealistic', '16k', 'award winning'],
    includeKeywords: true,
  },
  
  'fal-ai/flux-2/turbo': {
    stylePrefix: 'Dynamic digital art,',
    styleSuffix: ', vivid colors, professional quality',
    qualityBoosters: ['sharp', 'detailed'],
    includeKeywords: true,
  },
  
  // Imagen models - excellent with natural language
  'fal-ai/imagen4/preview': {
    stylePrefix: 'A stunning photograph of',
    styleSuffix: '. Shot on a high-end camera with perfect lighting and composition.',
    qualityBoosters: ['photorealistic', 'professional photography', 'magazine quality'],
    includeKeywords: false,
  },
  
  'fal-ai/imagen4/preview/ultra': {
    stylePrefix: 'An extraordinary photograph capturing',
    styleSuffix: '. Masterful composition, perfect exposure, gallery-worthy image.',
    qualityBoosters: ['award-winning photography', 'museum quality'],
    includeKeywords: false,
  },
  
  'fal-ai/imagen3': {
    stylePrefix: 'High quality image of',
    styleSuffix: ', professional photography, excellent lighting',
    qualityBoosters: ['detailed', 'sharp focus', 'high resolution'],
    includeKeywords: false,
  },
  
  // Ideogram - verified working
  'fal-ai/ideogram/v2': {
    stylePrefix: 'Digital illustration with',
    styleSuffix: ', clean design, professional look',
    qualityBoosters: ['sharp text', 'clear graphics'],
    includeKeywords: true,
  },
  
  // Recraft - verified working
  'fal-ai/recraft-v3': {
    stylePrefix: 'Professional digital illustration,',
    styleSuffix: ', vector art style, clean lines, modern design aesthetic',
    qualityBoosters: ['graphic design quality', 'polished', 'professional'],
    includeKeywords: true,
  },
  
  // Aura Flow - experimental
  'fal-ai/aura-flow': {
    stylePrefix: 'Flowing artistic visualization of',
    styleSuffix: ', smooth gradients, organic forms, ethereal quality',
    qualityBoosters: ['soft lighting', 'elegant', 'refined'],
    includeKeywords: true,
  },
  
  // Stable Cascade - experimental
  'fal-ai/stable-cascade': {
    stylePrefix: 'High-fidelity digital art of',
    styleSuffix: ', rich details, vibrant rendering, professional quality',
    qualityBoosters: ['ultra detailed', 'coherent', 'high quality'],
    negativePrompt: 'blurry, low quality, artifacts',
    includeKeywords: true,
  },
  
  // PixArt Sigma - experimental
  'fal-ai/pixart-sigma': {
    stylePrefix: 'Artistic digital creation of',
    styleSuffix: ', creative style, unique aesthetic, detailed',
    qualityBoosters: ['artistic', 'imaginative', 'quality'],
    includeKeywords: true,
  },
  
  // Stable Diffusion variants - flexible with negative prompts
  'fal-ai/fast-sdxl': {
    stylePrefix: 'Stunning digital art of',
    styleSuffix: ', highly detailed, professional quality, sharp focus',
    qualityBoosters: ['8k', 'trending on artstation', 'masterpiece'],
    negativePrompt: 'blurry, low quality, distorted, ugly, bad anatomy, watermark, text, logo',
    includeKeywords: true,
  },
  
  'fal-ai/stable-diffusion-v35-large': {
    stylePrefix: 'Exceptional digital artwork depicting',
    styleSuffix: ', intricate details, professional lighting, stunning composition',
    qualityBoosters: ['best quality', 'highly detailed', 'sharp'],
    negativePrompt: 'worst quality, low quality, blurry, jpeg artifacts, watermark, signature',
    includeKeywords: true,
  },
  
  'fal-ai/fast-lightning-sdxl': {
    stylePrefix: 'Digital art,',
    styleSuffix: ', detailed, quality',
    qualityBoosters: ['sharp', 'clear'],
    negativePrompt: 'blurry, ugly, bad',
    includeKeywords: false,
  },
  
  // Artistic/stylized models
  'fal-ai/dreamshaper': {
    stylePrefix: 'Fantasy digital painting of',
    styleSuffix: ', dreamlike atmosphere, magical lighting, ethereal beauty',
    qualityBoosters: ['artstation', 'fantasy art', 'mystical'],
    negativePrompt: 'ugly, tiling, poorly drawn hands, out of frame, mutation, blurry',
    includeKeywords: true,
  },
  
  'fal-ai/playground-v25': {
    stylePrefix: 'Vibrant creative artwork showing',
    styleSuffix: ', rich colors, dynamic composition, artistic flair',
    qualityBoosters: ['colorful', 'expressive', 'bold'],
    negativePrompt: 'dull, boring, low contrast',
    includeKeywords: true,
  },
  
  'fal-ai/kolors': {
    stylePrefix: 'Colorful artistic interpretation of',
    styleSuffix: ', bold palette, striking visuals, artistic style',
    qualityBoosters: ['vivid', 'saturated', 'eye-catching'],
    negativePrompt: 'monochrome, dull, washed out',
    includeKeywords: true,
  },
  
  // Photorealistic models
  'fal-ai/realistic-vision': {
    stylePrefix: 'Photorealistic image of',
    styleSuffix: ', natural lighting, sharp focus, high resolution photograph',
    qualityBoosters: ['RAW photo', 'film grain', 'professional'],
    negativePrompt: 'cartoon, illustration, painting, drawing, artificial, fake',
    includeKeywords: false,
  },
  
  'fal-ai/luma-photon': {
    stylePrefix: 'Cinematic photograph of',
    styleSuffix: ', studio lighting, high production value',
    qualityBoosters: ['photographic', 'cinematic', 'professional'],
    includeKeywords: false,
  },
  
  // Chinese/Asian models
  'fal-ai/hunyuan-image/v3/text-to-image': {
    stylePrefix: 'Exquisite digital art,',
    styleSuffix: ', refined aesthetics, harmonious composition, masterful technique',
    qualityBoosters: ['ultra high quality', 'best quality', 'detailed'],
    negativePrompt: 'low quality, worst quality, blurry, watermark',
    includeKeywords: true,
  },
  
  'fal-ai/cogview4': {
    stylePrefix: 'High quality digital creation,',
    styleSuffix: ', professional finish, excellent detail',
    qualityBoosters: ['detailed', 'high resolution'],
    negativePrompt: 'low quality, blurry',
    includeKeywords: true,
  },
  
  // Unique/experimental models
  'fal-ai/bagel': {
    stylePrefix: 'Unique artistic visualization of',
    styleSuffix: ', creative interpretation, distinctive style',
    qualityBoosters: ['artistic', 'creative', 'unique'],
    includeKeywords: true,
  },
  
  'fal-ai/gpt-image-1': {
    stylePrefix: 'A detailed image of',
    styleSuffix: ', high quality, clear and well-composed',
    qualityBoosters: ['detailed', 'professional'],
    includeKeywords: false,
  },
  
  'fal-ai/minimax/image-01': {
    stylePrefix: 'Professional quality image of',
    styleSuffix: ', excellent composition, high detail',
    qualityBoosters: ['high quality', 'detailed', 'sharp'],
    includeKeywords: true,
  },
};

// Default config for models not explicitly configured
const DEFAULT_CONFIG: ModelPromptConfig = {
  stylePrefix: 'High quality digital art,',
  styleSuffix: ', professional quality, detailed, well-composed',
  qualityBoosters: ['detailed', 'high quality'],
  includeKeywords: true,
};

// ═══════════════════════════════════════════════════════════════
// ARTICLE-SPECIFIC VISUAL THEMES
// ═══════════════════════════════════════════════════════════════

interface VisualTheme {
  primaryElements: string[];
  atmosphere: string[];
  colorPalette: string[];
  composition: string[];
}

const ARTICLE_THEMES: Record<string, VisualTheme> = {
  // Tech horror / sci-fi disaster stories
  'tech-horror': {
    primaryElements: [
      'abandoned server room with flickering lights',
      'corrupted holographic display glitching',
      'AI neural network visualization fracturing',
      'malfunctioning robot in industrial setting',
      'data center in catastrophic failure',
    ],
    atmosphere: ['ominous', 'tense', 'apocalyptic', 'eerie', 'foreboding'],
    colorPalette: ['deep crimson', 'electric blue', 'warning orange', 'toxic green', 'void black'],
    composition: ['dutch angle', 'dramatic perspective', 'silhouette', 'stark contrast'],
  },
  
  // AI/ML technical content
  'ai-tech': {
    primaryElements: [
      'neural network visualization with glowing nodes',
      'abstract data flow through geometric shapes',
      'futuristic command center with holograms',
      'quantum computer core with light beams',
      'robotic arm performing precise operation',
    ],
    atmosphere: ['innovative', 'cutting-edge', 'sophisticated', 'precise', 'powerful'],
    colorPalette: ['electric cyan', 'deep purple', 'gold accents', 'clean white', 'steel blue'],
    composition: ['symmetrical', 'centered', 'clean lines', 'minimalist'],
  },
  
  // Business/strategy content
  'business': {
    primaryElements: [
      'futuristic boardroom with holographic charts',
      'city skyline with digital overlay',
      'abstract growth visualization',
      'strategic chess pieces with tech elements',
      'interconnected global network visualization',
    ],
    atmosphere: ['professional', 'ambitious', 'forward-thinking', 'decisive', 'powerful'],
    colorPalette: ['navy blue', 'gold', 'silver', 'white', 'accent red'],
    composition: ['balanced', 'professional', 'clean', 'corporate'],
  },
  
  // R3F/3D development content
  'r3f-dev': {
    primaryElements: [
      'wireframe 3D scene with glowing edges',
      'floating geometric primitives in void',
      'shader visualization with color gradients',
      'virtual reality headset reflecting code',
      'abstract 3D mesh being constructed',
    ],
    atmosphere: ['creative', 'technical', 'immersive', 'dimensional', 'dynamic'],
    colorPalette: ['neon pink', 'electric blue', 'bright green', 'purple', 'white grid lines'],
    composition: ['depth', 'layers', 'perspective', 'floating elements'],
  },
  
  // Backstory/narrative content
  'narrative': {
    primaryElements: [
      'lone figure silhouetted against massive display',
      'time-lapse of technology evolution',
      'researcher in lab with breakthrough moment',
      'mysterious artifact in scientific setting',
      'pivotal moment captured dramatically',
    ],
    atmosphere: ['dramatic', 'pivotal', 'emotional', 'historic', 'momentous'],
    colorPalette: ['warm amber', 'cool blue', 'dramatic shadows', 'spotlight white'],
    composition: ['cinematic', 'story-driven', 'emotional focus', 'dramatic lighting'],
  },
  
  // Default/generic
  'default': {
    primaryElements: [
      'abstract technological visualization',
      'futuristic digital landscape',
      'data streams in artistic form',
      'modern tech aesthetic',
      'innovation concept visualization',
    ],
    atmosphere: ['modern', 'innovative', 'clean', 'professional', 'inspiring'],
    colorPalette: ['tech blue', 'clean white', 'accent orange', 'subtle gray'],
    composition: ['balanced', 'clean', 'professional', 'engaging'],
  },
};

// ═══════════════════════════════════════════════════════════════
// PROMPT GENERATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Detect article theme from context
 */
export function detectArticleTheme(context: ArticleContext): keyof typeof ARTICLE_THEMES {
  const text = `${context.title} ${context.description} ${context.keywords.join(' ')}`.toLowerCase();
  
  // Check for tech horror indicators
  if (text.match(/incident|failure|catastrophe|disaster|malfunction|outbreak|collapse|horror|2\d{3}/)) {
    return 'tech-horror';
  }
  
  // Check for R3F/3D development
  if (text.match(/r3f|three\.?js|3d|webgl|shader|mesh|geometry|canvas|scene/)) {
    return 'r3f-dev';
  }
  
  // Check for AI/ML technical
  if (text.match(/neural|ai|ml|model|training|inference|llm|gpt|transformer/)) {
    return 'ai-tech';
  }
  
  // Check for narrative/backstory
  if (text.match(/backstory|chapter|story|journey|chronicle|memoir/)) {
    return 'narrative';
  }
  
  // Check for business/strategy
  if (text.match(/strategy|business|executive|leadership|roadmap|framework/)) {
    return 'business';
  }
  
  return 'default';
}

/**
 * Generate a unique visual concept for an article
 */
export function generateVisualConcept(context: ArticleContext, variationSeed: number = 0): string {
  const theme = detectArticleTheme(context);
  const themeConfig = ARTICLE_THEMES[theme];
  
  // Use seed to pick consistent but varied elements
  const seed = hashString(context.slug) + variationSeed;
  const random = seededRandom(seed);
  
  const element = themeConfig.primaryElements[Math.floor(random() * themeConfig.primaryElements.length)];
  const atmosphere = themeConfig.atmosphere[Math.floor(random() * themeConfig.atmosphere.length)];
  const color1 = themeConfig.colorPalette[Math.floor(random() * themeConfig.colorPalette.length)];
  const color2 = themeConfig.colorPalette[Math.floor(random() * themeConfig.colorPalette.length)];
  const composition = themeConfig.composition[Math.floor(random() * themeConfig.composition.length)];
  
  // Build concept incorporating article specifics
  const titleWords = context.title.split(' ').slice(0, 4).join(' ');
  
  return `${element}, representing "${titleWords}", ${atmosphere} mood, ${color1} and ${color2} color scheme, ${composition} composition`;
}

/**
 * Build a model-optimized prompt
 */
export function buildModelPrompt(
  modelId: string,
  context: ArticleContext,
  variationSeed: number = 0
): { prompt: string; negativePrompt?: string } {
  const config = { ...DEFAULT_CONFIG, ...(PROMPT_CONFIGS[modelId] || {}) };
  
  // Generate base visual concept
  const baseConcept = generateVisualConcept(context, variationSeed);
  
  // Build prompt parts
  const parts: string[] = [];
  
  // Style prefix
  parts.push(config.stylePrefix);
  
  // Base concept
  parts.push(baseConcept);
  
  // Include keywords if configured
  if (config.includeKeywords && context.keywords.length > 0) {
    const keywordStr = context.keywords.slice(0, 3).join(', ');
    parts.push(`themes of ${keywordStr}`);
  }
  
  // Style suffix
  parts.push(config.styleSuffix);
  
  // Quality boosters
  if (config.qualityBoosters.length > 0) {
    parts.push(config.qualityBoosters.join(', '));
  }
  
  let prompt = parts.join(' ').replace(/\s+/g, ' ').trim();
  
  // Apply custom transformation if defined
  if (config.transformPrompt) {
    prompt = config.transformPrompt(prompt, context);
  }
  
  // Truncate if needed
  if (config.maxPromptLength && prompt.length > config.maxPromptLength) {
    prompt = prompt.substring(0, config.maxPromptLength - 3) + '...';
  }
  
  return {
    prompt,
    negativePrompt: config.negativePrompt,
  };
}

/**
 * Get prompt config for a model
 */
export function getModelPromptConfig(modelId: string): ModelPromptConfig {
  return { ...DEFAULT_CONFIG, ...(PROMPT_CONFIGS[modelId] || {}) };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Export theme types
export type ArticleTheme = keyof typeof ARTICLE_THEMES;
export { ARTICLE_THEMES, PROMPT_CONFIGS };
