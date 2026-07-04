// Series hub: The Interface, a 24-part fiction series. Crawlable filtered view of the archive.

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

export const getStaticProps: GetStaticProps<TopicProps> = async () => {
  let articles: TopicArticle[] = []
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'lib/generated/article-manifest.json'), 'utf8')
    ) as (TopicArticle & Record<string, unknown>)[]
    articles = manifest
      .filter((a) => a.slug.startsWith('interface-') || /interface/i.test(a.title))
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

export default function TheInterfacePage({ articles }: TopicProps) {
  const url = `${SITE_URL}/the-interface`
  const title = 'The Interface — a 24-part series by Alex Welcing'
  const description =
    'The Interface: a 24-part fiction series about the boundary layer between people and machine minds — translators, protocols, grief engines, and the hands that learn to use them.'
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
          <Link href="/">Alex Welcing</Link> / The Interface
        </nav>
        <header>
          <h1>The Interface</h1>
          <p>
            A 24-part fiction series about the boundary layer between people and machine minds:
            each installment follows one person — a translator, a ceramicist, an interpreter — at
            the moment the interface stops being a tool and starts being a relationship. Read in
            order or drop in anywhere.
          </p>
        </header>
        <section aria-label="The Interface series">
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
