import { GetStaticPaths, GetStaticProps, NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import StructuredData from '@/components/StructuredData'

interface ArticleProps {
  title: string
  date: string
  author: string[]
  content: string
  description?: string
  keywords?: string[]
  ogImage?: string
  readingTime: number
  relatedArticles: Array<{
    slug: string
    title: string
    description: string
    date: string
  }>
  slug: string
  prevArticle: { slug: string; title: string } | null
  nextArticle: { slug: string; title: string } | null
}

const ArticlePage: NextPage<ArticleProps> = ({
  title,
  date,
  author,
  content,
  description,
  keywords,
  ogImage,
  readingTime,
  relatedArticles,
  slug,
  prevArticle,
  nextArticle,
}) => {
  const siteUrl = 'https://alexwelcing.com'
  const articleUrl = `${siteUrl}/articles/${slug}`
  const fullOgImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`) : `${siteUrl}/social-preview.png`

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return (
    <>
      <Head>
        <title>{title} | Alex Welcing</title>
        <meta name="description" content={description || `Read ${title}`} />
        {keywords && <meta name="keywords" content={keywords.join(', ')} />}
        <meta name="author" content={author.join(', ')} />
        <link rel="canonical" href={articleUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description || `Read ${title}`} />
        <meta property="og:image" content={fullOgImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="article:published_time" content={date} />
        <meta property="article:author" content={author.join(', ')} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description || `Read ${title}`} />
        <meta name="twitter:image" content={fullOgImage} />

        <meta name="theme-color" content="#030308" />
      </Head>

      <StructuredData
        type="Article"
        data={{
          headline: title,
          description: description,
          image: fullOgImage,
          datePublished: date,
          dateModified: date,
          url: articleUrl,
          author: author.map(name => ({
            '@type': 'Person',
            name: name,
            url: `${siteUrl}/about`
          })),
          publisher: {
            '@type': 'Organization',
            name: 'Alex Welcing',
            url: siteUrl,
          },
        }}
      />

      <div className="min-h-screen bg-[#030308] text-white">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030308]/90 backdrop-blur-sm border-b border-white/5">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-mono text-sm tracking-wide text-white/90 hover:text-white transition-colors">
              ALEX WELCING
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/articles" className="font-mono text-xs tracking-wider text-white/60 hover:text-white transition-colors">
                RESEARCH
              </Link>
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs tracking-wider text-white/60 hover:text-cyan-400 transition-colors"
              >
                SHARE
              </a>
            </div>
          </div>
        </nav>

        <article className="pt-24 pb-16 px-6">
          <div className="max-w-3xl mx-auto">
            {/* Hero Image */}
            {ogImage && (
              <div className="relative w-full aspect-[2/1] mb-10 -mx-6 md:mx-0 overflow-hidden">
                <Image
                  src={ogImage}
                  alt={title}
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030308] via-transparent to-transparent" />
              </div>
            )}

            {/* Header */}
            <header className="mb-12">
              <div className="flex items-center gap-3 mb-4 text-xs font-mono text-white/40">
                <time dateTime={date}>{formattedDate}</time>
                <span className="text-white/20">|</span>
                <span>{readingTime} min read</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white/95 leading-tight mb-4">
                {title}
              </h1>
              {description && (
                <p className="text-lg text-white/50 leading-relaxed">
                  {description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-6">
                <span className="text-sm text-white/30">By {author.join(', ')}</span>
                {keywords && keywords.slice(0, 3).map(kw => (
                  <span key={kw} className="px-2 py-1 bg-white/5 text-xs font-mono text-white/40">
                    {kw}
                  </span>
                ))}
              </div>
            </header>

            {/* Content */}
            <div className="prose prose-invert prose-lg max-w-none
              prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-2xl prose-h2:text-white/90 prose-h2:mt-12 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2
              prose-h3:text-xl prose-h3:text-cyan-400/90 prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-white/70 prose-p:leading-relaxed
              prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-white/90 prose-strong:font-semibold
              prose-ul:text-white/70 prose-ol:text-white/70
              prose-li:my-1
              prose-blockquote:border-l-cyan-500 prose-blockquote:text-white/50 prose-blockquote:italic
              prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-cyan-300 prose-code:font-mono prose-code:text-sm
              prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>

            {/* Share Section */}
            <div className="mt-16 py-8 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="font-mono text-xs text-white/30 tracking-wider">SHARE THIS ARTICLE</span>
                <div className="flex items-center gap-3">
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all font-mono text-xs"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all font-mono text-xs"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(articleUrl)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-all font-mono text-xs"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>

            {/* Prev/Next Navigation */}
            <nav className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {prevArticle && (
                <Link
                  href={`/articles/${prevArticle.slug}`}
                  className="group p-4 border border-white/10 hover:border-cyan-500/30 transition-colors"
                >
                  <span className="font-mono text-xs text-white/30 mb-2 block">&larr; PREVIOUS</span>
                  <span className="text-white/70 group-hover:text-cyan-400 transition-colors line-clamp-2">
                    {prevArticle.title}
                  </span>
                </Link>
              )}
              {nextArticle && (
                <Link
                  href={`/articles/${nextArticle.slug}`}
                  className="group p-4 border border-white/10 hover:border-cyan-500/30 transition-colors md:text-right"
                >
                  <span className="font-mono text-xs text-white/30 mb-2 block">NEXT &rarr;</span>
                  <span className="text-white/70 group-hover:text-cyan-400 transition-colors line-clamp-2">
                    {nextArticle.title}
                  </span>
                </Link>
              )}
            </nav>

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <section className="mt-16 pt-12 border-t border-white/10">
                <h2 className="font-mono text-xs tracking-widest text-white/40 mb-8">RELATED RESEARCH</h2>
                <div className="grid gap-4">
                  {relatedArticles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/articles/${article.slug}`}
                      className="group flex items-start justify-between gap-4 py-4 border-b border-white/5 hover:border-cyan-500/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white/70 group-hover:text-cyan-400 transition-colors mb-1">
                          {article.title}
                        </h3>
                        <p className="text-sm text-white/30 line-clamp-1">
                          {article.description}
                        </p>
                      </div>
                      <span className="text-cyan-400/30 group-hover:text-cyan-400 transition-colors">
                        &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </article>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/5">
          <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/articles" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">
              &larr; ALL ARTICLES
            </Link>
            <div className="flex items-center gap-6">
              <a href="/feed.xml" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">RSS</a>
              <a href="https://x.com/alexwelcing" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-white/30 hover:text-cyan-400 transition-colors">@ALEXWELCING</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

// Calculate reading time
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
}

