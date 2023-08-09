import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import styles from '@/styles/Home.module.css'
import Footer from '@/components/ui/footer'
import CircleNav from '@/components/ui/CircleNav'

export default function Home() {
  return (
    <>
      <Head>
        <title>Alex Welcing webs in New York.</title>
        <meta
          name="description"
          content="Check out Alex Welcing's OpenAI experiments, Generative AI creations, and a career in technology, consulting, and marketing."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <CircleNav />
      <div
        className={styles.gradientbg + ' flex flex-col items-center justify-center min-h-screen'}
      >
        <div className={styles.centeredtitle}>Web experiments with Alex Welcing.</div>
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <Link href="/chat" className={styles.landingBtn}>
            Chat
          </Link>
          <Link href="/viewer" className={styles.landingBtn}>
            Explore
          </Link>
          <Link href="/about" className={styles.landingBtn}>
            About
          </Link>
        </div>
      </div>
      <Footer
        onImageChange={function (newImage: string): void {
          throw new Error('Function not implemented.')
        }}
        showChangeScenery={false}
      />
    </>
  )
}