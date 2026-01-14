/**
 * FAL AI Image Generation Models Configuration
 * 
 * A comprehensive catalog of image generation models available on FAL AI,
 * organized for easy selection based on speed, quality, style, and cost.
 * 
 * @see https://fal.ai/models
 * @lastUpdated 2026-01-14
 */

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export type ModelCategory = 
  | 'fast' 
  | 'quality' 
  | 'balanced' 
  | 'artistic' 
  | 'text-rendering' 
  | 'photorealistic'
  | 'editing'
  | 'lora';

export type SpeedTier = 'instant' | 'fast' | 'medium' | 'slow';
export type QualityTier = 1 | 2 | 3 | 4 | 5;
export type CostTier = 'free' | 'low' | 'medium' | 'high' | 'premium';

export interface FalImageModel {
  /** Model ID used in API calls (e.g., "fal-ai/flux/schnell") */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Brief description of the model's strengths */
  description: string;
  /** Model categories for filtering */
  category: ModelCategory[];
  /** Relative speed classification */
  speedTier: SpeedTier;
  /** Quality rating 1-5 */
  qualityTier: QualityTier;
  /** Relative cost classification */
  costTier: CostTier;
  /** Whether model accepts negative_prompt parameter */
  supportsNegativePrompt: boolean;
  /** Whether model supports image-to-image */
  supportsImageToImage: boolean;
  /** Maximum supported resolution */
  maxResolution?: { width: number; height: number };
  /** Default parameters for this model */
  defaultParams: Record<string, unknown>;
  /** Approximate generation time in seconds */
  estimatedTime?: string;
}

export interface ImageSizeOption {
  width: number;
  height: number;
  label: string;
  aspectRatio: string;
}

// ═══════════════════════════════════════════════════════════════
// FAST MODELS - For quick iterations (<2 seconds)
// ═══════════════════════════════════════════════════════════════

