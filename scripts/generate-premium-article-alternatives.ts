#!/usr/bin/env node

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import matter from 'gray-matter'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

import { FalClient } from '../lib/art-generation/fal-client'
import {
  buildModelPrompt,
  detectArticleTheme,
  type ArticleContext,
} from '../lib/art-generation/prompt-customizer'
import { getModelById, type FalImageModel } from '../lib/fal-models'

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const MULTI_ART_DIR = path.join(process.cwd(), 'public', 'images', 'multi-art')

const PREMIUM_MODELS = [
  'fal-ai/flux/dev',
  'fal-ai/stable-diffusion-v35-large',
  'fal-ai/recraft/v3/text-to-image',
] as const

const MODEL_ALIASES: Record<string, string> = {
  'fal-ai/flux/dev': 'dev',
  'fal-ai/stable-diffusion-v35-large': 'sd35-large',
  'fal-ai/recraft/v3/text-to-image': 'recraft-v3',
}

const argv = yargs(hideBin(process.argv))
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Maximum number of articles to process',
  })
  .option('article', {
    alias: 'a',
    type: 'string',
    description: 'Generate and select for a single article slug',
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: 'Regenerate premium alternatives even if they already exist',
    default: false,
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Preview target articles and planned winners',
    default: false,
  })
  .help()
  .parseSync()

interface TargetArticle extends ArticleContext {
  filePath: string
  currentOgImage: string
}

function getFalApiKey(): string {
  return process.env.FAL_API_KEY || process.env.FAL_KEY || ''
}

function readTargetArticles(): TargetArticle[] {
  const files = fs.readdirSync(ARTICLES_DIR).filter((file) => file.endsWith('.mdx')).sort()
  const articles: TargetArticle[] = []

  for (const file of files) {
    const filePath = path.join(ARTICLES_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)
    const slug = file.replace(/\.mdx$/, '')
    const currentOgImage = typeof data.ogImage === 'string' ? data.ogImage : ''

    if (!currentOgImage.includes('/images/multi-art/') || !currentOgImage.includes('schnell')) {
      continue
    }

    articles.push({
      slug,
      title: data.title || slug,
      description: data.description || '',
      keywords: Array.isArray(data.keywords) ? data.keywords : [],
      excerpt: content.replace(/\s+/g, ' ').trim().slice(0, 500),
      category: data.articleType,
      filePath,
      currentOgImage,
    })
  }

  return articles
}

function getOutputPath(slug: string, modelId: string, optionNumber: number): string {
  const alias = MODEL_ALIASES[modelId] || modelId.split('/').pop() || 'unknown'
  return path.join(MULTI_ART_DIR, slug, `option-${optionNumber}-${alias}.png`)
}

function getPublicPath(slug: string, absolutePath: string): string {
  return `/images/multi-art/${slug}/${path.basename(absolutePath)}`
}

async function saveImage(imageUrl: string, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const download = (url: string, redirectsLeft: number) => {
      const client = url.startsWith('https:') ? https : http
      const request = client.get(url, (response) => {
        const statusCode = response.statusCode || 0
        if (statusCode >= 300 && statusCode < 400 && response.headers.location && redirectsLeft > 0) {
          response.resume()
          download(response.headers.location, redirectsLeft - 1)
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume()
          reject(new Error(`Failed to download generated image: ${statusCode}`))
          return
        }

        const fileStream = fs.createWriteStream(outputPath)
        response.pipe(fileStream)
        fileStream.on('finish', () => {
          fileStream.close()
          resolve()
        })
        fileStream.on('error', (error) => {
          fileStream.close()
          reject(error)
        })
      })

      request.setTimeout(300000, () => {
        request.destroy(new Error('Download timed out'))
      })
      request.on('error', reject)
    }

    download(imageUrl, 5)
  })
}

function copySelected(slug: string, sourcePath: string): string {
  const selectedPath = path.join(MULTI_ART_DIR, slug, 'selected.png')
  fs.copyFileSync(sourcePath, selectedPath)
  return selectedPath
}

