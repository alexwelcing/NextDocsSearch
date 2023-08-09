import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import styles from '@/styles/Home.module.css'
import { SearchDialog } from '@/components/SearchDialog'
import Footer from '@/components/ui/footer'
import ThreeSixty from '@/components/ThreeSixty'

const Chat = () => {
  const [currentImage, setCurrentImage] = useState<string>('./background/bg1.jpg')
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

  const handleImageChange = () => {
    const randomImage = backgroundImages[Math.floor(Math.random() * backgroundImages.length)]
    setCurrentImage(`./background/${randomImage}`)
  }

  return (
    <>
      <Head>
        <title>Chat with Alex</title>
      </Head>

      <main className={`${styles.main} ${styles.gradientbg}`}>
        <ThreeSixty
          currentImage={currentImage}
          isDialogOpen={false}
          onChangeImage={handleImageChange}
        />
      </main>

      <SearchDialog />

      <Footer onImageChange={handleImageChange} showChangeScenery={true} />
    </>
  )
}

export default Chat
