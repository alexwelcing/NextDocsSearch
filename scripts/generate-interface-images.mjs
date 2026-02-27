#!/usr/bin/env node
/**
 * Interface Series Image Generator
 *
 * Generates images for all 24 Interface articles using FAL AI.
 * Uses curl for API calls (Node.js fetch is blocked in some environments).
 * Reads prompts from public/images/concepts/interface-series-prompts.json.
 *
 * Usage: FAL_KEY=your-key node scripts/generate-interface-images.mjs
 *   or:  node scripts/generate-interface-images.mjs  (reads from .env.local)
 */

import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROMPTS_FILE = join(ROOT, 'public/images/concepts/interface-series-prompts.json')
const OUTPUT_BASE = join(ROOT, 'public/images/multi-art')

// Load FAL_KEY from env or .env.local
let FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) {
  try {
    const envLocal = readFileSync(join(ROOT, '.env.local'), 'utf-8')
    const match = envLocal.match(/^FAL_KEY=(.+)$/m)
    if (match) FAL_KEY = match[1].trim()
  } catch {}
}
if (!FAL_KEY) {
  console.error('ERROR: FAL_KEY not found. Set it in .env.local or as environment variable.')
  process.exit(1)
}

// Model mapping
const MODELS = {
  fast: 'fal-ai/flux/schnell',
  quality: 'fal-ai/flux/dev',
  artistic: 'fal-ai/recraft/v3/text-to-image',
}

const MODEL_SHORT = {
  'fal-ai/flux/schnell': 'schnell',
  'fal-ai/flux/dev': 'dev',
  'fal-ai/recraft/v3/text-to-image': 'recraft-v3',
}

// Load prompts
const promptData = JSON.parse(readFileSync(PROMPTS_FILE, 'utf-8'))
const { stylePrefix, styleSuffix, articles } = promptData

// Stats
let generated = 0
let skipped = 0
let failed = 0
const failures = []

function callFal(model, prompt, imageSize = 'landscape_16_9') {
  const fullPrompt = `${stylePrefix}, ${prompt}, ${styleSuffix}`
  const payload = JSON.stringify({
    prompt: fullPrompt,
    image_size: imageSize,
    enable_safety_checker: true,
  })

  try {
    const result = execSync(
      `curl -s --max-time 120 -X POST "https://fal.run/${model}" ` +
      `-H "Authorization: Key ${FAL_KEY}" ` +
      `-H "Content-Type: application/json" ` +
      `-d ${escapeShell(payload)}`,
      { encoding: 'utf-8', timeout: 130000 }
    )
    return JSON.parse(result)
  } catch (e) {
    return { error: e.message }
  }
}

function downloadImage(url, outputPath) {
  try {
    execSync(
      `curl -s --max-time 60 -o "${outputPath}" "${url}"`,
      { timeout: 70000 }
    )
    return existsSync(outputPath) && readFileSync(outputPath).length > 1000
  } catch {
    return false
  }
}

function escapeShell(str) {
  // Write to temp file to avoid shell escaping issues with complex prompts
  const tmpFile = '/tmp/fal-prompt.json'
  writeFileSync(tmpFile, str)
  return `@${tmpFile}`
}

function getOutputPath(slug, option, model) {
  const shortName = MODEL_SHORT[model] || model.split('/').pop()
  const suffix = option > 1 && model === MODELS.fast ? `-alt${option > 2 ? option : ''}` : ''
  return join(OUTPUT_BASE, slug, `option-${option}-${shortName}${suffix}.png`)
}

// Process articles
async function main() {
  console.log(`\n=== Interface Series Image Generator ===`)
  console.log(`Articles: ${articles.length}`)
  console.log(`Prompts per article: 3`)
  console.log(`Total images to generate: ${articles.length * 3}`)
  console.log(`Output: ${OUTPUT_BASE}\n`)

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i]
    const { slug, title, prompts } = article

    console.log(`\n[${i + 1}/${articles.length}] ${title}`)
    console.log(`  slug: ${slug}`)

    // Create output directory
    const outDir = join(OUTPUT_BASE, slug)
    mkdirSync(outDir, { recursive: true })

    for (const p of prompts) {
      const model = MODELS[p.model] || MODELS.fast
      const shortName = MODEL_SHORT[model] || model.split('/').pop()
      const outFile = join(outDir, `option-${p.option}-${shortName}.png`)

      // Skip if already exists
      if (existsSync(outFile)) {
        const size = readFileSync(outFile).length
        if (size > 1000) {
          console.log(`  ✓ option-${p.option} (${shortName}) — already exists (${(size/1024).toFixed(0)}KB)`)
          skipped++
          continue
        }
      }

      process.stdout.write(`  ⏳ option-${p.option} (${shortName})...`)

      // Call FAL
      const response = callFal(model, p.prompt)

      // Extract image URL
      const imageUrl = response?.images?.[0]?.url
        || response?.image?.url
        || response?.data?.[0]?.url

      if (!imageUrl) {
        const detail = response?.detail || response?.error || 'unknown error'
        console.log(` ✗ FAILED — ${detail.substring(0, 80)}`)
        failed++
        failures.push({ slug, option: p.option, model: shortName, error: detail })
        continue
      }

      // Download
      const ok = downloadImage(imageUrl, outFile)
      if (ok) {
        const size = readFileSync(outFile).length
        console.log(` ✓ ${(size/1024).toFixed(0)}KB`)
        generated++
      } else {
        console.log(` ✗ download failed`)
        failed++
        failures.push({ slug, option: p.option, model: shortName, error: 'download failed' })
      }

      // Small delay between requests to be respectful
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log(`DONE`)
  console.log(`  Generated: ${generated}`)
  console.log(`  Skipped (already existed): ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total: ${generated + skipped + failed}`)

  if (failures.length > 0) {
    console.log(`\nFailures:`)
    for (const f of failures) {
      console.log(`  - ${f.slug} option-${f.option} (${f.model}): ${f.error.substring(0, 60)}`)
    }
  }

  console.log(`\nImages saved to: ${OUTPUT_BASE}`)
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
