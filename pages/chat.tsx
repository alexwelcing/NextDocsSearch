import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import { SearchDialog } from '@/components/SearchDialog';
import Footer from '@/components/ui/footer';
import ThreeSixty from '@/components/ThreeSixty';
import CircleNav from '@/components/ui/CircleNav';

const Chat = () => {
  const [currentImage, setCurrentImage] = useState<string>('./background/bg1.jpg'); // Initial placeholder image
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch('/api/backgroundImages');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const images: string[] = await response.json();

        // Pre-fetch images
        images.forEach((image: string) => {
          new Image().src = `./background/${image}`;
        });

        setBackgroundImages(images);

        // Set a random initial image
        selectRandomImage(images);
      } catch (error) {
        console.error('There was a problem fetching the background images:', error);
        // Optionally, you could inform the user that something went wrong.
      }
    };

    // Execute fetchImages when the browser is idle
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(fetchImages);
    } else {
      setTimeout(fetchImages, 1000);
    }
  }, []);

  const selectRandomImage = (images: string[]) => {
    const randomImage = images[Math.floor(Math.random() * images.length)];
    setCurrentImage(`./background/${randomImage}`);
  };

  const handleImageChange = () => {
    selectRandomImage(backgroundImages);
  };

  return (
    <>
      <Head>
        <title>Chat with Alex documents while enjoying fantastic generated worlds!</title>
        <meta
          name="description"
          content="Explore Alex Welcing's world using 360 and chat with documents! Learn about his experience in product leadership and how he uses generative AI and LLM to build amazing products."
        />
        <meta name="keywords" content="Alex Welcing, product leadership, generative AI, LLM, 360, chat with documents" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <CircleNav />
      <main className={`${styles.main} ${styles.gradientbg}`}>
        <ThreeSixty currentImage={currentImage} isDialogOpen={false} onChangeImage={handleImageChange} />
      </main>
      <SearchDialog />
      <Footer onImageChange={handleImageChange} showChangeScenery={true} />
    </>
  );
};

export default Chat;
