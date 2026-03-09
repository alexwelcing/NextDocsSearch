/**
 * LTX-2.3 Parameter Validation and Resolution Presets
 *
 * Enforces hard constraints from the LTX-2.3 model:
 * - Width/height must be divisible by 32
 * - Frame count must be 8k + 1 (i.e., (frames - 1) % 8 === 0)
 * - Maximum 257 frames (~10s at 25fps)
 *
 * @see https://huggingface.co/Lightricks/LTX-Video
 */

import type { LtxParameters, LtxResolutionPreset, LinkedInExportPreset } from './types'

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** LTX requires width and height divisible by this value */
export const DIMENSION_DIVISOR = 32

/** LTX requires (frames - 1) divisible by this value */
export const FRAME_MODULUS = 8

/** Maximum frames supported by LTX-2.3 */
export const MAX_FRAMES = 257

/** Default fps for the official Hugging Face Space */
export const DEFAULT_FPS = 24

/** Maximum clip duration in seconds */
export const MAX_DURATION_S = 10.0

/** Minimum clip duration in seconds */
export const MIN_DURATION_S = 1.0

/** Default clip duration in seconds */
export const DEFAULT_DURATION_S = 6.0

// ═══════════════════════════════════════════════════════════════
// RESOLUTION PRESETS (all divisible by 32)
// ═══════════════════════════════════════════════════════════════

export const RESOLUTION_PRESETS: LtxResolutionPreset[] = [
  { label: '768×512', width: 768, height: 512, aspectRatio: '3:2', use: 'Fast iteration landscape' },
  { label: '512×768', width: 512, height: 768, aspectRatio: '2:3', use: 'Fast iteration portrait' },
  { label: '640×640', width: 640, height: 640, aspectRatio: '1:1', use: 'Square (LinkedIn compatible)' },
  { label: '1024×576', width: 1024, height: 576, aspectRatio: '16:9', use: 'Standard widescreen' },
  { label: '576×1024', width: 576, height: 1024, aspectRatio: '9:16', use: 'Vertical stories' },
  {
    label: '1024×1280',
    width: 1024,
    height: 1280,
    aspectRatio: '4:5',
    use: 'LinkedIn feed (vertical, crop to 1080×1350)',
  },
  {
    label: '1024×1824',
    width: 1024,
    height: 1824,
    aspectRatio: '~9:16',
    use: 'LinkedIn stories (crop to 1080×1920)',
  },
]

// ═══════════════════════════════════════════════════════════════
// LINKEDIN EXPORT PRESETS
// ═══════════════════════════════════════════════════════════════

