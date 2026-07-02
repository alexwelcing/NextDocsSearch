/**
 * ACC Batch Generate & Grade Article Images
 *
 * Uses the Agent Command Center (ACC) Elixir ComfyUI queue manager
 * to generate article images with backpressure, then grades them
 * programmatically and stores results.
 *
 * The ACC repo is expected to be running at ../agent-command-center-ex
 * (default URL: http://localhost:4000)
 *
 * Usage:
 *   npx tsx scripts/acc-batch-generate-and-grade.ts [--preview] [--limit N] [--offset N] [--force] [--min-score 6.5] [--auto-retry]
 *
 * Options:
 *   --preview      Show what would be generated without submitting
 *   --limit N      Only process N articles
 *   --offset N     Skip the first N articles (use with --limit for pagination)
 *   --force        Regenerate even if image already exists
 *   --min-score N  Minimum overall grade to accept (default: 5.0)
 *   --auto-retry   Re-queue with a different seed if grade is below min-score
 *   --svg-only     Only process articles with SVG images
 */

import * as fs from 'fs'
import * as path from 'path'
import { getACCClient, ACCQueueClient } from '../lib/acc-queue/client'
import { gradeImage, GradeResult } from '../lib/image-grading/grader'
import { getGenerationOrchestrator } from '../lib/orchestrator/orchestrator'

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const isPreview = args.includes('--preview')
const force = args.includes('--force')
const svgOnly = args.includes('--svg-only')
const autoRetry = args.includes('--auto-retry')
const ensureServices = !args.includes('--no-ensure-services')
const limitIndex = args.indexOf('--limit')
const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) || undefined : undefined
const offsetIndex = args.indexOf('--offset')
const offset = offsetIndex >= 0 ? parseInt(args[offsetIndex + 1]) || 0 : 0
const minScoreIndex = args.indexOf('--min-score')
const minScore = minScoreIndex >= 0 ? parseFloat(args[minScoreIndex + 1]) || 5.0 : 5.0

// ─── Paths ───────────────────────────────────────────────────────────────────

const MANIFEST_PATH = path.join(process.cwd(), 'lib/generated/article-manifest.json')
const IMAGE_MANIFEST_PATH = path.join(process.cwd(), 'lib/generated/image-manifest.json')
const GRADE_DB_PATH = path.join(process.cwd(), 'lib/generated/image-grades.json')
const GRADE_APPEND_PATH = path.join(process.cwd(), 'lib/generated/image-grades-append.ndjson')
const OUTPUT_DIR = path.join(process.cwd(), 'public/images/articles')

// ─── Types ───────────────────────────────────────────────────────────────────

interface Article {
  slug: string
  title: string
  description: string
  articleType?: string
  keywords?: string[]
}

interface ImageManifestEntry {
  heroImage?: string | null
  articleJpg?: string | null
  articleSvg?: string | null
}

interface GradeRecord {
  slug: string
  filename: string
  generatedAt: string
  jobId: string
  grade: GradeResult
  accepted: boolean
  retries: number
}

interface GradeDB {
  version: string
  updatedAt: string
  entries: Record<string, GradeRecord>
}

// ─── Prompt Templates ────────────────────────────────────────────────────────

const PROMPT_TEMPLATES: Record<string, (article: Article) => string> = {
  fiction: (article) => {
    const baseKeywords = article.keywords?.slice(0, 4).join(', ') || ''
    return `Cinematic science fiction scene: ${article.title}. ${baseKeywords}. Dramatic lighting, photorealistic concept art, moody atmosphere, futuristic setting, professional digital art, 8k, highly detailed, z_image style`
  },
  research: (article) => {
    return `Technical research visualization: ${article.title}. Clean modern design, data visualization aesthetic, blue gradient background, professional tech illustration, abstract conceptual art, minimalist composition, z_image style`
  },
  default: (article) => {
    return `Abstract conceptual illustration: ${article.title}. ${article.description?.slice(0, 100) || ''}. Modern digital art style, professional quality, clean composition, visual metaphor, z_image style`
  },
}

// ─── Workflow Builder ────────────────────────────────────────────────────────

