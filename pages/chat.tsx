import React from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import Main from '@/components/ui/main';
import Walkie from '@/components/ui/walkie';
import Footer from '@/components/ui/footer';

const Chat = () => {
    return (
      <>
          <Head>
              <title>Chat with Alex</title>
          </Head>

          <main className={`${styles.main} ${styles.gradientbg}`}>
              <Main currentImage={''} showThreeSixty={false} />
              <Walkie sendRequestToSupabase={function (query: string): void {
                  throw new Error('Function not implemented.');
              }} />
          </main>

          <Footer onImageChange={function (newImage: string): void {
              // This can be kept empty if you don't plan on changing the image.
          }} showChangeScenery={false} /> {/* Added the footer with showChangeScenery set to false */}

      </>
    );
}

export default Chat;
