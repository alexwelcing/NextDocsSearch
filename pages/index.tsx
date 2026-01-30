import React from 'react'
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
  ogImage?: string
  featured?: boolean
  featuredPriority?: number
}

interface HomeProps {
  featuredArticles: Article[]
  recentArticles: Article[]
  totalArticles: number
}

export default function HomePage({ featuredArticles, recentArticles, totalArticles }: HomeProps) {
  return (
    <>
      <Head>
        <title>Alex Welcing | AI Strategy & Speculative Futures</title>
        <meta
          name="description"
          content="Original research on speculative AI futures, agent civilizations, and emergent intelligence systems. Building frameworks for abundant cognition."
        />
        <meta name="keywords" content="speculative AI, emergent intelligence, AI futures, AI strategy, product leadership" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:title" content="Alex Welcing | AI Strategy & Speculative Futures" />
        <meta property="og:description" content="Original research on speculative AI futures, agent civilizations, and emergent intelligence systems." />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing | AI Strategy & Speculative Futures" />
        <meta name="twitter:description" content="Original research on speculative AI futures, agent civilizations, and emergent intelligence systems." />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />

        <meta name="theme-color" content="#0a0a0a" />

        {/* Preload critical fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing - AI Strategy & Speculative Futures",
          url: "https://alexwelcing.com",
          description: "Original research on speculative AI futures, agent civilizations, and emergent intelligence systems.",
          author: { "@type": "Person", name: "Alex Welcing", url: "https://alexwelcing.com/about" }
        }}
      />

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          url: "https://alexwelcing.com",
          jobTitle: "AI Strategy & Product Leadership",
          description: "Building frameworks for understanding worlds where intelligence becomes abundant.",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ]
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
              <Link href="/articles" className="font-mono text-xs tracking-wider text-white/60 hover:text-white transition-colors">
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

        {/* Hero */}
        <header className="pt-32 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                AI Strategy &
              </span>
              <br />
              <span className="text-white/90">
                Speculative Futures
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed mb-8">
              Original frameworks for understanding worlds where intelligence becomes abundant.
              Exploring what happens when cognitive labor approaches zero marginal cost.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-sm tracking-wide hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all"
              >
                READ RESEARCH
                <span className="text-xs opacity-60">({totalArticles} articles)</span>
              </Link>
              <a
                href="/feed.xml"
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 text-white/60 font-mono text-sm tracking-wide hover:border-white/30 hover:text-white/80 transition-all"
              >
                RSS FEED
              </a>
            </div>
          </div>
        </header>

        {/* Featured Section */}
        {featuredArticles.length > 0 && (
          <section className="py-16 px-6 border-t border-white/5">
            <div className="max-w-4xl mx-auto">
              <h2 className="font-mono text-xs tracking-widest text-cyan-400/80 mb-8">FEATURED RESEARCH</h2>
              <div className="grid gap-6">
                {featuredArticles.map((article, index) => (
                  <Link
                    key={article.slug}
                    href={`/articles/${article.slug}`}
                    className="group block p-6 -mx-6 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl md:text-2xl font-semibold text-white/90 group-hover:text-cyan-400 transition-colors mb-2 leading-tight">
                          {article.title}
                        </h3>
                        <p className="text-white/50 leading-relaxed line-clamp-2 mb-3">
                          {article.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs font-mono text-white/30">
                          <time dateTime={article.date}>
                            {new Date(article.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </time>
                          {article.keywords?.slice(0, 2).map(kw => (
                            <span key={kw} className="px-2 py-0.5 bg-white/5 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="hidden md:block text-cyan-400/50 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all text-2xl">
                        &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Recent Articles */}
        <section className="py-16 px-6 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-mono text-xs tracking-widest text-white/40">RECENT</h2>
              <Link
                href="/articles"
                className="font-mono text-xs tracking-wider text-cyan-400/60 hover:text-cyan-400 transition-colors"
              >
                VIEW ALL &rarr;
              </Link>
            </div>
            <div className="space-y-1">
              {recentArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group flex items-center justify-between py-4 border-b border-white/5 hover:border-cyan-500/20 transition-colors"
                >
                  <span className="text-white/70 group-hover:text-white transition-colors truncate pr-4">
                    {article.title}
                  </span>
                  <time
                    dateTime={article.date}
                    className="font-mono text-xs text-white/30 whitespace-nowrap"
                  >
                    {new Date(article.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </time>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6 border-t border-white/5 bg-gradient-to-b from-transparent to-cyan-950/10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-white/90 mb-4">
              New research every 4 hours
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              Follow on X for automated article drops exploring AI futures, emergent systems, and speculative scenarios.
            </p>
            <a
              href="https://x.com/alexwelcing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black font-mono text-sm tracking-wide hover:bg-cyan-400 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              FOLLOW @ALEXWELCING
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/5">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="font-mono text-xs text-white/30">
              &copy; {new Date().getFullYear()} Alex Welcing
            </p>
            <div className="flex items-center gap-6">
              <a href="/feed.xml" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">RSS</a>
              <a href="/sitemap.xml" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">SITEMAP</a>
              <a href="https://github.com/alexwelcing" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">GITHUB</a>
              <a href="https://linkedin.com/in/alexwelcing" target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-white/30 hover:text-white/60 transition-colors">LINKEDIN</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const articlesDir = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const filenames = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx'))

  const articles: Article[] = filenames.map(filename => {
    const filePath = path.join(articlesDir, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)

    return {
      slug: filename.replace('.mdx', ''),
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date instanceof Date ? data.date.toISOString() : (data.date || new Date().toISOString()),
      keywords: data.keywords || [],
      ogImage: data.ogImage || null,
      featured: data.featured || false,
      featuredPriority: data.featuredPriority || 999,
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const featuredArticles = articles
    .filter(a => a.featured)
    .sort((a, b) => (a.featuredPriority || 999) - (b.featuredPriority || 999))
    .slice(0, 3)

  const recentArticles = articles
    .filter(a => !a.featured)
    .slice(0, 8)

  return {
    props: {
      featuredArticles,
      recentArticles,
      totalArticles: articles.length,
    },
    revalidate: 3600, // ISR: Regenerate every hour
  }
}
