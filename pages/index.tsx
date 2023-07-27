import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import ThreeSixty from "@/components/ThreeSixty";
import Footer from "@/components/ui/footer";
import * as React from 'react'



export default function Home() {
  const [currentImage, setCurrentImage] = React.useState<string>("./background/scifi1.jpg");
  return (
    <>
      <Head>
        <title>Explore with Alex.</title>
        <meta name="description" content="Explore Alex Welcing's career in technology, consulting, and marketing." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
      <ThreeSixty currentImage={currentImage} />
      </main>

      <Footer onImageChange={setCurrentImage} />
    </>
  );
}