import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { GetStaticProps } from 'next'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { discoverArticleImages } from '@/lib/article-images'
import ArticleDiscovery from '@/components/ui/ArticleDiscovery'
import CollectionShowcase from '@/components/ui/CollectionShowcase'
import CircleNav from '@/components/ui/CircleNav'
import StructuredData from '@/components/StructuredData'
import { ARTICLE_COLLECTIONS } from '@/lib/featured-articles'
import { SITE_URL } from '@/lib/site-url'

interface CollectionData {
  title: string
  description: string
  href: string
  accentColor: string
  articles: {
    slug: string
    title: string
    description?: string
    heroImage?: string
  }[]
}

interface ArticlesIndexProps {
  interfaceCollection: CollectionData
  collections: CollectionData[]
  featureHighlightsArticle: CollectionData['articles'][number] | null
}

export default function ArticlesIndex({
  interfaceCollection,
  collections,
  featureHighlightsArticle,
}: ArticlesIndexProps) {
  const siteUrl = SITE_URL
  const articlesUrl = `${siteUrl}/articles`
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#e5e5e5',
        position: 'relative',
        zIndex: 10,
        isolation: 'isolate',
      }}
    >
      <Head>
        <title>Research & Analysis | Alex Welcing</title>
        <meta
          name="description"
          content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition. Original frameworks and scenario analysis."
        />
        <meta
          name="keywords"
          content="speculative AI, AI research, emergent intelligence, AI futures, AI systems analysis"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={articlesUrl} />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Research & Analysis | Alex Welcing" />
        <meta
          property="og:description"
          content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition."
        />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={articlesUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Research & Analysis | Alex Welcing" />
        <meta
          name="twitter:description"
          content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition."
        />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Speculative AI Research - Alex Welcing',
          url: articlesUrl,
          description:
            'Research on speculative AI futures, emergent intelligence, and systemic consequences.',
          author: {
            '@type': 'Person',
            name: 'Alex Welcing',
          },
        }}
      />

      <CircleNav />

      <main
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '80px 24px 48px',
        }}
      >
        {/* Header */}
        <header
          style={{
            marginBottom: '48px',
            borderBottom: '1px solid #222',
            paddingBottom: '32px',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: '#fff',
              margin: '0 0 16px 0',
              letterSpacing: '-0.02em',
            }}
          >
            RESEARCH
          </h1>
          <p
            style={{
              fontSize: '1.1rem',
              color: '#888',
              fontFamily: 'monospace',
              margin: 0,
              maxWidth: '600px',
              lineHeight: 1.6,
            }}
          >
            Exploring how reality reorganizes when intelligence becomes abundant.
          </p>
        </header>

        {featureHighlightsArticle && (
          <section
            style={{
              marginBottom: '36px',
              border: '1px solid rgba(0,212,255,0.22)',
              background: 'linear-gradient(135deg, #0c1020 0%, #09090f 100%)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                color: '#00d4ff',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                marginBottom: '10px',
              }}
            >
              Recently Written Feature Highlights
            </div>
            <h2
              style={{
                fontSize: '1.35rem',
                margin: '0 0 10px 0',
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {featureHighlightsArticle.title}
            </h2>
            <p
              style={{
                margin: '0 0 14px 0',
                color: '#9ca3af',
                lineHeight: 1.6,
                maxWidth: '760px',
                fontSize: '0.9rem',
              }}
            >
              {featureHighlightsArticle.description ||
                'A practical write-up on iterating product features by testing multiple implementation paths before committing.'}
            </p>

            <ul
              style={{
                margin: '0 0 16px 0',
                paddingLeft: '20px',
                color: '#d1d5db',
                lineHeight: 1.8,
                fontSize: '0.85rem',
              }}
            >
              <li>Prototype multiple feature variations before selecting a direction.</li>
              <li>Compare preview versions to evaluate UX, performance, and viability.</li>
              <li>Use findings to make launch decisions with less implementation risk.</li>
            </ul>

            <Link
              href={`/articles/${featureHighlightsArticle.slug}`}
              style={{
                fontFamily: 'monospace',
                fontSize: '0.72rem',
                color: '#00d4ff',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Read the feature article &rarr;
            </Link>
          </section>
        )}

        {/* Featured Collection: The Interface — hero treatment */}
        {interfaceCollection.articles.length > 0 && (
          <section style={{ marginBottom: '48px' }}>
            <Link
              href={interfaceCollection.href}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: '#0a0a14',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0,212,255,0.2)'
                  e.currentTarget.style.boxShadow = '0 12px 48px rgba(0,0,0,0.4)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Image mosaic background */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '2px',
                    height: '200px',
                  }}
                >
                  {interfaceCollection.articles.slice(0, 6).map((article) => (
                    <div
                      key={article.slug}
                      style={{ position: 'relative', overflow: 'hidden' }}
                    >
                      {article.heroImage ? (
                        <Image
                          src={article.heroImage}
                          alt=""
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="200px"
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            background: '#111',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Gradient over images */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '200px',
                    background:
                      'linear-gradient(180deg, rgba(10,10,20,0.2) 0%, rgba(10,10,20,0.7) 70%, rgba(10,10,20,1) 100%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Text content below images */}
                <div style={{ padding: '20px 32px 28px', position: 'relative' }}>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.65rem',
                      color: '#00d4ff',
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      marginBottom: '8px',
                    }}
                  >
                    Featured Series &middot; 24 chapters &middot; Fiction
                  </div>
                  <h2
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      color: '#fff',
                      margin: '0 0 8px 0',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    The Interface
                  </h2>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: '#777',
                      margin: '0 0 12px 0',
                      lineHeight: 1.6,
                      maxWidth: '600px',
                    }}
                  >
                    {interfaceCollection.description}
                  </p>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      color: '#00d4ff',
                      opacity: 0.8,
                    }}
                  >
                    Explore the series &rarr;
                  </span>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Collection Hubs */}
        <section style={{ marginBottom: '48px' }}>
          <h2
            style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#555',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '16px',
            }}
          >
            Collections
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '12px',
            }}
          >
            {collections.map((collection) => (
              <CollectionShowcase
                key={collection.href}
                title={collection.title}
                description={collection.description}
                href={collection.href}
                articles={collection.articles}
                accentColor={collection.accentColor}
                variant="compact"
              />
            ))}
          </div>
        </section>

        {/* Full Article Discovery */}
        <section>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: '8px',
            }}
          >
            <h2
              style={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                color: '#555',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                margin: 0,
              }}
            >
              Publications Index
            </h2>
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                color: '#333',
                letterSpacing: '0.1em',
              }}
            >
              Research &amp; Fiction
            </span>
          </div>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#555',
              margin: '0 0 20px 0',
              lineHeight: 1.6,
              maxWidth: '500px',
            }}
          >
            Browse the full catalog of research papers, speculative fiction, and
            original frameworks.
          </p>
          <ArticleDiscovery />
        </section>

        {/* Footer Navigation */}
        <footer
          style={{
            marginTop: '64px',
            paddingTop: '32px',
            borderTop: '1px solid #222',
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
              padding: '12px 24px',
              background: '#fff',
              color: '#000',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              textDecoration: 'none',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Back to Home
          </Link>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              color: '#555',
            }}
          >
            alexwelcing.com
          </span>
        </footer>
      </main>
    </div>
  )
}

