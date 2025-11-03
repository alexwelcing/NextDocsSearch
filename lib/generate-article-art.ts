#!/usr/bin/env node

/**
 * Article Art Generator
 *
 * This script generates unique AI artwork for all blog articles using
 * the signature NextDocs Quantum Aesthetic style.
 *
 * Usage:
 *   pnpm run generate:art              # Generate art for all articles
 *   pnpm run generate:art --refresh    # Regenerate all art (skip existing)
 *   pnpm run generate:art --force      # Force regenerate all art
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import {
  generateImagePrompts,
  getImageGenerationParams,
} from './art-generation/art-style'
import {
  generateArticleArtwork,
  artworkExists,
  estimateCost,
} from './art-generation/image-generator'

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('refresh', {
    alias: 'r',
    type: 'boolean',
    description: 'Regenerate art for articles without images',
    default: false,
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Force regenerate all art (overwrites existing)',
    default: false,
  })
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Limit number of images to generate',
  })
  .option('article', {
    alias: 'a',
    type: 'string',
    description: 'Generate art for a specific article slug',
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Show what would be generated without actually generating',
    default: false,
  })
  .option('skip-confirm', {
    alias: 'y',
    type: 'boolean',
    description: 'Skip the 5-second confirmation countdown',
    default: false,
  })
  .help()
  .parseSync()

interface Article {
  slug: string
  filePath: string
  title: string
  description: string
  keywords: string[]
  currentOgImage?: string
}

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images')

/**
 * Get all article files
 */
function getArticleFiles(): string[] {
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .sort()
}

/**
 * Parse article frontmatter
 */
function parseArticle(filename: string): Article {
  const filePath = path.join(ARTICLES_DIR, filename)
  const fileContents = fs.readFileSync(filePath, 'utf-8')
  const { data } = matter(fileContents)

  const slug = filename.replace(/\.mdx$/, '')

  return {
    slug,
    filePath,
    title: data.title || slug,
    description: data.description || '',
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    currentOgImage: data.ogImage,
  }
}

/**
 * Update article frontmatter with new image paths
 */
function updateArticleFrontmatter(
  filePath: string,
  ogPath: string
): void {
  const fileContents = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(fileContents)

  // Update ogImage field
  data.ogImage = ogPath

  // Rebuild the file with updated frontmatter
  const updatedContent = matter.stringify(content, data)
  fs.writeFileSync(filePath, updatedContent, 'utf-8')

  console.log(`📝 Updated frontmatter in ${path.basename(filePath)}`)
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🎨 NextDocs Article Art Generator')
  console.log('================================\n')

  // Check for OpenAI API key (not needed for dry-run)
  if (!process.env.OPENAI_KEY && !argv.dryRun) {
    console.error('❌ Error: OPENAI_KEY environment variable is not set')
    console.error('   Please set your OpenAI API key in .env.local')
    process.exit(1)
  }

  // Get articles to process
  let articleFiles = getArticleFiles()

  // Filter by specific article if provided
  if (argv.article) {
    const targetFile = `${argv.article}.mdx`
    articleFiles = articleFiles.filter((f) => f === targetFile)

    if (articleFiles.length === 0) {
      console.error(`❌ Article not found: ${argv.article}`)
      process.exit(1)
    }
  }

  console.log(`📚 Found ${articleFiles.length} article(s)\n`)

  // Parse all articles
  const articles = articleFiles.map(parseArticle)

  // Filter articles that need artwork
  let articlesToProcess = articles.filter((article) => {
    const exists = artworkExists(article.slug, OUTPUT_DIR)

    if (argv.force) {
      return true // Process all
    }

    if (exists && !argv.refresh) {
      console.log(`⏭️  Skipping ${article.slug} (artwork exists)`)
      return false
    }

    if (!exists) {
      return true
    }

    return false
  })

  // Apply limit if specified
  if (argv.limit && argv.limit > 0) {
    articlesToProcess = articlesToProcess.slice(0, argv.limit)
  }

  if (articlesToProcess.length === 0) {
    console.log('\n✅ All articles already have artwork!')
    console.log('   Use --force to regenerate all, or --refresh to update missing ones.\n')
    return
  }

  // Show cost estimate
  const estimatedCost = estimateCost(articlesToProcess.length)
  console.log(`\n💰 Cost Estimate:`)
  console.log(`   Images to generate: ${articlesToProcess.length}`)
  console.log(`   Estimated cost: $${estimatedCost.toFixed(2)} USD`)
  console.log(`   (DALL-E 3 HD: $0.080 per image)\n`)

  if (argv.dryRun) {
    console.log('🏃 DRY RUN - No images will be generated\n')
    articlesToProcess.forEach((article, index) => {
      console.log(`${index + 1}. ${article.slug}`)
      console.log(`   Title: ${article.title}`)
      console.log(`   Keywords: ${article.keywords.slice(0, 3).join(', ')}`)
      console.log()
    })
    return
  }

  // Confirm with user (unless --skip-confirm or in CI environment)
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
  const shouldSkipConfirm = argv.skipConfirm || isCI

  if (!shouldSkipConfirm) {
    console.log('⚠️  This will generate images using OpenAI DALL-E 3.')
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')
    await new Promise((resolve) => setTimeout(resolve, 5000))
  } else {
    console.log('▶️  Starting image generation...\n')
  }

  // Process each article
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < articlesToProcess.length; i++) {
    const article = articlesToProcess[i]

    console.log(`\n[${ i + 1}/${articlesToProcess.length}] Processing: ${article.slug}`)
    console.log(`Title: ${article.title}`)

    try {
      // Generate prompts
      const prompts = generateImagePrompts(
        article.title,
        article.description,
        article.keywords
      )

      // Generate artwork (using OG prompt which is optimized for social media)
      const { heroPath, ogPath } = await generateArticleArtwork(
        article.slug,
        prompts.og,
        OUTPUT_DIR
      )

      // Update article frontmatter
      updateArticleFrontmatter(article.filePath, ogPath)

      successCount++
      console.log(`✅ Success! Generated artwork for: ${article.slug}`)
    } catch (error: any) {
      errorCount++
      console.error(`❌ Failed to generate artwork for ${article.slug}:`, error.message)
    }

    // Rate limiting: wait 1 second between requests
    if (i < articlesToProcess.length - 1) {
      console.log('\n⏳ Waiting 1 second before next generation...')
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('🎉 Article Art Generation Complete!')
  console.log('='.repeat(60))
  console.log(`✅ Successful: ${successCount}`)
  console.log(`❌ Failed: ${errorCount}`)
  console.log(`💰 Actual cost: ~$${(successCount * 0.08).toFixed(2)} USD`)
  console.log('\n📁 Images saved to:')
  console.log(`   - Hero images: public/images/articles/`)
  console.log(`   - OG images: public/images/og/`)
  console.log()
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Fatal error:', error)
  process.exit(1)
})
