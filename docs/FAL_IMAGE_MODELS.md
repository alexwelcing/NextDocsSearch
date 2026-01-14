# FAL AI Image Generation Models - Comprehensive Catalog

> Last updated: January 2026
> Source: fal.ai model catalog

This document provides a comprehensive list of image generation models available on FAL AI, organized by category for building a multi-model generation system.

---

## Table of Contents

1. [Quick Reference - Recommended Models](#quick-reference---recommended-models)
2. [FLUX Family (Black Forest Labs)](#flux-family-black-forest-labs)
3. [Stable Diffusion Family](#stable-diffusion-family)
4. [Google Imagen](#google-imagen)
5. [Ideogram](#ideogram)
6. [Recraft](#recraft)
7. [ByteDance Models](#bytedance-models)
8. [Hunyuan (Tencent)](#hunyuan-tencent)
9. [Qwen Image (Alibaba)](#qwen-image-alibaba)
10. [GPT/OpenAI-Style](#gptopenai-style)
11. [Luma Photon](#luma-photon)
12. [Fast/Turbo Models](#fastturbo-models)
13. [Artistic/Specialized](#artisticspecialized)
14. [Other Notable Models](#other-notable-models)
15. [Model Configuration TypeScript](#model-configuration-typescript)

---

## Quick Reference - Recommended Models

| Use Case | Model ID | Speed | Quality | Cost |
|----------|----------|-------|---------|------|
| **Fast Iteration** | `fal-ai/flux/schnell` | ⚡ Very Fast | ★★★☆ | $ |
| **Best Quality** | `fal-ai/flux-2-max` | 🐢 Slow | ★★★★★ | $$$ |
| **Balanced** | `fal-ai/flux/dev` | ⚡ Fast | ★★★★ | $$ |
| **Text Rendering** | `fal-ai/ideogram/v3` | ⚡ Fast | ★★★★ | $$ |
| **Photorealistic** | `fal-ai/imagen4/preview/ultra` | 🐢 Medium | ★★★★★ | $$$ |
| **Artistic/Creative** | `fal-ai/recraft/v3/text-to-image` | ⚡ Fast | ★★★★ | $$ |
| **Budget** | `fal-ai/fast-sdxl` | ⚡⚡ Fastest | ★★★ | $ |

---

## FLUX Family (Black Forest Labs)

The FLUX family represents state-of-the-art open models from Black Forest Labs.

### FLUX 1 Series

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/flux/schnell` | Text-to-Image | Fast iteration, prototyping | ⚡⚡ ~1-2s |
| `fal-ai/flux/dev` | Text-to-Image | Balanced quality/speed | ⚡ ~3-5s |
| `fal-ai/flux/dev/image-to-image` | Image-to-Image | Style transfer, editing | ⚡ ~3-5s |
| `fal-ai/flux/dev/redux` | Redux | Image variations | ⚡ ~3-5s |
| `fal-ai/flux/srpo` | SRPO Enhanced | Higher quality dev | ⚡ ~4-6s |
| `fal-ai/flux/krea` | Creative | Artistic/stylized | ⚡ ~3-5s |

### FLUX 2 Series (Latest)

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/flux-2/flash` | Text-to-Image | Fast FLUX 2 generation | ⚡⚡ ~2s |
| `fal-ai/flux-2/turbo` | Text-to-Image | Faster FLUX 2 | ⚡⚡ ~1.5s |
| `fal-ai/flux-2-max` | Text-to-Image | **SOTA quality** | 🐢 ~10-15s |
| `fal-ai/flux-2-flex` | Text-to-Image | Flexible control | ⚡ ~4-6s |
| `fal-ai/flux-2-pro` | Text-to-Image | Professional quality | 🐢 ~8-12s |
| `fal-ai/flux-2/lora` | LoRA | Custom fine-tuned | ⚡ ~4-6s |

### FLUX Pro/Kontext

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/flux-pro/v1` | Text-to-Image | Pro quality | 🐢 ~8-12s |
| `fal-ai/flux-pro/new` | Text-to-Image | Latest pro | 🐢 ~8-12s |
| `fal-ai/flux-pro/kontext/text-to-image` | Text-to-Image | Context-aware | ⚡ ~5-7s |
| `fal-ai/flux-pro/kontext/max/text-to-image` | Text-to-Image | Max context | 🐢 ~10-15s |
| `fal-ai/flux-kontext-lora/text-to-image` | LoRA | Custom kontext | ⚡ ~5-7s |

### FLUX LoRA/Training

| Model ID | Type | Best For |
|----------|------|----------|
| `fal-ai/flux-lora` | LoRA Inference | Custom styles |
| `fal-ai/flux-lora-fast-training` | Training | Fast LoRA training |
| `fal-ai/flux-lora-portrait-trainer` | Training | Portrait-specific |
| `fal-ai/flux-2-trainer-v2` | Training | FLUX 2 fine-tuning |

**Common FLUX Parameters:**
```typescript
{
  prompt: string,                    // Required
  image_size: "square_hd" | "square" | "portrait_4_3" | "portrait_16_9" | "landscape_4_3" | "landscape_16_9",
  num_inference_steps: number,       // 1-50, default varies by model
  guidance_scale: number,            // 1-20, default 3.5
  num_images: number,                // 1-4
  enable_safety_checker: boolean,
  seed: number,                      // For reproducibility
  sync_mode: boolean,                // Wait for result
}
```

---

## Stable Diffusion Family

Classic Stable Diffusion models with proven reliability.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/stable-diffusion-v15` | SD 1.5 | Legacy compatibility | ⚡⚡ |
| `fal-ai/stable-diffusion-v3-medium` | SD 3 | Balanced SD3 | ⚡ |
| `fal-ai/stable-diffusion-v35-medium` | SD 3.5 | Medium quality | ⚡ |
| `fal-ai/stable-diffusion-v35-large` | SD 3.5 | **Best SD quality** | 🐢 |
| `fal-ai/fast-sdxl` | SDXL | Fast SDXL | ⚡⚡ |
| `fal-ai/fast-lightning-sdxl` | SDXL | Lightning-fast | ⚡⚡⚡ |
| `fal-ai/hyper-sdxl` | SDXL | Hyper-optimized | ⚡⚡ |
| `fal-ai/stable-cascade` | Cascade | Multi-stage | ⚡ |
| `fal-ai/stable-cascade/sote-diffusion` | Cascade | Specialized | ⚡ |

**Common SD Parameters:**
```typescript
{
  prompt: string,
  negative_prompt: string,           // What to avoid
  image_size: "square_hd" | "square" | "portrait_4_3" | "landscape_4_3",
  num_inference_steps: number,       // 20-50
  guidance_scale: number,            // 5-15
  scheduler: "DPM++ 2M" | "Euler" | "Euler a" | "DPM++ SDE",
  seed: number,
}
```

---

## Google Imagen

Google's flagship image generation models.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/imagen3` | Imagen 3 | High quality | 🐢 |
| `fal-ai/imagen3/fast` | Imagen 3 Fast | Faster Imagen | ⚡ |
| `fal-ai/imagen4/preview` | Imagen 4 | Latest preview | 🐢 |
| `fal-ai/imagen4/preview/fast` | Imagen 4 Fast | Faster preview | ⚡ |
| `fal-ai/imagen4/preview/ultra` | Imagen 4 Ultra | **Best Google quality** | 🐢🐢 |
| `fal-ai/gemini-25-flash-image` | Gemini | Multimodal | ⚡ |

**Imagen Parameters:**
```typescript
{
  prompt: string,
  aspect_ratio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4",
  negative_prompt: string,
  num_images: number,
  safety_filter_level: "block_some" | "block_few" | "block_none",
}
```

---

## Ideogram

Industry-leading for text rendering in images.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/ideogram/v2` | V2 | Good text rendering | ⚡ |
| `fal-ai/ideogram/v2/turbo` | V2 Turbo | Fast V2 | ⚡⚡ |
| `fal-ai/ideogram/v2a` | V2a | Improved V2 | ⚡ |
| `fal-ai/ideogram/v2a/turbo` | V2a Turbo | Fast V2a | ⚡⚡ |
| `fal-ai/ideogram/v3` | V3 | **Best text rendering** | ⚡ |

**Ideogram Parameters:**
```typescript
{
  prompt: string,
  aspect_ratio: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3",
  model: "V_2" | "V_2_TURBO",
  magic_prompt_option: "AUTO" | "ON" | "OFF",  // Enhanced prompting
  style_type: "AUTO" | "GENERAL" | "REALISTIC" | "DESIGN" | "RENDER_3D" | "ANIME",
  negative_prompt: string,
}
```

---

## Recraft

Professional design-focused generation with excellent vector-style output.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/recraft/v3` | Recraft V3 | Design work | ⚡ |
| `fal-ai/recraft/v3/text-to-image` | V3 T2I | **Design/vector style** | ⚡ |
| `fal-ai/recraft-20b` | Recraft 20B | Large model | 🐢 |

**Recraft Parameters:**
```typescript
{
  prompt: string,
  image_size: { width: number, height: number },
  style: "realistic_image" | "digital_illustration" | "vector_illustration" | "icon",
  substyle: string,  // Style-specific
  colors: string[],  // Color palette control
}
```

---

## ByteDance Models

Powerful models from ByteDance/TikTok.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/bytedance/seedream/v3/text-to-image` | SeedREAM V3 | High quality | 🐢 |
| `fal-ai/bytedance/seedream/v4` | SeedREAM V4 | Latest | 🐢 |
| `fal-ai/bytedance/seedream/v4/text-to-image` | SeedREAM V4 | Text-to-image | 🐢 |
| `fal-ai/bytedance/seedream/v4/edit` | SeedREAM V4 | Image editing | ⚡ |
| `fal-ai/bytedance/dreamina/v3` | Dreamina | Creative | ⚡ |

---

## Hunyuan (Tencent)

Tencent's advanced image and multimodal models.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/hunyuan-image/v2` | Hunyuan V2 | Chinese style | 🐢 |
| `fal-ai/hunyuan-image/v3/text-to-image` | Hunyuan V3 | Latest | 🐢 |

---

## Qwen Image (Alibaba)

Alibaba's multimodal image generation.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/qwen-image` | Qwen Base | General | ⚡ |
| `fal-ai/qwen-image-2512` | Qwen 2512 | High res | 🐢 |
| `fal-ai/qwen-image-2512/lora` | Qwen LoRA | Custom | ⚡ |
| `fal-ai/qwen-image-edit-2509` | Qwen Edit | Image editing | ⚡ |
| `fal-ai/qwen-image-edit-2511` | Qwen Edit | Latest editing | ⚡ |
| `fal-ai/qwen-image-layered` | Qwen Layered | Layer control | ⚡ |

**Qwen Edit Gallery (Specialized):**
- `fal-ai/qwen-image-edit-2509-lora-gallery/add-background`
- `fal-ai/qwen-image-edit-2509-lora-gallery/face-to-full-portrait`
- `fal-ai/qwen-image-edit-2509-lora-gallery/group-photo`
- `fal-ai/qwen-image-edit-2509-lora-gallery/integrate-product`
- `fal-ai/qwen-image-edit-2509-lora-gallery/lighting-restoration`
- `fal-ai/qwen-image-edit-2509-lora-gallery/multiple-angles`
- `fal-ai/qwen-image-edit-2509-lora-gallery/remove-element`
- `fal-ai/qwen-image-edit-2509-lora-gallery/shirt-design`

---

## GPT/OpenAI-Style

OpenAI-compatible and similar models.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/gpt-image-1` | GPT Image | OpenAI-style | ⚡ |
| `fal-ai/gpt-image-1-mini` | GPT Mini | Fast OpenAI-style | ⚡⚡ |

---

## Luma Photon

Luma's efficient photorealistic model.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/luma-photon` | Luma Photon | Photorealistic | ⚡ |
| `fal-ai/luma-photon/flash` | Luma Flash | Fast photorealistic | ⚡⚡ |

---

## Fast/Turbo Models

Optimized for speed - best for real-time applications.

| Model ID | Type | Speed | Notes |
|----------|------|-------|-------|
| `fal-ai/flux/schnell` | FLUX | ⚡⚡ ~1s | Best fast quality |
| `fal-ai/flux-2/turbo` | FLUX 2 | ⚡⚡ ~1.5s | Latest fast |
| `fal-ai/flux-2/flash` | FLUX 2 | ⚡⚡ ~2s | Flash speed |
| `fal-ai/fast-sdxl` | SDXL | ⚡⚡ ~1.5s | Reliable |
| `fal-ai/fast-lightning-sdxl` | SDXL | ⚡⚡⚡ <1s | Fastest SDXL |
| `fal-ai/fast-lcm-diffusion` | LCM | ⚡⚡⚡ <1s | Ultra fast |
| `fal-ai/fast-fooocus-sdxl` | SDXL | ⚡⚡ ~1.5s | Fooocus-enhanced |
| `fal-ai/hyper-sdxl` | SDXL | ⚡⚡ ~1.5s | Hyper-optimized |
| `fal-ai/lcm` | LCM | ⚡⚡⚡ <1s | Latent Consistency |
| `fal-ai/sana/sprint` | SANA | ⚡⚡ ~1.5s | Sprint mode |
| `fal-ai/ideogram/v2/turbo` | Ideogram | ⚡⚡ ~2s | Fast text |
| `fal-ai/imagen3/fast` | Imagen | ⚡⚡ ~3s | Fast Google |

---

## Artistic/Specialized

Models optimized for specific artistic styles.

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/dreamshaper` | DreamShaper | Fantasy/artistic | ⚡ |
| `fal-ai/realistic-vision` | Realistic Vision | Photorealistic | ⚡ |
| `fal-ai/playground-v25` | Playground | Creative | ⚡ |
| `fal-ai/kolors` | Kolors | Colorful art | ⚡ |
| `fal-ai/pixart-sigma` | PixArt | Artistic | ⚡ |
| `fal-ai/bagel` | BAGEL | Unique style | ⚡ |
| `fal-ai/dreamo` | Dreamo | Dream-like | ⚡ |
| `fal-ai/piflow` | PiFlow | Flow art | ⚡ |
| `fal-ai/sky-raccoon` | Sky Raccoon | Stylized | ⚡ |
| `fal-ai/janus` | Janus | Dual-style | ⚡ |
| `fal-ai/emu-3` | EMU-3 | Multi-style | ⚡ |

---

## Other Notable Models

| Model ID | Type | Best For | Speed |
|----------|------|----------|-------|
| `fal-ai/lumina-image/v2` | Lumina | Luminous effects | ⚡ |
| `fal-ai/minimax/image-01` | MiniMax | Compact quality | ⚡ |
| `fal-ai/longcat-image` | Longcat | Long context | ⚡ |
| `fal-ai/omnigen-v1` | OmniGen V1 | Multi-purpose | ⚡ |
| `fal-ai/omnigen-v2` | OmniGen V2 | Latest multi | ⚡ |
| `fal-ai/ovis-image` | OVIS | Vision-Language | ⚡ |
| `fal-ai/cogview4` | CogView4 | Chinese-optimized | 🐢 |
| `fal-ai/hidream-i1-dev` | HiDream | High-res dreams | 🐢 |
| `fal-ai/sana` | SANA | Efficient | ⚡ |
| `fal-ai/sana/v1` | SANA V1 | Standard | ⚡ |
| `fal-ai/nano-banana` | Nano Banana | Tiny/fast | ⚡⚡⚡ |
| `fal-ai/nano-banana-pro` | Nano Pro | Better tiny | ⚡⚡ |
| `fal-ai/z-image/turbo` | Z-Image | Fast turbo | ⚡⚡ |
| `fal-ai/f-lite/standard` | F-Lite | Lightweight | ⚡⚡ |
| `fal-ai/f-lite/texture` | F-Lite | Texture gen | ⚡⚡ |
| `fal-ai/bria/text-to-image/base` | BRIA | Commercial safe | ⚡ |
| `fal-ai/bria/text-to-image/fast` | BRIA Fast | Fast commercial | ⚡⚡ |
| `fal-ai/bria/text-to-image/hd` | BRIA HD | HD commercial | 🐢 |
| `fal-ai/vidu/q2/text-to-image` | Vidu | Quality focus | 🐢 |
| `fal-ai/reve/text-to-image` | Reve | Unique style | ⚡ |
| `fal-ai/wan-25-preview/text-to-image` | WAN | Preview model | ⚡ |

---

## Image Editing & Utilities

| Model ID | Type | Best For |
|----------|------|----------|
| `fal-ai/bria/background/remove` | Utility | Background removal |
| `fal-ai/lightx/relight` | Utility | Relighting images |
| `fal-ai/topaz/upscale/image` | Utility | AI upscaling |
| `fal-ai/nova-sr` | Utility | Super resolution |
| `fal-ai/scail` | Utility | Scaling |
| `fal-ai/arbiter/image` | Utility | Image arbitration |

---

## Model Configuration TypeScript

Here's a TypeScript configuration you can use for a multi-model system:

```typescript
// lib/fal-models.ts

export type ModelCategory = 
  | 'fast' 
  | 'quality' 
  | 'balanced' 
  | 'artistic' 
  | 'text-rendering' 
  | 'photorealistic'
  | 'editing';

export type SpeedTier = 'instant' | 'fast' | 'medium' | 'slow';
export type QualityTier = 1 | 2 | 3 | 4 | 5;
export type CostTier = 'free' | 'low' | 'medium' | 'high' | 'premium';

export interface FalImageModel {
  id: string;
  name: string;
  description: string;
  category: ModelCategory[];
  speedTier: SpeedTier;
  qualityTier: QualityTier;
  costTier: CostTier;
  supportsNegativePrompt: boolean;
  supportsImageToImage: boolean;
  maxResolution?: { width: number; height: number };
  defaultParams: Record<string, unknown>;
}

export const FAL_IMAGE_MODELS: FalImageModel[] = [
  // ═══════════════════════════════════════════════════════════════
  // FAST MODELS - For quick iterations
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fal-ai/flux/schnell',
    name: 'FLUX Schnell',
    description: 'Fastest FLUX model, great quality for speed',
    category: ['fast', 'balanced'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    defaultParams: {
      image_size: 'landscape_4_3',
      num_inference_steps: 4,
      guidance_scale: 3.5,
    },
  },
  {
    id: 'fal-ai/flux-2/turbo',
    name: 'FLUX 2 Turbo',
    description: 'Fast FLUX 2 generation with improved quality',
    category: ['fast', 'balanced'],
    speedTier: 'instant',
    qualityTier: 4,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
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
    defaultParams: {
      image_size: 'landscape_4_3',
    },
  },
  {
    id: 'fal-ai/fast-sdxl',
    name: 'Fast SDXL',
    description: 'Optimized SDXL for speed',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    defaultParams: {
      image_size: 'square_hd',
      num_inference_steps: 25,
      guidance_scale: 7.5,
    },
  },
  {
    id: 'fal-ai/fast-lightning-sdxl',
    name: 'Lightning SDXL',
    description: 'Ultra-fast lightning-distilled SDXL',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 2,
    costTier: 'free',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    defaultParams: {
      image_size: 'square_hd',
      num_inference_steps: 4,
    },
  },
  {
    id: 'fal-ai/lcm',
    name: 'LCM',
    description: 'Latent Consistency Model - extremely fast',
    category: ['fast'],
    speedTier: 'instant',
    qualityTier: 2,
    costTier: 'free',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    defaultParams: {
      num_inference_steps: 4,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // QUALITY/SOTA MODELS - For best results
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fal-ai/flux-2-max',
    name: 'FLUX 2 Max',
    description: 'State-of-the-art quality, best FLUX model',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'premium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
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
    defaultParams: {
      image_size: 'landscape_16_9',
    },
  },
  {
    id: 'fal-ai/flux-pro/v1',
    name: 'FLUX Pro V1',
    description: 'Original FLUX Pro quality',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'high',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    defaultParams: {
      image_size: 'landscape_16_9',
    },
  },
  {
    id: 'fal-ai/imagen4/preview/ultra',
    name: 'Imagen 4 Ultra',
    description: 'Google\'s best image model',
    category: ['quality', 'photorealistic'],
    speedTier: 'slow',
    qualityTier: 5,
    costTier: 'premium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    defaultParams: {
      aspect_ratio: '16:9',
    },
  },
  {
    id: 'fal-ai/stable-diffusion-v35-large',
    name: 'SD 3.5 Large',
    description: 'Largest Stable Diffusion 3.5',
    category: ['quality'],
    speedTier: 'slow',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
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
    defaultParams: {},
  },

  // ═══════════════════════════════════════════════════════════════
  // BALANCED MODELS - Good quality with reasonable speed
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fal-ai/flux/dev',
    name: 'FLUX Dev',
    description: 'Balanced FLUX - good quality and speed',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: true,
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
    defaultParams: {
      image_size: 'landscape_4_3',
    },
  },
  {
    id: 'fal-ai/imagen3',
    name: 'Imagen 3',
    description: 'Google Imagen 3 - high quality',
    category: ['balanced', 'photorealistic'],
    speedTier: 'medium',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
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
    defaultParams: {
      num_inference_steps: 30,
      guidance_scale: 7.0,
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEXT RENDERING - Best for text in images
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fal-ai/ideogram/v3',
    name: 'Ideogram V3',
    description: 'Best-in-class text rendering',
    category: ['text-rendering', 'balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    defaultParams: {
      aspect_ratio: '16:9',
      magic_prompt_option: 'AUTO',
      style_type: 'AUTO',
    },
  },
  {
    id: 'fal-ai/ideogram/v2a/turbo',
    name: 'Ideogram V2a Turbo',
    description: 'Fast text rendering',
    category: ['text-rendering', 'fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: false,
    defaultParams: {
      magic_prompt_option: 'AUTO',
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ARTISTIC/STYLIZED MODELS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fal-ai/recraft/v3/text-to-image',
    name: 'Recraft V3',
    description: 'Professional design and vector-style',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
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
    defaultParams: {
      image_size: 'square_hd',
    },
  },
  {
    id: 'fal-ai/dreamshaper',
    name: 'DreamShaper',
    description: 'Fantasy and artistic styles',
    category: ['artistic'],
    speedTier: 'fast',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
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
    defaultParams: {},
  },

  // ═══════════════════════════════════════════════════════════════
  // PHOTOREALISTIC MODELS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fal-ai/realistic-vision',
    name: 'Realistic Vision',
    description: 'Photorealistic human portraits',
    category: ['photorealistic'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'low',
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    defaultParams: {
      guidance_scale: 7.0,
    },
  },
  {
    id: 'fal-ai/luma-photon',
    name: 'Luma Photon',
    description: 'Efficient photorealistic model',
    category: ['photorealistic', 'balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    defaultParams: {},
  },
  {
    id: 'fal-ai/luma-photon/flash',
    name: 'Luma Photon Flash',
    description: 'Fast photorealistic',
    category: ['photorealistic', 'fast'],
    speedTier: 'instant',
    qualityTier: 3,
    costTier: 'low',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    defaultParams: {},
  },

  // ═══════════════════════════════════════════════════════════════
  // LORA/CUSTOM MODELS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'fal-ai/flux-lora',
    name: 'FLUX LoRA',
    description: 'FLUX with custom LoRA support',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    defaultParams: {
      image_size: 'landscape_4_3',
    },
  },
  {
    id: 'fal-ai/flux-2/lora',
    name: 'FLUX 2 LoRA',
    description: 'FLUX 2 with custom LoRA support',
    category: ['balanced'],
    speedTier: 'fast',
    qualityTier: 4,
    costTier: 'medium',
    supportsNegativePrompt: false,
    supportsImageToImage: false,
    defaultParams: {},
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getModelsByCategory(category: ModelCategory): FalImageModel[] {
  return FAL_IMAGE_MODELS.filter(m => m.category.includes(category));
}

export function getModelsBySpeed(speed: SpeedTier): FalImageModel[] {
  return FAL_IMAGE_MODELS.filter(m => m.speedTier === speed);
}

export function getModelById(id: string): FalImageModel | undefined {
  return FAL_IMAGE_MODELS.find(m => m.id === id);
}

export function getFastestModels(limit = 5): FalImageModel[] {
  const speedOrder: SpeedTier[] = ['instant', 'fast', 'medium', 'slow'];
  return [...FAL_IMAGE_MODELS]
    .sort((a, b) => speedOrder.indexOf(a.speedTier) - speedOrder.indexOf(b.speedTier))
    .slice(0, limit);
}

export function getHighestQualityModels(limit = 5): FalImageModel[] {
  return [...FAL_IMAGE_MODELS]
    .sort((a, b) => b.qualityTier - a.qualityTier)
    .slice(0, limit);
}

export function getModelRecommendation(
  priority: 'speed' | 'quality' | 'balanced' | 'cost'
): FalImageModel {
  switch (priority) {
    case 'speed':
      return FAL_IMAGE_MODELS.find(m => m.id === 'fal-ai/flux/schnell')!;
    case 'quality':
      return FAL_IMAGE_MODELS.find(m => m.id === 'fal-ai/flux-2-max')!;
    case 'balanced':
      return FAL_IMAGE_MODELS.find(m => m.id === 'fal-ai/flux/dev')!;
    case 'cost':
      return FAL_IMAGE_MODELS.find(m => m.id === 'fal-ai/fast-lightning-sdxl')!;
    default:
      return FAL_IMAGE_MODELS.find(m => m.id === 'fal-ai/flux/schnell')!;
  }
}

// ═══════════════════════════════════════════════════════════════
// IMAGE SIZE PRESETS
// ═══════════════════════════════════════════════════════════════

export const IMAGE_SIZE_PRESETS = {
  // FLUX-style presets
  square: { width: 1024, height: 1024 },
  square_hd: { width: 1024, height: 1024 },
  portrait_4_3: { width: 768, height: 1024 },
  portrait_16_9: { width: 576, height: 1024 },
  landscape_4_3: { width: 1024, height: 768 },
  landscape_16_9: { width: 1024, height: 576 },
  
  // Custom presets
  thumbnail: { width: 512, height: 512 },
  hero_banner: { width: 1920, height: 1080 },
  social_square: { width: 1080, height: 1080 },
  social_story: { width: 1080, height: 1920 },
  blog_header: { width: 1200, height: 630 },
} as const;

export type ImageSizePreset = keyof typeof IMAGE_SIZE_PRESETS;
```

---

## API Call Examples

### Basic Text-to-Image (FLUX Schnell)

```typescript
const response = await fetch('https://fal.run/fal-ai/flux/schnell', {
  method: 'POST',
  headers: {
    'Authorization': `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'A futuristic city at sunset, cyberpunk style',
    image_size: 'landscape_16_9',
    num_inference_steps: 4,
    num_images: 1,
  }),
});
```

### High Quality (FLUX 2 Max)

```typescript
const response = await fetch('https://fal.run/fal-ai/flux-2-max', {
  method: 'POST',
  headers: {
    'Authorization': `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Photorealistic portrait of a wise elder, dramatic lighting',
    image_size: 'portrait_4_3',
    num_inference_steps: 50,
  }),
});
```

### Text Rendering (Ideogram V3)

```typescript
const response = await fetch('https://fal.run/fal-ai/ideogram/v3', {
  method: 'POST',
  headers: {
    'Authorization': `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'A vintage poster with the text "ADVENTURE AWAITS" in bold letters',
    aspect_ratio: '3:4',
    magic_prompt_option: 'ON',
    style_type: 'DESIGN',
  }),
});
```

### Design/Vector Style (Recraft V3)

```typescript
const response = await fetch('https://fal.run/fal-ai/recraft/v3/text-to-image', {
  method: 'POST',
  headers: {
    'Authorization': `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Minimalist logo of a mountain with a rising sun',
    image_size: { width: 1024, height: 1024 },
    style: 'vector_illustration',
  }),
});
```

---

## Cost Optimization Tips

1. **Use `fal-ai/flux/schnell` for iterations** - It's fast and cheap
2. **Only use quality models for final output** - Save `flux-2-max` for production
3. **Batch requests when possible** - Some models support `num_images: 4`
4. **Use appropriate resolution** - Don't generate 4K if you need thumbnails
5. **Consider `fast-lightning-sdxl`** - Near-free for prototyping

---

## Model Selection Flowchart

```
Need text in image?
├── Yes → fal-ai/ideogram/v3
└── No
    └── Priority?
        ├── Speed → fal-ai/flux/schnell
        ├── Quality → fal-ai/flux-2-max
        ├── Balance → fal-ai/flux/dev
        ├── Artistic → fal-ai/recraft/v3/text-to-image
        ├── Photo → fal-ai/imagen4/preview/ultra
        └── Budget → fal-ai/fast-lightning-sdxl
```

---

## Changelog

- **2026-01-14**: Initial catalog with 100+ models documented
- Models verified against fal.ai as of January 2026
