import React, { useCallback, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import StructuredData from '@/components/StructuredData'
import HeroMosaic from '@/components/HeroMosaic'
import { SITE_URL } from '@/lib/site-url'
import { useArticleDiscovery } from '@/components/ArticleDiscoveryProvider'

export default function HomePage() {
  const siteUrl = SITE_URL
  const router = useRouter()
  const { setShowFloatingButton } = useArticleDiscovery()

  useEffect(() => {
    setShowFloatingButton(false)
    return () => setShowFloatingButton(true)
  }, [setShowFloatingButton])

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
        <meta
          name="keywords"
          content="Alex Welcing, speculative AI, emergent intelligence, LLM, AI agents, essays"
        />
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

          {/* Layer 1 — glass image grid with panorama reveal */}
          <HeroMosaic onAllBroken={handleAllBroken} />

          {/*
            Layer 20 intentionally removed for the major release: first-arrival
            visitors should see no visible menu items or CTA buttons. The Rive
            cannon/glass wall is the sole visible entry instrument.
          */}

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

          <style>{`
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
