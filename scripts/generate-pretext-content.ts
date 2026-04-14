import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

interface ArticleIndexEntry {
  slug: string
  title: string
  date: string
  author: string[]
  description: string
  keywords: string[]
  readingTime: number
  wordCount: number
  articleType: 'fiction' | 'research'
  heroImage: string | null
  thumbnail: string | null
  ogImage: string | null
  articleVideo: string | null
  chunkPath: string
}

interface ArticleChunk {
  slug: string
  title: string
  date: string
  author: string[]
  description: string
  keywords: string[]
  articleType: 'fiction' | 'research'
  readingTime: number
  wordCount: number
  heroImage: string | null
  thumbnail: string | null
  ogImage: string | null
  articleVideo: string | null
  content: string
  plainText: string
  sections: string[]
}

interface SearchDoc {
  slug: string
  title: string
  description: string
  keywords: string[]
  body: string
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function stripMdx(content: string): string {
  return normalizeWhitespace(
    content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[>#*_~|-]/g, ' ')
  )
}

function splitSections(content: string): string[] {
  return content
    .split(/\n#{1,3}\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function writeStaticArticleHtml(
  outDir: string,
  article: ArticleChunk,
  siteUrl: string,
  generatedAt: string
): void {
  const articleUrl = `${siteUrl}/articles/${article.slug}`
  const title = `${article.title} | Alex Welcing`
  const description = article.description || article.plainText.slice(0, 160)
  const keywords = article.keywords.join(', ')
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.date,
    dateModified: article.date,
    author: article.author.map((name) => ({ '@type': 'Person', name })),
    description,
    image: article.ogImage ? `${siteUrl}${article.ogImage}` : undefined,
    mainEntityOfPage: articleUrl,
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: `${siteUrl}/articles` },
      { '@type': 'ListItem', position: 3, name: article.title, item: articleUrl },
    ],
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <meta name="robots" content="index,follow" />
    <meta name="generator" content="NextDocsSearch PreText Offline Build" />
    <meta name="build-time" content="${generatedAt}" />
    <link rel="canonical" href="${articleUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${articleUrl}" />
    ${article.ogImage ? `<meta property="og:image" content="${siteUrl}${article.ogImage}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${article.ogImage ? `<meta name="twitter:image" content="${siteUrl}${article.ogImage}" />` : ''}
    <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: Inter, system-ui, -apple-system, sans-serif; background: #090b10; color: #eef2ff; }
      main { max-width: 760px; margin: 0 auto; padding: 48px 20px 80px; line-height: 1.75; }
      h1 { font-size: clamp(2rem, 4.2vw, 3rem); margin-bottom: 0.6rem; line-height: 1.1; }
      .meta { color: #93a4c8; font-size: 0.9rem; margin-bottom: 2rem; }
      .description { color: #c9d7f8; margin-bottom: 2rem; }
      pre { white-space: pre-wrap; background: #0f1420; padding: 16px; border-radius: 10px; overflow-x: auto; }
      .hero { margin: 0 0 2rem; border-radius: 14px; overflow: hidden; }
      .hero img { width: 100%; display: block; }
      a { color: #80c1ff; }
    </style>
  </head>
  <body>
    <main>
      <a href="/" aria-label="Back to articles">← Back to stories</a>
      <h1>${escapeHtml(article.title)}</h1>
      <div class="meta">${escapeHtml(article.date)} · ${article.readingTime} min read · ${escapeHtml(article.author.join(', '))}</div>
      ${article.heroImage ? `<figure class="hero"><img src="${article.heroImage}" alt="${escapeHtml(article.title)}" loading="lazy" decoding="async" /></figure>` : ''}
      <p class="description">${escapeHtml(description)}</p>
      <pre>${escapeHtml(article.plainText)}</pre>
    </main>
  </body>
</html>`

  const articleDir = path.join(outDir, 'articles', article.slug)
  fs.mkdirSync(articleDir, { recursive: true })
  fs.writeFileSync(path.join(articleDir, 'index.html'), html, 'utf8')
}

function main() {
  const root = process.cwd()
  const articleFolderPath = path.join(root, 'pages', 'docs', 'articles')
  const imageManifestPath = path.join(root, 'lib', 'generated', 'image-manifest.json')
  const outDir = path.join(root, 'pretext-app', 'public')
  const dataDir = path.join(outDir, 'data')
  const chunkDir = path.join(dataDir, 'articles')
  const staticOut = outDir
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://alexwelcing.com').replace(/\/$/, '')
  const generatedAt = new Date().toISOString()

  fs.mkdirSync(chunkDir, { recursive: true })

  const imageManifest: Record<
    string,
    { heroImage: string | null; thumbnail: string | null; ogImage: string | null }
  > = fs.existsSync(imageManifestPath)
    ? JSON.parse(fs.readFileSync(imageManifestPath, 'utf8'))
    : {}

  const filenames = fs.readdirSync(articleFolderPath).filter((file) => file.endsWith('.mdx')).sort()

  const indexEntries: ArticleIndexEntry[] = []
  const searchDocs: SearchDoc[] = []
  const slugs: string[] = []

  for (const filename of filenames) {
    const slug = filename.replace(/\.mdx$/, '')
    const filePath = path.join(articleFolderPath, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)
    const plainText = stripMdx(content)
    const wordCount = plainText.split(/\s+/).filter(Boolean).length
    const readingTime = Math.max(1, Math.ceil(wordCount / 220))
    const imageData = imageManifest[slug] || { heroImage: null, thumbnail: null, ogImage: null }
    const videoPath = `/images/article-videos/${slug}.mp4`
    const hasVideo = fs.existsSync(path.join(root, 'public', videoPath))

    const chunkPath = `/data/articles/${slug}.json`

    const chunk: ArticleChunk = {
      slug,
      title: String(data.title || slug),
      date: String(data.date || ''),
      author: Array.isArray(data.author)
        ? data.author.map(String)
        : data.author
          ? [String(data.author)]
          : ['Alex Welcing'],
      description: String(data.description || ''),
      keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : [],
      articleType: data.articleType === 'research' ? 'research' : 'fiction',
      readingTime,
      wordCount,
      heroImage: imageData.heroImage,
      thumbnail: imageData.thumbnail,
      ogImage: imageData.ogImage,
      articleVideo: hasVideo ? videoPath : null,
      content,
      plainText,
      sections: splitSections(content),
    }

    indexEntries.push({
      slug: chunk.slug,
      title: chunk.title,
      date: chunk.date,
      author: chunk.author,
      description: chunk.description,
      keywords: chunk.keywords,
      readingTime: chunk.readingTime,
      wordCount: chunk.wordCount,
      articleType: chunk.articleType,
      heroImage: chunk.heroImage,
      thumbnail: chunk.thumbnail,
      ogImage: chunk.ogImage,
      articleVideo: chunk.articleVideo,
      chunkPath,
    })

    searchDocs.push({
      slug: chunk.slug,
      title: chunk.title,
      description: chunk.description,
      keywords: chunk.keywords,
      body: chunk.plainText.slice(0, 12000),
    })

    slugs.push(slug)
    fs.writeFileSync(path.join(chunkDir, `${slug}.json`), JSON.stringify(chunk), 'utf8')
    writeStaticArticleHtml(staticOut, chunk, siteUrl, generatedAt)
  }

  const indexPayload = {
    generatedAt,
    total: indexEntries.length,
    version: 1,
    articles: indexEntries,
  }

  fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(indexPayload), 'utf8')
  fs.writeFileSync(path.join(dataDir, 'search-docs.json'), JSON.stringify(searchDocs), 'utf8')
  fs.writeFileSync(path.join(dataDir, 'prefetch-manifest.json'), JSON.stringify({ chunks: indexEntries.map((a) => a.chunkPath) }), 'utf8')

  const sitemapUrls = ['/', ...slugs.map((slug) => `/articles/${slug}`)]
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
    .map((loc) => `  <url><loc>${siteUrl}${loc}</loc><changefreq>weekly</changefreq><priority>${loc === '/' ? '1.0' : '0.8'}</priority></url>`)
    .join('\n')}\n</urlset>\n`
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8')

  const robots = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`
  fs.writeFileSync(path.join(outDir, 'robots.txt'), robots, 'utf8')

  const redirects = '/docs/articles/:slug /articles/:slug 301\n/docs/articles / 301\n'
  fs.writeFileSync(path.join(outDir, '_redirects'), redirects, 'utf8')

  console.log(`Generated pretext content payloads: ${indexEntries.length} articles`)
}

main()
