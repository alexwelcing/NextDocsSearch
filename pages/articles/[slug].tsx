// Article deep link: server-renders the complete record as semantic HTML (the SEO layer and the
// no-WebGPU reading surface), while the persistent immersive app resolves the same URL to the
// in-scene ARC reader. Body blocks come from the generated public/arc/records JSON.

import Head from 'next/head'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import type { GetStaticPaths, GetStaticProps } from 'next'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'

interface RecordBlock {
  t: 'h' | 'p' | 'l' | 'q'
  x: string
}

interface ArticlePageProps {
  slug: string
  title: string
  date: string
  description: string
  hero: string | null
  keywords: string[]
  blocks: RecordBlock[]
}

const RECORDS_DIR = path.join(process.cwd(), 'public', 'arc', 'records')

export const getStaticPaths: GetStaticPaths = async () => {
  let slugs: string[] = []
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'lib/generated/article-manifest.json'), 'utf8')
    ) as { slug: string; date?: string }[]
    slugs = manifest
      .slice()
      .sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? 1 : -1))
      .slice(0, 30)
      .map((a) => a.slug)
  } catch {
    /* manifest arrives during build */
  }
  return { paths: slugs.map((slug) => ({ params: { slug } })), fallback: 'blocking' }
}

export const getStaticProps: GetStaticProps<ArticlePageProps> = async ({ params }) => {
  const slug = String(params?.slug ?? '')
  if (!/^[a-z0-9-]+$/i.test(slug)) return { notFound: true }
  try {
    const record = JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, `${slug}.json`), 'utf8')) as {
      title: string
      date: string
      description: string
      hero: string | null
      blocks: RecordBlock[]
    }
    let keywords: string[] = []
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), 'lib/generated/article-manifest.json'), 'utf8')
      ) as { slug: string; keywords?: string[] }[]
      keywords = manifest.find((a) => a.slug === slug)?.keywords ?? []
    } catch {
      /* keywords optional */
    }
    return {
      props: {
        slug,
        title: record.title,
        date: record.date,
        description: record.description,
        hero: record.hero,
        keywords,
        blocks: record.blocks,
      },
      revalidate: 86400,
    }
  } catch {
    return { notFound: true }
  }
}

export default function ArticlePage({
  slug,
  title,
  date,
  description,
  hero,
  keywords,
  blocks,
}: ArticlePageProps) {
  const url = `${SITE_URL}/articles/${slug}`
  const ogImage = hero ? `${SITE_URL}${hero}` : `${SITE_URL}/social-preview.png`
  return (
    <>
      <Head>
        <title>{`${title} — Alex Welcing`}</title>
        <meta name="description" content={description} />
        {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        {date && <meta property="article:published_time" content={date} />}
      </Head>
      <StructuredData
        type="Article"
        data={{
          headline: title,
          description,
          datePublished: date,
          image: ogImage,
          url,
          author: { '@type': 'Person', name: 'Alex Welcing', url: `${SITE_URL}/about` },
        }}
      />
      <main className="arc-feed">
        <nav aria-label="Breadcrumb">
          <Link href="/">Alex Welcing</Link> / <Link href="/articles">Archive</Link>
        </nav>
        <article>
          <header>
            <h1>{title}</h1>
            {date && <time dateTime={date}>{date.slice(0, 10)}</time>}
            {hero && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt={title} loading="lazy" style={{ maxWidth: '100%' }} />
            )}
          </header>
          {blocks.map((b, i) =>
            b.t === 'h' ? (
              <h2 key={i}>{b.x}</h2>
            ) : b.t === 'l' ? (
              <ul key={i}>
                <li>{b.x}</li>
              </ul>
            ) : b.t === 'q' ? (
              <blockquote key={i}>{b.x}</blockquote>
            ) : (
              <p key={i}>{b.x}</p>
            )
          )}
        </article>
      </main>
    </>
  )
}
