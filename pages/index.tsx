import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import Main from '@/components/ui/main'; // Ensure you have the correct path to Main component
import Footer from '@/components/ui/footer';
import React from 'react';
import Walkie from '@/components/ui/walkie';

export default function Home() {
  const [currentImage, setCurrentImage] = React.useState<string>('./background/scifi1.jpg');
  const sendToSupabase = (query: string) => {
    // For now, just log the query. Replace with your Supabase logic later.
    console.log(`Sending the following query to Supabase: ${query}`);
  };

  return (
    <>
      <Head>
        <title>Explore with Alex.</title>
        <meta
          name="description"
          content="Explore Alex Welcing's career in technology, consulting, and marketing."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <Main onImageChange={setCurrentImage} />
        <Walkie sendRequestToSupabase={sendToSupabase} />
      </main>

      <Footer />
    </>
  );
}
