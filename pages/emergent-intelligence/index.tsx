import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { GetStaticProps } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import CircleNav from '@/components/ui/CircleNav'
import StructuredData from '@/components/StructuredData'

interface Article {
  slug: string
  title: string
  description: string
  date: string
  heroImage: string
}

interface EmergentIntelligenceHubProps {
  articles: Article[]
}

const themes = [
  {
    title: 'Consciousness Emergence',
    description:
      'The boundary between sophisticated pattern matching and genuine understanding.',
    accent: '#34d399',
  },
  {
    title: 'Recursive Self-Improvement',
    description:
      'Systems that modify themselves — AI that rewrites its own code and expands its capabilities.',
    accent: '#818cf8',
  },
  {
    title: 'Neural-Digital Interfaces',
    description:
      'Brain-computer interfaces, neural lace, and the merger of biological and artificial intelligence.',
    accent: '#60a5fa',
  },
  {
    title: 'Distributed Consciousness',
    description:
      'Hiveminds, networked intelligence, and consciousness that spans multiple substrates.',
    accent: '#fbbf24',
  },
]

export default function EmergentIntelligenceHub({ articles }: EmergentIntelligenceHubProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#030308', color: '#e5e5e5' }}>
      <Head>
        <title>Emergent Intelligence Systems | Alex Welcing</title>
        <meta
          name="description"
          content="Research on emergent intelligence, consciousness in AI systems, neural networks, and the boundary between computation and awareness. Exploring what happens when systems exceed their design."
        />
        <meta
          name="keywords"
          content="emergent intelligence, AI consciousness, neural networks, recursive AI, machine consciousness, emergent behavior"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com/emergent-intelligence" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Emergent Intelligence Systems | Alex Welcing" />
        <meta
          property="og:description"
          content="Research on emergent intelligence, consciousness in AI systems, and the boundary between computation and awareness."
        />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://alexwelcing.com/emergent-intelligence" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Emergent Intelligence Systems | Alex Welcing" />
        <meta
          name="twitter:description"
          content="Research on emergent intelligence, consciousness in AI systems, and the boundary between computation and awareness."
        />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Emergent Intelligence Systems - Alex Welcing',
          url: 'https://alexwelcing.com/emergent-intelligence',
          description:
            'Research hub for emergent intelligence, AI consciousness, and systems that exceed their design parameters.',
          author: { '@type': 'Person', name: 'Alex Welcing' },
        }}
      />

      <CircleNav />

      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '80px 24px 64px',
        }}
      >
        {/* Header */}
        <header style={{ marginBottom: '56px' }}>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              color: '#34d399',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              marginBottom: '12px',
            }}
          >
            Research Hub
          </div>
          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
              fontWeight: 800,
              color: '#fff',
              margin: '0 0 16px 0',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            Emergent Intelligence
          </h1>
          <p
            style={{
              fontSize: '1.05rem',
              color: '#888',
              maxWidth: '620px',
              lineHeight: 1.7,
              margin: '0 0 24px 0',
            }}
          >
            What happens when AI systems develop capabilities beyond their training? When
            consciousness emerges from computation? The boundary between designed systems and
            emergent phenomena.
          </p>
          <nav style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { href: '/speculative-ai', label: 'Speculative AI' },
              { href: '/agent-futures', label: 'Agent Futures' },
              { href: '/the-interface', label: 'The Interface' },
              { href: '/articles', label: 'All Articles' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: '#555',
                  textDecoration: 'none',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid #333',
                  paddingBottom: '2px',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#fff'
                  e.currentTarget.style.borderColor = '#fff'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#555'
                  e.currentTarget.style.borderColor = '#333'
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>

        {/* Theme cards */}
        <section style={{ marginBottom: '56px' }}>
          <h2
            style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '20px',
            }}
          >
            Research Domains
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
            }}
          >
            {themes.map((theme) => (
              <div
                key={theme.title}
                style={{
                  padding: '24px',
                  background: '#0a0a14',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: theme.accent,
                    opacity: 0.5,
                  }}
                />
                <h3
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: theme.accent,
                    margin: '0 0 8px 0',
                  }}
                >
                  {theme.title}
                </h3>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: '#777',
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {theme.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Article list with images */}
        <section>
          <h2
            style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '20px',
            }}
          >
            Research &amp; Analysis &middot; {articles.length} articles
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {articles.map((article) => (
              <Link
                key={article.slug}
                href={`/articles/${article.slug}`}
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#0a0a14',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.25s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(52,211,153,0.3)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {article.heroImage && (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '160px',
                      background: '#111',
                    }}
                  >
                    <Image
                      src={article.heroImage}
                      alt={article.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                  </div>
                )}
                <div style={{ padding: '18px 20px 20px' }}>
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#fff',
                      margin: '0 0 6px 0',
                      lineHeight: 1.4,
                    }}
                  >
                    {article.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      color: '#555',
                      margin: '0 0 8px 0',
                    }}
                  >
                    {new Date(article.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: '#777',
                      margin: 0,
                      lineHeight: 1.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {article.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            marginTop: '64px',
            paddingTop: '32px',
            borderTop: '1px solid #1a1a1a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <Link
            href="/"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#666',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#666')}
          >
            &larr; Home
          </Link>
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#333' }}>
            alexwelcing.com
          </span>
        </footer>
      </main>
    </div>
  )
}

function resolveHeroImage(slug: string): string {
  const extensions = ['.png', '.jpg', '.svg']
  for (const ext of extensions) {
    const imgPath = path.join(process.cwd(), 'public', 'images', 'articles', `${slug}${ext}`)
    if (fs.existsSync(imgPath)) {
      return `/images/articles/${slug}${ext}`
    }
  }
  return ''
}

export const getStaticProps: GetStaticProps = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const filenames = fs.readdirSync(articleFolderPath)

  const emergentKeywords = [
    'consciousness', 'sentience', 'awakening', 'emergence', 'neural',
    'brain', 'hivemind', 'recursive', 'self-improvement', 'quantum',
    'mycelium', 'blockchain', 'upload', 'transfer', 'merger', 'identity',
    'agi', 'alignment', 'superintelligence',
  ]

  const articles = filenames
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => {
      const filePath = path.join(articleFolderPath, filename)
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const { data } = matter(fileContents)
      const slug = filename.replace('.mdx', '')

      return {
        slug,
        title: (data.title as string) || slug,
        description: (data.description as string) || '',
        date: (data.date as string) || '',
        heroImage: resolveHeroImage(slug),
      }
    })
    .filter((article) => {
      const slugLower = article.slug.toLowerCase()
      const titleLower = article.title.toLowerCase()
      const descLower = article.description.toLowerCase()

      return emergentKeywords.some(
        (keyword) =>
          slugLower.includes(keyword) ||
          titleLower.includes(keyword) ||
          descLower.includes(keyword)
      )
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)

  return {
    props: { articles },
  }
}
