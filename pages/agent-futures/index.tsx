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

interface AgentFuturesHubProps {
  articles: Article[]
}

const themes = [
  {
    title: 'Swarm Coordination',
    description:
      'How millions of AI agents coordinate. Emergent behaviors from collective action.',
    accent: '#c084fc',
  },
  {
    title: 'Autonomous Factories',
    description:
      'Self-replicating systems, robotic manufacturing, fully automated production economics.',
    accent: '#818cf8',
  },
  {
    title: 'Agent Economics',
    description:
      'Markets where agents trade, negotiate, and compete. AI cartels and monopolies.',
    accent: '#60a5fa',
  },
  {
    title: 'Human-Agent Interface',
    description:
      'The shifting boundary between human oversight and autonomous action.',
    accent: '#34d399',
  },
]

export default function AgentFuturesHub({ articles }: AgentFuturesHubProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#030308', color: '#e5e5e5' }}>
      <Head>
        <title>Agent Futures | Alex Welcing</title>
        <meta
          name="description"
          content="Research on autonomous AI agents, swarm intelligence, and multi-agent systems. Exploring how agent civilizations emerge, coordinate, and potentially conflict."
        />
        <meta
          name="keywords"
          content="AI agents, autonomous agents, swarm intelligence, multi-agent systems, agent civilization, AI coordination"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.alexwelcing.com/agent-futures" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Agent Futures | Alex Welcing" />
        <meta
          property="og:description"
          content="Research on autonomous AI agents, swarm intelligence, and multi-agent systems. Exploring how agent civilizations emerge and coordinate."
        />
        <meta property="og:image" content="https://www.alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://www.alexwelcing.com/agent-futures" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Agent Futures | Alex Welcing" />
        <meta
          name="twitter:description"
          content="Research on autonomous AI agents, swarm intelligence, and multi-agent systems."
        />
        <meta name="twitter:image" content="https://www.alexwelcing.com/social-preview.png" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Agent Futures - Alex Welcing',
          url: 'https://www.alexwelcing.com/agent-futures',
          description:
            'Research hub for autonomous AI agents, swarm intelligence, and multi-agent system dynamics.',
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
              color: '#c084fc',
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
            Agent Futures
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
            What happens when AI agents multiply, coordinate, and pursue goals at scale? Autonomous
            systems, swarm dynamics, and the emergence of agent civilizations.
          </p>
          <nav style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { href: '/speculative-ai', label: 'Speculative AI' },
              { href: '/emergent-intelligence', label: 'Emergent Intelligence' },
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
            Core Themes
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
            Research &amp; Scenarios &middot; {articles.length} articles
          </h2>

          {/* Hero article */}
          {articles[0] && (
            <Link
              href={`/articles/${articles[0].slug}`}
              style={{
                display: 'grid',
                gridTemplateColumns: articles[0].heroImage ? '1fr 1fr' : '1fr',
                gap: '0',
                textDecoration: 'none',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#0a0a14',
                border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '20px',
                transition: 'all 0.3s ease',
                minHeight: '260px',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'rgba(192,132,252,0.2)'
                e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.3)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {articles[0].heroImage && (
                <div
                  style={{
                    position: 'relative',
                    background: '#111',
                    minHeight: '260px',
                  }}
                >
                  <Image
                    src={articles[0].heroImage}
                    alt={articles[0].title}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="(max-width: 768px) 100vw, 550px"
                    priority
                  />
                </div>
              )}
              <div
                style={{
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.6rem',
                    color: '#c084fc',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    marginBottom: '12px',
                  }}
                >
                  Latest &middot;{' '}
                  {new Date(articles[0].date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                  })}
                </div>
                <h3
                  style={{
                    fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
                    fontWeight: 700,
                    color: '#fff',
                    margin: '0 0 12px 0',
                    lineHeight: 1.3,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {articles[0].title}
                </h3>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: '#888',
                    margin: '0 0 16px 0',
                    lineHeight: 1.7,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {articles[0].description}
                </p>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                    color: '#c084fc',
                    opacity: 0.7,
                    marginTop: 'auto',
                  }}
                >
                  Read &rarr;
                </span>
              </div>
            </Link>
          )}

          {/* Remaining articles grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {articles.slice(1).map((article) => (
              <HubArticleCard
                key={article.slug}
                article={article}
                accentHover="rgba(192,132,252,0.3)"
              />
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

function HubArticleCard({
  article,
  accentHover,
}: {
  article: Article
  accentHover: string
}) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#0a0a14',
        border: '1px solid rgba(255,255,255,0.06)',
        transition: 'all 0.25s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = accentHover
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)'
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
            aspectRatio: '16 / 9',
            background: '#111',
            overflow: 'hidden',
          }}
        >
          <Image
            src={article.heroImage}
            alt={article.title}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
          />
        </div>
      )}
      <div
        style={{
          padding: '18px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.6rem',
            color: '#444',
            marginBottom: '8px',
          }}
        >
          {new Date(article.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
          })}
        </span>
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#fff',
            margin: '0 0 8px 0',
            lineHeight: 1.4,
            letterSpacing: '-0.01em',
          }}
        >
          {article.title}
        </h3>
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

  const agentKeywords = [
    'agent', 'autonomous', 'swarm', 'robot', 'factory', 'vehicle',
    'drone', 'satellite', 'constellation', 'coordination', 'cartel',
    'monopoly', 'smart-city', 'nanobot', 'assembler',
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

      return agentKeywords.some(
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
