// Working pitch: crawlable HTML version of the hiring pitch and its four pillars.

import Head from 'next/head'
import Link from 'next/link'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'

const PILLARS = [
  {
    title: 'Evals & quality',
    body: 'Reproducible eval suites, regression gates, and the discipline to ship behind them.',
  },
  {
    title: 'Retrieval & RAG',
    body: 'Vector search, chunking, recall metrics — the parts of LLM systems that quietly decide outcomes.',
  },
  {
    title: 'Observability',
    body: 'Tracing, telemetry, and the feedback loops that turn model behavior into product signal.',
  },
  {
    title: 'Product judgment',
    body: 'Translating fuzzy AI capability into roadmaps, runbooks, and risks a team can actually decide on.',
  },
]

export default function PitchPage() {
  const url = `${SITE_URL}/pitch`
  const title = 'Pitch — Alex Welcing'
  const description =
    'AI product and engineering work — evals, retrieval, observability, and the receipts to back them up.'
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
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE_URL}/social-preview.png`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <StructuredData
        type="Person"
        data={{
          name: 'Alex Welcing',
          url,
          jobTitle: 'Product Manager',
          sameAs: ['https://www.linkedin.com/in/alexwelcing', 'https://github.com/alexwelcing'],
        }}
      />
      <main className="arc-feed">
        <nav aria-label="Breadcrumb">
          <Link href="/">Alex Welcing</Link> / Pitch
        </nav>
        <header>
          <h1>AI product and engineering, shipped behind evals.</h1>
          <p>
            A working surface, not a deck. Built with the same primitives the AI infra world ships
            on — retrieval, traces, telemetry, and the patience to put a real eval gate in front of
            them.
          </p>
        </header>
        <section>
          <h2>The shape of the work</h2>
          <ul>
            {PILLARS.map((p) => (
              <li key={p.title}>
                <strong>{p.title}.</strong> {p.body}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Try it, don&apos;t read about it</h2>
          <ul>
            <li>
              <Link href="/articles">Explore the archive</Link> — a deep essay archive with
              semantic search and article-aware answer surfaces.
            </li>
            <li>
              <Link href="/">Boot the immersive layer</Link> — a real-time 360 surface, not a
              screenshot.
            </li>
          </ul>
        </section>
        <section>
          <h2>Building something where evals and retrieval matter?</h2>
          <p>
            I&apos;d rather sit with your roadmap for an hour than send a deck. If you&apos;re
            hiring for AI product, applied AI, evals, or platform work — let&apos;s talk. Reach me
            at <a href="mailto:alexwelcing@gmail.com">alexwelcing@gmail.com</a>, on{' '}
            <a href="https://linkedin.com/in/alexwelcing">LinkedIn</a>, or{' '}
            <a href="https://github.com/alexwelcing">GitHub</a>. Full background on the{' '}
            <Link href="/about">about page</Link>.
          </p>
        </section>
      </main>
    </>
  )
}
