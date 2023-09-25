import React, { useState, useEffect, lazy, Suspense } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import { SearchDialog } from '@/components/SearchDialog';
import Footer from '@/components/ui/footer';
import CircleNav from '@/components/ui/CircleNav';
import dynamic from 'next/dynamic';

// Lazy load ThreeSixty component
const ThreeSixty = dynamic(() => import('@/components/ThreeSixty'), {
  ssr: false, // Disable server-side rendering for this component
  loading: () => <div>Loading...</div>,
});

const Chat = () => {
  const [currentImage, setCurrentImage] = useState<string>('./background/bg1.jpg');
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
        selectRandomImage(images);
      } catch (error) {
        console.error('There was a problem fetching the background images:', error);
      }
    };

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
        <Suspense fallback={<div>Loading...</div>}>
          <ThreeSixty currentImage={currentImage} isDialogOpen={false} onChangeImage={handleImageChange} />
        </Suspense>
      </main>
      <SearchDialog />
      <Footer onImageChange={handleImageChange} showChangeScenery={true} />
    </>
  );
};

export default Chat;
