/**
 * Image Generation Utility using OpenAI DALL-E 3
 *
 * This module handles the generation and downloading of AI-generated artwork
 * for blog articles using the signature NextDocs Quantum Aesthetic style.
 */

import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import https from 'https'
import sharp from 'sharp'
import { randomFillSync } from 'crypto'

let cachedOpenAI: OpenAI | null = null

function getOpenAIKey(): string {
  const raw = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ''
  // Common misconfiguration: pasting `Bearer <key>` into env vars.
  return raw.replace(/^Bearer\s+/i, '').trim()
}

function getOpenAIClient(): OpenAI {
  if (cachedOpenAI) return cachedOpenAI

  const apiKey = getOpenAIKey()
  if (!apiKey) {
    throw new Error(
      'Missing OpenAI API key. Set OPENAI_API_KEY (preferred) or OPENAI_KEY in .env.local'
    )
  }

  cachedOpenAI = new OpenAI({ apiKey })
  return cachedOpenAI
}

export interface ImageGenerationOptions {
  prompt: string
  size: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
}

export interface GeneratedImage {
  url: string
  revisedPrompt?: string
}

/**
 * Generate an image using DALL-E 3
 */
export async function generateImage(
  options: ImageGenerationOptions
): Promise<GeneratedImage> {
  console.log(`🎨 Generating image with DALL-E 3...`)
  console.log(`   Size: ${options.size}`)
  console.log(`   Quality: ${options.quality || 'hd'}`)

  const maxPromptChars = Number(process.env.DALLE_PROMPT_MAX_CHARS || 3200)
  const prompt =
    options.prompt.length > maxPromptChars
      ? options.prompt.slice(0, maxPromptChars)
      : options.prompt

  if (prompt.length !== options.prompt.length) {
    console.log(
      `✂️  Truncated prompt to ${maxPromptChars} chars (was ${options.prompt.length})`
    )
  }

  try {
    const openai = getOpenAIClient()
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: options.size,
      quality: options.quality || 'hd',
      style: options.style || 'vivid',
    })

    const imageData = response.data ? response.data[0] : null

    if (!imageData || !imageData.url) {
      throw new Error('No image URL returned from OpenAI')
    }

    console.log(`✅ Image generated successfully`)
    if (imageData.revised_prompt) {
      console.log(`   Revised prompt: ${imageData.revised_prompt.substring(0, 100)}...`)
    }

    return {
      url: imageData.url,
      revisedPrompt: imageData.revised_prompt,
    }
  } catch (error: any) {
    // OpenAI v4 error handling
    if (error instanceof OpenAI.APIError) {
      console.error(`❌ Error generating image: HTTP ${error.status}`)
      console.error(`   OpenAI: ${error.message}`)
      console.error(`   Code: ${error.code}`)
      console.error(`   Type: ${error.type}`)
    } else {
      console.error('❌ Error generating image:', error.message || error)
    }
    throw error
  }
}

/**
 * Download an image from a URL
 */
export async function downloadImage(
  url: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath)

    https
      .get(url, (response) => {
        response.pipe(file)

        file.on('finish', () => {
          file.close()
          console.log(`💾 Image downloaded to: ${outputPath}`)
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlinkSync(outputPath)
        reject(err)
      })
  })
}

/**
 * Crop and resize image for Open Graph (1200x630)
 */
export async function createOGImage(
  sourcePath: string,
  outputPath: string
): Promise<void> {
  console.log(`🖼️  Creating OG image (1200x630)...`)

  try {
    await sharp(sourcePath)
      .resize(1200, 630, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath)

    console.log(`✅ OG image created: ${outputPath}`)
  } catch (error: any) {
    console.error(`❌ Error creating OG image:`, error.message)
    throw error
  }
}

async function createNoiseOverlayPng(width: number, height: number, opacity: number): Promise<Buffer> {
  const channels = 1
  const buf = Buffer.alloc(width * height * channels)
  randomFillSync(buf)

  const multiplier = opacity
  const offset = 128 * (1 - opacity)

  // Make it look like film grain: a touch of blur and reduced contrast.
  return sharp(buf, { raw: { width, height, channels } })
    .blur(0.35)
    .linear(multiplier, offset)
    .png()
    .toBuffer()
}

