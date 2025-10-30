/**
 * Image Generation Utility using OpenAI DALL-E 3
 *
 * This module handles the generation and downloading of AI-generated artwork
 * for blog articles using the signature NextDocs Quantum Aesthetic style.
 */

import { Configuration, OpenAIApi } from 'openai'
import fs from 'fs'
import path from 'path'
import https from 'https'
import sharp from 'sharp'

// Initialize OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_KEY,
})
const openai = new OpenAIApi(configuration)

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

  try {
    const response = await openai.createImage({
      model: 'dall-e-3',
      prompt: options.prompt,
      n: 1,
      size: options.size as any, // DALL-E 3 sizes not in old openai package types
      quality: options.quality || 'hd' as any,
      style: options.style || 'vivid' as any,
    } as any)

    const imageData = response.data.data[0] as any

    if (!imageData.url) {
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
    console.error('❌ Error generating image:', error.message)
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
  await sharp(tempPath)
    .resize(1792, 1024, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toFile(heroPath)
  console.log(`✅ Hero image created: ${heroPath}`)

  // Create OG image (1200x630)
  await createOGImage(tempPath, ogPath)

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