function updateFrontmatter(filePath: string, ogImage: string): void {
  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)
  data.ogImage = ogImage
  fs.writeFileSync(filePath, matter.stringify(content, data))
}

function writeSelectionSummary(
  slug: string,
  winner: { modelId: string; score: number; rationale: string; publicPath: string },
  candidates: Array<{ modelId: string; score: number; rationale: string; publicPath: string }>
): void {
  const summaryPath = path.join(MULTI_ART_DIR, slug, 'selection.json')
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        selectedAt: new Date().toISOString(),
        winner,
        candidates,
      },
      null,
      2
    )
  )
}

function computeCreativeFit(article: TargetArticle, model: FalImageModel): { score: number; rationale: string } {
  const text = `${article.slug} ${article.title} ${article.description} ${article.keywords.join(' ')}`.toLowerCase()
  const theme = detectArticleTheme(article)

  const editorialTokens = [
    'garden',
    'map',
    'cartograph',
    'archive',
    'letters',
    'inventory',
    'diary',
    'index',
    'pattern',
    'bookbinder',
    'translation',
    'lullaby',
    'festival',
    'hands',
    'seed',
    'soil',
    'repair',
    'commons',
  ]

  const darkTokens = [
    'sickness',
    'withdrawal',
    'fossil',
    'expedition',
    'severance',
    'power',
    'threshold',
    'confession',
    'dispute',
    'territorial',
    'scar',
    'cohort',
    'handoff',
    'night',
    'exit',
  ]

  const humanTokens = [
    'return',
    'handshake',
    'daughter',
    'mother',
    'rememberer',
    'volunteer',
    'teacher',
    'midwife',
    'counselor',
    'janitor',
    'librarian',
    'collector',
    'storyteller',
    'apprentice',
    'settlers',
    'cartographer',
  ]

  const editorialHits = editorialTokens.filter((token) => text.includes(token))
  const darkHits = darkTokens.filter((token) => text.includes(token))
  const humanHits = humanTokens.filter((token) => text.includes(token))

  const scoreByModel: Record<string, number> = {
    'fal-ai/flux/dev': 8.4,
    'fal-ai/stable-diffusion-v35-large': 8.0,
    'fal-ai/recraft/v3/text-to-image': 8.1,
  }

  let score = scoreByModel[model.id] || 7.5
  const reasons: string[] = []

  if (model.id === 'fal-ai/flux/dev') {
    score += humanHits.length * 0.45
    score += darkHits.length * 0.18
    if (theme === 'narrative') score += 0.7
    reasons.push('cinematic human-focus bias')
  }

  if (model.id === 'fal-ai/stable-diffusion-v35-large') {
    score += darkHits.length * 0.55
    score += humanHits.length * 0.08
    if (theme === 'tech-horror') score += 1.1
    reasons.push('moody tension and detail bias')
  }

  if (model.id === 'fal-ai/recraft/v3/text-to-image') {
    score += editorialHits.length * 0.5
    score += humanHits.length * 0.12
    score -= darkHits.length * 0.05
    reasons.push('editorial illustration bias')
  }

  if (editorialHits.length > 0) reasons.push(`editorial motifs: ${editorialHits.slice(0, 3).join(', ')}`)
  if (darkHits.length > 0) reasons.push(`dark motifs: ${darkHits.slice(0, 3).join(', ')}`)
  if (humanHits.length > 0) reasons.push(`human motifs: ${humanHits.slice(0, 3).join(', ')}`)

  return {
    score: Number(score.toFixed(2)),
    rationale: reasons.join('; '),
  }
}

