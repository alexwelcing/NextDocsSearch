import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ArticleList from '@/components/ui/ArticleList';
import CircleNav from '@/components/ui/CircleNav';
import Footer from '@/components/ui/footer';
import styles from '@/styles/Home.module.css';

export default function ArticlesIndex() {
  return (
    <div className={styles.gradientbg + ' min-h-screen flex flex-col'}>
      <Head>
        <title>Articles & Insights | Alex Welcing</title>
        <meta name="description" content="Insights on AI Product Management, Generative AI, and Strategy by Alex Welcing." />
      </Head>

      <CircleNav />

      <main className="flex-grow container mx-auto px-4 py-12 flex flex-col items-center">
        <h1 className={styles.centeredtitle}>Articles & Insights</h1>
        <div className="w-full max-w-4xl">
          <ArticleList />
        </div>

        <div className="mt-8">
          <Link href="/" className={styles.landingBtn}>
            Back to Home
          </Link>
        </div>
      </main>

      <Footer showChangeScenery={false} onImageChange={() => {}} />
    </div>
  );
}
