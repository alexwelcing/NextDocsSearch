// Topic hub: speculative AI fiction and futures. Crawlable filtered view of the archive.

import Head from 'next/head'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import type { GetStaticProps } from 'next'
import { SITE_URL } from '@/lib/site-url'

interface TopicArticle {
  slug: string
  title: string
  date: string
  description: string
}

interface TopicProps {
  articles: TopicArticle[]
}

const PATTERN = /speculat|future/i

export const getStaticProps: GetStaticProps<TopicProps> = async () => {
  let articles: TopicArticle[] = []
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'lib/generated/article-manifest.json'), 'utf8')
    ) as (TopicArticle & { keywords?: string[]; articleType?: string })[]
    articles = manifest
      .filter(
        (a) =>
          a.articleType === 'fiction' ||
          PATTERN.test(`${a.title} ${a.description ?? ''} ${(a.keywords ?? []).join(' ')}`)
      )
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
  return { props: { articles } }
}

export default function SpeculativeAIPage({ articles }: TopicProps) {
  const url = `${SITE_URL}/speculative-ai`
  const title = 'Speculative AI — Alex Welcing'
  const description =
    'Speculative fiction and futures writing about AI: near-term scenarios, far-shore worlds, and the people living inside them.'
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
          <Link href="/">Alex Welcing</Link> / Speculative AI
        </nav>
        <header>
          <h1>Speculative AI</h1>
          <p>
            Fiction as a forecasting instrument: {articles.length} records that run AI futures
            forward far enough to see what breaks, who adapts, and what ordinary life looks like on
            the other side.
          </p>
        </header>
        <section aria-label="Speculative AI records">
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
