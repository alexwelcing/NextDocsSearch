import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { SearchDialog } from '@/components/SearchDialog'
import Footer from '@/components/ui/footer'
import CircleNav from '@/components/ui/CircleNav'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'
import { SupabaseDataProvider } from '@/components/SupabaseDataContext'

// Dynamically import Scene3D, using StylishFallback as the loading component.
const Scene3D = dynamic(() => import('@/components/scene/Scene3D'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

const Chat = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [articles, setArticles] = useState<any[]>([])

  // Centralized fetch logic so we don't repeat ourselves.
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

  // Handler for when user wants a new background image.
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
        <title>Chat with Alex documents while enjoying fantastic generated worlds!</title>
        <meta
          name="description"
          content="Explore Alex Welcing's world using 360 and chat with documents! Learn about his product leadership and how he leverages generative AI."
        />
        <meta name="keywords" content="Alex Welcing, product leadership, generative AI, LLM, 360" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com/chat" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta property="og:title" content="Chat with Alex documents while enjoying fantastic generated worlds!" />
        <meta
          property="og:description"
          content="Explore Alex Welcing's world using 360 and chat with documents! Learn about his experience in product leadership and how he uses generative AI to build amazing products."
        />
        <meta property="og:image" content="/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com/chat" />
        <meta property="og:type" content="website" />
      </Head>

      <SupabaseDataProvider>
        <CircleNav />
        <main className={`${styles.main} ${styles.gradientbg}`}>
          <Scene3D
            world={worldConfig}
            articles={articles}
          />
        </main>
        <SearchDialog />
        <Footer onImageChange={handleImageChange} showChangeScenery={false} />
      </SupabaseDataProvider>
    </>
  )
}

export default Chat
