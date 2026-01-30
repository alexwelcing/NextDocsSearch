import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

interface Article {
  slug: string
  title: string
  description: string
  date: string
  author: string[]
  keywords?: string[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const articlesDirectory = path.join(process.cwd(), 'pages', 'docs', 'articles')
    const filenames = fs.readdirSync(articlesDirectory)
    
    const articles: Article[] = filenames
      .filter(filename => filename.endsWith('.mdx'))
      .map(filename => {
        const filePath = path.join(articlesDirectory, filename)
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const { data } = matter(fileContents)
        
        return {
          slug: filename.replace('.mdx', ''),
          title: data.title || 'Untitled',
          description: data.description || '',
          date: data.date || new Date().toISOString(),
          author: data.author || ['Alex Welcing'],
          keywords: data.keywords || []
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50) // Last 50 articles

    const siteUrl = 'https://alexwelcing.com'
    const buildDate = new Date().toUTCString()

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Alex Welcing - AI Strategy &amp; Product Leadership</title>
    <link>${siteUrl}</link>
    <description>Building intelligent systems and frameworks for emergent AI futures</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/api/rss" rel="self" type="application/rss+xml"/>
    ${articles.map(article => `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${siteUrl}/docs/articles/${article.slug}</link>
      <guid isPermaLink="true">${siteUrl}/docs/articles/${article.slug}</guid>
      <description><![CDATA[${article.description}]]></description>
      <pubDate>${new Date(article.date).toUTCString()}</pubDate>
      <author>alex@alexwelcing.com (${article.author.join(', ')})</author>
      ${article.keywords?.map(keyword => `<category>${keyword}</category>`).join('\n      ') || ''}
    </item>`).join('')}
  </channel>
</rss>`

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')
    res.status(200).send(rss)
  } catch (error) {
    console.error('Error generating RSS feed:', error)
    res.status(500).json({ error: 'Failed to generate RSS feed' })
  }
}
