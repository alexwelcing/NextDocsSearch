// Video deep link: crawlable HTML + VideoObject structured data for each article video.
// Slugs are the films in public/arc/media.json (every public/images/article-videos/*.mp4), all
// prerendered at build (fallback: false, no ISR); metadata comes from the article manifest.

import Head from 'next/head'
import Link from 'next/link'
import fs from 'node:fs'
import path from 'node:path'
import type { GetStaticPaths, GetStaticProps } from 'next'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'
import { ogImagePath, readImageManifest, readImageSize } from '@/lib/seo/records'

interface VideoPageProps {
  slug: string
  title: string
  date: string
  description: string
  hasArticle: boolean
  /** Site-relative poster: the record's og:image (see ogImagePath()). */
  ogPath: string
  ogWidth: number | null
  ogHeight: number | null
}

const ROOT = process.cwd()
const VIDEOS_DIR = path.join(ROOT, 'public', 'images', 'article-videos')
const MANIFEST_PATH = path.join(ROOT, 'lib/generated/article-manifest.json')
const RECORDS_DIR = path.join(ROOT, 'public', 'arc', 'records')

interface ManifestEntry {
  slug: string
  title: string
  date?: string
  description?: string
}

// Read at build time, once per build worker rather than once per page.
let manifest: ManifestEntry[] | undefined
function articleManifest(): ManifestEntry[] {
  return (manifest ??= JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[])
}

export const getStaticPaths: GetStaticPaths = async () => {
  // media.json is generated from the film directory (scripts/generate-media-manifest.ts); an
  // ALLOW_EMPTY_MEDIA build lists no films and so exports no video pages.
  const media = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public', 'arc', 'media.json'), 'utf8')
  ) as { films: string[] }
  return { paths: media.films.map((slug) => ({ params: { slug } })), fallback: false }
}

export const getStaticProps: GetStaticProps<VideoPageProps> = async ({ params }) => {
  const slug = String(params?.slug ?? '')
  if (!/^[a-z0-9-]+$/i.test(slug)) return { notFound: true }
  // Build-time assertion: media.json listed this film, so its MP4 must be there to link.
  if (!fs.existsSync(path.join(VIDEOS_DIR, `${slug}.mp4`))) {
    throw new Error(`videos: public/images/article-videos/${slug}.mp4 is missing`)
  }

  const entry = articleManifest().find((a) => a.slug === slug)
  // The poster is the record's og:image, so the film and its article share one social card.
  const recordFile = path.join(RECORDS_DIR, `${slug}.json`)
  const hero = fs.existsSync(recordFile)
    ? (JSON.parse(fs.readFileSync(recordFile, 'utf8')) as { hero: string | null }).hero
    : null
  const ogPath = ogImagePath(hero, readImageManifest(ROOT)[slug])
  const size = readImageSize(path.join(ROOT, 'public', ogPath))

  return {
    props: {
      slug,
      title: entry?.title ?? slug.replace(/-/g, ' '),
      date: entry?.date ?? '',
      description: entry?.description ?? `Video companion to the record "${slug}".`,
      hasArticle: Boolean(entry),
      ogPath,
      ogWidth: size?.width ?? null,
      ogHeight: size?.height ?? null,
    },
  }
}

export default function VideoPage({
  slug,
  title,
  date,
  description,
  hasArticle,
  ogPath,
  ogWidth,
  ogHeight,
}: VideoPageProps) {
  const url = `${SITE_URL}/videos/${slug}`
  const contentUrl = `${SITE_URL}/images/article-videos/${slug}.mp4`
  const poster = `${SITE_URL}${ogPath}`
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
        <meta property="og:image" content={poster} />
        {ogWidth !== null && <meta property="og:image:width" content={String(ogWidth)} />}
        {ogHeight !== null && <meta property="og:image:height" content={String(ogHeight)} />}
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <StructuredData
        type="VideoObject"
        data={{
          name: title,
          description,
          contentUrl,
          thumbnailUrl: [poster],
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
