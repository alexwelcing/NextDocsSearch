#!/usr/bin/env node

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import { FalClient } from '../lib/art-generation/fal-client'
import { buildModelPrompt, ArticleContext } from '../lib/art-generation/prompt-customizer'
import { getModelById } from '../lib/fal-models'

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'multi-art')
const DEFAULT_MODEL = 'fal-ai/flux/schnell'

interface BrokenArticle extends ArticleContext {
  date: string
  ogImage: string
}

const argv = yargs(hideBin(process.argv))
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Maximum number of broken articles to repair',
  })
  .option('article', {
    alias: 'a',
    type: 'string',
    description: 'Repair a single article slug',
  })
  .option('model', {
    alias: 'm',
    type: 'string',
    description: 'FAL model to use for repair',
    default: DEFAULT_MODEL,
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Regenerate even if local multi-art already exists',
    default: false,
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Preview the repair batch without generating images',
    default: false,
  })
  .option('rewrite-frontmatter', {
    type: 'boolean',
    description: 'Rewrite broken ogImage frontmatter to the repaired local art asset',
    default: true,
  })
  .help()
  .parseSync()

function getFalApiKey(): string {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || ''
}

function resolveMissingFrontmatterPath(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || !candidate.startsWith('/images/')) {
    return null
  }

  const diskPath = path.join(process.cwd(), 'public', candidate.replace(/^\//, ''))
  return fs.existsSync(diskPath) ? null : candidate
}

function hasLocalArt(slug: string): boolean {
  const slugDir = path.join(OUTPUT_DIR, slug)
  if (!fs.existsSync(slugDir)) {
    return false
  }

  return fs.readdirSync(slugDir).some((file) => file.endsWith('.png'))
}

function getPreferredLocalArtPath(slug: string): string | null {
  const slugDir = path.join(OUTPUT_DIR, slug)
  if (!fs.existsSync(slugDir)) {
    return null
  }

  const files = fs
    .readdirSync(slugDir)
    .filter((file) => file.endsWith('.png'))
    .sort()

  if (files.length === 0) {
    return null
  }

  return `/images/multi-art/${slug}/${files[0]}`
}

function rewriteArticleOgImage(slug: string, ogImage: string): void {
  const filePath = path.join(ARTICLES_DIR, `${slug}.mdx`)
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)

  data.ogImage = ogImage
  fs.writeFileSync(filePath, matter.stringify(content, data))
}

function getBrokenArticles(): BrokenArticle[] {
  const files = fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.mdx'))
  const articles: BrokenArticle[] = []

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)
    const slug = file.replace(/\.mdx$/, '')
    const missingOgImage = resolveMissingFrontmatterPath(data.ogImage)

    if (!missingOgImage) {
      continue
    }

    articles.push({
      slug,
      title: data.title || slug,
      description: data.description || '',
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      excerpt: content.replace(/\s+/g, ' ').trim().slice(0, 500),
      category: data.articleType,
      date: typeof data.date === 'string' ? data.date : '',
      ogImage: missingOgImage,
    })
  }

  articles.sort((left, right) => {
    const leftDate = new Date(left.date || 0).getTime()
    const rightDate = new Date(right.date || 0).getTime()
    return rightDate - leftDate
  })

  return articles
}

async function saveImageLocally(imageUrl: string, slug: string, modelId: string): Promise<string> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to download generated image: ${response.status} ${response.statusText}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const modelName = modelId.split('/').pop() || 'unknown'
  const slugDir = path.join(OUTPUT_DIR, slug)
  fs.mkdirSync(slugDir, { recursive: true })

  const outputPath = path.join(slugDir, `option-1-${modelName}.png`)
  fs.writeFileSync(outputPath, buffer)
  return outputPath
}

async function main() {
  const model = getModelById(argv.model)
  if (!model) {
    console.error(`❌ Unknown model: ${argv.model}`)
    process.exit(1)
  }

  const falApiKey = getFalApiKey()
  if (!falApiKey && !argv.dryRun) {
    console.error('❌ FAL_API_KEY or FAL_KEY is required')
    process.exit(1)
  }

  let articles = getBrokenArticles()

  if (argv.article) {
    articles = articles.filter((article) => article.slug === argv.article)
  }

  if (argv.limit && argv.limit > 0) {
    articles = articles.slice(0, argv.limit)
  }

  console.log('\n🛠️  Repair Missing Article Images')
  console.log('================================')
  console.log(`Broken articles found: ${getBrokenArticles().length}`)
  console.log(`Articles queued: ${articles.length}`)
  console.log(`Model: ${model.id}`)
  console.log(`FAL key: ${falApiKey ? falApiKey.slice(0, 12) + '...' : 'dry-run/no key'}`)

  if (articles.length === 0) {
    console.log('\n✅ No broken article images need repair.')
    return
  }

  if (argv.dryRun) {
    for (const article of articles) {
      console.log(`- ${article.slug} -> missing ${article.ogImage}`)
    }
    return
  }

  const falClient = new FalClient(falApiKey)
  let successCount = 0
  let failureCount = 0
  let rewriteCount = 0

  for (let index = 0; index < articles.length; index++) {
    const article = articles[index]
    const existingLocalArt = getPreferredLocalArtPath(article.slug)

    console.log(`\n[${index + 1}/${articles.length}] ${article.slug}`)
    console.log(`Missing: ${article.ogImage}`)

    if (existingLocalArt && !argv.force) {
      if (argv.rewriteFrontmatter) {
        rewriteArticleOgImage(article.slug, existingLocalArt)
        rewriteCount++
        console.log(`📝 Rewrote frontmatter to ${existingLocalArt}`)
      } else {
        console.log(`⏭️  Existing local art found at ${existingLocalArt}`)
      }
      continue
    }

    const { prompt, negativePrompt } = buildModelPrompt(model.id, article, 0)

    const result = await falClient.generate({
      modelId: model.id,
      prompt,
      negativePrompt,
      params: model.defaultParams,
    })

    if (!result.success || !result.imageUrl) {
      failureCount++
      console.error(`❌ ${article.slug}: ${result.error || 'Unknown generation error'}`)
      continue
    }

    try {
      const outputPath = await saveImageLocally(result.imageUrl, article.slug, model.id)
      const publicPath = `/images/multi-art/${article.slug}/${path.basename(outputPath)}`
      if (argv.rewriteFrontmatter) {
        rewriteArticleOgImage(article.slug, publicPath)
        rewriteCount++
      }
      successCount++
      console.log(`✅ Saved ${path.relative(process.cwd(), outputPath)}`)
    } catch (error) {
      failureCount++
      console.error(`❌ ${article.slug}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log('\n📊 Repair Summary')
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failureCount}`)
  console.log(`Frontmatter rewrites: ${rewriteCount}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})