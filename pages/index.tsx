import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Home.module.css';

export default function Home() {
    return (
        <>
            <Head>
                <title>Innovative products with Alex Welcing.</title>
                <meta name="description" content="Explore Alex Welcing's career in technology, consulting, and marketing." />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className={styles.gradientBg + " flex flex-col items-center justify-center min-h-screen"}>
                <div className={styles.centeredtitle}>
                    Exploratory products with Alex Welcing.
                </div>
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                    <Link href="/chat" className={styles.landingBtn}>
                        Chat
                    </Link>
                    <Link href="/viewer" className={styles.landingBtn}>
                        Explore
                    </Link>
                </div>
            </div>
        </>
    );
}
