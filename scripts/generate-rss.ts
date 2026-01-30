/**
 * RSS Feed Generator
 *
 * Generates an RSS feed for all articles.
 * Run: pnpm run generate:rss
 */

import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://alexwelcing.com'
const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'feed.xml')

interface Article {
  slug: string
  title: string
  description: string
  date: string
  keywords: string[]
  content: string
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getAllArticles(): Article[] {
  const filenames = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx'))

  return filenames.map(filename => {
    const filePath = path.join(ARTICLES_DIR, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)

    return {
      slug: filename.replace('.mdx', ''),
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date instanceof Date ? data.date.toISOString() : (data.date || new Date().toISOString()),
      keywords: data.keywords || [],
      content: content.slice(0, 500) + '...', // First 500 chars for preview
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

function generateRssFeed(articles: Article[]): string {
  const lastBuildDate = new Date().toUTCString()

  const items = articles.slice(0, 50).map(article => {
    const pubDate = new Date(article.date).toUTCString()
    const url = `${SITE_URL}/articles/${article.slug}`
    const categories = article.keywords.map(k => `<category>${escapeXml(k)}</category>`).join('\n        ')

    return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(article.description)}</description>
      <content:encoded><![CDATA[${article.content}]]></content:encoded>
      ${categories}
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Alex Welcing - AI Strategy &amp; Speculative Futures</title>
    <link>${SITE_URL}</link>
    <description>Original research on speculative AI futures, agent civilizations, and emergent intelligence systems.</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/favicon.ico</url>
      <title>Alex Welcing</title>
      <link>${SITE_URL}</link>
    </image>
${items}
  </channel>
</rss>`
}

function main() {
  console.log('📰 Generating RSS feed...\n')

  const articles = getAllArticles()
  console.log(`Found ${articles.length} articles`)

  const feed = generateRssFeed(articles)

  // Ensure public directory exists
  const publicDir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  fs.writeFileSync(OUTPUT_FILE, feed)
  console.log(`\n✅ RSS feed generated: ${OUTPUT_FILE}`)
  console.log(`   Articles included: ${Math.min(articles.length, 50)}`)
}

main()
