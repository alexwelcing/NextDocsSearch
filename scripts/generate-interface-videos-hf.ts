#!/usr/bin/env node

/**
 * Generate LTX videos for The Interface series via HuggingFace Gradio Space.
 *
 * Uses existing multi-art images (option-2-dev.png) as I2V anchors
 * and the original prompts to drive motion. Output goes to Supabase
 * article-videos bucket + article_media table, and optionally to disk.
 *
 * Usage:
 *   pnpm tsx scripts/generate-interface-videos-hf.ts
 *   pnpm tsx scripts/generate-interface-videos-hf.ts --dry-run
 *   pnpm tsx scripts/generate-interface-videos-hf.ts --article interface-01-the-first-translator
 *   pnpm tsx scripts/generate-interface-videos-hf.ts --limit 5
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config() // also load .env if it exists

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { generateVideoViaHf } from '../lib/video-generation/hf-client'
import { ARTICLE_COLLECTIONS } from '../lib/featured-articles'

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const MULTI_ART_DIR = path.join(process.cwd(), 'public', 'images', 'multi-art')
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'article-videos')
const PROMPTS_FILE = path.join(
  process.cwd(),
  'public',
  'images',
  'concepts',
  'interface-series-prompts.json'
)

/** LTX generation settings — 768x448 (16:9 matching source images), 4s */
const LTX_WIDTH = 768
const LTX_HEIGHT = 448
const LTX_DURATION_S = 4
const STYLE_SUFFIX =
  'cinematic slow camera drift, shallow depth of field, volumetric haze, subtle particle movement, 35mm film grain, no text overlays'

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined
const articleIdx = args.indexOf('--article')
const SINGLE_ARTICLE = articleIdx !== -1 ? args[articleIdx + 1] : undefined
const FORCE = args.includes('--force')

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═══════════════════════════════════════════════════════════════

const hfToken = process.env.HF_TOKEN
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alexwelcing.com'

if (!hfToken && !DRY_RUN) {
  console.error('❌ HF_TOKEN is required. Set it in .env.local')
  process.exit(1)
}

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

interface PromptEntry {
  slug: string
  title: string
  prompts: Array<{ option: number; model: string; angle: string; prompt: string }>
}

function loadPrompts(): Map<string, PromptEntry> {
  const raw = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf-8'))
  const map = new Map<string, PromptEntry>()
  for (const entry of raw.articles) {
    map.set(entry.slug, entry)
  }
  return map
}

function findSourceImage(slug: string): string | null {
  // Prefer option-2-dev.png (quality), fall back to option-1
  const dir = path.join(MULTI_ART_DIR, slug)
  if (!fs.existsSync(dir)) return null

  const candidates = ['option-2-dev.png', 'option-1-schnell.png', 'option-3-schnell.png']
  for (const c of candidates) {
    const p = path.join(dir, c)
    if (fs.existsSync(p)) return p
  }
  return null
}

/**
 * Upload a local video file to Supabase storage and record in article_media.
 */