export const FAST_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/flux/schnell',
    name: 'FLUX Schnell',
    description: 'Fastest FLUX model - excellent quality for speed. Best default choice.',
    category: ['fast', 'balanced'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~1-2s',
    defaultParams: {
      image_size: 'landscape_4_3',
      num_inference_steps: 4,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'fal-ai/flux-2/turbo',
    name: 'FLUX 2 Turbo',
    description: 'Fast FLUX 2 generation with improved quality over FLUX 1',
    category: ['fast', 'balanced'],
    speedTier: 'instant',
    qualityTier: 4,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~1.5s',
    defaultParams: {
      image_size: 'landscape_4_3',
      num_inference_steps: 4,
    },
  },
  {
    id: 'fal-ai/flux-2/flash',
    name: 'FLUX 2 Flash',
    description: 'Flash-speed FLUX 2 variant',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~2s',
    defaultParams: {
      image_size: 'landscape_4_3',
    },
  },
  {
    id: 'fal-ai/fast-sdxl',
    name: 'Fast SDXL',
    description: 'Optimized Stable Diffusion XL for speed',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~1.5s',
    defaultParams: {
      image_size: 'square_hd',
      num_inference_steps: 25,
      guidance_scale: 7.5,
    },
  },
  {
    id: 'fal-ai/fast-lightning-sdxl',
    name: 'Lightning SDXL',
    description: 'Ultra-fast lightning-distilled SDXL - cheapest option',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 2,
    costTier: 'free',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '<1s',
    defaultParams: {
      image_size: 'square_hd',
      num_inference_steps: 4,
    },
  },
  {
    id: 'fal-ai/fast-lcm-diffusion',
    name: 'Fast LCM',
    description: 'Latent Consistency Model - extremely fast diffusion',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 2,
    costTier: 'free',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '<1s',
    defaultParams: {
      num_inference_steps: 4,
    },
  },
  {
    id: 'fal-ai/hyper-sdxl',
    name: 'Hyper SDXL',
    description: 'Hyper-optimized SDXL variant',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~1.5s',
    defaultParams: {
      num_inference_steps: 4,
    },
  },
  {
    id: 'fal-ai/sana/sprint',
    name: 'SANA Sprint',
    description: 'Sprint mode for SANA model',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~1.5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/luma-photon/flash',
    name: 'Luma Photon Flash',
    description: 'Fast photorealistic generation',
    category: ['fast', 'photorealistic'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~2s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/ideogram/v2/turbo',
    name: 'Ideogram V2 Turbo',
    description: 'Fast text rendering',
    category: ['fast', 'text-rendering'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~2s',
    defaultParams: {
      magic_prompt_option: 'AUTO',
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// SOTA/QUALITY MODELS - For best results
// ═══════════════════════════════════════════════════════════════

export const QUALITY_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/flux-2-max',
    name: 'FLUX 2 Max',
    description: 'State-of-the-art quality - best FLUX model available',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'premium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~10-15s',
    defaultParams: {
      image_size: 'landscape_16_9',
      num_inference_steps: 50,
    },
  },
  {
    id: 'fal-ai/flux-2-pro',
    name: 'FLUX 2 Pro',
    description: 'Professional-grade FLUX 2',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'high',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    defaultParams: {
      image_size: 'landscape_16_9',
    },
  },
  {
    id: 'fal-ai/flux-pro/v1',
    name: 'FLUX Pro V1',
    description: 'Original FLUX Pro - proven quality',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'high',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    defaultParams: {
      image_size: 'landscape_16_9',
    },
  },
  {
    id: 'fal-ai/flux-pro/new',
    name: 'FLUX Pro New',
    description: 'Latest FLUX Pro iteration',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'high',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/imagen4/preview/ultra',
    name: 'Imagen 4 Ultra',
    description: 'Google\'s best image model - excellent photorealism',
    category: ['quality', 'photorealistic'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'premium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~15-20s',
    defaultParams: {
      aspect_ratio: '16:9',
    },
  },
  {
    id: 'fal-ai/imagen4/preview',
    name: 'Imagen 4',
    description: 'Google Imagen 4 preview',
    category: ['quality', 'photorealistic'],
    speedTier: 'medium',
    qualityTier: 5,
    costTier: 'high',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    defaultParams: {
      aspect_ratio: '16:9',
    },
  },
  {
    id: 'fal-ai/stable-diffusion-v35-large',
    name: 'SD 3.5 Large',
    description: 'Largest Stable Diffusion 3.5 model',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~8-12s',
    defaultParams: {
      num_inference_steps: 40,
      guidance_scale: 7.0,
    },
  },
  {
    id: 'fal-ai/bytedance/seedream/v4/text-to-image',
    name: 'SeedREAM V4',
    description: 'ByteDance\'s latest high-quality model',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'high',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~10-15s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/recraft-20b',
    name: 'Recraft 20B',
    description: 'Largest Recraft model for professional quality',
    category: ['quality', 'artistic'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'high',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~10-15s',
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// BALANCED MODELS - Good quality with reasonable speed
// ═══════════════════════════════════════════════════════════════

export const BALANCED_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/flux/dev',
    name: 'FLUX Dev',
    description: 'Balanced FLUX - good quality and speed. Recommended default.',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: true,
    estimatedTime: '~3-5s',
    defaultParams: {
      image_size: 'landscape_4_3',
      num_inference_steps: 28,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'fal-ai/flux-2-flex',
    name: 'FLUX 2 Flex',
    description: 'Flexible FLUX 2 with control features',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: true,
    estimatedTime: '~4-6s',
    defaultParams: {
      image_size: 'landscape_4_3',
    },
  },
  {
    id: 'fal-ai/flux/srpo',
    name: 'FLUX SRPO',
    description: 'SRPO-enhanced FLUX Dev - slightly better quality',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: true,
    estimatedTime: '~4-6s',
    defaultParams: {
      image_size: 'landscape_4_3',
    },
  },
  {
    id: 'fal-ai/imagen3',
    name: 'Imagen 3',
    description: 'Google Imagen 3 - high quality photorealism',
    category: ['balanced', 'photorealistic'],
    speedTier: 'medium',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~5-8s',
    defaultParams: {
      aspect_ratio: '16:9',
    },
  },
  {
    id: 'fal-ai/imagen3/fast',
    name: 'Imagen 3 Fast',
    description: 'Faster Google Imagen 3',
    category: ['balanced', 'photorealistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {
      aspect_ratio: '16:9',
    },
  },
  {
    id: 'fal-ai/stable-diffusion-v35-medium',
    name: 'SD 3.5 Medium',
    description: 'Balanced Stable Diffusion 3.5',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~4-6s',
    defaultParams: {
      num_inference_steps: 30,
      guidance_scale: 7.0,
    },
  },
  {
    id: 'fal-ai/stable-diffusion-v3-medium',
    name: 'SD 3 Medium',
    description: 'Stable Diffusion 3 medium variant',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~3-5s',
    defaultParams: {
      num_inference_steps: 28,
      guidance_scale: 7.0,
    },
  },
  {
    id: 'fal-ai/luma-photon',
    name: 'Luma Photon',
    description: 'Efficient photorealistic model',
    category: ['balanced', 'photorealistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// TEXT RENDERING MODELS - Best for text in images
// ═══════════════════════════════════════════════════════════════

export const TEXT_RENDERING_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/ideogram/v3',
    name: 'Ideogram V3',
    description: 'Best-in-class text rendering - industry leading',
    category: ['text-rendering', 'balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {
      aspect_ratio: '16:9',
      magic_prompt_option: 'AUTO',
      style_type: 'AUTO',
    },
  },
  {
    id: 'fal-ai/ideogram/v2',
    name: 'Ideogram V2',
    description: 'Good text rendering - previous generation',
    category: ['text-rendering'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {
      magic_prompt_option: 'AUTO',
    },
  },
  {
    id: 'fal-ai/ideogram/v2a',
    name: 'Ideogram V2a',
    description: 'Improved V2 text rendering',
    category: ['text-rendering'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {
      magic_prompt_option: 'AUTO',
    },
  },
  {
    id: 'fal-ai/ideogram/v2a/turbo',
    name: 'Ideogram V2a Turbo',
    description: 'Fast V2a text rendering',
    category: ['text-rendering', 'fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~2s',
    defaultParams: {
      magic_prompt_option: 'AUTO',
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// ARTISTIC/STYLIZED MODELS
// ═══════════════════════════════════════════════════════════════

export const ARTISTIC_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/recraft/v3/text-to-image',
    name: 'Recraft V3',
    description: 'Professional design and vector-style generation',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {
      style: 'digital_illustration',
    },
  },
  {
    id: 'fal-ai/flux/krea',
    name: 'FLUX Krea',
    description: 'Creative and artistic FLUX variant',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: true,
    estimatedTime: '~3-5s',
    defaultParams: {
      image_size: 'square_hd',
    },
  },
  {
    id: 'fal-ai/dreamshaper',
    name: 'DreamShaper',
    description: 'Fantasy and artistic styles - community favorite',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~3-5s',
    defaultParams: {
      guidance_scale: 7.0,
    },
  },
  {
    id: 'fal-ai/playground-v25',
    name: 'Playground V2.5',
    description: 'Creative and vibrant outputs',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/kolors',
    name: 'Kolors',
    description: 'Colorful artistic generation',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/pixart-sigma',
    name: 'PixArt Sigma',
    description: 'Artistic pixel-perfect generation',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/stable-cascade',
    name: 'Stable Cascade',
    description: 'Multi-stage cascade generation',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/dreamo',
    name: 'Dreamo',
    description: 'Dream-like artistic generation',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/bagel',
    name: 'BAGEL',
    description: 'Unique artistic style model',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/lumina-image/v2',
    name: 'Lumina Image V2',
    description: 'Luminous and vibrant effects',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// PHOTOREALISTIC MODELS
// ═══════════════════════════════════════════════════════════════

export const PHOTOREALISTIC_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/realistic-vision',
    name: 'Realistic Vision',
    description: 'Photorealistic human portraits and scenes',
    category: ['photorealistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~3-5s',
    defaultParams: {
      guidance_scale: 7.0,
    },
  },
  {
    id: 'fal-ai/gpt-image-1',
    name: 'GPT Image 1',
    description: 'OpenAI-style image generation',
    category: ['photorealistic', 'balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/gpt-image-1-mini',
    name: 'GPT Image 1 Mini',
    description: 'Fast OpenAI-style generation',
    category: ['photorealistic', 'fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~2s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/gemini-25-flash-image',
    name: 'Gemini 2.5 Flash Image',
    description: 'Google Gemini multimodal image generation',
    category: ['photorealistic', 'fast'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// CHINESE/ASIAN MARKET MODELS
// ═══════════════════════════════════════════════════════════════

export const ASIAN_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/hunyuan-image/v3/text-to-image',
    name: 'Hunyuan V3',
    description: 'Tencent\'s latest image model',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/hunyuan-image/v2',
    name: 'Hunyuan V2',
    description: 'Tencent Hunyuan - Chinese style optimized',
    category: ['balanced'],
    speedTier: 'medium',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~5-8s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/qwen-image',
    name: 'Qwen Image',
    description: 'Alibaba Qwen base image model',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/qwen-image-2512',
    name: 'Qwen Image 2512',
    description: 'High resolution Alibaba Qwen',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    maxResolution: { width: 2512, height: 2512 },
    defaultParams: {},
  },
  {
    id: 'fal-ai/cogview4',
    name: 'CogView 4',
    description: 'Chinese-optimized generation model',
    category: ['balanced'],
    speedTier: 'medium',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~5-8s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/bytedance/dreamina/v3',
    name: 'Dreamina V3',
    description: 'ByteDance creative model',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// LORA/CUSTOM MODELS
// ═══════════════════════════════════════════════════════════════

export const LORA_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/flux-lora',
    name: 'FLUX LoRA',
    description: 'FLUX with custom LoRA support',
    category: ['lora', 'balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~4-6s',
    defaultParams: {
      image_size: 'landscape_4_3',
    },
  },
  {
    id: 'fal-ai/flux-2/lora',
    name: 'FLUX 2 LoRA',
    description: 'FLUX 2 with custom LoRA support',
    category: ['lora', 'balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~4-6s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/flux-kontext-lora/text-to-image',
    name: 'FLUX Kontext LoRA',
    description: 'Context-aware FLUX with LoRA',
    category: ['lora', 'balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~5-7s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/qwen-image-2512/lora',
    name: 'Qwen 2512 LoRA',
    description: 'High-res Qwen with LoRA',
    category: ['lora', 'quality'],
    speedTier: 'slow',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// OTHER NOTABLE MODELS
// ═══════════════════════════════════════════════════════════════

export const OTHER_MODELS: FalImageModel[] = [
  {
    id: 'fal-ai/stable-diffusion-v15',
    name: 'SD 1.5',
    description: 'Legacy Stable Diffusion 1.5 - widest LoRA compatibility',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 2,
    costTier: 'free',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~2s',
    defaultParams: {
      num_inference_steps: 25,
      guidance_scale: 7.5,
    },
  },
  {
    id: 'fal-ai/omnigen-v1',
    name: 'OmniGen V1',
    description: 'Multi-purpose generation model',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/omnigen-v2',
    name: 'OmniGen V2',
    description: 'Latest multi-purpose model',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/sana',
    name: 'SANA',
    description: 'Efficient generation model',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/sana/v1',
    name: 'SANA V1',
    description: 'SANA standard version',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/minimax/image-01',
    name: 'MiniMax Image',
    description: 'Compact high-quality model',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/bria/text-to-image/base',
    name: 'BRIA Base',
    description: 'Commercial-safe generation',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/bria/text-to-image/hd',
    name: 'BRIA HD',
    description: 'High-definition commercial-safe',
    category: ['quality'],
    speedTier: 'medium',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~5-8s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/nano-banana-pro',
    name: 'Nano Banana Pro',
    description: 'Ultra-compact fast model',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 2,
    costTier: 'free',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '<1s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/z-image/turbo',
    name: 'Z-Image Turbo',
    description: 'Fast turbo model',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~1.5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/reve/text-to-image',
    name: 'Reve',
    description: 'Unique artistic style',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    estimatedTime: '~3-5s',
    defaultParams: {},
  },
  {
    id: 'fal-ai/hidream-i1-dev',
    name: 'HiDream I1 Dev',
    description: 'High-resolution dream generation',
    category: ['quality', 'artistic'],
    speedTier: 'slow',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    estimatedTime: '~8-12s',
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// COMBINED CATALOG
// ═══════════════════════════════════════════════════════════════

export const FAL_IMAGE_MODELS: FalImageModel[] = [
  ...FAST_MODELS,
  ...QUALITY_MODELS,
  ...BALANCED_MODELS,
  ...TEXT_RENDERING_MODELS,
  ...ARTISTIC_MODELS,
  ...PHOTOREALISTIC_MODELS,
  ...ASIAN_MODELS,
  ...LORA_MODELS,
  ...OTHER_MODELS,
];

// ═══════════════════════════════════════════════════════════════
// IMAGE SIZE PRESETS
// ═══════════════════════════════════════════════════════════════

export const IMAGE_SIZE_PRESETS: Record<string, ImageSizeOption> = {
  // FLUX-style presets
  square: { width: 1024, height: 1024, label: 'Square', aspectRatio: '1:1' },
  square_hd: { width: 1024, height: 1024, label: 'Square HD', aspectRatio: '1:1' },
  portrait_4_3: { width: 768, height: 1024, label: 'Portrait 4:3', aspectRatio: '3:4' },
  portrait_16_9: { width: 576, height: 1024, label: 'Portrait 16:9', aspectRatio: '9:16' },
  landscape_4_3: { width: 1024, height: 768, label: 'Landscape 4:3', aspectRatio: '4:3' },
  landscape_16_9: { width: 1024, height: 576, label: 'Landscape 16:9', aspectRatio: '16:9' },
  
  // Custom presets
  thumbnail: { width: 512, height: 512, label: 'Thumbnail', aspectRatio: '1:1' },
  hero_banner: { width: 1920, height: 1080, label: 'Hero Banner', aspectRatio: '16:9' },
  social_square: { width: 1080, height: 1080, label: 'Social Square', aspectRatio: '1:1' },
  social_story: { width: 1080, height: 1920, label: 'Social Story', aspectRatio: '9:16' },
  blog_header: { width: 1200, height: 630, label: 'Blog Header', aspectRatio: '1.91:1' },
};

export type ImageSizePreset = keyof typeof IMAGE_SIZE_PRESETS;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get models filtered by category
 */
export function getModelsByCategory(category: ModelCategory): FalImageModel[] {
  return FAL_IMAGE_MODELS.filter(m => m.category.includes(category));
}

/**
 * Get models filtered by speed tier
 */
export function getModelsBySpeed(speed: SpeedTier): FalImageModel[] {
  return FAL_IMAGE_MODELS.filter(m => m.speedTier === speed);
}

/**
 * Get a specific model by ID
 */
export function getModelById(id: string): FalImageModel | undefined {
  return FAL_IMAGE_MODELS.find(m => m.id === id);
}

/**
 * Get the fastest models (sorted by speed)
 */
export function getFastestModels(limit = 5): FalImageModel[] {
  const speedOrder: SpeedTier[] = ['instant', 'fast', 'medium', 'slow'];
  return [...FAL_IMAGE_MODELS]
    .sort((a, b) => speedOrder.indexOf(a.speedTier) - speedOrder.indexOf(b.speedTier))
    .slice(0, limit);
}

/**
 * Get the highest quality models (sorted by quality)
 */
export function getHighestQualityModels(limit = 5): FalImageModel[] {
  return [...FAL_IMAGE_MODELS]
    .sort((a, b) => b.qualityTier - a.qualityTier)
    .slice(0, limit);
}

/**
 * Get model recommendation based on priority
 */
export function getModelRecommendation(
  priority: 'speed' | 'quality' | 'balanced' | 'cost' | 'text'
): FalImageModel {
  switch (priority) {
    case 'speed':
      return getModelById('fal-ai/flux/schnell')!;
    case 'quality':
      return getModelById('fal-ai/flux-2-max')!;
    case 'balanced':
      return getModelById('fal-ai/flux/dev')!;
    case 'cost':
      return getModelById('fal-ai/fast-lightning-sdxl')!;
    case 'text':
      return getModelById('fal-ai/ideogram/v3')!;
    default:
      return getModelById('fal-ai/flux/schnell')!;
  }
}

/**
 * Get models that support negative prompts
 */
export function getModelsWithNegativePrompt(): FalImageModel[] {
  return FAL_IMAGE_MODELS.filter(m => m.supportsNegativePrompt);
}

/**
 * Get models that support image-to-image
 */
export function getModelsWithImageToImage(): FalImageModel[] {
  return FAL_IMAGE_MODELS.filter(m => m.supportsImageToImage);
}

/**
 * Search models by name or description
 */
export function searchModels(query: string): FalImageModel[] {
  const lowerQuery = query.toLowerCase();
  return FAL_IMAGE_MODELS.filter(
    m =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery) ||
      m.id.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get a random model from a category (for variety)
 */
export function getRandomModelFromCategory(category: ModelCategory): FalImageModel {
  const models = getModelsByCategory(category);
  return models[Math.floor(Math.random() * models.length)];
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT EXPORTS FOR COMMON USE CASES
// ═══════════════════════════════════════════════════════════════

/** Default model for fast iteration */
export const DEFAULT_FAST_MODEL = 'fal-ai/flux/schnell';

/** Default model for high quality */
export const DEFAULT_QUALITY_MODEL = 'fal-ai/flux-2-max';

/** Default model for balanced use */
export const DEFAULT_BALANCED_MODEL = 'fal-ai/flux/dev';

/** Default model for text rendering */
export const DEFAULT_TEXT_MODEL = 'fal-ai/ideogram/v3';

/** Default model for artistic styles */
export const DEFAULT_ARTISTIC_MODEL = 'fal-ai/recraft/v3/text-to-image';

/** Default model for photorealism */
export const DEFAULT_PHOTO_MODEL = 'fal-ai/imagen4/preview';

/** Cheapest model for prototyping */
export const CHEAPEST_MODEL = 'fal-ai/fast-lightning-sdxl';
