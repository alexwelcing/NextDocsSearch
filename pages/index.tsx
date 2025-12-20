import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SupabaseDataProvider } from '@/components/SupabaseDataContext'
import { SearchDialog } from '@/components/SearchDialog'
import QuestNotification from '@/components/QuestNotification'
import AchievementUnlock from '@/components/AchievementUnlock'
import CircleNav from '@/components/ui/CircleNav'
import Footer from '@/components/ui/footer'
import ArticleList from '@/components/ui/ArticleList'
import StylishFallback from '@/components/StylishFallback'
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
        <title>Alex Welcing – Senior AI Product Manager</title>
        <meta
          name="description"
          content="Senior AI Product Manager specializing in generative AI applications, machine learning product strategy, and cross-functional leadership."
        />
        <meta
          name="keywords"
          content="Alex Welcing, Product Management, AI Product Manager, Generative AI, Machine Learning, Product Strategy"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta
          property="og:title"
          content="Alex Welcing – Senior AI Product Manager"
        />
        <meta
          property="og:description"
          content="Senior AI Product Manager specializing in generative AI applications, machine learning product strategy, and cross-functional leadership."
        />
        <meta property="og:image" content="/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />
      </Head>

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
            {currentImage ? (
              <ThreeSixty
                currentImage={currentImage}
                isDialogOpen={false}
                onChangeImage={getRandomImage}
                onGameStateChange={setGameState}
              />
            ) : (
              <StylishFallback />
            )}

            {/* SearchDialog for AI chat - only show when NOT playing game */}
            {gameState !== 'PLAYING' && <SearchDialog />}

            {/* Journey UI - Quest Tracker */}
            {gameState !== 'PLAYING' && gameState !== 'COUNTDOWN' && <QuestNotification />}

            {/* Achievement Unlock Popup */}
            <AchievementUnlock
              achievement={currentAchievement}
              onDismiss={() => setCurrentAchievement(null)}
            />

            {/* Button to go back to 2D home */}
            <div className="absolute top-4 left-4 z-50">
              <button
                onClick={handleToggle3D}
                className={styles.landingBtn}
                style={{ padding: '0.5rem 1rem' }}
              >
                Return to 2D
              </button>
            </div>
          </main>
        ) : (
          <div className="min-h-screen bg-slate-900 text-white">
            {/* Hero Section */}
            <section className={`${styles.gradientbg} min-h-[80vh] flex flex-col items-center justify-center text-center px-4`}>
              <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight max-w-4xl">
                Build products with Alex Welcing.
              </h1>
              <p className="text-xl md:text-2xl max-w-2xl mb-10 text-slate-100 opacity-90">
                Senior AI Product Manager specializing in generative AI, strategy, and cross-functional leadership.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="#work" className="bg-white text-indigo-600 px-8 py-3 rounded-full font-bold hover:bg-opacity-90 transition text-center">
                  View Work
                </Link>
                <button
                  onClick={handleToggle3D}
                  className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-full font-bold hover:bg-white hover:text-indigo-600 transition"
                >
                  Explore 3D World
                </button>
              </div>
            </section>

            {/* Services / Value Prop */}
            <section className="py-20 px-4 bg-slate-900">
              <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
                <div className="p-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                  <h3 className="text-2xl font-bold mb-4 text-indigo-400">AI Strategy</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Aligning generative AI capabilities with business goals to drive tangible ROI and innovation.
                  </p>
                </div>
                <div className="p-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                  <h3 className="text-2xl font-bold mb-4 text-pink-400">Product Leadership</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Leading cross-functional teams of engineers and data scientists to deliver complex ML products.
                  </p>
                </div>
                <div className="p-8 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
                  <h3 className="text-2xl font-bold mb-4 text-blue-400">Technical Execution</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Deep technical literacy in LLMs, RAG, and MLOps to bridge the gap between research and production.
                  </p>
                </div>
              </div>
            </section>

            {/* Featured Work */}
            <section id="work" className="py-20 px-4 bg-slate-950">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-end mb-10 border-b border-slate-800 pb-4">
                  <h2 className="text-4xl font-bold">Featured Insights</h2>
                  <Link href="/articles" className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-2">
                    View All <span className="text-xl">→</span>
                  </Link>
                </div>
                <ArticleList limit={3} showTitle={false} />
              </div>
            </section>
          </div>
        )}

        {/* Single shared footer */}
        <Footer onImageChange={getRandomImage} showChangeScenery={false} />
      </SupabaseDataProvider>
    </>
  )
}