async function uploadToSupabase(
  localPath: string,
  slug: string,
  title: string,
  durationS: number,
  width: number,
  height: number,
  thumbnailLocalPath: string | null
): Promise<boolean> {
  if (!supabase) {
    console.log('   ⚠️  No Supabase credentials — skipping upload')
    return false
  }

  try {
    const videoBuffer = fs.readFileSync(localPath)
    const storagePath = `${slug}/ltx-hf-${Date.now()}.mp4`

    const { error: uploadError } = await supabase.storage
      .from('article-videos')
      .upload(storagePath, videoBuffer, {
        contentType: 'video/mp4',
        upsert: true,
      })

    if (uploadError) {
      console.error('   ❌ Storage upload failed:', uploadError.message)
      return false
    }

    // Upload thumbnail if available
    let thumbnailPath: string | null = null
    if (thumbnailLocalPath && fs.existsSync(thumbnailLocalPath)) {
      const thumbBuffer = fs.readFileSync(thumbnailLocalPath)
      thumbnailPath = `${slug}/video-thumb.png`
      await supabase.storage.from('article-images').upload(thumbnailPath, thumbBuffer, {
        contentType: 'image/png',
        upsert: true,
      })
    }

    // Insert into article_media table
    const { error: dbError } = await supabase.from('article_media').insert({
      article_slug: slug,
      media_type: 'video',
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      title: `${title} — Video`,
      caption: `Generated from The Interface series`,
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
      console.error('   ❌ DB insert failed:', dbError.message)
      return false
    }

    console.log(`   ☁️  Uploaded: article-videos/${storagePath}`)
    return true
  } catch (err) {
    console.error('   ❌ Upload error:', err)
    return false
  }
}

async function hasExistingVideo(slug: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('article_media')
    .select('id')
    .eq('article_slug', slug)
    .eq('media_type', 'video')
    .eq('status', 'ready')
    .limit(1)
  return (data?.length || 0) > 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('🎬 INTERFACE SERIES — HF LTX VIDEO GENERATION')
  console.log('═'.repeat(60))
  console.log(`   Backend:    HuggingFace Gradio Space (LTX-Video Distilled)`)
  console.log(`   Mode:       I2V (image-to-video)`)
  console.log(`   Resolution: ${LTX_WIDTH}×${LTX_HEIGHT}`)
  console.log(`   Duration:   ${LTX_DURATION_S}s`)
  console.log(`   Dry run:    ${DRY_RUN}`)
  console.log()

  const prompts = loadPrompts()
  const interfaceSlugs = ARTICLE_COLLECTIONS.theInterface.articles

  let targetSlugs = SINGLE_ARTICLE ? [SINGLE_ARTICLE] : [...interfaceSlugs]
  if (LIMIT && LIMIT < targetSlugs.length) {
    targetSlugs = targetSlugs.slice(0, LIMIT)
  }

  console.log(`🎯 ${targetSlugs.length} articles to process\n`)

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  let successCount = 0
  let skipCount = 0
  let failCount = 0
  const results: Array<{ slug: string; status: string; timeMs?: number }> = []

  for (let i = 0; i < targetSlugs.length; i++) {
    const slug = targetSlugs[i]
    const promptEntry = prompts.get(slug)
    const title = promptEntry?.title || slug

    console.log(`[${i + 1}/${targetSlugs.length}] ${slug}`)

    // Check for existing video (local file or Supabase)
    if (!FORCE) {
      const localVideoPath = path.join(OUTPUT_DIR, `${slug}.mp4`)
      if (fs.existsSync(localVideoPath) && fs.statSync(localVideoPath).size > 1000) {
        console.log(`   ⏭️  Local video exists (${(fs.statSync(localVideoPath).size / 1024).toFixed(0)}KB) — skipping`)
        skipCount++
        results.push({ slug, status: 'skipped' })
        continue
      }
      const exists = await hasExistingVideo(slug)
      if (exists) {
        console.log(`   ⏭️  Video already exists in Supabase — skipping`)
        skipCount++
        results.push({ slug, status: 'skipped' })
        continue
      }
    }

    // Find source image
    const imagePath = findSourceImage(slug)
    if (!imagePath) {
      console.log(`   ⚠️  No source image found — skipping`)
      skipCount++
      results.push({ slug, status: 'no-image' })
      continue
    }

    // Build motion prompt from the option-2 prompt (quality angle)
    const basePrompt =
      promptEntry?.prompts.find((p) => p.option === 2)?.prompt ||
      promptEntry?.prompts[0]?.prompt ||
      `Cinematic scene for ${title}`

    const motionPrompt = `${basePrompt}, ${STYLE_SUFFIX}`

    console.log(`   📷 Source: ${path.basename(imagePath)}`)
    console.log(`   📝 Prompt: ${motionPrompt.slice(0, 80)}...`)

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would generate ${LTX_DURATION_S}s video at ${LTX_WIDTH}×${LTX_HEIGHT}`)
      successCount++
      results.push({ slug, status: 'dry-run' })
      continue
    }

    try {
      const result = await generateVideoViaHf(
        {
          prompt: motionPrompt,
          mode: 'I2V',
          imagePath: imagePath,
          durationS: LTX_DURATION_S,
          width: LTX_WIDTH,
          height: LTX_HEIGHT,
          negativePrompt:
            'worst quality, inconsistent motion, blurry, jittery, distorted, text, watermark, logo',
        },
        hfToken!,
        path.join(OUTPUT_DIR, `${slug}.mp4`)
      )

      if (!result.success) {
        console.log(`   ❌ Generation failed: ${result.error}`)
        failCount++
        results.push({ slug, status: 'failed', timeMs: result.generationTimeMs })

        // Wait before retrying the next one (HF rate limits)
        await sleep(5000)
        continue
      }

      console.log(
        `   ✅ Generated in ${(result.generationTimeMs / 1000).toFixed(1)}s (${result.frames} frames)`
      )

      // Save locally
      const localPath = path.join(OUTPUT_DIR, `${slug}.mp4`)
      if (fs.existsSync(localPath)) {
        console.log(`   💾 Saved: ${path.relative(process.cwd(), localPath)}`)
      }

      // Upload to Supabase
      await uploadToSupabase(
        localPath,
        slug,
        title,
        result.durationS,
        result.width,
        result.height,
        imagePath // Use the source image as thumbnail
      )

      successCount++
      results.push({ slug, status: 'success', timeMs: result.generationTimeMs })

      // Brief pause between requests to avoid hammering the HF queue
      if (i < targetSlugs.length - 1) {
        console.log(`   ⏳ Waiting 10s before next request...`)
        await sleep(10000)
      }
    } catch (err) {
      console.error(`   ❌ Error:`, err)
      failCount++
      results.push({ slug, status: 'error' })
      await sleep(5000)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60))
  console.log('📊 GENERATION COMPLETE')
  console.log('═'.repeat(60))
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ⏭️  Skipped: ${skipCount}`)
  console.log(`   ❌ Failed:  ${failCount}`)
  console.log(`   📁 Output:  ${OUTPUT_DIR}`)

  const totalTimeMs = results.reduce((sum, r) => sum + (r.timeMs || 0), 0)
  if (totalTimeMs > 0) {
    console.log(`   ⏱️  Total generation time: ${(totalTimeMs / 60000).toFixed(1)} min`)
    const avgMs = totalTimeMs / results.filter((r) => r.timeMs).length
    console.log(`   📈 Average per video: ${(avgMs / 1000).toFixed(1)}s`)
  }

  // Write results log
  const logPath = path.join(OUTPUT_DIR, 'interface-generation-log.json')
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        config: {
          backend: 'hf-gradio',
          model: 'LTX-Video Distilled',
          mode: 'I2V',
          width: LTX_WIDTH,
          height: LTX_HEIGHT,
          durationS: LTX_DURATION_S,
        },
        results,
      },
      null,
      2
    ),
    'utf-8'
  )
  console.log(`   📋 Log: ${path.relative(process.cwd(), logPath)}`)
  console.log()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
