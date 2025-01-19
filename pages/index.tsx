import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SupabaseDataProvider } from '@/components/SupabaseDataContext'
import { SearchDialog } from '@/components/SearchDialog'
import CircleNav from '@/components/ui/CircleNav'
import Footer from '@/components/ui/footer'
import ArticleList from '@/components/ui/ArticleList'
import StylishFallback from '@/components/StylishFallback'
import styles from '@/styles/Home.module.css'

// Dynamically import the 3D environment, same as your old Chat page
const ThreeSixty = dynamic(() => import('@/components/ThreeSixty'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

export default function HomePage() {
  // Reuse logic to fetch random background images
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [isIn3DMode, setIsIn3DMode] = useState<boolean>(false)

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
        <title>Unified 2D Landing + 3D Chat | Alex Welcing</title>
        <meta
          name="description"
          content="A single page that merges the 2D landing content with the 3D environment. Explore articles and chat in one place."
        />
        <meta
          name="keywords"
          content="Alex Welcing, Product Management, 3D environment, Generative AI, Next.js"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta
          property="og:title"
          content="Unified 2D Landing + 3D Chat | Alex Welcing"
        />
        <meta
          property="og:description"
          content="A single page that merges the 2D landing content with the 3D environment. Explore articles and chat in one place."
        />
        <meta property="og:image" content="/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />
      </Head>

      <SupabaseDataProvider>
        {/* Our global nav */}
        <CircleNav />

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
              />
            )}

            {/* SearchDialog for AI chat if you want it in 3D mode */}
            <SearchDialog />

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
            <div className={styles.centeredtitle}>
              Build products with Alex Welcing.
            </div>
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
