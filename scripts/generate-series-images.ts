#!/usr/bin/env node

/**
 * Series Image Generator — FAL Flux
 *
 * Generates source images for fiction series articles using FAL AI (Flux models).
 * These images serve as I2V anchors for the LTX video pipeline.
 *
 * Reads prompts from per-series JSON configs in public/images/concepts/
 * and outputs to public/images/multi-art/{slug}/.
 *
 * Usage:
 *   pnpm tsx scripts/generate-series-images.ts --series threshold
 *   pnpm tsx scripts/generate-series-images.ts --series residue --option 2
 *   pnpm tsx scripts/generate-series-images.ts --all --dry-run
 *   pnpm tsx scripts/generate-series-images.ts --article threshold-01-the-last-diagnosis
 *   pnpm tsx scripts/generate-series-images.ts --all --option 2 --only-missing
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
// PROXY-AWARE FETCH
// ═══════════════════════════════════════════════════════════════

function getProxyFetch(): typeof globalThis.fetch {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy
  if (proxyUrl) {
    console.warn('generate-series-images: proxy environment detected; native fetch may not honor proxy settings.')
  }
  return globalThis.fetch
}

const proxyFetch = getProxyFetch()

// ═══════════════════════════════════════════════════════════════
// SERIES CONFIG
// ═══════════════════════════════════════════════════════════════

interface SeriesPromptConfig {
  series: string
  description: string
  stylePrefix: string
  styleSuffix: string
  recommendedModels: { fast: string; quality: string }
  imageSize: string
  outputStructure: string
  articles: Array<{
    slug: string
    title: string
    prompts: Array<{ option: number; model: string; angle: string; prompt: string }>
  }>
}

const SERIES_FILES = [
  'threshold-series-prompts.json',
  'residue-series-prompts.json',
  'cartography-series-prompts.json',
]

const CONCEPTS_DIR = path.join(process.cwd(), 'public', 'images', 'concepts')
const MULTI_ART_DIR = path.join(process.cwd(), 'public', 'images', 'multi-art')

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const ALL = args.includes('--all')
const ONLY_MISSING = args.includes('--only-missing')

const seriesIdx = args.indexOf('--series')
const SERIES_FILTER = seriesIdx !== -1 ? args[seriesIdx + 1] : undefined

const articleIdx = args.indexOf('--article')
const SINGLE_ARTICLE = articleIdx !== -1 ? args[articleIdx + 1] : undefined

const optionIdx = args.indexOf('--option')
const OPTION_FILTER = optionIdx !== -1 ? parseInt(args[optionIdx + 1], 10) : undefined

if (!ALL && !SERIES_FILTER && !SINGLE_ARTICLE) {
  console.error('Usage: --series <name> | --all | --article <slug>')
  console.error('Series: threshold, residue, cartography')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═══════════════════════════════════════════════════════════════

const falKey = process.env.FAL_API_KEY || process.env.FAL_KEY

if (!falKey && !DRY_RUN) {
  console.error('FAL_API_KEY or FAL_KEY is required. Set it in .env.local')
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// FAL CLIENT (inline — avoids importing the full art-generation module)
// ═══════════════════════════════════════════════════════════════

async function generateImage(
  modelId: string,
  prompt: string,
  imageSize: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  if (!falKey) return { success: false, error: 'No FAL API key' }

  try {
    const response = await proxyFetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: imageSize,
        num_images: 1,
        enable_safety_checker: false,
      }),
    })

    if (!response.ok) {
      // Queue-based: we get a request_id to poll
      if (response.status === 200 || response.status === 202) {
        // handle below
      } else {
        return { success: false, error: `FAL error ${response.status}: ${await response.text()}` }
      }
    }

    const data = (await response.json()) as {
      images?: Array<{ url: string }>
      request_id?: string
      status?: string
    }

    // If we got images immediately (synchronous response)
    if (data.images?.[0]?.url) {
      return { success: true, imageUrl: data.images[0].url }
    }

    // Queue-based: poll for result
    if (data.request_id) {
      return await pollFalResult(modelId, data.request_id)
    }

    return { success: false, error: 'Unexpected FAL response format' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function pollFalResult(
  modelId: string,
  requestId: string,
  maxWaitMs = 120_000
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const startTime = Date.now()
  const pollInterval = 3000

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollInterval))

    try {
      const statusRes = await proxyFetch(`https://queue.fal.run/${modelId}/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${falKey}` },
      })

      const statusData = (await statusRes.json()) as { status: string }

      if (statusData.status === 'COMPLETED') {
        const resultRes = await proxyFetch(`https://queue.fal.run/${modelId}/requests/${requestId}`, {
          headers: { Authorization: `Key ${falKey}` },
        })
        const resultData = (await resultRes.json()) as { images?: Array<{ url: string }> }
        if (resultData.images?.[0]?.url) {
          return { success: true, imageUrl: resultData.images[0].url }
        }
        return { success: false, error: 'No image in completed result' }
      }

      if (statusData.status === 'FAILED') {
        return { success: false, error: 'FAL generation failed' }
      }
    } catch {
      // polling error, retry
    }
  }

  return { success: false, error: 'FAL generation timed out' }
}

async function downloadImage(url: string, outputPath: string): Promise<boolean> {
  try {
    const response = await proxyFetch(url)
    if (!response.ok) return false
    const buffer = Buffer.from(await response.arrayBuffer())
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(outputPath, buffer)
    return true
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

function getModelShort(modelId: string): string {
  if (modelId.includes('schnell')) return 'schnell'
  if (modelId.includes('dev')) return 'dev'
  return 'gen'
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  SERIES IMAGE GENERATOR — FAL Flux')
  console.log('='.repeat(60))
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log()

  // Load all series configs
  const allConfigs: Array<{ filename: string; config: SeriesPromptConfig }> = []
  for (const file of SERIES_FILES) {
    const filePath = path.join(CONCEPTS_DIR, file)
    if (fs.existsSync(filePath)) {
      allConfigs.push({ filename: file, config: JSON.parse(fs.readFileSync(filePath, 'utf-8')) })
    }
  }

  // Filter to target series
  let targetConfigs = allConfigs
  if (SERIES_FILTER) {
    targetConfigs = allConfigs.filter((c) =>
      c.config.series.toLowerCase().includes(SERIES_FILTER!.toLowerCase())
    )
    if (targetConfigs.length === 0) {
      console.error(`No series matching "${SERIES_FILTER}"`)
      process.exit(1)
    }
  }

  let totalGenerated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const { config } of targetConfigs) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`  ${config.series.toUpperCase()}`)
    console.log(`  Style: ${config.stylePrefix.slice(0, 60)}...`)
    console.log(`${'─'.repeat(60)}`)

    let articles = config.articles
    if (SINGLE_ARTICLE) {
      articles = articles.filter((a) => a.slug === SINGLE_ARTICLE)
    }

    for (const article of articles) {
      console.log(`\n  ${article.slug} — "${article.title}"`)

      const prompts = OPTION_FILTER
        ? article.prompts.filter((p) => p.option === OPTION_FILTER)
        : article.prompts

      for (const promptEntry of prompts) {
        const modelId = promptEntry.model === 'fast'
          ? config.recommendedModels.fast
          : config.recommendedModels.quality
        const modelShort = getModelShort(modelId)

        const outputFilename = `option-${promptEntry.option}-${modelShort}.png`
        const outputPath = path.join(MULTI_ART_DIR, article.slug, outputFilename)

        // Check if exists
        if (ONLY_MISSING && fs.existsSync(outputPath)) {
          console.log(`   [${promptEntry.option}] ${promptEntry.angle} — exists, skipping`)
          totalSkipped++
          continue
        }

        const fullPrompt = `${config.stylePrefix}, ${promptEntry.prompt}, ${config.styleSuffix}`

        console.log(`   [${promptEntry.option}] ${promptEntry.angle} (${modelShort})`)
        console.log(`     ${fullPrompt.slice(0, 80)}...`)

        if (DRY_RUN) {
          console.log(`     [DRY RUN] Would generate via ${modelId}`)
          console.log(`     Output: ${path.relative(process.cwd(), outputPath)}`)
          totalGenerated++
          continue
        }

        const result = await generateImage(modelId, fullPrompt, config.imageSize)

        if (!result.success || !result.imageUrl) {
          console.log(`     FAILED: ${result.error}`)
          totalFailed++
          continue
        }

        const saved = await downloadImage(result.imageUrl, outputPath)
        if (saved) {
          console.log(`     Saved: ${path.relative(process.cwd(), outputPath)}`)
          totalGenerated++
        } else {
          console.log(`     Failed to download`)
          totalFailed++
        }

        // Brief pause between generations
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('  IMAGE GENERATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`  Generated: ${totalGenerated}`)
  console.log(`  Skipped:   ${totalSkipped}`)
  console.log(`  Failed:    ${totalFailed}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
