#!/usr/bin/env node

/**
 * Series Art Generator
 *
 * Generates 3 image options per article using curated series prompts.
 * Reads from public/images/concepts/{series}-series-prompts.json
 * Outputs to public/images/multi-art/{slug}/option-{N}-{model}.png
 *
 * Usage:
 *   npx tsx scripts/generate-series-art.ts                    # All 3 series
 *   npx tsx scripts/generate-series-art.ts --series threshold # One series
 *   npx tsx scripts/generate-series-art.ts --dry-run          # Preview only
 */

import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'

// Load .env if present
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config()
} catch {
  // dotenv not required if env vars already set
}

const FAL_BASE_URL = 'https://fal.run'
const FAL_KEY = process.env.FAL_KEY || ''

if (!FAL_KEY) {
  console.error('FAL_KEY not set in environment')
  process.exit(1)
}

const SERIES_NAMES = ['threshold', 'residue', 'cartography']
const OUTPUT_BASE = path.join(process.cwd(), 'public', 'images', 'multi-art')
const PROMPTS_BASE = path.join(process.cwd(), 'public', 'images', 'concepts')

interface SeriesPrompts {
  series: string
  stylePrefix: string
  styleSuffix: string
  negativePrompt: string
  recommendedModels: { fast: string; quality: string }
  imageSize: string
  articles: Array<{
    slug: string
    title: string
    prompts: Array<{
      option: number
      model: 'fast' | 'quality'
      angle: string
      prompt: string
    }>
  }>
}

function getModelShortName(modelId: string): string {
  const parts = modelId.split('/')
  return parts[parts.length - 1]
}

async function downloadImage(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const file = fs.createWriteStream(dest)
    const protocol = url.startsWith('https') ? https : http
    protocol
      .get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            downloadImage(redirectUrl, dest).then(resolve).catch(reject)
            return
          }
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {})
        reject(err)
      })
  })
}

async function generateImage(
  modelId: string,
  prompt: string,
  negativePrompt: string,
  imageSize: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const endpoint = `${FAL_BASE_URL}/${modelId}`

  const payload: Record<string, unknown> = {
    prompt,
    image_size: imageSize,
    num_images: 1,
  }

  // Add negative prompt for models that support it (non-flux)
  if (!modelId.includes('flux')) {
    payload.negative_prompt = negativePrompt
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `FAL ${response.status}: ${errorText.slice(0, 200)}` }
    }

    const data = (await response.json()) as Record<string, unknown>
    const images = data.images as Array<{ url: string }> | undefined
    const image = data.image as { url: string } | undefined
    const imageUrl = images?.[0]?.url || image?.url

    if (!imageUrl) {
      return { success: false, error: 'No image URL in response' }
    }

    return { success: true, imageUrl }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Timeout after 2 minutes' }
    }
    return { success: false, error: String(err) }
  }
}

async function processArticle(
  series: SeriesPrompts,
  article: SeriesPrompts['articles'][0],
  dryRun: boolean
): Promise<{ generated: number; failed: number }> {
  const slugDir = path.join(OUTPUT_BASE, article.slug)
  let generated = 0
  let failed = 0

  for (const promptConfig of article.prompts) {
    const modelId = series.recommendedModels[promptConfig.model]
    const modelShort = getModelShortName(modelId)
    const outputFile = path.join(slugDir, `option-${promptConfig.option}-${modelShort}.png`)

    // Skip if already exists
    if (fs.existsSync(outputFile)) {
      console.log(`    [skip] option-${promptConfig.option} already exists`)
      generated++
      continue
    }

    const fullPrompt = `${series.stylePrefix}, ${promptConfig.prompt}, ${series.styleSuffix}`

    if (dryRun) {
      console.log(`    [dry-run] option-${promptConfig.option} (${modelShort})`)
      console.log(`      prompt: ${fullPrompt.slice(0, 120)}...`)
      generated++
      continue
    }

    console.log(`    [gen] option-${promptConfig.option} (${modelShort}, ${promptConfig.angle})...`)

    const result = await generateImage(modelId, fullPrompt, series.negativePrompt, series.imageSize)

    if (result.success && result.imageUrl) {
      try {
        await downloadImage(result.imageUrl, outputFile)
        const stat = fs.statSync(outputFile)
        console.log(`    [ok]  option-${promptConfig.option} saved (${Math.round(stat.size / 1024)}KB)`)
        generated++
      } catch (err) {
        console.log(`    [err] option-${promptConfig.option} download failed: ${err}`)
        failed++
      }
    } else {
      console.log(`    [err] option-${promptConfig.option}: ${result.error}`)
      failed++
    }

    // Brief pause between requests to be polite
    await new Promise((r) => setTimeout(r, 500))
  }

  return { generated, failed }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const seriesArg = args.find((a, i) => args[i - 1] === '--series')

  const seriesToProcess = seriesArg ? [seriesArg] : SERIES_NAMES

  console.log(`\nSeries Art Generator`)
  console.log(`====================`)
  if (dryRun) console.log('(DRY RUN - no images will be generated)\n')

  let totalGenerated = 0
  let totalFailed = 0

  for (const seriesName of seriesToProcess) {
    const promptsFile = path.join(PROMPTS_BASE, `${seriesName}-series-prompts.json`)

    if (!fs.existsSync(promptsFile)) {
      console.log(`\n[skip] ${seriesName}: prompts file not found`)
      continue
    }

    const series: SeriesPrompts = JSON.parse(fs.readFileSync(promptsFile, 'utf-8'))
    console.log(`\n${series.series} (${series.articles.length} articles, 3 images each)`)
    console.log(`${'─'.repeat(50)}`)

    for (const article of series.articles) {
      console.log(`\n  ${article.title} (${article.slug})`)
      const result = await processArticle(series, article, dryRun)
      totalGenerated += result.generated
      totalFailed += result.failed
    }
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`Done: ${totalGenerated} generated, ${totalFailed} failed`)
  console.log(`Total images: ${totalGenerated} across ${seriesToProcess.length} series\n`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
