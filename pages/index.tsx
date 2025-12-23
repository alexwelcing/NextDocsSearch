import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SupabaseDataProvider } from '@/components/SupabaseDataContext'
import { SearchDialog } from '@/components/SearchDialog'
import QuestNotification from '@/components/QuestNotification'
import AchievementUnlock from '@/components/AchievementUnlock'
import CircleNav from '@/components/ui/CircleNav'
import ArticleList from '@/components/ui/ArticleList'
import StylishFallback from '@/components/StylishFallback'
import StructuredData from '@/components/StructuredData'
import styles from '@/styles/Home.module.css'
import type { GameState } from '@/components/ClickingGame'
import { useJourney } from '@/components/JourneyContext'

// Dynamically import the 3D environment, same as your old Chat page
const ThreeSixty = dynamic(() => import('@/components/ThreeSixty'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

export default function HomePage() {
  // Reuse logic to fetch random background images
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [isIn3DMode, setIsIn3DMode] = useState<boolean>(false)
  const [gameState, setGameState] = useState<GameState>('IDLE')

  // Journey system
  const { achievements } = useJourney()
  const [currentAchievement, setCurrentAchievement] = useState<typeof achievements[0] | null>(null)

  // Watch for new achievements
  useEffect(() => {
    const unlockedAchievements = achievements.filter(a => a.unlocked)
    if (unlockedAchievements.length > 0) {
      const latest = unlockedAchievements[unlockedAchievements.length - 1]
      setCurrentAchievement(latest)
    }
  }, [achievements])

  async function getRandomImage() {
    try {
      const response = await fetch('/api/backgroundImages')
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const data = await response.json()
      setCurrentImage(data.image)
    } catch (error) {
      console.error('There was a problem fetching the background image:', error)
    }
  }

  // On initial mount, fetch a random background for the 3D environment
  useEffect(() => {
    getRandomImage()
  }, [])

  // Toggle function: 2D <-> 3D
  function handleToggle3D() {
    setIsIn3DMode((prev) => !prev)
  }

  return (
    <>
      <Head>
        <title>Speculative AI Futures & Emergent Intelligence Systems | Alex Welcing</title>
        <meta
          name="description"
          content="Exploring speculative AI futures, agent civilizations, and emergent intelligence systems. Original frameworks for understanding how reality reorganizes when intelligence becomes abundant."
        />
        <meta
          name="keywords"
          content="speculative AI futures, emergent intelligence, AI civilization, agent futures, post-human systems, AI systems research, Alex Welcing"
        />
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
        <meta property="og:image" content="/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Alex Welcing - Speculative AI Futures",
          url: "https://alexwelcing.com",
          description: "Exploring speculative AI futures, agent civilizations, and emergent intelligence systems.",
          author: {
            "@type": "Person",
            name: "Alex Welcing",
            url: "https://alexwelcing.com/about"
          }
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
            "https://twitter.com/alexwelcing"
          ]
        }}
      />

      <SupabaseDataProvider>
        {/* Our global nav - shrink during gameplay */}
        <CircleNav isGamePlaying={gameState === 'PLAYING'} />

        {/*
          If in 3D mode, we show a full-screen 3D environment + chat.
          If not in 3D mode, we show the old home page layout.
        */}
        {isIn3DMode ? (
          <main className={`${styles.main} ${styles.gradientbg}`}>
            {/* Show the ThreeSixty VR environment */}
            {currentImage && (
              <ThreeSixty
                currentImage={currentImage}
                isDialogOpen={false}
                onChangeImage={getRandomImage}
                onGameStateChange={setGameState}
              />
            )}

            {/* SearchDialog for AI chat - only show when NOT playing game */}
            {gameState !== 'PLAYING' && <SearchDialog />}

            {/* Achievement Unlock Popup */}
            <AchievementUnlock
              achievement={currentAchievement}
              onDismiss={() => setCurrentAchievement(null)}
            />
          </main>
        ) : (
          <div className="min-h-screen bg-slate-900 text-white">
            {/* Hero Section */}
            <section className={`${styles.gradientbg} min-h-[80vh] flex flex-col items-center justify-center text-center px-4`}>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight max-w-4xl">
                Exploring speculative AI futures and emergent intelligence systems.
              </h1>
              <p className="text-xl md:text-2xl max-w-2xl mb-10 text-slate-100 opacity-90">
                Original frameworks for understanding how reality reorganizes when cognition becomes abundant, fast, and non-human.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="#work" className="bg-white text-indigo-600 px-8 py-3 rounded-full font-bold hover:bg-opacity-90 transition text-center">
                  Explore Research
                </Link>
                <button
                  onClick={handleToggle3D}
                  className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-full font-bold hover:bg-white hover:text-indigo-600 transition"
                >
                  Enter 3D World
                </button>
              </div>
            </section>

            {/* Research Domains */}
            <section className="py-20 px-4 bg-slate-900">
              <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
                <div className="p-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                  <h3 className="text-2xl font-bold mb-4 text-indigo-400">Speculative AI Systems</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Mapping futures where AI agents, autonomous systems, and emergent intelligence reshape civilization.
                  </p>
                </div>
                <div className="p-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                  <h3 className="text-2xl font-bold mb-4 text-pink-400">Discovery Compression</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Exploring how AI accelerates scientific discovery from centuries to hours, and the systemic consequences.
                  </p>
                </div>
                <div className="p-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                  <h3 className="text-2xl font-bold mb-4 text-blue-400">Control & Governance</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Analyzing failure modes, alignment challenges, and the governance of systems that exceed human oversight.
                  </p>
                </div>
              </div>
            </section>

            {/* Featured Research */}
            <section id="work" className="py-20 px-4 bg-slate-950">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-end mb-10 border-b border-slate-800 pb-4">
                  <h2 className="text-4xl font-bold">Featured Research</h2>
                  <Link href="/articles" className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-2">
                    Explore All <span className="text-xl">→</span>
                  </Link>
                </div>
                <ArticleList limit={3} showTitle={false} />
              </div>
            </section>
          </div>
        )}
      </SupabaseDataProvider>
    </>
  )
}
