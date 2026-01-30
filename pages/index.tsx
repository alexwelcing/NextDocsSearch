import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import StructuredData from '@/components/StructuredData'

interface Article {
  slug: string
  title: string
  description: string
  date: string
  author: string[]
  keywords?: string[]
  ogImage?: string
  featured?: boolean
  featuredPriority?: number
}

export default function Home() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([])

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch('/api/articles')
        if (!response.ok) throw new Error('Failed to fetch articles')
        const data = await response.json()
        setArticles(data)
        
        // Get featured articles (sorted by priority)
        const featured = data
          .filter((a: Article) => a.featured)
          .sort((a: Article, b: Article) => 
            (a.featuredPriority || 999) - (b.featuredPriority || 999)
          )
          .slice(0, 3)
        setFeaturedArticles(featured)
      } catch (error) {
        console.error('Failed to fetch articles:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchArticles()
  }, [])

  const latestArticles = articles.slice(0, 6)

  return (
    <>
      <Head>
        <title>Alex Welcing | AI Strategy & Product Leadership</title>
        <meta
          name="description"
          content="Building intelligent systems and frameworks for emergent AI futures. Expert insights on AI product strategy, ML systems, and speculative AI research."
        />
        <meta name="keywords" content="AI strategy, product leadership, machine learning, AI futures, Alex Welcing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph */}
        <meta property="og:title" content="Alex Welcing | AI Strategy & Product Leadership" />
        <meta property="og:description" content="Building intelligent systems and frameworks for emergent AI futures." />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing | AI Strategy & Product Leadership" />
        <meta name="twitter:description" content="Building intelligent systems and frameworks for emergent AI futures." />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />
        
        {/* RSS Feed */}
        <link rel="alternate" type="application/rss+xml" title="Alex Welcing RSS Feed" href="https://alexwelcing.com/api/rss" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing - AI Strategy & Product Leadership",
          url: "https://alexwelcing.com",
          description: "Building intelligent systems and frameworks for emergent AI futures.",
          author: { "@type": "Person", name: "Alex Welcing", url: "https://alexwelcing.com/about" }
        }}
      />

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          url: "https://alexwelcing.com",
          jobTitle: "AI Strategy & Product Leadership",
          description: "Building intelligent systems and frameworks for emergent AI futures.",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ]
        }}
      />

      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {/* Simple Header */}
        <header className="border-b border-gray-800">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/" className="text-xl font-bold font-mono">
              ALEX WELCING
            </Link>
            <div className="flex gap-6 text-sm">
              <Link href="/articles" className="hover:text-cyan-400 transition-colors">
                Articles
              </Link>
              <Link href="/about" className="hover:text-cyan-400 transition-colors">
                About
              </Link>
              <Link href="/chat" className="hover:text-cyan-400 transition-colors">
                Chat
              </Link>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
              AI Strategy & Product Leadership
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-8 leading-relaxed">
              Building intelligent systems and frameworks for emergent AI futures. 
              Exploring the intersection of strategy, product, and speculative research.
            </p>
            <div className="flex gap-4">
              <Link
                href="/articles"
                className="px-6 py-3 bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
              >
                Read Articles
              </Link>
              <Link
                href="/about"
                className="px-6 py-3 border border-white hover:bg-white hover:text-black transition-colors"
              >
                About Me
              </Link>
            </div>
          </div>
        </section>

        {/* Featured Articles */}
        {featuredArticles.length > 0 && (
          <section className="max-w-6xl mx-auto px-6 py-12">
            <h2 className="text-3xl font-bold mb-8 font-mono">Featured</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {featuredArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/docs/articles/${article.slug}`}
                  className="group border border-gray-800 hover:border-cyan-400 transition-colors p-6"
                >
                  <div className="text-xs text-gray-500 mb-2 font-mono">
                    {new Date(article.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <h3 className="text-xl font-bold mb-3 group-hover:text-cyan-400 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-3">
                    {article.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Latest Articles */}
        <section className="max-w-6xl mx-auto px-6 py-12 mb-20">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold font-mono">Latest</h2>
            <Link href="/articles" className="text-cyan-400 hover:underline text-sm">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading articles...</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {latestArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/docs/articles/${article.slug}`}
                  className="group border border-gray-800 hover:border-gray-600 transition-all p-6"
                >
                  <div className="text-xs text-gray-500 mb-2 font-mono">
                    {new Date(article.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-white transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2">
                    {article.description}
                  </p>
                  {article.keywords && article.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {article.keywords.slice(0, 3).map((keyword) => (
                        <span
                          key={keyword}
                          className="text-xs px-2 py-1 bg-gray-900 text-gray-400"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-800 py-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <h3 className="font-bold mb-4 font-mono">Connect</h3>
                <div className="flex flex-col gap-2 text-sm text-gray-400">
                  <a href="https://x.com/alexwelcing" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    X (Twitter)
                  </a>
                  <a href="https://github.com/alexwelcing" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    GitHub
                  </a>
                  <a href="https://www.linkedin.com/in/alexwelcing" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    LinkedIn
                  </a>
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-4 font-mono">Explore</h3>
                <div className="flex flex-col gap-2 text-sm text-gray-400">
                  <Link href="/articles" className="hover:text-white">All Articles</Link>
                  <Link href="/speculative-ai" className="hover:text-white">Speculative AI</Link>
                  <Link href="/agent-futures" className="hover:text-white">Agent Futures</Link>
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-4 font-mono">Site</h3>
                <div className="flex flex-col gap-2 text-sm text-gray-400">
                  <Link href="/about" className="hover:text-white">About</Link>
                  <Link href="/chat" className="hover:text-white">AI Chat</Link>
                  <a href="/api/rss" className="hover:text-white">RSS Feed</a>
                </div>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
              © {new Date().getFullYear()} Alex Welcing. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
