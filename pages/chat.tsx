import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'
import { SupabaseDataProvider } from '@/components/contexts/SupabaseDataContext'
import { JourneyProvider } from '@/components/contexts/JourneyContext'
import CircleNav from '@/components/ui/CircleNav'
import SearchDialog from '@/components/SearchDialog'
import Footer from '@/components/ui/footer'

// Dynamically import Scene3D, using StylishFallback as the loading component.
const Scene3D = dynamic(() => import('@/components/scene/Scene3D'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

const Chat = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [articles, setArticles] = useState<any[]>([])

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

  async function handleImageChange(): Promise<void> {
    await getRandomImage()
  }

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
          <CircleNav />
          <main className={`${styles.main} ${styles.gradientbg}`}>
            <Scene3D
              world={worldConfig}
              articles={articles}
            />
          </main>
          <SearchDialog />
          <Footer onImageChange={handleImageChange} showChangeScenery={false} />
        </JourneyProvider>
      </SupabaseDataProvider>
    </>
  )
}

export default Chat