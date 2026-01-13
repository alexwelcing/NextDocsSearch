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
import dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

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
import { generateImageConcept } from './art-generation/concept-generator'

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
  .option('resume', {
    type: 'string',
    description: 'Resume generation starting from a specific article slug',
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Show what would be generated without actually generating',
    default: false,
  })
  .option('concept', {
    type: 'boolean',
    description: 'Generate a per-article cinematic concept from the full article text (recommended)',
    default: true,
  })
  .option('concept-model', {
    type: 'string',
    description: 'OpenAI model to use for concept generation (e.g. gpt-4o-mini)',
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
  headings?: string[]
  excerpt?: string
  fullText: string
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
  const { data, content } = matter(fileContents)

  const slug = filename.replace(/\.mdx$/, '')

  const headings = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^#{1,3}\s+/.test(line))
    .map((line) => line.replace(/^#{1,3}\s+/, '').trim())
    .filter(Boolean)
    .slice(0, 6)

  const excerpt = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .find((block) => {
      if (/^#{1,6}\s+/.test(block)) return false
      if (/^import\s+/.test(block)) return false
      if (block.startsWith('<')) return false
      return true
    })

  const excerptOneLine = excerpt ? excerpt.replace(/\s+/g, ' ').trim().slice(0, 400) : undefined

  return {
    slug,
    filePath,
    title: data.title || slug,
    description: data.description || '',
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    currentOgImage: data.ogImage,
    headings,
    excerpt: excerptOneLine,
    fullText: content,
  }
}

function getConceptCachePath(slug: string): string {
  return path.join(OUTPUT_DIR, 'concepts', `${slug}.json`)
}

function readCachedConcept(slug: string): any | null {
  const cachePath = getConceptCachePath(slug)
  if (!fs.existsSync(cachePath)) return null
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
  } catch {
    return null
  }
}

function writeCachedConcept(slug: string, concept: unknown): void {
  const cachePath = getConceptCachePath(slug)
  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  fs.writeFileSync(cachePath, JSON.stringify(concept, null, 2), 'utf-8')
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
  const rawKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
  const normalizedKey = rawKey?.replace(/^Bearer\s+/i, '').trim()
  if (!normalizedKey && !argv.dryRun) {
    console.error('❌ Error: OpenAI API key environment variable is not set')
    console.error('   Please set OPENAI_API_KEY (preferred) or OPENAI_KEY in .env.local')
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

  // Resume from specific article if provided
  if (argv.resume) {
    let targetFile = `${argv.resume}.mdx`
    let startIndex = articleFiles.indexOf(targetFile)

    // If exact match not found, try partial match
    if (startIndex === -1) {
      const partialMatch = articleFiles.find((f) => f.includes(argv.resume as string))
      if (partialMatch) {
        targetFile = partialMatch
        startIndex = articleFiles.indexOf(targetFile)
        console.log(`🔍 Exact match not found, assuming you meant: ${targetFile}`)
      }
    }

    if (startIndex === -1) {
      console.error(`❌ Resume article not found: ${argv.resume}`)
      console.error('   Available articles similar to your query:')
      const similar = articleFiles.filter(
        (f) =>
          f.includes(argv.resume as string) ||
          f.includes((argv.resume as string).split('-')[0])
      )
      similar.slice(0, 5).forEach((f) => console.error(`   - ${f.replace('.mdx', '')}`))
      process.exit(1)
    }

    console.log(
      `⏩ Resuming from ${targetFile.replace('.mdx', '')} (skipping ${startIndex} articles)`
    )
    articleFiles = articleFiles.slice(startIndex)
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

  // Confirm with user
  console.log('⚠️  This will generate images using OpenAI DALL-E 3.')
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')

  await new Promise((resolve) => setTimeout(resolve, 5000))

  // Process each article
  let successCount = 0
  let errorCount = 0
  const recentlyUsedArchetypes: string[] = []

  for (let i = 0; i < articlesToProcess.length; i++) {
    const article = articlesToProcess[i]

    console.log(`\n[${ i + 1}/${articlesToProcess.length}] Processing: ${article.slug}`)
    console.log(`Title: ${article.title}`)

    try {
      let conceptText: string | undefined
      if (argv.concept) {
        const cached = !argv.force ? readCachedConcept(article.slug) : null
        const concept =
          cached ||
          (await generateImageConcept({
            slug: article.slug,
            title: article.title,
            description: article.description,
            keywords: article.keywords,
            headings: article.headings,
            fullText: article.fullText,
            recentlyUsedArchetypes: recentlyUsedArchetypes.slice(-8),
            model: (argv as any)['concept-model'],
          }))

        if (!cached) {
          writeCachedConcept(article.slug, concept)
        }

        if (concept?.archetype) {
          recentlyUsedArchetypes.push(String(concept.archetype))
        }

        // Concept-first string: makes prompts start differently per article.
        conceptText = [
          `Concept archetype: ${concept.archetype}.`,
          `Logline: ${concept.logline}`,
          `Scene: ${concept.scene}`,
          concept.keyProps?.length ? `Key props: ${concept.keyProps.join(', ')}.` : '',
          concept.camera ? `Camera: ${concept.camera}.` : '',
          concept.lighting ? `Lighting: ${concept.lighting}.` : '',
          concept.productionDesign ? `Production design: ${concept.productionDesign}.` : '',
          concept.signatureTwist ? `Signature twist: ${concept.signatureTwist}.` : '',
          concept.avoid?.length ? `Avoid: ${concept.avoid.join('; ')}.` : '',
        ]
          .filter(Boolean)
          .join(' ')
      }

      // Generate prompts
      const prompts = generateImagePrompts(
        article.title,
        article.description,
        article.keywords,
        {
          slug: article.slug,
          headings: article.headings,
          excerpt: article.excerpt,
          concept: conceptText,
        }
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
