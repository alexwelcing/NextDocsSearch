import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import Footer from '@/components/ui/footer'
import ThreeSixty from '@/components/ThreeSixty'
import CircleNav from '@/components/ui/CircleNav'


export default function ThreeSixtyPage() {
  const [currentImage, setCurrentImage] = useState<string>('./background/scifi1.jpg')
  const [backgroundImages, setBackgroundImages] = useState<string[]>([])

  useEffect(() => {
    // Fetch images from the API when the component is mounted
    fetch('/api/backgroundImages')
      .then((response) => response.json())
      .then((images) => {
        setBackgroundImages(images)
        // Preload the images
        images.forEach((image: any) => {
          new Image().src = `./background/${image}`
        })
        const randomImage = images[Math.floor(Math.random() * images.length)]
        setCurrentImage(`./background/${randomImage}`)
      })
  }, [])

  const changeImageRandomly = () => {
    const randomImage = backgroundImages[Math.floor(Math.random() * backgroundImages.length)]
    setCurrentImage(`./background/${randomImage}`)
  }

  return (
    <>
<Head>
<title>Explore generated worlds with Alex, including in Virtual Reality!</title>
<meta name="description" content="Explore Alex Welcing's world using VR! Learn about his experience in product leadership and how he uses generative AI and LLM to build amazing products." />
<meta name="keywords" content="Alex Welcing, product manager, product leadership, generative AI, LLM, 360, chat with documents" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" href="/favicon.ico" />
</Head>
      <CircleNav />

      <main className={styles.main}>
        <ThreeSixty
          currentImage={currentImage}
          isDialogOpen={false}
          onChangeImage={changeImageRandomly}
        />
      </main>

      <Footer onImageChange={changeImageRandomly} showChangeScenery={true} />
    </>
  )
}
