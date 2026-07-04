// Topic hub: agents, autonomy, and delegation. Crawlable filtered view of the archive.

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

const PATTERN = /agent|autonom|delegat/i

export const getStaticProps: GetStaticProps<TopicProps> = async () => {
  let articles: TopicArticle[] = []
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'lib/generated/article-manifest.json'), 'utf8')
    ) as (TopicArticle & { keywords?: string[] })[]
    articles = manifest
      .filter((a) =>
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

export default function AgentFuturesPage({ articles }: TopicProps) {
  const url = `${SITE_URL}/agent-futures`
  const title = 'Agent Futures — Alex Welcing'
  const description =
    'Essays and fiction on AI agents: autonomy, delegation, coordination, and what happens when software starts acting on your behalf.'
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
          <Link href="/">Alex Welcing</Link> / Agent Futures
        </nav>
        <header>
          <h1>Agent Futures</h1>
          <p>
            Software is starting to act, not just answer. These records trace what autonomy and
            delegation actually cost — credentials, trust, audit trails, and the coordination layer
            nobody has built yet — across {articles.length} essays and stories from the archive.
          </p>
        </header>
        <section aria-label="Agent Futures records">
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
