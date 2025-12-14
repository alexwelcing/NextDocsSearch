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
        <title>Alex Welcing – Senior AI Product Manager & Inventor</title>
        <meta
          name="description"
          content="Senior AI Product Manager & Inventor specializing in generative AI applications, machine learning product strategy, and cross-functional leadership."
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
          content="Alex Welcing – Senior AI Product Manager & Inventor"
        />
        <meta
          property="og:description"
          content="Senior AI Product Manager & Inventor specializing in generative AI applications, machine learning product strategy, and cross-functional leadership."
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
          <div
            className={
              styles.gradientbg + ' flex flex-col items-center justify-center min-h-screen'
            }
          >
            {/* Original 2D home content from old index */}
            <h1 className={styles.centeredtitle}>
              Alex Welcing – Senior AI Product Manager & Inventor
            </h1>
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              {/* Link to about page */}
              <Link href="/about" className={styles.landingBtn}>
                Learn about my work
              </Link>
              {/* Instead of linking to /chat, we toggle 3D directly */}
              <button onClick={handleToggle3D} className={styles.landingBtn}>
                Explore generated worlds
              </button>
            </div>
            {/* Article list under the CTA */}
            <div className="pt-4">
              <ArticleList />
            </div>
          </div>
        )}

        {/* Single shared footer */}
        <Footer onImageChange={getRandomImage} showChangeScenery={false} />
      </SupabaseDataProvider>
    </>
  )
}