async function ensureAlternatives(article: TargetArticle, falClient: FalClient): Promise<Array<{ modelId: string; path: string }>> {
  const generated: Array<{ modelId: string; path: string }> = []

  for (const [index, modelId] of PREMIUM_MODELS.entries()) {
    const model = getModelById(modelId)
    if (!model) {
      throw new Error(`Unknown FAL model: ${modelId}`)
    }

    const optionNumber = index + 2
    const outputPath = getOutputPath(article.slug, modelId, optionNumber)

    if (fs.existsSync(outputPath) && !argv.force) {
      generated.push({ modelId, path: outputPath })
      continue
    }

    const { prompt, negativePrompt } = buildModelPrompt(modelId, article, index + 1)
    const result = await falClient.generate({
      modelId,
      prompt,
      negativePrompt,
      params: model.defaultParams,
    })

    if (!result.success || !result.imageUrl) {
      throw new Error(`${article.slug} ${modelId} failed: ${result.error || 'Unknown error'}`)
    }

    await saveImage(result.imageUrl, outputPath)
    generated.push({ modelId, path: outputPath })
  }

  return generated
}

async function withRetries<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === retries) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)))
    }
  }

  throw lastError
}

async function main() {
  const falKey = getFalApiKey()
  if (!falKey && !argv.dryRun) {
    console.error('❌ FAL_API_KEY or FAL_KEY is required')
    process.exit(1)
  }

  let articles = readTargetArticles()

  if (argv.article) {
    articles = articles.filter((article) => article.slug === argv.article)
  }

  if (argv.limit && argv.limit > 0) {
    articles = articles.slice(0, argv.limit)
  }

  console.log('\n🎨 Generate Premium Article Alternatives')
  console.log('=====================================')
  console.log(`Target articles: ${articles.length}`)
  console.log(`Premium models: ${PREMIUM_MODELS.map((id) => MODEL_ALIASES[id]).join(', ')}`)

  if (articles.length === 0) {
    console.log('\n✅ No target articles found.')
    return
  }

  const falClient = argv.dryRun ? null : new FalClient(falKey)
  let promoted = 0
  let failed = 0

  for (let index = 0; index < articles.length; index++) {
    const article = articles[index]
    console.log(`\n[${index + 1}/${articles.length}] ${article.slug}`)

    const scoredCandidates = PREMIUM_MODELS.map((modelId) => {
      const model = getModelById(modelId)!
      const fit = computeCreativeFit(article, model)
      const outputPath = getOutputPath(article.slug, modelId, PREMIUM_MODELS.indexOf(modelId) + 2)
      return {
        modelId,
        score: fit.score,
        rationale: fit.rationale,
        path: outputPath,
        publicPath: getPublicPath(article.slug, outputPath),
      }
    }).sort((left, right) => right.score - left.score)

    if (argv.dryRun) {
      console.log(`Planned winner: ${MODEL_ALIASES[scoredCandidates[0].modelId]} (${scoredCandidates[0].score})`)
      console.log(scoredCandidates.map((candidate) => `- ${MODEL_ALIASES[candidate.modelId]}: ${candidate.score} :: ${candidate.rationale}`).join('\n'))
      continue
    }

    try {
      await withRetries(() => ensureAlternatives(article, falClient!))

      const winner = scoredCandidates[0]
      const selectedPath = copySelected(article.slug, winner.path)
      const selectedPublicPath = getPublicPath(article.slug, selectedPath)
      updateFrontmatter(article.filePath, selectedPublicPath)
      writeSelectionSummary(
        article.slug,
        {
          modelId: winner.modelId,
          score: winner.score,
          rationale: winner.rationale,
          publicPath: selectedPublicPath,
        },
        scoredCandidates.map((candidate) => ({
          modelId: candidate.modelId,
          score: candidate.score,
          rationale: candidate.rationale,
          publicPath: candidate.publicPath,
        }))
      )

      promoted++
      console.log(`Selected ${MODEL_ALIASES[winner.modelId]} -> ${selectedPublicPath}`)
    } catch (error) {
      failed++
      console.error(`❌ ${article.slug}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log('\n📊 Premium Alternative Summary')
  console.log(`Promoted winners: ${promoted}`)
  console.log(`Failed articles: ${failed}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})