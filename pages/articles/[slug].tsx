// Article deep link: server-renders the complete record as semantic HTML (the SEO layer and the
// no-WebGPU reading surface), while the persistent immersive app resolves the same URL to the
// in-scene ARC reader. Body blocks come from the generated public/arc/records JSON.
//
// Every manifest slug is prerendered at build (fallback: false, no ISR), so the pages export as
// static HTML. Thin records still render but carry noindex (see lib/seo/records.ts).

import Head from 'next/head'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import type { GetStaticPaths, GetStaticProps } from 'next'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'
import { bodyWords, readImageManifest, resolveOgImage, thinReason } from '@/lib/seo/records'

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
  indexable: boolean
  /** Site-relative og:image path; see resolveOgImage(). */
  ogPath: string
  ogWidth: number
  ogHeight: number
}

const ROOT = process.cwd()
const RECORDS_DIR = path.join(ROOT, 'public', 'arc', 'records')

type ManifestEntry = { slug: string; keywords?: string[] }

// Read at build time, once per build worker rather than once per page.
let manifest: ManifestEntry[] | undefined
function articleManifest(): ManifestEntry[] {
  const file = path.join(ROOT, 'lib/generated/article-manifest.json')
  return (manifest ??= JSON.parse(fs.readFileSync(file, 'utf8')) as ManifestEntry[])
}

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = articleManifest().map((a) => a.slug)
  // An empty manifest means the generators lost the content; fail rather than export no pages.
  if (slugs.length === 0) throw new Error('articles: lib/generated/article-manifest.json is empty')
  return { paths: slugs.map((slug) => ({ params: { slug } })), fallback: false }
}

export const getStaticProps: GetStaticProps<ArticlePageProps> = async ({ params }) => {
  const slug = String(params?.slug ?? '')
  if (!/^[a-z0-9-]+$/i.test(slug)) return { notFound: true }
  // Only manifest slugs reach here, and each must have a record: a missing one fails the build
  // instead of quietly exporting a 404 for a URL the sitemap and the scene both link.
  const record = JSON.parse(fs.readFileSync(path.join(RECORDS_DIR, `${slug}.json`), 'utf8')) as {
    title: string
    date: string
    description: string
    hero: string | null
    blocks: RecordBlock[]
  }
  const og = resolveOgImage(ROOT, record.hero, readImageManifest(ROOT)[slug])
  return {
    props: {
      slug,
      title: record.title,
      date: record.date,
      description: record.description,
      hero: record.hero,
      keywords: articleManifest().find((a) => a.slug === slug)?.keywords ?? [],
      blocks: record.blocks,
      indexable: thinReason(slug, bodyWords(record.blocks)) === null,
      ogPath: og.path,
      ogWidth: og.width,
      ogHeight: og.height,
    },
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
  indexable,
  ogPath,
  ogWidth,
  ogHeight,
}: ArticlePageProps) {
  const url = `${SITE_URL}/articles/${slug}`
  const ogImage = `${SITE_URL}${ogPath}`
  return (
    <>
      <Head>
        <title>{`${title} — Alex Welcing`}</title>
        <meta name="description" content={description} />
        {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content={indexable ? 'index, follow' : 'noindex,follow'} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content={String(ogWidth)} />
        <meta property="og:image:height" content={String(ogHeight)} />
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
