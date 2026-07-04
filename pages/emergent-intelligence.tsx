// Topic hub: emergence, machine minds, and cognition. Crawlable filtered view of the archive.

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

const PATTERN = /emerg|intelligen|mind|cognit/i

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

export default function EmergentIntelligencePage({ articles }: TopicProps) {
  const url = `${SITE_URL}/emergent-intelligence`
  const title = 'Emergent Intelligence — Alex Welcing'
  const description =
    'Essays and fiction on emergent intelligence: machine minds, cognition at scale, and behavior nobody programmed.'
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
          <Link href="/">Alex Welcing</Link> / Emergent Intelligence
        </nav>
        <header>
          <h1>Emergent Intelligence</h1>
          <p>
            Intelligence keeps showing up where no one specified it — in scale, in training runs,
            in systems of systems. These {articles.length} records study machine minds and
            cognition from both the engineering side and the fiction side of the archive.
          </p>
        </header>
        <section aria-label="Emergent Intelligence records">
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
