import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import StructuredData from '@/components/StructuredData'
import HeroMosaic from '@/components/HeroMosaic'
import { SITE_URL } from '@/lib/site-url'

export default function HomePage() {
  const siteUrl = SITE_URL

  return (
    <>
      <Head>
        <title>Alex Welcing</title>
        <meta
          name="description"
          content="Essays on speculative AI and emergent intelligence."
        />
        <meta name="keywords" content="Alex Welcing, speculative AI, emergent intelligence, LLM, AI agents, essays" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={siteUrl} />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta
          property="og:title"
          content="Alex Welcing"
        />
        <meta
          property="og:description"
          content="Essays on speculative AI and emergent intelligence."
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
        <meta name="twitter:description" content="Essays on speculative AI and emergent intelligence." />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />

        {/* Performance and PWA hints */}
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="preload" as="image" href="/social-preview.png" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing",
          url: siteUrl,
          description: "Essays on speculative AI and emergent intelligence.",
          author: { "@type": "Person", name: "Alex Welcing", url: `${siteUrl}/about` }
        }}
      />

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          url: siteUrl,
          description: "Writing on speculative AI and emergent intelligence.",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ],
          knowsAbout: [
            "Large Language Models",
            "AI Agent Systems",
            "Retrieval-Augmented Generation",
            "Vector Databases",
            "AI Product Management",
            "Prompt Engineering",
            "AI Safety & Alignment",
            "3D Visualization",
            "System Architecture",
            "TypeScript",
            "React",
            "Next.js"
          ]
        }}
      />

      <div className="min-h-screen text-white">
        {/* Hero - Immersive mosaic wall */}
        <section
          className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
          style={{ background: '#030308' }}
        >
          {/*
            Text layer — sits BEHIND the tile grid on the z-axis.
            Rendered in the SSR'd HTML so crawlers see the H1 and subtitle,
            but visually obscured by the opaque HeroMosaic tiles until the
            user breaks them with the ball.
          */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none"
            style={{ zIndex: 0 }}
            aria-hidden="false"
          >
            <div className="max-w-5xl">
              <h1
                className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-4"
                style={{
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  fontWeight: 800,
                }}
              >
                <span style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #00d4ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Writing on speculative AI and emergent intelligence.
                </span>
              </h1>
              <p
                className="text-lg md:text-xl lg:text-2xl font-light mt-6 mb-2 mx-auto"
                style={{
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  color: 'rgba(255, 255, 255, 0.85)',
                  letterSpacing: '0.01em',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  maxWidth: '600px',
                }}
              >
                Building AI products that survive contact with real people.
              </p>
            </div>
          </div>

          {/* Tile grid — sits ABOVE the text layer */}
          <HeroMosaic />

          {/* CTAs — above tiles */}
          <div className="relative z-20 flex flex-col items-center justify-end text-center px-6 max-w-5xl pb-16" style={{ marginTop: 'auto' }}>
            <div className="flex flex-col sm:flex-row gap-6">
              <Link
                href="/current-work"
                className="group relative px-8 py-4 overflow-hidden"
                style={{
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  borderRadius: '2px',
                }}
              >
                <span className="relative z-10 text-sm font-medium tracking-widest uppercase text-purple-400 group-hover:text-purple-300 transition-colors">
                  Current Work
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.1))',
                  }}
                />
              </Link>

              <Link
                href="/articles"
                className="group relative px-8 py-4 overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '2px',
                }}
              >
                <span className="relative z-10 text-sm font-medium tracking-widest uppercase text-white/80 group-hover:text-white transition-colors">
                  Read Articles
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.1), rgba(255, 215, 0, 0.05))',
                  }}
                />
              </Link>

              <Link
                href="/explore"
                className="group relative px-8 py-4 overflow-hidden"
                style={{
                  background: 'rgba(0, 212, 255, 0.08)',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  borderRadius: '2px',
                }}
              >
                <span className="relative z-10 text-sm font-medium tracking-widest uppercase" style={{ color: 'rgba(0, 212, 255, 0.9)' }}>
                  3D Experience
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.15), rgba(0, 212, 255, 0.05))',
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
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent)',
              }}
            />
          </div>

          <style jsx>{`
            @keyframes float {
              0%, 100% { transform: translateX(-50%) translateY(0); }
              50% { transform: translateX(-50%) translateY(8px); }
            }
          `}</style>
        </section>
      </div>
    </>
  )
}
