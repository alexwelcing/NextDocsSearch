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

      <div className="min-h-screen bg-[#030308] text-white">
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-[#030308]/90 backdrop-blur-sm border-b border-white/5">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-mono text-sm tracking-wide text-white/90 hover:text-white transition-colors">
              ALEX WELCING
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/articles" className="font-mono text-xs tracking-wider text-cyan-400">
                RESEARCH
              </Link>
              <Link href="/about" className="font-mono text-xs tracking-wider text-white/60 hover:text-white transition-colors">
                ABOUT
              </Link>
              <a
                href="https://x.com/alexwelcing"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs tracking-wider text-white/60 hover:text-cyan-400 transition-colors"
              >
                @X
              </a>
            </div>
          </div>
        </nav>

        <main className="pt-24 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-12">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white/90">
                Research Archive
              </h1>
              <p className="text-lg text-white/50 max-w-2xl">
                {articles.length} articles exploring AI futures, emergent systems, and speculative scenarios.
              </p>
            </header>

            {/* Search & Filters */}
            <div className="mb-10 space-y-4">
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white placeholder-white/30 font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-colors"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter(null)}
                  className={`px-3 py-1.5 font-mono text-xs tracking-wide transition-all ${
                    !filter
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                      : 'border border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
                  }`}
                >
                  ALL
                </button>
                {topKeywords.map(kw => (
                  <button
                    key={kw}
                    onClick={() => setFilter(filter === kw ? null : kw)}
                    className={`px-3 py-1.5 font-mono text-xs tracking-wide transition-all ${
                      filter === kw
                        ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                        : 'border border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
                    }`}
                  >
                    {kw.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Results count */}
            <div className="mb-6 font-mono text-xs text-white/30">
              {filteredArticles.length} {filteredArticles.length === 1 ? 'result' : 'results'}
              {filter && <span> in &ldquo;{filter}&rdquo;</span>}
              {searchQuery && <span> matching &ldquo;{searchQuery}&rdquo;</span>}
            </div>

            {/* Articles List */}
            <div className="space-y-1">
              {filteredArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group block py-6 border-b border-white/5 hover:border-cyan-500/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-medium text-white/80 group-hover:text-cyan-400 transition-colors mb-2 leading-snug">
                        {article.title}
                      </h2>
                      <p className="text-sm text-white/40 line-clamp-2 mb-3">
                        {article.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs font-mono text-white/25">
                        <time dateTime={article.date}>
                          {new Date(article.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </time>
                        {article.keywords?.slice(0, 2).map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-white/5">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="hidden md:block text-cyan-400/30 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all text-xl mt-1">
                      &rarr;
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {filteredArticles.length === 0 && (
              <div className="py-16 text-center">
                <p className="text-white/40 mb-4">No articles found</p>
                <button
                  onClick={() => { setFilter(null); setSearchQuery(''); }}
                  className="font-mono text-xs text-cyan-400 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/5">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">
              &larr; BACK TO HOME
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
