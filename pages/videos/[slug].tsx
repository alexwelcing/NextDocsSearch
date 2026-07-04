// Video deep link: crawlable HTML + VideoObject structured data for each article video.
// Slugs come from public/images/article-videos/*.mp4; metadata from the article manifest.

import Head from 'next/head'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import type { GetStaticPaths, GetStaticProps } from 'next'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'

interface VideoPageProps {
  slug: string
  title: string
  date: string
  description: string
  hasArticle: boolean
}

const VIDEOS_DIR = path.join(process.cwd(), 'public', 'images', 'article-videos')
const MANIFEST_PATH = path.join(process.cwd(), 'lib/generated/article-manifest.json')

interface ManifestEntry {
  slug: string
  title: string
  date?: string
  description?: string
}

export const getStaticPaths: GetStaticPaths = async () => {
  let slugs: string[] = []
  try {
    slugs = fs
      .readdirSync(VIDEOS_DIR)
      .filter((f) => f.endsWith('.mp4'))
      .map((f) => ({
        slug: f.slice(0, -4),
        mtime: fs.statSync(path.join(VIDEOS_DIR, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 8)
      .map((v) => v.slug)
  } catch {
    // videos directory may be absent in a bare checkout
  }
  return { paths: slugs.map((slug) => ({ params: { slug } })), fallback: 'blocking' }
}

export const getStaticProps: GetStaticProps<VideoPageProps> = async ({ params }) => {
  const slug = String(params?.slug ?? '')
  if (!/^[a-z0-9-]+$/i.test(slug)) return { notFound: true }

  let entry: ManifestEntry | undefined
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[]
    entry = manifest.find((a) => a.slug === slug)
  } catch {
    // manifest is generated during build
  }
  const hasVideo = fs.existsSync(path.join(VIDEOS_DIR, `${slug}.mp4`))
  if (!entry && !hasVideo) return { notFound: true }

  return {
    props: {
      slug,
      title: entry?.title ?? slug.replace(/-/g, ' '),
      date: entry?.date ?? '',
      description: entry?.description ?? `Video companion to the record "${slug}".`,
      hasArticle: Boolean(entry),
    },
    revalidate: 86400,
  }
}

export default function VideoPage({ slug, title, date, description, hasArticle }: VideoPageProps) {
  const url = `${SITE_URL}/videos/${slug}`
  const contentUrl = `${SITE_URL}/images/article-videos/${slug}.mp4`
  return (
    <>
      <Head>
        <title>{`${title} (video) — Alex Welcing`}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={`${title} (video)`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content={url} />
        <meta property="og:video" content={contentUrl} />
        <meta property="og:image" content={`${SITE_URL}/social-preview.png`} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <StructuredData
        type="VideoObject"
        data={{
          name: title,
          description,
          contentUrl,
          thumbnailUrl: [`${SITE_URL}/social-preview.png`],
          ...(date && { uploadDate: date }),
          url,
          mainEntityOfPage: url,
          publisher: { '@type': 'Organization', name: 'Alex Welcing', url: SITE_URL },
        }}
      />
      <main className="arc-feed">
        <nav aria-label="Breadcrumb">
          <Link href="/">Alex Welcing</Link> / <Link href="/articles">Archive</Link> / Video
        </nav>
        <article>
          <header>
            <h1>{title}</h1>
            {date && <time dateTime={date}>{date.slice(0, 10)}</time>}
            <p>{description}</p>
          </header>
          <video controls preload="none" src={`/images/article-videos/${slug}.mp4`}>
            Your browser does not support embedded video.{' '}
            <a href={`/images/article-videos/${slug}.mp4`}>Download the MP4.</a>
          </video>
          {hasArticle && (
            <p>
              <Link href={`/articles/${slug}`}>Read the full record: {title}</Link>
            </p>
          )}
        </article>
      </main>
    </>
  )
}