export const LINKEDIN_EXPORT_PRESETS: Record<string, LinkedInExportPreset> = {
  feed_vertical: {
    aspectRatio: '4:5',
    width: 1080,
    height: 1350,
    maxFileSizeMb: 200,
    maxDurationS: 600,
    description: 'LinkedIn in-feed vertical (broadest compatibility)',
  },
  stories: {
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    maxFileSizeMb: 200,
    maxDurationS: 600,
    description: 'LinkedIn stories / mobile-first vertical',
  },
  landscape: {
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    maxFileSizeMb: 200,
    maxDurationS: 600,
    description: 'LinkedIn landscape video',
  },
  square: {
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    maxFileSizeMb: 200,
    maxDurationS: 600,
    description: 'LinkedIn square video',
  },
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a dimension is divisible by 32
 */
export function isDimensionValid(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value % DIMENSION_DIVISOR === 0
}

/**
 * Round a dimension up to the nearest multiple of 32
 */
export function roundDimensionUp(value: number): number {
  return Math.ceil(value / DIMENSION_DIVISOR) * DIMENSION_DIVISOR
}

/**
 * Round a dimension to the nearest multiple of 32
 */
export function roundDimensionNearest(value: number): number {
  return Math.round(value / DIMENSION_DIVISOR) * DIMENSION_DIVISOR
}

/**
 * Check if a frame count satisfies the 8k+1 constraint
 */
export function isFrameCountValid(frames: number): boolean {
  return Number.isInteger(frames) && frames > 0 && (frames - 1) % FRAME_MODULUS === 0
}

/**
 * Round a frame count to the nearest valid value (8k + 1)
 */
export function roundFrameCount(frames: number): number {
  const k = Math.round((frames - 1) / FRAME_MODULUS)
  return Math.max(1, k * FRAME_MODULUS + 1)
}

/**
 * Calculate frame count from duration and fps, ensuring 8k+1 compliance
 */
export function calculateFrames(durationS: number, fps: number): number {
  const rawFrames = Math.round(durationS * fps)
  const rounded = roundFrameCount(rawFrames)
  return Math.min(rounded, MAX_FRAMES)
}

/**
 * Calculate actual duration from a valid frame count and fps
 */
export function calculateDuration(frames: number, fps: number): number {
  return frames / fps
}

/**
 * Find the closest resolution preset for a target aspect ratio
 */
export function findClosestPreset(
  targetAspectRatio: string
): LtxResolutionPreset | undefined {
  return RESOLUTION_PRESETS.find((p) => p.aspectRatio === targetAspectRatio)
}

/**
 * Validate all LTX parameters and return errors
 */
export function validateLtxParameters(params: LtxParameters): string[] {
  const errors: string[] = []

  if (!isDimensionValid(params.width)) {
    errors.push(
      `Width ${params.width} is not divisible by ${DIMENSION_DIVISOR}. Use ${roundDimensionNearest(params.width)}.`
    )
  }

  if (!isDimensionValid(params.height)) {
    errors.push(
      `Height ${params.height} is not divisible by ${DIMENSION_DIVISOR}. Use ${roundDimensionNearest(params.height)}.`
    )
  }

  if (!isFrameCountValid(params.frames)) {
    errors.push(
      `Frame count ${params.frames} does not satisfy 8k+1 constraint. Use ${roundFrameCount(params.frames)}.`
    )
  }

  if (params.frames > MAX_FRAMES) {
    errors.push(`Frame count ${params.frames} exceeds maximum of ${MAX_FRAMES}.`)
  }

  if (params.durationS > MAX_DURATION_S) {
    errors.push(`Duration ${params.durationS}s exceeds maximum of ${MAX_DURATION_S}s.`)
  }

  if (params.durationS < MIN_DURATION_S) {
    errors.push(`Duration ${params.durationS}s is below minimum of ${MIN_DURATION_S}s.`)
  }

  if (params.fps <= 0) {
    errors.push(`FPS must be positive, got ${params.fps}.`)
  }

  if (!params.prompt || params.prompt.trim().length === 0) {
    errors.push('Prompt is required.')
  }

  if (params.mode === 'I2V' && !params.imageUrl && !params.imagePath) {
    errors.push('Image URL or local image path is required for image-to-video (I2V) mode.')
  }

  return errors
}

/**
 * Build safe default LTX parameters from a partial request
 */
export function buildLtxParameters(partial: {
  prompt: string
  mode?: 'T2V' | 'I2V'
  imageUrl?: string
  imagePath?: string
  durationS?: number
  width?: number
  height?: number
  fps?: number
  seed?: number
  enhancePrompt?: boolean
  highResolution?: boolean
  checkpoint?: 'ltx-2.3-22b-distilled' | 'ltx-2.3-22b-dev'
}): LtxParameters {
  const fps = partial.fps || DEFAULT_FPS
  const durationS = Math.min(partial.durationS || DEFAULT_DURATION_S, MAX_DURATION_S)
  const width = partial.width ? roundDimensionNearest(partial.width) : 768
  const height = partial.height ? roundDimensionNearest(partial.height) : 512
  const frames = calculateFrames(durationS, fps)

  return {
    mode: partial.mode || 'T2V',
    prompt: partial.prompt,
    imageUrl: partial.imageUrl,
    imagePath: partial.imagePath,
    checkpoint: partial.checkpoint || 'ltx-2.3-22b-distilled',
    width,
    height,
    fps,
    durationS,
    frames,
    seed: partial.seed,
    enhancePrompt: partial.enhancePrompt ?? false,
    highResolution: partial.highResolution ?? false,
  }
}
