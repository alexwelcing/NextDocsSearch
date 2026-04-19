import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import styles from '@/styles/Home.module.css'
import CircleNav from '@/components/ui/CircleNav'
import { SITE_URL } from '@/lib/site-url'

export default function Custom404() {
  const siteUrl = SITE_URL
  return (
    <>
      <Head>
        <title>This page is real, but the one you clicked on was not. 404.</title>
        <meta
          name="description"
          content="The page you are looking for on Alex Welcing's site does not exist, sorry about that."
        />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={`${siteUrl}/404`} />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Page Not Found | Alex Welcing" />
        <meta
          property="og:description"
          content="The page you are looking for on Alex Welcing's site does not exist."
        />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Page Not Found | Alex Welcing" />
        <meta
          name="twitter:description"
          content="The page you are looking for on Alex Welcing's site does not exist."
        />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />
      </Head>
      <CircleNav />
      <div className={styles.gradientbg + ' flex flex-col items-center justify-center min-h-screen'}>
        <h1 className="text-3xl font-bold mb-4">This page is real, but the one you clicked on was not. 404.</h1>
        <Link href="/" className={styles.landingBtn}>
          Return to Home
        </Link>
      </div>
    </>
  )
}
