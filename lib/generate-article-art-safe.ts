#!/usr/bin/env node

/**
 * Safe Article Art Generator for Build Process
 *
 * This wrapper script runs article art generation during builds,
 * but gracefully handles missing API keys without failing the build.
 *
 * - If OPENAI_KEY is set: Generate missing images only (skip existing)
 * - If OPENAI_KEY is NOT set: Skip generation with a warning
 * - Always exits with success (0) to not break builds
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const OPENAI_KEY = process.env.OPENAI_KEY

console.log('\n🎨 Article Art Generation (Build Mode)')
console.log('=====================================\n')

// Check if OPENAI_KEY is set
if (!OPENAI_KEY || OPENAI_KEY.trim() === '') {
  console.log('⚠️  OPENAI_KEY not found in environment')
  console.log('   Skipping image generation for this build.')
  console.log('   To generate images, set OPENAI_KEY in your environment.\n')
  console.log('   Images can also be generated manually with:')
  console.log('   pnpm run generate:art\n')
  process.exit(0)
}

// Check if we have existing images
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images')
const articlesDir = path.join(OUTPUT_DIR, 'articles')
const ogDir = path.join(OUTPUT_DIR, 'og')

let existingImagesCount = 0
try {
  if (fs.existsSync(articlesDir)) {
    existingImagesCount = fs.readdirSync(articlesDir).filter(f => f.endsWith('.jpg')).length
  }
} catch (err) {
  // Ignore errors checking for existing images
}

console.log('✅ OPENAI_KEY found')
console.log(`   Existing images: ${existingImagesCount}`)
console.log('   Generating artwork for articles without images...\n')

try {
  // Run the actual art generation script
  // This will automatically skip articles that already have images
  // Use --skip-confirm to avoid the 5-second countdown in build environments
  execSync('tsx lib/generate-article-art.ts --skip-confirm', {
    stdio: 'inherit',
    env: { ...process.env, OPENAI_KEY }
  })

  console.log('\n✅ Image generation completed successfully\n')
  process.exit(0)
} catch (error: any) {
  // Even if image generation fails, don't fail the build
  // The site can still function without new images
  console.error('\n⚠️  Image generation encountered errors')
  console.error('   Build will continue, but some images may be missing.')
  console.error('   You can regenerate images later with: pnpm run generate:art\n')

  if (error.message) {
    console.error(`   Error: ${error.message}\n`)
  }

  // Exit successfully to not break the build
  process.exit(0)
}
