import React, { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SupabaseDataProvider } from '@/components/contexts/SupabaseDataContext'
import AchievementUnlock from '@/components/AchievementUnlock'
import EnhancedNav from '@/components/ui/EnhancedNav'
import StylishFallback from '@/components/StylishFallback'
import StructuredData from '@/components/StructuredData'
import EnhancedHeroCanvas from '@/components/EnhancedHeroCanvas'
import styles from '@/styles/Home.module.css'
import type { GameState } from '@/components/3d/game/ClickingGame'
import { useJourney } from '@/components/contexts/JourneyContext'

// Dynamically import the 3D environment
const ThreeSixty = dynamic(() => import('@/components/3d/scene/ThreeSixty'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

export default function HomePage() {
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [isIn3DMode, setIsIn3DMode] = useState<boolean>(false)
  const [gameState, setGameState] = useState<GameState>('IDLE')
  const [isEntering, setIsEntering] = useState(false)

  const { achievements } = useJourney()
  const [currentAchievement, setCurrentAchievement] = useState<typeof achievements[0] | null>(null)

  useEffect(() => {
    const unlockedAchievements = achievements.filter(a => a.unlocked)
    if (unlockedAchievements.length > 0) {
      const latest = unlockedAchievements[unlockedAchievements.length - 1]
      setCurrentAchievement(latest)
    }
  }, [achievements])

  const getRandomImage = useCallback(async () => {
    try {
      const response = await fetch('/api/backgroundImages')
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`)
      const data = await response.json()
      setCurrentImage(data.image)
    } catch (error) {
      console.error('Failed fetching background image:', error)
    }
  }, [])

  useEffect(() => {
    getRandomImage()
  }, [getRandomImage])

  const handleEnter3D = useCallback(() => {
    setIsEntering(true)
    // Small delay for transition effect
    setTimeout(() => setIsIn3DMode(true), 300)
  }, [])

  // Handle changing to a specific image (from scene selection)
  const handleChangeImage = useCallback((newImage: string) => {
    setCurrentImage(newImage)
  }, [])

  return (
    <>
      <Head>
        <title>Alex Welcing | Speculative AI Futures</title>
        <meta
          name="description"
          content="Exploring speculative AI futures, agent civilizations, and emergent intelligence systems."
        />
        <meta name="keywords" content="speculative AI, emergent intelligence, AI futures, Alex Welcing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta
          property="og:title"
          content="Speculative AI Futures & Emergent Intelligence Systems | Alex Welcing"
        />
        <meta
          property="og:description"
          content="Exploring speculative AI futures, agent civilizations, and emergent intelligence systems. Original frameworks for understanding worlds where intelligence is abundant."
        />
        <meta property="og:image" content="https://alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />

        {/* X (Twitter) Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Speculative AI Futures & Emergent Intelligence Systems | Alex Welcing" />
        <meta name="twitter:description" content="Exploring speculative AI futures, agent civilizations, and emergent intelligence systems. Original frameworks for understanding worlds where intelligence is abundant." />
        <meta name="twitter:image" content="https://alexwelcing.com/social-preview.png" />

        {/* Performance and PWA hints */}
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="preload" as="image" href="/social-preview.png" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing - Speculative AI Futures",
          url: "https://alexwelcing.com",
          description: "Exploring speculative AI futures, agent civilizations, and emergent intelligence systems.",
          author: { "@type": "Person", name: "Alex Welcing", url: "https://alexwelcing.com/about" }
        }}
      />

      <StructuredData
        type="Person"
        data={{
          name: "Alex Welcing",
          url: "https://alexwelcing.com",
          jobTitle: "AI Futures Researcher",
          description: "Exploring speculative AI futures, agent civilizations, and emergent intelligence systems.",
          sameAs: [
            "https://www.linkedin.com/in/alexwelcing",
            "https://github.com/alexwelcing",
            "https://x.com/alexwelcing"
          ]
        }}
      />

      <SupabaseDataProvider>
        {isIn3DMode ? (
          <main className={styles.main}>
            {currentImage && (
              <ThreeSixty
                currentImage={currentImage}
                isDialogOpen={false}
                onChangeImage={handleChangeImage}
                onGameStateChange={setGameState}
                onExit={() => setIsIn3DMode(false)}
              />
            )}
            <AchievementUnlock
              achievement={currentAchievement}
              onDismiss={() => setCurrentAchievement(null)}
            />
          </main>
        ) : (
          <div
            className="min-h-screen text-white"
            style={{
              opacity: isEntering ? 0 : 1,
              transition: 'opacity 0.3s ease-out',
            }}
          >
            <EnhancedNav isGamePlaying={false} limit={3} />
            {/* Hero - Immersive, mysterious, minimal */}
            <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
              <EnhancedHeroCanvas />

              {/* Content overlay */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-5xl">
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
                    AI Strategy & Product Leadership
                  </span>
                </h1>
                <p
                  className="text-lg md:text-xl lg:text-2xl font-light mt-6 mb-2"
                  style={{
                    fontFamily: "'Inter', -apple-system, sans-serif",
                    color: 'rgba(255, 255, 255, 0.7)',
                    letterSpacing: '0.01em',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    maxWidth: '600px',
                  }}
                >
                  Building intelligent systems and frameworks for emergent AI futures
                </p>

                {/* Two clear paths */}
                <div className="flex flex-col sm:flex-row gap-6 mt-12">
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

                  <button
                    onClick={handleEnter3D}
                    className="group relative px-8 py-4 overflow-hidden cursor-pointer"
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
                  </button>
                </div>
              </div>

              {/* Scroll indicator */}
              <div
                className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
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
        )}
      </SupabaseDataProvider>
    </>
  )
}
