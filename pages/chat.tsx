import React from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';
import Main from '@/components/ui/main';
import Walkie from '@/components/ui/walkie';

const Chat = () => {

  return (
    <>
        <Head>
            <title>Chat with Alex</title>
        </Head>

        <main className={styles.main}>
            <Main currentImage={''} />
            <Walkie sendRequestToSupabase={function (query: string): void {
                throw new Error('Function not implemented.');
            }} />
        </main>

    </>
);
}

export default Chat;
