import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { GetStaticProps } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import CircleNav from '@/components/ui/CircleNav'
import StructuredData from '@/components/StructuredData'

interface InterfaceArticle {
  slug: string
  title: string
  description: string
  date: string
  seriesOrder: number
  heroImage: string
}

interface InterfacePageProps {
  articles: InterfaceArticle[]
}

export default function TheInterfacePage({ articles }: InterfacePageProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Pick a few highlight images for the hero mosaic
  const heroImages = articles.filter((a) => a.heroImage).slice(0, 6)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#030308',
        color: '#e5e5e5',
      }}
    >
      <Head>
        <title>The Interface — A 24-Part Series | Alex Welcing</title>
        <meta
          name="description"
          content="A 24-part fiction series exploring bridge events between human and artificial intelligence — the tools, moments, and cultural shifts that define the boundary where two kinds of mind meet."
        />
        <meta
          name="keywords"
          content="the interface series, human-AI bridge, AI fiction, speculative fiction, bridge events, AI interface, computational linguistics, artificial intelligence fiction"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.alexwelcing.com/the-interface" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="The Interface — A 24-Part Series | Alex Welcing" />
        <meta
          property="og:description"
          content="A 24-part series exploring bridge events between human and artificial intelligence."
        />
        <meta
          property="og:image"
          content="https://www.alexwelcing.com/images/articles/interface-01-the-first-translator.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://www.alexwelcing.com/the-interface" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="The Interface — A 24-Part Series" />
        <meta
          name="twitter:description"
          content="A 24-part series exploring bridge events between human and artificial intelligence."
        />
        <meta
          name="twitter:image"
          content="https://www.alexwelcing.com/images/articles/interface-01-the-first-translator.png"
        />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'The Interface — A 24-Part Series',
          url: 'https://www.alexwelcing.com/the-interface',
          description:
            'A 24-part fiction series exploring bridge events between human and artificial intelligence.',
          author: {
            '@type': 'Person',
            name: 'Alex Welcing',
          },
        }}
      />

      <CircleNav />

      {/* Hero Section - Full-bleed image mosaic */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
        }}
      >
        {/* Background mosaic grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(2, 1fr)',
            gap: '2px',
            opacity: 0.4,
          }}
        >
          {heroImages.map((article) => (
            <div
              key={article.slug}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              <Image
                src={article.heroImage}
                alt=""
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 50vw, 33vw"
                priority
              />
            </div>
          ))}
        </div>

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(3,3,8,0.3) 0%, rgba(3,3,8,0.6) 40%, rgba(3,3,8,0.95) 80%, #030308 100%)',
            zIndex: 1,
          }}
        />

        {/* Hero text */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 24px 64px',
            width: '100%',
          }}
        >
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#00d4ff',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              marginBottom: '16px',
            }}
          >
            24-Part Fiction Series
          </div>
          <h1
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              fontWeight: 800,
              color: '#fff',
              margin: '0 0 20px 0',
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            The Interface
          </h1>
          <p
            style={{
              fontSize: 'clamp(1rem, 2vw, 1.2rem)',
              color: '#999',
              maxWidth: '640px',
              lineHeight: 1.7,
              margin: '0 0 32px 0',
            }}
          >
            Bridge events between human and artificial intelligence &mdash; the tools, moments, and
            cultural shifts that define the boundary where two kinds of mind meet.
          </p>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: '#555',
              display: 'flex',
              gap: '24px',
            }}
          >
            <span>{articles.length} chapters</span>
            <span>Fiction</span>
            <span>AI-generated artwork by Nano Banana 2</span>
          </div>
        </div>
      </section>

      {/* Article Grid */}
      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px 96px',
        }}
      >
        {/* Cinematic image gallery grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '20px',
            marginBottom: '64px',
          }}
        >
          {articles.map((article, index) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              style={{
                display: 'block',
                textDecoration: 'none',
                position: 'relative',
                borderRadius: '10px',
                overflow: 'hidden',
                background: '#0a0a14',
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'all 0.3s ease',
                transform: hoveredIndex === index ? 'translateY(-4px)' : 'none',
                boxShadow:
                  hoveredIndex === index
                    ? '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.15)'
                    : 'none',
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Large hero image */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 9',
                  background: '#111',
                }}
              >
                {article.heroImage ? (
                  <Image
                    src={article.heroImage}
                    alt={article.title}
                    fill
                    style={{
                      objectFit: 'cover',
                      transition: 'transform 0.5s ease',
                      transform: hoveredIndex === index ? 'scale(1.05)' : 'scale(1)',
                    }}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #0a0a14, #1a1a2e)',
                      fontFamily: 'monospace',
                      color: '#333',
                      fontSize: '0.7rem',
                    }}
                  >
                    {String(article.seriesOrder).padStart(2, '0')}
                  </div>
                )}

                {/* Episode number badge */}
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.65rem',
                    color: '#00d4ff',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    zIndex: 1,
                  }}
                >
                  {String(article.seriesOrder).padStart(2, '0')} / 24
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: '18px 20px 20px' }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#fff',
                    margin: '0 0 8px 0',
                    lineHeight: 1.4,
                    transition: 'color 0.2s',
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
          ))}
        </div>

        {/* Footer */}
        <footer
          style={{
            borderTop: '1px solid #1a1a1a',
            paddingTop: '32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', gap: '24px' }}>
            <Link
              href="/articles"
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
              All Articles
            </Link>
            <Link
              href="/speculative-ai"
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
              Speculative AI
            </Link>
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#333',
            }}
          >
            Artwork generated with Nano Banana 2
          </span>
        </footer>
      </main>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const filenames = fs.readdirSync(articleFolderPath)

  const interfaceSlugs = [
    'interface-01-the-first-translator',
    'interface-02-haptic-vernacular',
    'interface-03-the-ceramicist-and-the-kiln',
    'interface-04-protocol-zero',
    'interface-05-the-weight-of-a-gaze',
    'interface-06-latency-as-intimacy',
    'interface-07-the-cartographer-of-attention',
    'interface-08-scaffold-and-bone',
    'interface-09-the-grief-engine',
    'interface-10-forking-paths',
    'interface-11-the-soil-whisperer',
    'interface-12-resonance-frequency',
    'interface-13-the-interpreters-dilemma',
    'interface-14-phantom-limb-electric-ghost',
    'interface-15-the-last-manual',
    'interface-16-the-gardeners-algorithm',
    'interface-17-consensus-engine',
    'interface-18-the-proprioception-problem',
    'interface-19-when-the-ship-dreamed',
    'interface-20-the-apprentices-reversal',
    'interface-21-bridge-tenders',
    'interface-22-the-memory-market',
    'interface-23-calibration-day',
    'interface-24-the-slowest-interface',
  ]

  const articles: InterfaceArticle[] = interfaceSlugs
    .map((slug) => {
      const filename = `${slug}.mdx`
      if (!filenames.includes(filename)) return null

      const filePath = path.join(articleFolderPath, filename)
      const fileContents = fs.readFileSync(filePath, 'utf8')
      const { data } = matter(fileContents)

      // Check for hero image - Nano Banana 2 generates PNGs
      const possibleImages = [
        `/images/articles/${slug}.png`,
        `/images/articles/${slug}.jpg`,
        `/images/articles/${slug}.svg`,
      ]

      let heroImage = ''
      for (const img of possibleImages) {
        const imgPath = path.join(process.cwd(), 'public', img)
        if (fs.existsSync(imgPath)) {
          heroImage = img
          break
        }
      }

      return {
        slug,
        title: data.title || slug,
        description: data.description || '',
        date: data.date || '',
        seriesOrder: data.seriesOrder || parseInt(slug.match(/interface-(\d+)/)?.[1] || '0', 10),
        heroImage: heroImage || (data.ogImage as string) || '',
      }
    })
    .filter((a): a is InterfaceArticle => a !== null)
    .sort((a, b) => a.seriesOrder - b.seriesOrder)

  return {
    props: {
      articles,
    },
  }
}
