import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'
import { ArrowLeft, Box, Layers, Wand2, Play } from 'lucide-react'

const Interactive3DExperience = dynamic(
  () => import('@/components/3d/Interactive3DExperience'),
  {
    ssr: false,
    loading: () => <StylishFallback />,
  }
)

export default function ExploreLandingPage() {
  const siteUrl = SITE_URL
  const pageUrl = `${siteUrl}/explore`
  const [launched, setLaunched] = useState(false)

  if (launched) {
    return (
      <>
        <Head>
          <title>Explore the Interactive Layer | Alex Welcing</title>
          <meta name="robots" content="noindex, follow" />
        </Head>
        <Interactive3DExperience onExit={() => setLaunched(false)} />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Explore the Interactive Layer | Alex Welcing</title>
        <meta
          name="description"
          content="A 3D, interactive surface for the writing and research at alexwelcing.com. Procedurally generated rooms, article-driven levels, and a procedural character system — built with React Three Fiber."
        />
        <meta name="keywords" content="Alex Welcing, 3D portfolio, React Three Fiber, interactive AI experience, procedural rooms, article levels, ProGen character" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Explore the Interactive Layer | Alex Welcing" />
        <meta
          property="og:description"
          content="A 3D, interactive surface for the writing and research at alexwelcing.com. Procedural rooms, article levels, and procedural characters."
        />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Explore the Interactive Layer | Alex Welcing" />
        <meta
          name="twitter:description"
          content="A 3D, interactive surface for the writing and research at alexwelcing.com."
        />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />

        <meta name="theme-color" content="#0a0a0a" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Explore the Interactive Layer — Alex Welcing',
          url: pageUrl,
          description:
            'A 3D, interactive surface for the writing and research at alexwelcing.com.',
          author: { '@type': 'Person', name: 'Alex Welcing', url: `${siteUrl}/about` },
        }}
      />

      <div className="min-h-screen text-white bg-[#030308]">
        <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/articles" className="hover:text-white transition">Articles</Link>
            <Link href="/about" className="hover:text-white transition">About</Link>
          </nav>
        </header>

        <main className="px-6 py-16 max-w-5xl mx-auto">
          <section className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              <span
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #00d4ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Explore the Interactive Layer
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10">
              A 3D surface on top of the writing and research. Procedural rooms,
              article-driven levels, and a procedural character system — all built
              with React Three Fiber.
            </p>
            <button
              onClick={() => setLaunched(true)}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition text-sm font-medium tracking-widest uppercase"
            >
              <Play className="w-4 h-4" />
              Launch 3D Experience
            </button>
            <noscript>
              <p className="mt-6 text-sm text-white/50 max-w-xl mx-auto">
                The interactive 3D layer requires JavaScript. The links below give
                you a non-interactive map of the same content.
              </p>
            </noscript>
          </section>

          <section aria-labelledby="sub-routes-heading">
            <h2
              id="sub-routes-heading"
              className="text-2xl font-semibold mb-6 text-white/90"
            >
              Or jump straight into a sub-experience
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/explore/article-levels"
                className="group block p-6 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 transition"
              >
                <Layers className="w-6 h-6 mb-3 text-cyan-400" />
                <h3 className="text-lg font-semibold mb-2">Article Levels</h3>
                <p className="text-sm text-white/60">
                  Three unique 3D levels generated from articles in the library.
                </p>
              </Link>
              <Link
                href="/explore/rooms"
                className="group block p-6 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 transition"
              >
                <Box className="w-6 h-6 mb-3 text-cyan-400" />
                <h3 className="text-lg font-semibold mb-2">Procedural Rooms</h3>
                <p className="text-sm text-white/60">
                  Walk through procedurally generated rooms with physics and
                  navigation.
                </p>
              </Link>
              <Link
                href="/explore/progen"
                className="group block p-6 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 transition"
              >
                <Wand2 className="w-6 h-6 mb-3 text-cyan-400" />
                <h3 className="text-lg font-semibold mb-2">ProGen Characters</h3>
                <p className="text-sm text-white/60">
                  Real-time procedural character generation with quality validation.
                </p>
              </Link>
            </div>
          </section>

          <section className="mt-16 pt-10 border-t border-white/10 text-center">
            <p className="text-sm text-white/50">
              Prefer the writing? Read the{' '}
              <Link href="/articles" className="text-cyan-400 hover:text-cyan-300 underline">
                articles
              </Link>
              , see what I&apos;m{' '}
              <Link href="/current-work" className="text-cyan-400 hover:text-cyan-300 underline">
                currently building
              </Link>
              , or learn{' '}
              <Link href="/about" className="text-cyan-400 hover:text-cyan-300 underline">
                more about me
              </Link>
              .
            </p>
          </section>
        </main>
      </div>
    </>
  )
}
