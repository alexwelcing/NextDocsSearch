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

        <meta name="theme-color" content="#F5D547" />
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

      <div className="min-h-screen bg-parchment-50">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-parchment-50/95 backdrop-blur-sm border-b border-earth-200">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sun-400 to-flora-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AW</span>
              </span>
              <span className="font-serif text-lg text-earth-700 group-hover:text-flora-600 transition-colors">
                Alex Welcing
              </span>
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/articles" className="text-sm text-earth-600 hover:text-flora-600 transition-colors font-medium">
                Research
              </Link>
              <a
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-earth-500 hover:text-sun-600 transition-colors font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Share
              </a>
            </div>
          </div>
        </nav>

        <article className="pb-16">
          {/* Hero Image */}
          {ogImage && (
            <div className="relative w-full aspect-[2.5/1] overflow-hidden">
              <Image
                src={ogImage}
                alt={title}
                fill
                priority
                className="object-cover"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-parchment-50 via-parchment-50/20 to-transparent" />
            </div>
          )}

          <div className="max-w-3xl mx-auto px-6">
            {/* Header */}
            <header className={`${ogImage ? '-mt-20 relative' : 'pt-16'} mb-12`}>
              <div className="bg-white rounded-2xl p-8 md:p-10 border border-earth-100 shadow-lg">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-flora-400" />
                    <time dateTime={date} className="text-sm text-earth-400">{formattedDate}</time>
                  </div>
                  <span className="text-earth-300">·</span>
                  <span className="text-sm text-earth-400">{readingTime} min read</span>
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-earth-700 leading-tight mb-4">
                  {title}
                </h1>
                {description && (
                  <p className="text-lg text-earth-500 leading-relaxed mb-6">
                    {description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-earth-500">By {author.join(', ')}</span>
                  {keywords && keywords.slice(0, 3).map(kw => (
                    <span key={kw} className="px-3 py-1 bg-parchment-100 text-earth-500 text-xs rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </header>

            {/* Content */}
            <div className="prose prose-lg max-w-none
              prose-headings:font-serif prose-headings:font-bold prose-headings:text-earth-700
              prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-earth-200
              prose-h3:text-xl prose-h3:text-flora-700 prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-earth-600 prose-p:leading-relaxed
              prose-a:text-flora-600 prose-a:no-underline hover:prose-a:underline hover:prose-a:text-flora-700
              prose-strong:text-earth-700 prose-strong:font-semibold
              prose-ul:text-earth-600 prose-ol:text-earth-600
              prose-li:my-1
              prose-blockquote:border-l-sun-400 prose-blockquote:text-earth-500 prose-blockquote:italic prose-blockquote:bg-sun-50/50 prose-blockquote:py-1 prose-blockquote:rounded-r-lg
              prose-code:bg-flora-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-flora-700 prose-code:font-mono prose-code:text-sm
              prose-pre:bg-earth-700 prose-pre:border prose-pre:border-earth-600 prose-pre:rounded-xl
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>

            {/* Share Section */}
            <div className="mt-16 py-8 border-t border-earth-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm font-medium text-earth-500">Share this article</span>
                <div className="flex items-center gap-3">
                  <a
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-earth-200 text-earth-600 hover:text-earth-700 hover:border-sun-300 hover:shadow-sm transition-all rounded-lg text-sm font-medium"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-earth-200 text-earth-600 hover:text-earth-700 hover:border-flora-300 hover:shadow-sm transition-all rounded-lg text-sm font-medium"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(articleUrl)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-earth-200 text-earth-600 hover:text-earth-700 hover:border-earth-400 hover:shadow-sm transition-all rounded-lg text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Prev/Next Navigation */}
            <nav className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {prevArticle && (
                <Link
                  href={`/articles/${prevArticle.slug}`}
                  className="group p-6 bg-white rounded-2xl border border-earth-100 hover:border-sun-300 hover:shadow-md transition-all"
                >
                  <span className="text-xs font-medium text-earth-400 mb-2 block flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </span>
                  <span className="font-serif text-earth-700 group-hover:text-flora-600 transition-colors line-clamp-2">
                    {prevArticle.title}
                  </span>
                </Link>
              )}
              {nextArticle && (
                <Link
                  href={`/articles/${nextArticle.slug}`}
                  className="group p-6 bg-white rounded-2xl border border-earth-100 hover:border-sun-300 hover:shadow-md transition-all md:text-right"
                >
                  <span className="text-xs font-medium text-earth-400 mb-2 block flex items-center gap-1 md:justify-end">
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <span className="font-serif text-earth-700 group-hover:text-flora-600 transition-colors line-clamp-2">
                    {nextArticle.title}
                  </span>
                </Link>
              )}
            </nav>

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <section className="mt-16 pt-12 border-t border-earth-200">
                <div className="flex items-center gap-2 mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-flora-400" />
                  <h2 className="text-sm font-semibold text-earth-500 uppercase tracking-wider">Related Research</h2>
                </div>
                <div className="grid gap-4">
                  {relatedArticles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/articles/${article.slug}`}
                      className="group flex items-start justify-between gap-4 p-5 bg-white rounded-xl border border-earth-100 hover:border-sun-300 hover:shadow-md transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-serif text-lg text-earth-700 group-hover:text-flora-600 transition-colors mb-1">
                          {article.title}
                        </h3>
                        <p className="text-sm text-earth-500 line-clamp-1">
                          {article.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sun-100 text-sun-600 group-hover:bg-sun-400 group-hover:text-earth-700 transition-all shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </article>

        {/* Footer */}
        <footer className="py-12 bg-earth-700">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-sun-400 to-flora-500 flex items-center justify-center">
                  <span className="text-white font-bold text-xs">AW</span>
                </span>
                <span className="text-earth-300 text-sm">&copy; {new Date().getFullYear()} Alex Welcing</span>
              </div>
              <div className="flex items-center gap-8">
                <Link href="/articles" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">All Research</Link>
                <a href="/feed.xml" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">RSS</a>
                <a href="https://x.com/alexwelcing" target="_blank" rel="noopener noreferrer" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">@alexwelcing</a>
              </div>
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