function createVignetteSvg(width: number, height: number, strength: number): Buffer {
  const s = Math.max(0, Math.min(1, strength))
  const edge = (0.15 + 0.35 * s).toFixed(3)
  const alpha = (0.25 + 0.45 * s).toFixed(3)
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="v" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="${edge}" stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,${alpha})"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill="url(#v)"/>
    </svg>
  `.trim()
  return Buffer.from(svg)
}

async function renderCinematicJpeg(params: {
  sourcePath: string
  outputPath: string
  width: number
  height: number
}): Promise<void> {
  const enable = String(process.env.FILM_GRADE || '1') !== '0'
  const grainStrength = Number(process.env.FILM_GRAIN || 0.085)
  const vignetteStrength = Number(process.env.FILM_VIGNETTE || 0.55)

  let pipeline = sharp(params.sourcePath)
    .resize(params.width, params.height, { fit: 'cover', position: 'center' })

  if (enable) {
    // Subtle grade to reduce the synthetic look.
    pipeline = pipeline
      .modulate({ saturation: 0.92 })
      .gamma(1.03)
      .linear(1.02, -2)

    const overlays: sharp.OverlayOptions[] = []

    if (grainStrength > 0) {
      const opacity = Math.min(0.2, grainStrength)
      const noisePng = await createNoiseOverlayPng(params.width, params.height, opacity)
      overlays.push({ input: noisePng, blend: 'overlay' })
    }

    if (vignetteStrength > 0) {
      const vignette = createVignetteSvg(params.width, params.height, vignetteStrength)
      overlays.push({ input: vignette, blend: 'multiply' })
    }

    if (overlays.length) {
      pipeline = pipeline.composite(overlays)
    }
  }

  await pipeline.jpeg({ quality: 90 }).toFile(params.outputPath)
}

/**
 * Generate and save article artwork
 */
export async function generateArticleArtwork(
  slug: string,
  prompt: string,
  outputDir: string
): Promise<{ heroPath: string; ogPath: string }> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🎨 Generating artwork for article: ${slug}`)
  console.log(`${'='.repeat(60)}`)

  // Generate the base image (1792x1024 - wide landscape)
  const generatedImage = await generateImage({
    prompt,
    size: '1792x1024',
    quality: 'hd',
    style: 'vivid',
  })

  // Define output paths
  const heroPath = path.join(outputDir, 'articles', `${slug}.jpg`)
  const ogPath = path.join(outputDir, 'og', `${slug}.jpg`)
  const tempPath = path.join(outputDir, `temp-${slug}.png`)

  // Download the generated image
  await downloadImage(generatedImage.url, tempPath)

  // Create hero image (optimize and convert to JPG)
  console.log(`🖼️  Creating hero image...`)
  await renderCinematicJpeg({
    sourcePath: tempPath,
    outputPath: heroPath,
    width: 1792,
    height: 1024,
  })
  console.log(`✅ Hero image created: ${heroPath}`)

  // Create OG image (1200x630)
  console.log(`🖼️  Creating OG image (1200x630)...`)
  await renderCinematicJpeg({
    sourcePath: tempPath,
    outputPath: ogPath,
    width: 1200,
    height: 630,
  })
  console.log(`✅ OG image created: ${ogPath}`)

  // Clean up temp file
  fs.unlinkSync(tempPath)

  // Return relative paths for use in frontmatter
  return {
    heroPath: `/images/articles/${slug}.jpg`,
    ogPath: `/images/og/${slug}.jpg`,
  }
}

/**
 * Check if artwork already exists for an article
 */
export function artworkExists(slug: string, outputDir: string): boolean {
  const heroPath = path.join(outputDir, 'articles', `${slug}.jpg`)
  const ogPath = path.join(outputDir, 'og', `${slug}.jpg`)

  return fs.existsSync(heroPath) && fs.existsSync(ogPath)
}

/**
 * Estimate cost for generating images
 */
export function estimateCost(imageCount: number): number {
  // DALL-E 3 HD pricing: $0.080 per image (1792x1024)
  const pricePerImage = 0.08
  return imageCount * pricePerImage
}