export const getStaticPaths: GetStaticPaths = async () => {
  const articlesDir = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const filenames = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))
  const paths = filenames.map((filename) => ({
    params: { slug: filename.replace('.mdx', '') },
  }))
  return { paths, fallback: false }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string }
  const articlesDir = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const articleFilePath = path.join(articlesDir, `${slug}.mdx`)
  const fileContents = fs.readFileSync(articleFilePath, 'utf8')
  const { data, content } = matter(fileContents)

  // Get all articles for related/navigation
  const filenames = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))
  const allArticles = filenames.map(filename => {
    const filePath = path.join(articlesDir, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)
    return {
      slug: filename.replace('.mdx', ''),
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date instanceof Date ? data.date.toISOString() : (data.date || new Date().toISOString()),
      keywords: data.keywords || [],
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Find current article index for prev/next
  const currentIndex = allArticles.findIndex(a => a.slug === slug)
  const prevArticle = currentIndex < allArticles.length - 1 ? { slug: allArticles[currentIndex + 1].slug, title: allArticles[currentIndex + 1].title } : null
  const nextArticle = currentIndex > 0 ? { slug: allArticles[currentIndex - 1].slug, title: allArticles[currentIndex - 1].title } : null

  // Get related articles (same keywords, excluding current)
  const currentKeywords = data.keywords || []
  const relatedArticles = allArticles
    .filter(a => a.slug !== slug)
    .map(a => ({
      ...a,
      relevance: a.keywords.filter((k: string) => currentKeywords.includes(k)).length
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 3)
    .map(({ relevance, ...a }) => a)

  const readingTime = calculateReadingTime(content)

  return {
    props: {
      title: data.title as string,
      date: (data.date instanceof Date ? data.date.toISOString() : data.date) as string,
      author: Array.isArray(data.author) ? data.author : [data.author || 'Alex Welcing'],
      description: data.description || '',
      keywords: data.keywords || [],
      ogImage: data.ogImage || '',
      content,
      readingTime,
      relatedArticles,
      slug,
      prevArticle,
      nextArticle,
    },
    revalidate: 3600, // ISR
  }
}

export default ArticlePage
