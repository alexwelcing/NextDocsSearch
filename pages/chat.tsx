import React, { useState, useEffect, Suspense } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import { SearchDialog } from '@/components/SearchDialog';
import Footer from '@/components/ui/footer';
import CircleNav from '@/components/ui/CircleNav';
import dynamic from 'next/dynamic';
import StylishFallback from '@/components/StylishFallback';

const ThreeSixty = dynamic(() => import('@/components/ThreeSixty'), {
  ssr: false,
  loading: () => <StylishFallback />
});

const Chat = () => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchImage = async () => {
      try {
        const response = await fetch('/api/backgroundImages');
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        setCurrentImage(data.image);
      } catch (error) {
        console.error('There was a problem fetching the background image:', error);
      }
    };

    fetchImage();
  }, []);

  async function handleImageChange(): Promise<void> {
    try {
      const response = await fetch('/api/backgroundImages');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setCurrentImage(data.image);  // assuming your API returns an object with an "image" key
    } catch (error) {
      console.error('There was a problem fetching the background image:', error);
    }
  }


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
        {currentImage && (
          <Suspense fallback={<StylishFallback />}>
            <ThreeSixty currentImage={currentImage} isDialogOpen={false} onChangeImage={handleImageChange} />
          </Suspense>
        )}
      </main>
      <SearchDialog />
      <Footer onImageChange={handleImageChange} showChangeScenery={true} />
    </>
  );
};

export default Chat;
