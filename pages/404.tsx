// 404: terminal-flavored record-not-found page.

import Head from 'next/head'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site-url'

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>RECORD NOT FOUND — Alex Welcing</title>
        <meta
          name="description"
          content="The requested record does not exist in the archive. Return to the index or browse all records."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href={`${SITE_URL}/404`} />
      </Head>
      <main className="arc-feed">
        <header>
          <h1>RECORD NOT FOUND</h1>
          <p>
            ARC TERMINAL // STATUS 404. The address you requested resolves to no record in this
            archive. It may have been moved, renamed, or never committed.
          </p>
        </header>
        <nav aria-label="Recovery options">
          <ul>
            <li>
              <Link href="/">RETURN TO INDEX /</Link>
            </li>
            <li>
              <Link href="/articles">BROWSE ALL RECORDS /articles</Link>
            </li>
          </ul>
        </nav>
      </main>
    </>
  )
}
