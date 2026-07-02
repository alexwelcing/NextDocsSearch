/**
 * Image Grading System
 *
 * Evaluates generated images on technical and aesthetic dimensions.
 * Uses sharp for fast local analysis.
 */

import sharp from 'sharp'

export interface GradeResult {
  overallScore: number // 0-10
  technicalScore: number // 0-10
  aestheticScore: number // 0-10
  metrics: {
    width: number
    height: number
    fileSizeBytes: number
    sharpness: number // variance of Laplacian approx
    contrast: number // 0-1
    saturationMean: number // 0-1
    brightnessMean: number // 0-255
    colorVariety: number // unique color buckets
  }
  flags: {
    tooSmall: boolean
    tooBlurry: boolean
    lowContrast: boolean
    oversaturated: boolean
  }
  recommendations: string[]
}

export interface GraderOptions {
  minWidth?: number
  minHeight?: number
  minFileSizeBytes?: number
  sharpnessThreshold?: number
  contrastThreshold?: number
}

const DEFAULT_OPTIONS: GraderOptions = {
  minWidth: 512,
  minHeight: 512,
  minFileSizeBytes: 20 * 1024, // 20KB
  sharpnessThreshold: 15, // Laplacian variance proxy
  contrastThreshold: 0.15,
}

/**
 * Grade an image buffer programmatically.
 */
export async function gradeImage(
  imageBuffer: Buffer,
  options: GraderOptions = {}
): Promise<GradeResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Basic metadata
  const metadata = await sharp(imageBuffer).metadata()
  const width = metadata.width || 0
  const height = metadata.height || 0
  const fileSizeBytes = imageBuffer.length

  // Resize for faster analysis
  const resized = sharp(imageBuffer).resize(512, 512, { fit: 'inside' })

  // Raw RGBA data
  const { data, info } = await resized
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true })

  const pixels = data
  const pixelCount = info.width * info.height

  // Compute sharpness via edge detection proxy: std dev of grayscale
  const grayscale = await resized
    .greyscale()
    .raw()
    .toBuffer()
  const sharpness = estimateSharpness(grayscale as Buffer)

  // Color metrics
  let totalBrightness = 0
  let totalSaturation = 0
  let minL = 255
  let maxL = 0
  const colorBuckets = new Set<string>()

  for (let i = 0; i < pixelCount; i++) {
    const r = pixels[i * 4]
    const g = pixels[i * 4 + 1]
    const b = pixels[i * 4 + 2]

    const { l, s } = rgbToHsl(r, g, b)
    totalBrightness += l
    totalSaturation += s
    minL = Math.min(minL, l)
    maxL = Math.max(maxL, l)

    // Bucket colors coarsely for variety
    const bucket = `${Math.round(r / 32)},${Math.round(g / 32)},${Math.round(b / 32)}`
    colorBuckets.add(bucket)
  }

  const brightnessMean = totalBrightness / pixelCount
  const saturationMean = totalSaturation / pixelCount / 100
  const contrast = (maxL - minL) / 255
  const colorVariety = colorBuckets.size

  // Flags
  const tooSmall = width < (opts.minWidth || 0) || height < (opts.minHeight || 0)
  const tooBlurry = sharpness < (opts.sharpnessThreshold || 0)
  const lowContrast = contrast < (opts.contrastThreshold || 0)
  const oversaturated = saturationMean > 0.92

  // Scoring
  let technicalScore = 7.0
  if (tooSmall) technicalScore -= 2.5
  if (fileSizeBytes < (opts.minFileSizeBytes || 0)) technicalScore -= 1.5
  if (tooBlurry) technicalScore -= 2.0
  technicalScore = clamp(technicalScore, 0, 10)

  let aestheticScore = 7.0
  if (lowContrast) aestheticScore -= 1.5
  if (oversaturated) aestheticScore -= 1.0
  if (colorVariety < 30) aestheticScore -= 1.0
  if (colorVariety > 200) aestheticScore += 1.0
  aestheticScore = clamp(aestheticScore, 0, 10)

  const overallScore = clamp((technicalScore * 0.6 + aestheticScore * 0.4), 0, 10)

  // Recommendations
  const recommendations: string[] = []
  if (tooSmall) recommendations.push(`Resolution too low (${width}x${height}); consider larger generation.`)
  if (tooBlurry) recommendations.push(`Image appears soft/blurry; increase steps or use a sharper sampler.`)
  if (lowContrast) recommendations.push(`Low contrast; consider a stronger prompt or CFG adjustment.`)
  if (oversaturated) recommendations.push(`Oversaturated; reduce color intensity in prompt or VAE.`)
  if (recommendations.length === 0 && overallScore >= 8) {
    recommendations.push('Strong technical and aesthetic quality.')
  }

  return {
    overallScore: round(overallScore),
    technicalScore: round(technicalScore),
    aestheticScore: round(aestheticScore),
    metrics: {
      width,
      height,
      fileSizeBytes,
      sharpness: round(sharpness),
      contrast: round(contrast),
      saturationMean: round(saturationMean),
      brightnessMean: Math.round(brightnessMean),
      colorVariety,
    },
    flags: {
      tooSmall,
      tooBlurry,
      lowContrast,
      oversaturated,
    },
    recommendations,
  }
}

/**
 * Estimate sharpness using a simple edge-variance proxy on grayscale data.
 */
function estimateSharpness(gray: Buffer): number {
  const width = Math.floor(Math.sqrt(gray.length))
  const height = width
  if (width < 3 || height < 3) return 0

  let sum = 0
  let sumSq = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const val = gray[idx]
      const laplacian = Math.abs(
        4 * val -
        gray[idx - 1] -
        gray[idx + 1] -
        gray[idx - width] -
        gray[idx + width]
      )
      sum += laplacian
      sumSq += laplacian * laplacian
      count++
    }
  }

  if (count === 0) return 0
  const mean = sum / count
  const variance = sumSq / count - mean * mean
  return Math.sqrt(Math.max(0, variance))
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return { h: h * 360, s: s * 100, l: l * 255 }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function round(val: number, digits = 2): number {
  const factor = Math.pow(10, digits)
  return Math.round(val * factor) / factor
}