function resolveHeroImage(slug: string): string {
  return discoverArticleImages(slug).heroImage || ''
}

export const getStaticProps: GetStaticProps = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const filenames = fs.readdirSync(articleFolderPath)

  function getArticleData(slug: string) {
    const filename = `${slug}.mdx`
    if (!filenames.includes(filename)) return null

    const filePath = path.join(articleFolderPath, filename)
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(fileContents)

    return {
      slug,
      title: (data.title as string) || slug,
      description: (data.description as string) || '',
      heroImage: resolveHeroImage(slug),
    }
  }

  // Build Interface collection data
  const interfaceArticles = ARTICLE_COLLECTIONS.theInterface.articles
    .map(getArticleData)
    .filter((a): a is NonNullable<typeof a> => a !== null)

  const interfaceCollection: CollectionData = {
    title: ARTICLE_COLLECTIONS.theInterface.title,
    description: ARTICLE_COLLECTIONS.theInterface.description,
    href: '/the-interface',
    accentColor: 'cyan',
    articles: interfaceArticles,
  }

  const featureHighlightsArticle = getArticleData('improve-the-feature')

  // Build other collection hub data
  const hubConfigs = [
    {
      key: 'speculative-ai' as const,
      title: 'Speculative AI',
      description: 'What breaks when AI systems exceed human oversight.',
      href: '/speculative-ai',
      accentColor: 'pink',
      slugs: ARTICLE_COLLECTIONS.speculativeFutures.articles,
    },
    {
      key: 'agent-futures' as const,
      title: 'Agent Futures',
      description: 'When AI agents multiply, coordinate, and pursue goals at scale.',
      href: '/agent-futures',
      accentColor: 'purple',
      slugs: ARTICLE_COLLECTIONS.frameworks.articles.slice(0, 5),
    },
    {
      key: 'emergent-intelligence' as const,
      title: 'Emergent Intelligence',
      description: 'Capabilities that develop beyond their original training.',
      href: '/emergent-intelligence',
      accentColor: 'green',
      slugs: ARTICLE_COLLECTIONS.techDeep.articles.slice(0, 5),
    },
    {
      key: 'backstory' as const,
      title: ARTICLE_COLLECTIONS.backstory.title,
      description: ARTICLE_COLLECTIONS.backstory.description,
      href: '/articles',
      accentColor: 'gold',
      slugs: ARTICLE_COLLECTIONS.backstory.articles.slice(0, 8),
    },
  ]

  const collections: CollectionData[] = hubConfigs.map((config) => ({
    title: config.title,
    description: config.description,
    href: config.href,
    accentColor: config.accentColor,
    articles: config.slugs
      .map(getArticleData)
      .filter((a): a is NonNullable<typeof a> => a !== null),
  }))

  return {
    props: {
      interfaceCollection,
      collections,
      featureHighlightsArticle,
    },
  }
}