function buildZImageWorkflow(article: Article, seed: number) {
  const promptBuilder = PROMPT_TEMPLATES[article.articleType || 'default'] || PROMPT_TEMPLATES.default
  const prompt = promptBuilder(article)

  return {
    workflow: {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: 'juggernautXL_ragnarokBy.safetensors',
        },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['1', 1],
        },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: 'cartoon, illustration, anime, low quality, blurry, text, watermark, signature, amateur, distorted, ugly, deformed',
          clip: ['1', 1],
        },
      },
      '4': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
      },
      '5': {
        class_type: 'KSampler',
        inputs: {
          seed,
          steps: 20,
          cfg: 7.0,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1.0,
          model: ['1', 0],
          positive: ['2', 0],
          negative: ['3', 0],
          latent_image: ['4', 0],
        },
      },
      '6': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['5', 0],
          vae: ['1', 2],
        },
      },
      '7': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: `article_${article.slug}`,
          images: ['6', 0],
        },
      },
    },
    prompt,
  }
}

// ─── Manifest Helpers ────────────────────────────────────────────────────────

function loadArticlesNeedingImages(): Article[] {
  const articles: Article[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'))
  const imageManifest: Record<string, ImageManifestEntry> = JSON.parse(
    fs.readFileSync(IMAGE_MANIFEST_PATH, 'utf-8')
  )

  return articles.filter((article) => {
    const entry = imageManifest[article.slug]

    if (force) return true

    if (svgOnly) {
      return entry?.articleSvg && !entry?.articleJpg
    }

    return (
      !entry ||
      entry.heroImage?.endsWith('.svg') ||
      (!entry.heroImage && !entry.articleJpg)
    )
  })
}

function updateImageManifest(slug: string) {
  const manifest = JSON.parse(fs.readFileSync(IMAGE_MANIFEST_PATH, 'utf-8'))
  if (!manifest[slug]) manifest[slug] = {}
  manifest[slug].heroImage = `/images/articles/${slug}.jpg`
  manifest[slug].articleJpg = `/images/articles/${slug}.jpg`
  fs.writeFileSync(IMAGE_MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

function loadGradeDB(): GradeDB {
  if (fs.existsSync(GRADE_DB_PATH)) {
    return JSON.parse(fs.readFileSync(GRADE_DB_PATH, 'utf-8'))
  }
  return { version: '1.0', updatedAt: new Date().toISOString(), entries: {} }
}

function saveGradeDB(db: GradeDB) {
  db.updatedAt = new Date().toISOString()
  fs.writeFileSync(GRADE_DB_PATH, JSON.stringify(db, null, 2))
}

// ─── Core Pipeline ───────────────────────────────────────────────────────────

async function generateAndGrade(
  acc: ACCQueueClient,
  article: Article,
  gradeDB: GradeDB,
  retryCount = 0
): Promise<{ success: boolean; grade?: GradeResult; filename?: string; jobId: string }> {
  const seed = Math.floor(Math.random() * 1000000) + retryCount * 137
  const { workflow, prompt } = buildZImageWorkflow(article, seed)

  console.log(`  Prompt: ${prompt.slice(0, 80)}...`)
  if (retryCount > 0) {
    console.log(`  🔄 Retry #${retryCount} with seed ${seed}`)
  }

  // Submit to ACC queue
  const submitted = await acc.submitWorkflow(workflow, {
    priority: 0,
    extra_data: { article_slug: article.slug, seed },
  })

  console.log(`  ⏳ ACC job submitted: ${submitted.job_id}`)

  // Wait for completion
  const job = await acc.waitForCompletion(submitted.job_id, 600000)

  if (job.status !== 'completed') {
    console.log(`  ✗ Job failed or cancelled: ${job.status}`)
    return { success: false, jobId: submitted.job_id }
  }

  // Extract filename from outputs
  let filename: string | null = null
  if (job.outputs) {
    for (const [, output] of Object.entries(job.outputs)) {
      const images = (output as any).images
      if (images && images.length > 0) {
        filename = images[0].filename
        break
      }
    }
  }

  if (!filename) {
    console.log(`  ✗ No output filename found in job outputs`)
    return { success: false, jobId: submitted.job_id }
  }

  console.log(`  ✓ Generated: ${filename}`)

  // Download image
  const imageBuffer = await acc.downloadOutput(filename)

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  // Save to project's public/images/articles
  const destPath = path.join(OUTPUT_DIR, `${article.slug}.jpg`)
  fs.writeFileSync(destPath, imageBuffer)
  console.log(`  💾 Saved to: ${destPath}`)

  // Grade image
  const grade = await gradeImage(imageBuffer)
  console.log(`  📊 Grade: ${grade.overallScore}/10 (Technical: ${grade.technicalScore}, Aesthetic: ${grade.aestheticScore})`)

  // Store grade
  gradeDB.entries[article.slug] = {
    slug: article.slug,
    filename: `${article.slug}.jpg`,
    generatedAt: new Date().toISOString(),
    jobId: submitted.job_id,
    grade,
    accepted: grade.overallScore >= minScore,
    retries: retryCount,
  }
  fs.appendFileSync(GRADE_APPEND_PATH, JSON.stringify(gradeDB.entries[article.slug]) + '\n')

  // Auto-retry if below threshold
  if (grade.overallScore < minScore && autoRetry && retryCount < 2) {
    console.log(`  ⚠️ Score below ${minScore}. Auto-retrying...`)
    return generateAndGrade(acc, article, gradeDB, retryCount + 1)
  }

  return { success: true, grade, filename: `${article.slug}.jpg`, jobId: submitted.job_id }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(80))
  console.log('ACC Batch Generate & Grade Article Images')
  console.log(isPreview ? '(PREVIEW MODE)' : '(LIVE MODE)')
  if (svgOnly) console.log('(SVG-ONLY MODE)')
  if (force) console.log('(FORCE MODE)')
  if (autoRetry) console.log('(AUTO-RETRY MODE)')
  if (ensureServices) console.log('(AUTO-ENSURE SERVICES)')
  console.log(`Minimum score: ${minScore}`)
  console.log('═'.repeat(80))

  // Load data
  const articles = loadArticlesNeedingImages()
  const toProcess = limit ? articles.slice(offset, offset + limit) : articles.slice(offset)
  const gradeDB = loadGradeDB()

  console.log(`\nFound ${articles.length} articles needing images`)
  if (limit) {
    console.log(`Processing ${toProcess.length} articles starting at offset ${offset}`)
  }

  if (toProcess.length === 0) {
    console.log('\n✓ No articles need images!')
    return
  }

  console.log('\nArticles to process:')
  toProcess.forEach((article, i) => {
    const type = article.articleType || 'unknown'
    console.log(`  ${i + 1}. [${type}] ${article.slug}`)
  })

  // ─── Ensure services are running ───────────────────────────────────────────
  if (ensureServices && !isPreview) {
    console.log('\n' + '─'.repeat(80))
    console.log('Ensuring generation stack is ready...')
    console.log('─'.repeat(80))

    const orchestrator = getGenerationOrchestrator({ autoStart: true })

    // Stream orchestrator events
    orchestrator.on('status', (e) => console.log(`  [Orchestrator] ${e.message}`))
    orchestrator.on('comfy:action', (e) => console.log(`  [ComfyUI] ${e.message}`))
    orchestrator.on('acc:action', (e) => console.log(`  [ACC] ${e.message}`))
    orchestrator.on('warning', (e) => console.warn(`  ⚠️ ${e.message}`))

    try {
      await orchestrator.ensureReady()
      console.log('✅ Generation stack ready\n')
    } catch (error: any) {
      console.error(`❌ Failed to ensure stack readiness: ${error.message}`)
      console.error('Try starting manually: pnpm genstack:start')
      process.exit(1)
    }
  }

  if (isPreview) {
    console.log('\n' + '─'.repeat(80))
    console.log('Preview of prompts that would be used:')
    console.log('─'.repeat(80))

    for (const article of toProcess.slice(0, 5)) {
      const { prompt } = buildZImageWorkflow(article, 0)
      console.log(`\n${article.slug}:`)
      console.log(`  ${prompt.slice(0, 120)}...`)
    }

    if (toProcess.length > 5) {
      console.log(`\n... and ${toProcess.length - 5} more`)
    }

    console.log('\nRun without --preview to actually generate images.')
    return
  }

  // Initialize ACC client
  const acc = getACCClient()

  console.log('\n' + '─'.repeat(80))
  console.log('Checking ACC queue manager...')
  console.log('─'.repeat(80))

  const health = await acc.healthCheck()
  const accBaseUrl = process.env.ACC_URL || 'http://localhost:4000'
  if (!health.acc) {
    console.error('✗ ACC is not running at', accBaseUrl)
    console.error('  Start it with: cd ../agent-command-center-ex && mix phx.server')
    process.exit(1)
  }

  console.log(`✓ ACC connected`)
  console.log(`  ComfyUI link: ${health.comfy ? 'healthy' : 'DOWN'}`)

  if (!health.comfy) {
    console.error('\n✗ ACC cannot reach ComfyUI. Start ComfyUI first.')
    process.exit(1)
  }

  // Show queue status
  const status = await acc.getQueueStatus()
  console.log(`\nQueue status: ${status.pending} pending, ${status.active} active`)

  // Process articles
  console.log('\n' + '═'.repeat(80))
  console.log('Generating & grading...')
  console.log('═'.repeat(80))

  const results = { success: 0, failed: 0, skipped: 0, accepted: 0, rejected: 0 }

  const orchestrator = ensureServices ? getGenerationOrchestrator() : null

  /**
   * Wait for queue to drain if too deep, or for circuit breaker to close.
   */
  async function throttleIfNeeded() {
    if (!orchestrator) return

    let waited = false
    while (true) {
      const stackHealth = await orchestrator.getHealth()

      if (stackHealth.circuitOpen) {
        if (!waited) {
          console.log('\n  ⚡ VRAM circuit breaker open — pausing until VRAM drops...')
          waited = true
        }
        await new Promise((r) => setTimeout(r, 5000))
        continue
      }

      const pending = stackHealth.queue?.pending || 0
      const active = stackHealth.queue?.active || 0
      const totalQueue = pending + active

      if (totalQueue >= 5) {
        if (!waited) {
          console.log(`\n  🐢 Queue depth ${totalQueue} — throttling until it drains...`)
          waited = true
        }
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }

      break
    }

    if (waited) {
      console.log('  ✅ Resuming generation')
    }
  }

  for (let i = 0; i < toProcess.length; i++) {
    const article = toProcess[i]
    console.log(`\n[${i + 1}/${toProcess.length}] ${article.slug}`)
    console.log(`  Title: ${article.title?.slice(0, 60) || 'N/A'}${(article.title?.length || 0) > 60 ? '...' : ''}`)

    // Every 5 images, do a health check and recover if needed
    if (orchestrator && i > 0 && i % 5 === 0) {
      try {
        const stackHealth = await orchestrator.getHealth()
        if (!stackHealth.ready && !stackHealth.circuitOpen) {
          console.log('\n  ⚠️ Stack degraded — attempting recovery...')
          await orchestrator.ensureReady()
          console.log('  ✅ Recovered')
        }
      } catch (e: any) {
        console.warn(`  ⚠️ Health check failed: ${e.message}`)
      }
    }

    // Throttle based on queue depth / circuit breaker
    await throttleIfNeeded()

    try {
      const result = await generateAndGrade(acc, article, gradeDB)

      if (result.success && result.grade) {
        results.success++
        if (result.grade.overallScore >= minScore) {
          results.accepted++
          updateImageManifest(article.slug)
          console.log(`  ✅ ACCEPTED (score ${result.grade.overallScore})`)
        } else {
          results.rejected++
          console.log(`  ❌ REJECTED (score ${result.grade.overallScore} < ${minScore})`)
        }
      } else {
        results.failed++
        console.log(`  ✗ Generation failed`)
      }
    } catch (error: any) {
      results.failed++
      console.error(`  ✗ Error: ${error.message || error}`)
    }

    // Persist grades after each article
    saveGradeDB(gradeDB)

    // Brief pause to be nice to the queue
    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(80))
  console.log('Summary')
  console.log('═'.repeat(80))
  console.log(`  ✓ Success:    ${results.success}`)
  console.log(`  ✅ Accepted:   ${results.accepted}`)
  console.log(`  ❌ Rejected:   ${results.rejected}`)
  console.log(`  ✗ Failed:     ${results.failed}`)
  console.log(`  ⏭ Skipped:    ${results.skipped}`)
  console.log(`  Total:        ${toProcess.length}`)

  if (results.success > 0) {
    console.log(`\n  Images saved to: ${OUTPUT_DIR}`)
    console.log(`  Manifest updated: ${IMAGE_MANIFEST_PATH}`)
    console.log(`  Grades saved: ${GRADE_DB_PATH}`)
  }

  // Print top grades
  const grades = Object.values(gradeDB.entries)
    .filter((g) => toProcess.some((a) => a.slug === g.slug))
    .sort((a, b) => b.grade.overallScore - a.grade.overallScore)

  if (grades.length > 0) {
    console.log('\n  Top grades:')
    grades.slice(0, 5).forEach((g) => {
      console.log(`    ${g.slug}: ${g.grade.overallScore}/10`)
    })
  }
}

main().catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
