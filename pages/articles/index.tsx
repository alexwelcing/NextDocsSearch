import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import ArticleList from '@/components/ui/ArticleList';
import CircleNav from '@/components/ui/CircleNav';
import StructuredData from '@/components/StructuredData';
import styles from '@/styles/Home.module.css';

export default function ArticlesIndex() {
  return (
    <div className={styles.gradientbg + ' min-h-screen flex flex-col'}>
      <Head>
        <title>Speculative AI Research & Analysis | Alex Welcing</title>
        <meta
          name="description"
          content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition. Original frameworks and scenario analysis."
        />
        <meta
          name="keywords"
          content="speculative AI, AI research, emergent intelligence, AI futures, AI systems analysis"
        />
        <link rel="canonical" href="https://alexwelcing.com/articles" />
        <meta property="og:title" content="Speculative AI Research & Analysis | Alex Welcing" />
        <meta property="og:description" content="Research on speculative AI futures, emergent intelligence, and systemic consequences of abundant cognition." />
        <meta property="og:url" content="https://alexwelcing.com/articles" />
        <meta property="og:type" content="website" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: "Speculative AI Research - Alex Welcing",
          url: "https://alexwelcing.com/articles",
          description: "Research on speculative AI futures, emergent intelligence, and systemic consequences.",
          author: {
            "@type": "Person",
            name: "Alex Welcing"
          }
        }}
      />

      <CircleNav />

      <main className="flex-grow container mx-auto px-4 py-12 flex flex-col items-center">
        <h1 className={styles.centeredtitle}>Research & Analysis</h1>
        <p className="text-slate-300 text-center max-w-2xl mb-8 text-lg">
          Exploring how reality reorganizes when intelligence becomes abundant.
        </p>

        {/* Hub page links for internal linking */}
        <div className="flex gap-4 mb-8 text-sm">
          <Link href="/speculative-ai" className="text-indigo-400 hover:text-indigo-300">
            Speculative AI
          </Link>
          <Link href="/agent-futures" className="text-indigo-400 hover:text-indigo-300">
            Agent Futures
          </Link>
          <Link href="/emergent-intelligence" className="text-indigo-400 hover:text-indigo-300">
            Emergent Intelligence
          </Link>
        </div>

        <div className="w-full max-w-4xl">
          <ArticleList />
        </div>

        <div className="mt-8">
          <Link href="/" className={styles.landingBtn}>
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
