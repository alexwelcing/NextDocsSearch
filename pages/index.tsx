import React, { useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import StructuredData from '@/components/StructuredData'
import HeroMosaic from '@/components/HeroMosaic'
import HeroMaterialBackground from '@/components/HeroMaterialBackground'
import { SITE_URL } from '@/lib/site-url'

// Grid geometry (must match HeroMosaic constants so the fragments line up).
const GRID_COLS = 4
const GRID_ROWS = 3

// Copy split across the 4×3 grid. Each cell holds a fragment of the line
// "Building with AI products that help people survive." plus a decorative
// byline on the bottom row. One fragment per tile — breaking a tile reveals
// that fragment.
const HERO_FRAGMENTS: { text: string; emphasis?: boolean; byline?: boolean }[] = [
  // Row 1 — opening clause
  { text: 'Building', emphasis: true },
  { text: 'with' },
  { text: 'AI',       emphasis: true },
  { text: 'products' },
  // Row 2 — closing clause
  { text: 'that' },
  { text: 'help' },
  { text: 'people' },
  { text: 'survive.', emphasis: true },
  // Row 3 — byline / decorative
  { text: '·',              byline: true },
  { text: '— Alex Welcing', byline: true },
  { text: '—',              byline: true },
  { text: '·',              byline: true },
]

export default function HomePage() {
  const siteUrl = SITE_URL
  const router = useRouter()

  const handleAllBroken = useCallback(() => {
    // Every pane has been shattered → reward: ship the visitor to /explore.
    router.push('/explore')
  }, [router])

  return (
    <>
      <Head>
        <title>Alex Welcing</title>
        <meta
          name="description"
          content="Essays on speculative AI and emergent intelligence. Building with AI products that help people survive."
        />
        <meta name="keywords" content="Alex Welcing, speculative AI, emergent intelligence, LLM, AI agents, essays" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={siteUrl} />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta property="og:title" content="Alex Welcing" />
        <meta
          property="og:description"
          content="Building with AI products that help people survive. Essays on speculative AI and emergent intelligence."
        />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:type" content="website" />

        {/* X (Twitter) Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing" />
        <meta
          name="twitter:description"
          content="Building with AI products that help people survive. Essays on speculative AI and emergent intelligence."
        />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />

        {/* Performance and PWA hints */}
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="preload" as="image" href="/social-preview.png" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Alex Welcing',
          url: siteUrl,
          description:
            'Building with AI products that help people survive. Essays on speculative AI and emergent intelligence.',
          author: { '@type': 'Person', name: 'Alex Welcing', url: `${siteUrl}/about` },
        }}
      />

      <StructuredData
        type="Person"
        data={{
          name: 'Alex Welcing',
          url: siteUrl,
          description:
            'Building with AI products that help people survive. Writing on speculative AI and emergent intelligence.',
          sameAs: [
            'https://www.linkedin.com/in/alexwelcing',
            'https://github.com/alexwelcing',
            'https://x.com/alexwelcing',
          ],
          knowsAbout: [
            'Large Language Models',
            'AI Agent Systems',
            'Retrieval-Augmented Generation',
            'Vector Databases',
            'AI Product Management',
            'Prompt Engineering',
            'AI Safety & Alignment',
            '3D Visualization',
            'System Architecture',
            'TypeScript',
            'React',
            'Next.js',
          ],
        }}
      />

      <div className="min-h-screen text-white">
        {/* Hero — Immersive mosaic wall */}
        <section
          className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
          style={{ background: '#030308' }}
        >
          {/* Layer 0 — mathematical material field (behind everything) */}
          <HeroMaterialBackground zIndex={0} />

          {/*
            Layer 0.5 — SEO H1. Visually hidden but present in SSR HTML so
            search engines see the canonical heading. The per-tile copy
            below is decorative.
          */}
          <h1
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            Alex Welcing — Building with AI products that help people survive.
          </h1>

          {/*
            Layer 1 — decorative copy fragments, one per tile. Matches the
            HeroMosaic tile grid (4×3 with inset: -5%) so each fragment
            sits behind a specific tile and is uncovered when that tile
            shatters.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none"
            style={{
              position: 'absolute',
              inset: '-5%',
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
              gap: 0,
              zIndex: 1,
              padding: '0 12px',
            }}
          >
            {HERO_FRAGMENTS.map((frag, i) => (
              <div
                key={i}
                className="flex items-center justify-center text-center"
                style={{
                  padding: '12px',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    fontSize: frag.byline
                      ? 'clamp(0.9rem, 1.2vw, 1.3rem)'
                      : frag.emphasis
                      ? 'clamp(2rem, 5.5vw, 5.5rem)'
                      : 'clamp(1.6rem, 4vw, 4rem)',
                    fontWeight: frag.byline ? 400 : frag.emphasis ? 800 : 600,
                    letterSpacing: frag.byline ? '0.15em' : '-0.02em',
                    lineHeight: 1.05,
                    textTransform: frag.byline ? 'uppercase' : 'none',
                    color: frag.byline
                      ? 'rgba(125, 230, 255, 0.75)'
                      : 'rgba(255, 255, 255, 0.92)',
                    background: frag.emphasis
                      ? 'linear-gradient(135deg, #ffffff 0%, #7de6ff 50%, #c882ff 100%)'
                      : undefined,
                    WebkitBackgroundClip: frag.emphasis ? 'text' : undefined,
                    WebkitTextFillColor: frag.emphasis ? 'transparent' : undefined,
                    backgroundClip: frag.emphasis ? 'text' : undefined,
                    textShadow: frag.byline
                      ? '0 0 6px rgba(0, 212, 255, 0.35)'
                      : '0 2px 14px rgba(0, 0, 0, 0.6)',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                >
                  {frag.text}
                </span>
              </div>
            ))}
          </div>

          {/* Layer 2 — tile grid (obscures the copy until broken) */}
          <HeroMosaic onAllBroken={handleAllBroken} />

          {/* Layer 20 — CTAs, pinned to the bottom of the hero */}
          <div
            className="relative z-20 flex flex-col items-center justify-end text-center px-6 max-w-5xl pb-16"
            style={{ marginTop: 'auto' }}
          >
            <div className="flex flex-col sm:flex-row gap-5">
              <Link
                href="/current-work"
                className="group relative px-8 py-4 overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'rgba(168, 85, 247, 0.9)',
                  border: '2px solid rgba(216, 180, 254, 0.9)',
                  borderRadius: '6px',
                  boxShadow:
                    '0 8px 24px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                }}
              >
                <span className="relative z-10 text-sm font-bold tracking-widest uppercase text-white drop-shadow-sm">
                  Current Work
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(216, 180, 254, 0.25), rgba(168, 85, 247, 0.15))',
                  }}
                />
              </Link>

              <Link
                href="/articles"
                className="group relative px-8 py-4 overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '2px solid rgba(255, 255, 255, 1)',
                  borderRadius: '6px',
                  boxShadow:
                    '0 8px 24px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
                }}
              >
                <span className="relative z-10 text-sm font-bold tracking-widest uppercase text-slate-950">
                  Read Articles
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(0, 212, 255, 0.18), rgba(255, 215, 0, 0.12))',
                  }}
                />
              </Link>

              <Link
                href="/explore"
                className="group relative px-8 py-4 overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'rgba(0, 212, 255, 0.92)',
                  border: '2px solid rgba(125, 230, 255, 1)',
                  borderRadius: '6px',
                  boxShadow:
                    '0 8px 24px rgba(0, 212, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                }}
              >
                <span className="relative z-10 text-sm font-bold tracking-widest uppercase text-slate-950">
                  3D Experience
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(125, 230, 255, 0.35), rgba(0, 212, 255, 0.2))',
                  }}
                />
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
            style={{
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            <div
              className="w-px h-16 opacity-30"
              style={{
                background:
                  'linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent)',
              }}
            />
          </div>

          <style jsx>{`
            @keyframes float {
              0%,
              100% {
                transform: translateX(-50%) translateY(0);
              }
              50% {
                transform: translateX(-50%) translateY(8px);
              }
            }
          `}</style>
        </section>
      </div>
    </>
  )
}
