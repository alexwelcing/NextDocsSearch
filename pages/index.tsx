import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { GetStaticProps } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import StructuredData from '@/components/StructuredData'

// Dynamic import for 3D scene (client-side only)
const OrganicScene = dynamic(() => import('@/components/OrganicScene'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-gradient-to-br from-sun-100 via-parchment-50 to-flora-50 opacity-60" />
  ),
})

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
        <title>Alex Welcing | AI Strategy &amp; Speculative Futures</title>
        <meta
          name="description"
          content="Original research on speculative AI futures, emergent intelligence, and the transformation of human systems. Building frameworks for abundant cognition."
        />
        <meta name="keywords" content="speculative AI, emergent intelligence, AI futures, AI strategy, product leadership, AI research" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href="https://alexwelcing.com" />

        <meta property="og:title" content="Alex Welcing | AI Strategy & Speculative Futures" />
        <meta property="og:description" content="Original research on speculative AI futures, emergent intelligence, and the transformation of human systems." />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Alex Welcing" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:creator" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing | AI Strategy & Speculative Futures" />
        <meta name="twitter:description" content="Original research on speculative AI futures and emergent intelligence systems." />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />

        <meta name="theme-color" content="#F5D547" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing - AI Strategy & Speculative Futures",
          url: "https://alexwelcing.com",
          description: "Original research on speculative AI futures, emergent intelligence, and the transformation of human systems.",
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
              <Link href="/articles" className="text-sm text-earth-600 hover:text-flora-600 transition-colors font-medium">
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

        {/* Hero Section with 3D Scene */}
        <header className="relative overflow-hidden min-h-[85vh] flex items-center">
          {/* 3D Background */}
          <div className="absolute inset-0 z-0">
            <OrganicScene className="opacity-80" />
          </div>
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-parchment-50/90 via-parchment-50/70 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-parchment-50 via-transparent to-parchment-50/50 z-10" />

          <div className="relative z-20 max-w-5xl mx-auto px-6 py-20">
            <div className="max-w-3xl">
              <p className="text-flora-600 font-medium mb-4 tracking-wide text-sm uppercase">
                AI Research &amp; Strategy
              </p>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold text-earth-700 leading-tight mb-6">
                Cultivating
                <span className="block bg-gradient-to-r from-sun-500 via-sun-400 to-flora-500 bg-clip-text text-transparent">
                  Intelligent Futures
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-earth-500 leading-relaxed mb-10 max-w-2xl">
                Original research exploring what happens when cognitive abundance transforms human systems.
                Growing ideas at the intersection of AI, strategy, and speculative futures.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/articles"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-sun-400 to-sun-500 text-earth-700 font-semibold rounded-full hover:from-sun-500 hover:to-sun-600 transition-all shadow-lg shadow-sun-400/25 hover:shadow-sun-500/30"
                >
                  Explore Research
                  <span className="text-sm opacity-70">({totalArticles} articles)</span>
                </Link>
                <a
                  href="/feed.xml"
                  className="inline-flex items-center gap-2 px-6 py-4 border-2 border-earth-300 text-earth-600 font-medium rounded-full hover:border-flora-400 hover:text-flora-600 transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20C5 20 4 19 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1Z"/>
                  </svg>
                  RSS Feed
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Featured Research */}
        {featuredArticles.length > 0 && (
          <section className="py-20 bg-white border-y border-earth-100">
            <div className="max-w-5xl mx-auto px-6">
              <div className="flex items-center gap-3 mb-10">
                <span className="w-2 h-2 rounded-full bg-sun-400" />
                <h2 className="text-sm font-semibold text-earth-500 uppercase tracking-wider">Featured Research</h2>
              </div>
              <div className="grid gap-8 md:grid-cols-3">
                {featuredArticles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/articles/${article.slug}`}
                    className="group block p-6 bg-parchment-50 rounded-2xl border border-earth-100 hover:border-sun-300 hover:shadow-lg hover:shadow-sun-100 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-flora-400" />
                      <time dateTime={article.date} className="text-xs text-earth-400">
                        {new Date(article.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </time>
                    </div>
                    <h3 className="font-serif text-xl font-semibold text-earth-700 group-hover:text-flora-600 transition-colors mb-3 leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-earth-500 text-sm leading-relaxed line-clamp-3">
                      {article.description}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sun-600 text-sm font-medium group-hover:gap-3 transition-all">
                      Read more
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Recent Articles */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-flora-400" />
                <h2 className="text-sm font-semibold text-earth-500 uppercase tracking-wider">Latest Growth</h2>
              </div>
              <Link
                href="/articles"
                className="text-sm text-flora-600 hover:text-flora-700 font-medium flex items-center gap-1"
              >
                View all
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="space-y-4">
              {recentArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  className="group flex items-center justify-between py-5 border-b border-earth-100 hover:border-sun-300 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-serif text-lg text-earth-700 group-hover:text-flora-600 transition-colors truncate">
                      {article.title}
                    </h3>
                  </div>
                  <time dateTime={article.date} className="text-sm text-earth-400 whitespace-nowrap">
                    {new Date(article.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </time>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-flora-600 to-flora-700 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-sun-400 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-sun-300 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
              New research every 4 hours
            </h2>
            <p className="text-flora-100 text-lg mb-8 max-w-xl mx-auto">
              Follow along as ideas germinate. Fresh perspectives on AI futures, emergent systems, and speculative scenarios delivered to your feed.
            </p>
            <a
              href="https://x.com/alexwelcing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-sun-400 text-earth-700 font-semibold rounded-full hover:bg-sun-300 transition-colors shadow-lg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow @alexwelcing
            </a>
          </div>
        </section>

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
                <a href="/feed.xml" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">RSS</a>
                <a href="/sitemap.xml" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">Sitemap</a>
                <a href="https://github.com/alexwelcing" target="_blank" rel="noopener noreferrer" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">GitHub</a>
                <a href="https://linkedin.com/in/alexwelcing" target="_blank" rel="noopener noreferrer" className="text-earth-400 hover:text-sun-400 text-sm transition-colors">LinkedIn</a>
              </div>
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

  const displayFeatured = featuredArticles.length > 0 ? featuredArticles : articles.slice(0, 3)

  const recentArticles = articles
    .filter(a => !displayFeatured.find(f => f.slug === a.slug))
    .slice(0, 6)

  return {
    props: {
      featuredArticles: displayFeatured,
      recentArticles,
      totalArticles: articles.length,
    },
    revalidate: 3600,
  }
}
