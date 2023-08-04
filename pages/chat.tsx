import React from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import Main from '@/components/ui/main';
import { SearchDialog } from '@/components/SearchDialog';
import Footer from '@/components/ui/footer';

const Chat = () => {
    return (
      <>
          <Head>
              <title>Chat with Alex</title>
          </Head>

          <main className={`${styles.main} ${styles.gradientbg}`}>
              <Main currentImage={''} showThreeSixty={false} />
          </main>
          <SearchDialog />

      </>
    );
}

export default Chat;
