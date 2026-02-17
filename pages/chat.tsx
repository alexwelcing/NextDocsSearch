import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'
import { SupabaseDataProvider } from '@/components/contexts/SupabaseDataContext'
import { JourneyProvider } from '@/components/contexts/JourneyContext'
import InteractiveTablet from '@/components/3d/interactive/InteractiveTablet'

// Dynamically import Scene3D, using StylishFallback as the loading component.
const Scene3D = dynamic(() => import('@/components/scene/Scene3D'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

const Chat = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [articles, setArticles] = useState<any[]>([])
  const [cinematicComplete, setCinematicComplete] = useState(false)
  const [gameState, setGameState] = useState<string>('idle')

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

  async function fetchArticles() {
    try {
      const response = await fetch('/api/articles')
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const data = await response.json()
      setArticles(data)
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    }
  }

  // On mount, fetch the initial random background image and articles.
  useEffect(() => {
    getRandomImage()
    fetchArticles()
  }, [])

  // Build world config from random image
  const worldConfig = React.useMemo(() => {
    if (!currentImage) return 'default';
    return {
      id: 'dynamic-chat',
      name: 'Dynamic Chat',
      assets: {
        fallbackPanorama: currentImage
      }
    } as any;
  }, [currentImage]);

  return (
    <>
      <Head>
        <title>Alex Welcing - Interactive Portfolio</title>
        <meta
          name="description"
          content="Explore Alex Welcing's interactive portfolio. Chat with AI, play games, and discover his work in product leadership and generative AI."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com/chat" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Alex Welcing - Interactive Portfolio" />
        <meta property="og:description" content="Explore Alex Welcing's interactive portfolio with AI chat and immersive 3D environments." />
        <meta property="og:image" content="/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com/chat" />
        <meta property="og:type" content="website" />
      </Head>

      <SupabaseDataProvider>
        <JourneyProvider>
          <main className={`${styles.main} ${styles.gradientbg}`}>
            <Scene3D
              world={worldConfig}
              onCinematicComplete={() => setCinematicComplete(true)}
              onGameStateChange={setGameState}
            />
          </main>

          {/* InteractiveTablet — centered bottom menu, fades in after intro */}
          {cinematicComplete && gameState !== 'playing' && (
            <div style={{
              animation: 'fadeInUp 0.6s ease-out both',
            }}>
              <style>{`
                @keyframes fadeInUp {
                  from { opacity: 0; transform: translateY(20px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <InteractiveTablet
                isGamePlaying={gameState === 'playing'}
                articles={articles}
              />
            </div>
          )}
        </JourneyProvider>
      </SupabaseDataProvider>
    </>
  )
}

export default Chat
