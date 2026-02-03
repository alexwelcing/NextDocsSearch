import React, { useState, useMemo } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { GetStaticProps } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import StructuredData from '@/components/StructuredData'

interface Article {
  slug: string
  title: string
  description: string
  date: string
  keywords: string[]
  articleType?: string
  ogImage?: string
}

interface ArticlesPageProps {
  articles: Article[]
  allKeywords: string[]
}

export default function ArticlesPage({ articles, allKeywords }: ArticlesPageProps) {
  const [filter, setFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesFilter = !filter || article.keywords?.includes(filter)
      const matchesSearch = !searchQuery ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesFilter && matchesSearch
    })
  }, [articles, filter, searchQuery])

  const topKeywords = allKeywords.slice(0, 12)

  return (
    <>
      <Head>
        <title>Research Archive | Alex Welcing</title>
        <meta
          name="description"
          content="Comprehensive archive of research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition."
        />
        <meta name="keywords" content="speculative AI, AI research, emergent intelligence, AI futures, AI systems analysis" />
        <link rel="canonical" href="https://alexwelcing.com/articles" />
        <meta property="og:title" content="Research Archive | Alex Welcing" />
        <meta property="og:description" content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition." />
        <meta property="og:url" content="https://alexwelcing.com/articles" />
        <meta property="og:type" content="website" />
      </Head>

      <StructuredData
        type="CollectionPage"
        data={{
          name: "AI Research Archive - Alex Welcing",
          url: "https://alexwelcing.com/articles",
          description: "Comprehensive archive of research on speculative AI futures and emergent intelligence.",
        }}
      />

      <div className="min-h-screen bg-parchment-50">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-parchment-50/95 backdrop-blur-sm border-b border-earth-200">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sun-400 to-flora-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AW</span>
              </span>
              <span className="font-serif text-lg text-earth-700 group-hover:text-flora-600 transition-colors">
                Alex Welcing
              </span>
            </Link>
            <div className="flex items-center gap-8">
              <Link href="/articles" className="text-sm text-flora-600 font-medium">
                Research
              </Link>
              <Link href="/about" className="text-sm text-earth-600 hover:text-flora-600 transition-colors font-medium">
                About
              </Link>
              <a
                href="https://x.com/alexwelcing"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-earth-500 hover:text-sun-600 transition-colors"
              >
                @alexwelcing
              </a>
            </div>
          </div>
        </nav>

        {/* Hero Header */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-sun-50 via-parchment-50 to-flora-50 opacity-60" />
          <div className="absolute top-10 left-20 w-40 h-40 bg-sun-300/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-10 w-32 h-32 bg-flora-300/20 rounded-full blur-2xl" />

          <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-2 h-2 rounded-full bg-flora-400" />
              <span className="text-sm font-medium text-flora-600 uppercase tracking-wide">Research Archive</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-earth-700 mb-4">
              Cultivated
              <span className="bg-gradient-to-r from-flora-600 to-sun-500 bg-clip-text text-transparent"> Insights</span>
            </h1>
            <p className="text-lg text-earth-500 max-w-2xl">
              {articles.length} articles exploring AI futures, emergent systems, and speculative scenarios.
              Ideas planted and grown over time.
            </p>
          </div>
        </header>

        <main className="pb-20 px-6">
          <div className="max-w-5xl mx-auto">
            {/* Search & Filters */}
            <div className="mb-10 space-y-4 bg-white rounded-2xl p-6 border border-earth-100 shadow-sm">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-earth-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search through the garden..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-parchment-50 border border-earth-200 rounded-xl text-earth-700 placeholder-earth-400 focus:outline-none focus:border-flora-400 focus:ring-2 focus:ring-flora-100 transition-all"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    !filter
                      ? 'bg-gradient-to-r from-sun-400 to-sun-500 text-earth-700 shadow-sm'
                      : 'bg-parchment-100 text-earth-500 hover:bg-parchment-200 hover:text-earth-600'
                  }`}
                >
                  All Topics
                </button>
                {topKeywords.map(kw => (
                  <button
                    key={kw}
                    onClick={() => setFilter(filter === kw ? null : kw)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      filter === kw
                        ? 'bg-gradient-to-r from-flora-500 to-flora-600 text-white shadow-sm'
                        : 'bg-parchment-100 text-earth-500 hover:bg-flora-50 hover:text-flora-600'
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            {/* Results count */}
            <div className="mb-6 flex items-center gap-2 text-sm text-earth-500">
              <span className="w-1.5 h-1.5 rounded-full bg-sun-400" />
              <span>
                {filteredArticles.length} {filteredArticles.length === 1 ? 'article' : 'articles'}
                {filter && <span className="text-flora-600"> in &ldquo;{filter}&rdquo;</span>}
                {searchQuery && <span className="text-flora-600"> matching &ldquo;{searchQuery}&rdquo;</span>}
              </span>
            </div>

            {/* Articles Grid */}
            <div className="grid gap-4">
              {filteredArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group block p-6 bg-white rounded-2xl border border-earth-100 hover:border-sun-300 hover:shadow-lg hover:shadow-sun-100/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-flora-400" />
                        <time dateTime={article.date} className="text-xs text-earth-400">
                          {new Date(article.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </time>
                      </div>
                      <h2 className="font-serif text-xl font-semibold text-earth-700 group-hover:text-flora-600 transition-colors mb-2 leading-snug">
                        {article.title}
                      </h2>
                      <p className="text-earth-500 text-sm leading-relaxed line-clamp-2 mb-3">
                        {article.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {article.keywords?.slice(0, 3).map(kw => (
                          <span key={kw} className="px-2 py-1 bg-parchment-100 text-earth-500 text-xs rounded-md">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-sun-100 text-sun-600 group-hover:bg-sun-400 group-hover:text-earth-700 transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div className="py-20 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-earth-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-earth-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-earth-500 mb-4">No articles found in this corner of the garden</p>
                <button
                  onClick={() => { setFilter(null); setSearchQuery(''); }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-flora-600 hover:text-flora-700 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Clear filters and explore all
                </button>
              </div>
            )}
          </div>
        </main>

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
                <Link href="/" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">Home</Link>
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

export const getStaticProps: GetStaticProps<ArticlesPageProps> = async () => {
  const articlesDir = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const filenames = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))

  // Keyword frequency map
  const keywordCounts: Record<string, number> = {}

  const articles: Article[] = filenames.map(filename => {
    const filePath = path.join(articlesDir, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)

    // Count keywords
    if (data.keywords && Array.isArray(data.keywords)) {
      data.keywords.forEach((kw: string) => {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1
      })
    }

    return {
      slug: filename.replace('.mdx', ''),
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date instanceof Date ? data.date.toISOString() : (data.date || new Date().toISOString()),
      keywords: data.keywords || [],
      articleType: data.articleType || 'article',
      ogImage: data.ogImage || null,
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Sort keywords by frequency
  const allKeywords = Object.entries(keywordCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([kw]) => kw)

  return {
    props: {
      articles,
      allKeywords,
    },
    revalidate: 3600, // ISR: Regenerate every hour
  }
}
