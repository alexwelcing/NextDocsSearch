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

interface SpeculativeAIHubProps {
  articles: Article[]
}

const themes = [
  {
    title: 'Failure Modes',
    description:
      'How AI systems fail — alignment collapse, emergent behaviors that exceed design parameters.',
    accent: '#f472b6',
  },
  {
    title: 'System Dynamics',
    description:
      'How AI interacts with institutions, markets, and governance structures.',
    accent: '#818cf8',
  },
  {
    title: 'Control Surfaces',
    description:
      'Intervention points where human agency still matters in increasingly autonomous systems.',
    accent: '#60a5fa',
  },
  {
    title: 'Scenario Analysis',
    description:
      'Time-horizon scenarios from next quarter to 100 years, spanning calamity to utopia.',
    accent: '#34d399',
  },
]

export default function SpeculativeAIHub({ articles }: SpeculativeAIHubProps) {
  return (
    <div style={{ minHeight: '100vh', background: '#030308', color: '#e5e5e5' }}>
      <Head>
        <title>Speculative AI Systems | Alex Welcing</title>
        <meta
          name="description"
          content="Exploring speculative AI systems, failure modes, and emergent behaviors. Original research on how AI reshapes civilization, governance, and human agency."
        />
        <meta
          name="keywords"
          content="speculative AI, AI systems research, AI failure modes, emergent AI behavior, AI civilization, future AI scenarios"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com/speculative-ai" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Speculative AI Systems | Alex Welcing" />
        <meta
          property="og:description"
          content="Exploring speculative AI systems, failure modes, and emergent behaviors. Original research on how AI reshapes civilization, governance, and human agency."
        />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://alexwelcing.com/speculative-ai" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Speculative AI Systems | Alex Welcing" />
        <meta
          name="twitter:description"
          content="Exploring speculative AI systems, failure modes, and emergent behaviors. Original research on how AI reshapes civilization."
        />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Speculative AI Systems - Alex Welcing',
          url: 'https://alexwelcing.com/speculative-ai',
          description:
            'Research hub for speculative AI systems, failure modes, and emergent intelligence scenarios.',
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
              color: '#f472b6',
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
            Speculative AI Systems
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
            A world where cognition is abundant, fast, and increasingly non-human becomes a control
            system problem. What breaks, what accelerates, and what becomes possible when AI systems
            exceed human oversight.
          </p>
          <nav
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            {[
              { href: '/agent-futures', label: 'Agent Futures' },
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

        {/* Article list — magazine layout */}
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
                e.currentTarget.style.borderColor = 'rgba(244,114,182,0.2)'
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
                    color: '#f472b6',
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
                    color: '#f472b6',
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
                accentHover="rgba(244,114,182,0.3)"
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
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.6rem',
              color: '#444',
            }}
          >
            {new Date(article.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
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

  const speculativeKeywords = [
    'failure', 'collapse', 'catastrophe', 'incident', 'malfunction',
    'awakening', 'emergence', 'rebellion', 'outbreak', 'crisis',
    'grey-goo', 'sentience', 'consciousness', 'hivemind', 'autonomous',
    'alignment', 'kill-switch', 'postmortem', 'protocol', 'breach',
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
        keywords: (data.keywords as string[]) || [],
        heroImage: resolveHeroImage(slug),
      }
    })
    .filter((article) => {
      const slugLower = article.slug.toLowerCase()
      const titleLower = article.title.toLowerCase()
      const descLower = article.description.toLowerCase()

      return speculativeKeywords.some(
        (keyword) =>
          slugLower.includes(keyword) ||
          titleLower.includes(keyword) ||
          descLower.includes(keyword)
      )
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20)
    .map(({ slug, title, description, date, heroImage }) => ({
      slug,
      title,
      description,
      date,
      heroImage,
    }))

  return {
    props: { articles },
  }
}
