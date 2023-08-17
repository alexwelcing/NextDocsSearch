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
        <title>Product Maker | Alex Welcing | Technical Product Management & Management Consulting.</title>
        <meta
          name="description"
          content="New York innovator with 10+ years of experience in technology, consulting, and AI. Proven ability to lead and deliver successful products. Contact me today to learn more."
        />
        <meta name="keywords" content="product manager, technology, management consulting, Generative AI, product development, New York, remote" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <CircleNav />
      <div
        className={styles.gradientbg + ' flex flex-col items-center justify-center min-h-screen'}
      >
        <div className={styles.centeredtitle}>Build products with Alex Welcing.</div>
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
          <Link href="/chat" className={styles.landingBtn}>
            Got a question? Ask my LLM.
          </Link>
          <Link href="/viewer" className={styles.landingBtn}>
            Explore generative AI worlds.
          </Link>
          <Link href="/about" className={styles.landingBtn}>
            About my career.
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