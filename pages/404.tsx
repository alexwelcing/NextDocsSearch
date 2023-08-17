import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import styles from '@/styles/Home.module.css'
import CircleNav from '@/components/ui/CircleNav'

export default function Custom404() {
  return (
    <>
      <Head>
        <title>This page is real, but the one you clicked on was not. 404.</title>
        <meta
          name="description"
          content="The page you are looking for on Alex Welcing's site does not exist, sorry about that."
        />
        <link rel="icon" href="/favicon.ico" />
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
