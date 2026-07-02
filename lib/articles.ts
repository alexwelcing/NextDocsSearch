/**
 * Shared article loading utilities
 * Deduplicates getStaticProps logic across hub pages and article index
 */

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ARTICLE_FOLDER_PATH = path.join(process.cwd(), 'pages', 'docs', 'articles')
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.svg']

export interface ArticleMeta {
  slug: string
  title: string
  description: string
  date: string
  heroImage: string
  keywords?: string[]
  seriesOrder?: number | null
  [key: string]: unknown
}

/**
 * Resolve hero image path for a given article slug
 */
export function resolveHeroImage(slug: string): string {
  for (const ext of IMAGE_EXTENSIONS) {
    const imgPath = path.join(process.cwd(), 'public', 'images', 'articles', `${slug}${ext}`)
    if (fs.existsSync(imgPath)) {
      return `/images/articles/${slug}${ext}`
    }
  }
  return ''
}

/**
 * Get raw list of MDX filenames in the articles directory
 */
export function getArticleFilenames(): string[] {
  return fs.readdirSync(ARTICLE_FOLDER_PATH).filter((f) => f.endsWith('.mdx'))
}

/**
 * Load metadata for a single article by slug
 */
export function getArticleBySlug(slug: string): ArticleMeta | null {
  const filename = `${slug}.mdx`
  if (!fs.existsSync(path.join(ARTICLE_FOLDER_PATH, filename))) {
    return null
  }

  const filePath = path.join(ARTICLE_FOLDER_PATH, filename)
  const fileContents = fs.readFileSync(filePath, 'utf8')
  const { data } = matter(fileContents)

  return {
    slug,
    title: (data.title as string) || slug,
    description: (data.description as string) || '',
    date: (data.date as string) || '',
    heroImage: resolveHeroImage(slug),
    keywords: (data.keywords as string[]) || [],
    seriesOrder: (data.seriesOrder as number) || null,
  }
}

/**
 * Scan all articles and return their metadata
 */
export function scanArticles(): ArticleMeta[] {
  const filenames = getArticleFilenames()

  return filenames
    .map((filename) => {
      const slug = filename.replace('.mdx', '')
      return getArticleBySlug(slug)
    })
    .filter((a): a is ArticleMeta => a !== null)
}

/**
 * Filter articles by keyword matches in slug, title, or description
 */
export function filterArticlesByKeywords(
  articles: ArticleMeta[],
  keywords: string[]
): ArticleMeta[] {
  return articles.filter((article) => {
    const slugLower = article.slug.toLowerCase()
    const titleLower = article.title.toLowerCase()
    const descLower = article.description.toLowerCase()

    return keywords.some(
      (keyword) =>
        slugLower.includes(keyword) ||
        titleLower.includes(keyword) ||
        descLower.includes(keyword)
    )
  })
}

/**
 * Sort articles by date (newest first) and optionally limit count
 */
export function sortArticlesByDate(
  articles: ArticleMeta[],
  limit?: number
): ArticleMeta[] {
  const sorted = [...articles].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  return limit ? sorted.slice(0, limit) : sorted
}

/**
 * Get articles by explicit slug list, preserving order
 */
export function getArticlesBySlugs(
  slugs: string[],
  sortBySeriesOrder = false
): ArticleMeta[] {
  const articles = slugs
    .map((slug) => getArticleBySlug(slug))
    .filter((a): a is ArticleMeta => a !== null)

  if (sortBySeriesOrder) {
    return articles.sort((a, b) => (a.seriesOrder || 0) - (b.seriesOrder || 0))
  }

  return articles
}
