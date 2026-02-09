import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alexwelcing.com'
const DRIP_STATE_FILE = path.join(process.cwd(), '.drip-state.json')
const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')

interface Article {
  slug: string
  title: string
  description: string
  date: string
  keywords: string[]
  ogImage?: string
  url: string
}

interface DripState {
  postedSlugs: string[]
  lastPostedAt: string | null
  totalPosted: number
}

function loadDripState(): DripState {
  try {
    if (fs.existsSync(DRIP_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(DRIP_STATE_FILE, 'utf8'))
    }
  } catch {
    // Ignore errors
  }
  return { postedSlugs: [], lastPostedAt: null, totalPosted: 0 }
}

function getAllArticles(): Article[] {
  const filenames = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx'))

  return filenames.map(filename => {
    const filePath = path.join(ARTICLES_DIR, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)
    const slug = filename.replace('.mdx', '')

    return {
      slug,
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date instanceof Date ? data.date.toISOString() : (data.date || new Date().toISOString()),
      keywords: data.keywords || [],
      ogImage: data.ogImage || null,
      url: `${SITE_URL}/articles/${slug}`,
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function generatePosts(article: Article) {
  const hashtags = article.keywords
    .slice(0, 3)
    .map(k => `#${k.replace(/\s+/g, '').replace(/-/g, '')}`)
    .join(' ')

  const xContent = article.description.length > 180
    ? article.description.slice(0, 177) + '...'
    : article.description

  const xPost = `${article.title}\n\n${xContent}\n\n${article.url}\n\n${hashtags}`

  const linkedInPost = `📚 New Research: ${article.title}

${article.description}

Read the full analysis: ${article.url}

${hashtags}

#SpeculativeAI #AIFutures #EmergentIntelligence`

  return { xPost, linkedInPost }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const state = loadDripState()
    const articles = getAllArticles()

    // Find next unposted article
    const unposted = articles.filter(a => !state.postedSlugs.includes(a.slug))
    const nextArticle = unposted.length > 0
      ? unposted[unposted.length - 1]  // Oldest unposted
      : articles[articles.length - 1]   // Cycle back to oldest

    if (!nextArticle) {
      return res.status(404).json({ error: 'No articles available' })
    }

    const posts = generatePosts(nextArticle)

    // Calculate next post time (every 4 hours from last post)
    let nextPostTime: string | null = null
    if (state.lastPostedAt) {
      const lastPost = new Date(state.lastPostedAt)
      const next = new Date(lastPost.getTime() + 4 * 60 * 60 * 1000)
      nextPostTime = next.toISOString()
    }

    res.status(200).json({
      article: nextArticle,
      posts,
      stats: {
        totalArticles: articles.length,
        postedCount: state.postedSlugs.length,
        remainingInCycle: articles.length - state.postedSlugs.length,
        lastPostedAt: state.lastPostedAt,
        nextPostTime,
        totalPosted: state.totalPosted,
      },
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
