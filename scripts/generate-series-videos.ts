#!/usr/bin/env node

/**
 * Unified Video Generator for All Fiction Series
 *
 * Generates LTX videos via HuggingFace Gradio Space for any registered series.
 * Supports both I2V (image-to-video, preferred) and T2V (text-to-video, fallback)
 * modes. Reads prompts from per-series JSON configs in public/images/concepts/.
 *
 * Usage:
 *   pnpm tsx scripts/generate-series-videos.ts --series threshold
 *   pnpm tsx scripts/generate-series-videos.ts --series residue --dry-run
 *   pnpm tsx scripts/generate-series-videos.ts --series cartography --article cartography-01-the-unnamed-continent
 *   pnpm tsx scripts/generate-series-videos.ts --all
 *   pnpm tsx scripts/generate-series-videos.ts --all --limit 3
 *   pnpm tsx scripts/generate-series-videos.ts --all --t2v-only
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import fs from 'fs'
import path from 'path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { generateVideoViaHf } from '../lib/video-generation/hf-client'
import { ARTICLE_COLLECTIONS } from '../lib/featured-articles'
import { STORAGE_CONFIG } from '../types/article-media'

// ═══════════════════════════════════════════════════════════════
// SERIES REGISTRY
// ═══════════════════════════════════════════════════════════════

interface SeriesPromptConfig {
  series: string
  description: string
  stylePrefix: string
  styleSuffix: string
  videoStyleSuffix: string
  negativePrompt: string
  articles: Array<{
    slug: string
    title: string
    prompts: Array<{ option: number; model: string; angle: string; prompt: string }>
  }>
}

interface SeriesRegistration {
  key: string
  collectionKey: keyof typeof ARTICLE_COLLECTIONS
  promptsFile: string
  /** LTX resolution — tailored per series visual identity */
  width: number
  height: number
  /** Duration in seconds */
  durationS: number
  /** Preferred prompt option for video motion (1-indexed) */
  preferredPromptOption: number
}

const SERIES_REGISTRY: SeriesRegistration[] = [
  {
    key: 'threshold',
    collectionKey: 'theThreshold',
    promptsFile: 'threshold-series-prompts.json',
    width: 768,
    height: 512, // 3:2 — warm documentary feel
    durationS: 6,
    preferredPromptOption: 2, // quality/intimate angle
  },
  {
    key: 'residue',
    collectionKey: 'theResidue',
    promptsFile: 'residue-series-prompts.json',
    width: 768,
    height: 448, // 16:9 — wide melancholic frames
    durationS: 6,
    preferredPromptOption: 2, // quality/intimate angle
  },
  {
    key: 'cartography',
    collectionKey: 'theCartography',
    promptsFile: 'cartography-series-prompts.json',
    width: 768,
    height: 448, // 16:9 — expansive vistas
    durationS: 8, // longer for the vast, slow reveals
    preferredPromptOption: 2, // quality/abstract angle
  },
  {
    key: 'interface',
    collectionKey: 'theInterface',
    promptsFile: 'interface-series-prompts.json',
    width: 768,
    height: 448,
    durationS: 4,
    preferredPromptOption: 2,
  },
]

// ═══════════════════════════════════════════════════════════════
// PATHS
// ═══════════════════════════════════════════════════════════════

const CONCEPTS_DIR = path.join(process.cwd(), 'public', 'images', 'concepts')
const MULTI_ART_DIR = path.join(process.cwd(), 'public', 'images', 'multi-art')
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'article-videos')

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE = args.includes('--force')
const ALL = args.includes('--all')
const T2V_ONLY = args.includes('--t2v-only')

const seriesIdx = args.indexOf('--series')
const SERIES_FILTER = seriesIdx !== -1 ? args[seriesIdx + 1] : undefined

const articleIdx = args.indexOf('--article')
const SINGLE_ARTICLE = articleIdx !== -1 ? args[articleIdx + 1] : undefined

const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined

if (!ALL && !SERIES_FILTER && !SINGLE_ARTICLE) {
  console.error('Usage: --series <name> | --all | --article <slug>')
  console.error('Available series:', SERIES_REGISTRY.map((s) => s.key).join(', '))
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═══════════════════════════════════════════════════════════════

const hfToken = process.env.HF_TOKEN
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!hfToken && !DRY_RUN) {
  console.error('HF_TOKEN is required. Set it in .env.local')
  process.exit(1)
}

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function loadSeriesConfig(registration: SeriesRegistration): SeriesPromptConfig {
  const filePath = path.join(CONCEPTS_DIR, registration.promptsFile)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompts file not found: ${filePath}`)
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function findSourceImage(slug: string): string | null {
  const dir = path.join(MULTI_ART_DIR, slug)
  if (!fs.existsSync(dir)) return null

  const candidates = ['option-2-dev.png', 'option-2-schnell.png', 'option-1-schnell.png', 'option-3-schnell.png']
  for (const c of candidates) {
    const p = path.join(dir, c)
    if (fs.existsSync(p)) return p
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function uploadToSupabase(
  localPath: string,
  slug: string,
  seriesTitle: string,
  articleTitle: string,
  durationS: number,
  width: number,
  height: number,
  thumbnailLocalPath: string | null
): Promise<boolean> {
  if (!supabase) {
    console.log('   (no Supabase credentials — local only)')
    return false
  }

  try {
    const videoBuffer = fs.readFileSync(localPath)
    const storagePath = `${slug}/ltx-hf-${Date.now()}.mp4`

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_CONFIG.buckets.videos)
      .upload(storagePath, videoBuffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) {
      console.error('   Storage upload failed:', uploadError.message)
      return false
    }

    let thumbnailPath: string | null = null
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      const thumbBuffer = fs.readFileSync(thumbnailLocalPath)
      thumbnailPath = `${slug}/video-thumb.png`
      await supabase.storage
        .from(STORAGE_CONFIG.buckets.images)
        .upload(thumbnailPath, thumbBuffer, { contentType: 'image/png', upsert: true })
    }

    const { error: dbError } = await supabase.from('article_media').insert({
      article_slug: slug,
      media_type: 'video',
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      title: `${articleTitle} — Video`,
      caption: `Generated from ${seriesTitle}`,
      mime_type: 'video/mp4',
      width,
      height,
      duration_seconds: durationS,
      display_order: 0,
      status: 'ready',
      position_x: 50,
      position_y: 50,
      scale: 1.0,
      rotation: 0,
      z_index: 10,
    })

    if (dbError) {
      console.error('   DB insert failed:', dbError.message)
      return false
    }

    console.log(`   Uploaded: ${STORAGE_CONFIG.buckets.videos}/${storagePath}`)
    return true
  } catch (err) {
    console.error('   Upload error:', err)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

interface GenerationResult {
  slug: string
  series: string
  status: 'success' | 'skipped' | 'no-image' | 'failed' | 'error' | 'dry-run'
  mode?: 'I2V' | 'T2V'
  timeMs?: number
}

async function generateForSeries(
  registration: SeriesRegistration,
  results: GenerationResult[]
): Promise<{ success: number; skip: number; fail: number }> {
  const config = loadSeriesConfig(registration)
  const collection = ARTICLE_COLLECTIONS[registration.collectionKey]

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${config.series.toUpperCase()}`)
  console.log(`  ${config.description.slice(0, 80)}...`)
  console.log(`  Resolution: ${registration.width}x${registration.height} | Duration: ${registration.durationS}s`)
  console.log(`${'─'.repeat(60)}`)

  let targetSlugs = SINGLE_ARTICLE
    ? collection.articles.filter((s) => s === SINGLE_ARTICLE)
    : [...collection.articles]

  if (LIMIT && LIMIT < targetSlugs.length) {
    targetSlugs = targetSlugs.slice(0, LIMIT)
  }

  if (targetSlugs.length === 0) {
    console.log('  No matching articles found')
    return { success: 0, skip: 0, fail: 0 }
  }

  const promptMap = new Map(config.articles.map((a) => [a.slug, a]))
  let success = 0
  let skip = 0
  let fail = 0

  for (let i = 0; i < targetSlugs.length; i++) {
    const slug = targetSlugs[i]
    const promptEntry = promptMap.get(slug)
    const title = promptEntry?.title || slug

    console.log(`\n  [${i + 1}/${targetSlugs.length}] ${slug}`)

    // Check existing
    if (!FORCE) {
      const localVideoPath = path.join(OUTPUT_DIR, `${slug}.mp4`)
      if (fs.existsSync(localVideoPath) && fs.statSync(localVideoPath).size > 1000) {
        console.log(`   Exists (${(fs.statSync(localVideoPath).size / 1024).toFixed(0)}KB) — skipping`)
        skip++
        results.push({ slug, series: registration.key, status: 'skipped' })
        continue
      }
    }

    // Source image for I2V
    const imagePath = findSourceImage(slug)
    const useT2V = T2V_ONLY || !imagePath

    if (!imagePath && !T2V_ONLY) {
      console.log(`   No source image — using T2V mode`)
    }

    // Build motion prompt from the preferred option
    const basePrompt =
      promptEntry?.prompts.find((p) => p.option === registration.preferredPromptOption)?.prompt ||
      promptEntry?.prompts[0]?.prompt ||
      `Cinematic scene for ${title}`

    const motionPrompt = `${basePrompt}, ${config.videoStyleSuffix}`

    console.log(`   Mode: ${useT2V ? 'T2V' : 'I2V'}`)
    console.log(`   Prompt: ${motionPrompt.slice(0, 90)}...`)

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would generate ${registration.durationS}s at ${registration.width}x${registration.height}`)
      success++
      results.push({ slug, series: registration.key, status: 'dry-run', mode: useT2V ? 'T2V' : 'I2V' })
      continue
    }

    try {
      const result = await generateVideoViaHf(
        {
          prompt: motionPrompt,
          mode: useT2V ? 'T2V' : 'I2V',
          imagePath: useT2V ? undefined : imagePath!,
          durationS: registration.durationS,
          width: registration.width,
          height: registration.height,
          negativePrompt: config.negativePrompt,
        },
        hfToken!,
        path.join(OUTPUT_DIR, `${slug}.mp4`)
      )

      if (!result.success) {
        console.log(`   FAILED: ${result.error}`)
        fail++
        results.push({
          slug,
          series: registration.key,
          status: 'failed',
          mode: useT2V ? 'T2V' : 'I2V',
          timeMs: result.generationTimeMs,
        })
        await sleep(5000)
        continue
      }

      console.log(
        `   Generated in ${(result.generationTimeMs / 1000).toFixed(1)}s (${result.frames} frames, seed ${result.seed})`
      )

      const localPath = path.join(OUTPUT_DIR, `${slug}.mp4`)
      if (fs.existsSync(localPath)) {
        console.log(`   Saved: ${path.relative(process.cwd(), localPath)}`)
      }

      await uploadToSupabase(
        localPath,
        slug,
        config.series,
        title,
        result.durationS,
        result.width,
        result.height,
        imagePath
      )

      success++
      results.push({
        slug,
        series: registration.key,
        status: 'success',
        mode: useT2V ? 'T2V' : 'I2V',
        timeMs: result.generationTimeMs,
      })

      // Pause between requests
      if (i < targetSlugs.length - 1) {
        console.log(`   Waiting 10s...`)
        await sleep(10000)
      }
    } catch (err) {
      console.error(`   Error:`, err)
      fail++
      results.push({ slug, series: registration.key, status: 'error' })
      await sleep(5000)
    }
  }

  return { success, skip, fail }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('  SERIES VIDEO GENERATOR — HuggingFace LTX-Video Distilled')
  console.log('='.repeat(60))
  console.log(`  Mode:     ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  T2V only: ${T2V_ONLY}`)
  console.log(`  Force:    ${FORCE}`)
  console.log()

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Determine which series to process
  let targetSeries: SeriesRegistration[]
  if (SINGLE_ARTICLE) {
    // Find the series that contains this article
    targetSeries = SERIES_REGISTRY.filter((reg) => {
      const collection = ARTICLE_COLLECTIONS[reg.collectionKey]
      return collection.articles.includes(SINGLE_ARTICLE!)
    })
    if (targetSeries.length === 0) {
      console.error(`Article "${SINGLE_ARTICLE}" not found in any registered series`)
      process.exit(1)
    }
  } else if (ALL) {
    targetSeries = SERIES_REGISTRY
  } else {
    targetSeries = SERIES_REGISTRY.filter((s) => s.key === SERIES_FILTER)
    if (targetSeries.length === 0) {
      console.error(`Unknown series: "${SERIES_FILTER}"`)
      console.error('Available:', SERIES_REGISTRY.map((s) => s.key).join(', '))
      process.exit(1)
    }
  }

  console.log(`  Series: ${targetSeries.map((s) => s.key).join(', ')}`)

  const allResults: GenerationResult[] = []
  let totalSuccess = 0
  let totalSkip = 0
  let totalFail = 0

  for (const reg of targetSeries) {
    const { success, skip, fail } = await generateForSeries(reg, allResults)
    totalSuccess += success
    totalSkip += skip
    totalFail += fail
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('  GENERATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`  Success: ${totalSuccess}`)
  console.log(`  Skipped: ${totalSkip}`)
  console.log(`  Failed:  ${totalFail}`)
  console.log(`  Output:  ${OUTPUT_DIR}`)

  const totalTimeMs = allResults.reduce((sum, r) => sum + (r.timeMs || 0), 0)
  if (totalTimeMs > 0) {
    console.log(`  Total time: ${(totalTimeMs / 60000).toFixed(1)} min`)
    const avgMs = totalTimeMs / allResults.filter((r) => r.timeMs).length
    console.log(`  Avg/video:  ${(avgMs / 1000).toFixed(1)}s`)
  }

  // Write results log
  const logPath = path.join(OUTPUT_DIR, 'series-generation-log.json')
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        config: {
          backend: 'hf-gradio',
          model: 'LTX-Video Distilled',
          dryRun: DRY_RUN,
          t2vOnly: T2V_ONLY,
        },
        seriesProcessed: targetSeries.map((s) => s.key),
        results: allResults,
      },
      null,
      2
    ),
    'utf-8'
  )
  console.log(`  Log: ${path.relative(process.cwd(), logPath)}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
