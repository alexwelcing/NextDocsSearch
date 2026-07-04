// The landing URL of the immersive 360 archive. This page contributes the crawlable HTML layer
// (and metadata); the scene itself mounts persistently from _app.tsx and hides this content the
// moment WebGPU boots. Browsers without WebGPU read this page as a flat feed instead.

import Head from 'next/head'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import type { GetStaticProps } from 'next'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'

interface FeedArticle {
  slug: string
  title: string
  description: string
  date: string
}

interface HomeProps {
  articles: FeedArticle[]
  total: number
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  let articles: FeedArticle[] = []
  let total = 0
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'lib/generated/article-manifest.json'), 'utf8')
    ) as (FeedArticle & Record<string, unknown>)[]
    total = manifest.length
    articles = manifest
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 40)
      .map(({ slug, title, description, date }) => ({
        slug,
        title,
        description: description ?? '',
        date: date ?? '',
      }))
  } catch {
    // manifest is generated during build; a bare dev checkout still renders the shell
  }
  return { props: { articles, total } }
}

export default function HomePage({ articles, total }: HomeProps) {
  const siteUrl = SITE_URL
  const title = 'Alex Welcing — Immersive 360 Archive'
  const description =
    'An immersive 360 archive of essays and fiction on speculative AI, emergent intelligence, and the interfaces between. Boot the ARC Terminal to explore.'
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={siteUrl} />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="theme-color" content="#020403" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Alex Welcing',
          url: siteUrl,
          description,
          author: { '@type': 'Person', name: 'Alex Welcing', url: `${siteUrl}/about` },
        }}
      />
      <StructuredData
        type="Person"
        data={{
          name: 'Alex Welcing',
          url: siteUrl,
          description:
            'Building with AI products that help people survive. Writing on speculative AI and emergent intelligence.',
          sameAs: [
            'https://www.linkedin.com/in/alexwelcing',
            'https://github.com/alexwelcing',
            'https://x.com/alexwelcing',
          ],
          knowsAbout: [
            'Large Language Models',
            'AI Agent Systems',
            'Retrieval-Augmented Generation',
            'AI Product Management',
            'AI Safety & Alignment',
            '3D Visualization',
            'TypeScript',
            'React',
            'Next.js',
          ],
        }}
      />

      <main className="arc-feed">
        <header>
          <h1>Alex Welcing</h1>
          <p>
            Essays and fiction on speculative AI, emergent intelligence, and the interfaces between
            people and machine minds. The full experience is an immersive 360 environment — the ARC
            Terminal — for WebGPU browsers. Everything below is the same archive, flat.
          </p>
        </header>

        <nav aria-label="Sections">
          <ul>
            <li>
              <Link href="/articles">Article archive ({total} records)</Link>
            </li>
            <li>
              <Link href="/agent-futures">Agent Futures</Link>
            </li>
            <li>
              <Link href="/emergent-intelligence">Emergent Intelligence</Link>
            </li>
            <li>
              <Link href="/speculative-ai">Speculative AI</Link>
            </li>
            <li>
              <Link href="/the-interface">The Interface (series)</Link>
            </li>
            <li>
              <Link href="/about">About Alex Welcing</Link>
            </li>
            <li>
              <Link href="/current-work">Current work</Link>
            </li>
            <li>
              <Link href="/pitch">Working pitch</Link>
            </li>
          </ul>
        </nav>

        <section aria-label="Latest records">
          <h2>Latest records</h2>
          <ol>
            {articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/articles/${a.slug}`}>{a.title}</Link>
                {a.description && <p>{a.description}</p>}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  )
}
