// Flat archive index: every record in the manifest as crawlable HTML. The immersive app
// resolves /articles to the in-scene archive shelf; this is the same list for crawlers.

import Head from 'next/head'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import type { GetStaticProps } from 'next'
import { SITE_URL } from '@/lib/site-url'

interface ArchiveArticle {
  slug: string
  title: string
  date: string
  description: string
}

interface ArchiveProps {
  articles: ArchiveArticle[]
  total: number
}

export const getStaticProps: GetStaticProps<ArchiveProps> = async () => {
  let articles: ArchiveArticle[] = []
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'lib/generated/article-manifest.json'), 'utf8')
    ) as (ArchiveArticle & Record<string, unknown>)[]
    articles = manifest
      .slice()
      .sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? 1 : -1))
      .map(({ slug, title, description, date }) => ({
        slug,
        title,
        description: description ?? '',
        date: date ?? '',
      }))
  } catch {
    // manifest is generated during build
  }
  return { props: { articles, total: articles.length } }
}

export default function ArchivePage({ articles, total }: ArchiveProps) {
  const url = `${SITE_URL}/articles`
  const title = 'Archive — Alex Welcing'
  const description = `The complete archive: ${total} essays and fiction records on speculative AI, emergent intelligence, and the interfaces between people and machine minds.`
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE_URL}/social-preview.png`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <main className="arc-feed">
        <nav aria-label="Breadcrumb">
          <Link href="/">Alex Welcing</Link> / Archive
        </nav>
        <header>
          <h1>Archive</h1>
          <p>
            {total} records. Essays and fiction on speculative AI, emergent intelligence, and the
            interfaces between people and machine minds, newest first.
          </p>
        </header>
        <section aria-label="All records">
          <ol>
            {articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}`}>{a.title}</Link>{' '}
                {a.date && <time dateTime={a.date}>{a.date.slice(0, 10)}</time>}
                {a.description && <p>{a.description}</p>}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  )
}
