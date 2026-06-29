import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'
import { ArrowLeft, BookOpen, Play } from 'lucide-react'

const Interactive3DExperience = dynamic(() => import('@/components/3d/Interactive3DExperience'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

// When the glass-cannon landing shatters every pane it sends the visitor here
// with ?enter=1. We read that synchronously so the 3D scene mounts on the very
// first client render — the marketing landing below never paints, so there is
// no flash of the intermediate page between the break and the 360 scene.
function enteredFromCannon(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('enter') === '1'
}

export default function ExploreLandingPage() {
  const siteUrl = SITE_URL
  const pageUrl = `${siteUrl}/explore`
  const router = useRouter()
  const [launched, setLaunched] = useState(enteredFromCannon)

  // Cover the case where the query becomes available after hydration (e.g. a
  // client-side route change rather than a fresh load).
  useEffect(() => {
    if (!router.isReady) return
    if (router.query.enter === '1') setLaunched(true)
  }, [router.isReady, router.query.enter])

  if (launched) {
    // Visitors who shattered the wall expect "back" to return them home, not to
    // the marketing gateway they intentionally bypassed.
    const handleExit = enteredFromCannon()
      ? () => router.push('/')
      : () => setLaunched(false)

    return (
      <>
        <Head>
          <title>Explore the Interactive Layer | Alex Welcing</title>
          <meta name="robots" content="noindex, follow" />
        </Head>
        <Interactive3DExperience onExit={handleExit} />
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Explore the Interactive Layer | Alex Welcing</title>
        <meta
          name="description"
          content="A focused interactive layer for the writing and research at alexwelcing.com. Launch the 3D experience or continue into the essay archive."
        />
        <meta
          name="keywords"
          content="Alex Welcing, interactive AI writing, speculative AI essays, React Three Fiber"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={pageUrl} />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Explore the Interactive Layer | Alex Welcing" />
        <meta
          property="og:description"
          content="A focused interactive layer for the writing and research at alexwelcing.com."
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
          content="A focused interactive layer for the writing and research at alexwelcing.com."
        />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />

        <meta name="theme-color" content="#0a0a0a" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Explore the Interactive Layer — Alex Welcing',
          url: pageUrl,
          description: 'A focused interactive layer for the writing and research at alexwelcing.com.',
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
            <Link href="/articles" className="hover:text-white transition">
              Articles
            </Link>
            <Link href="/about" className="hover:text-white transition">
              About
            </Link>
          </nav>
        </header>

        <main className="px-6 py-16 max-w-4xl mx-auto">
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
              A deliberately simpler gateway: launch the 3D article experience, or go straight
              into the writing. The old procedural-room and character-generation labs have been
              removed from the main product path.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setLaunched(true)}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30 transition text-sm font-medium tracking-widest uppercase"
              >
                <Play className="w-4 h-4" />
                Launch 3D Experience
              </button>
              <Link
                href="/articles"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-md bg-white/5 border border-white/10 text-white/75 hover:text-white hover:bg-white/10 transition text-sm font-medium tracking-widest uppercase"
              >
                <BookOpen className="w-4 h-4" />
                Read Articles
              </Link>
            </div>
            <noscript>
              <p className="mt-6 text-sm text-white/50 max-w-xl mx-auto">
                The interactive 3D layer requires JavaScript. Use the Articles link for the
                non-interactive archive.
              </p>
            </noscript>
          </section>

          <section className="mt-16 pt-10 border-t border-white/10 text-center">
            <p className="text-sm text-white/50">
              You can also see what I&apos;m{' '}
              <Link href="/current-work" className="text-cyan-400 hover:text-cyan-300 underline">
                currently building
              </Link>{' '}
              or learn{' '}
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
