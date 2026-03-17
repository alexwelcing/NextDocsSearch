#!/usr/bin/env node

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { createClient } from '@supabase/supabase-js'

import { discoverArticleImages } from '../lib/article-images'
import { STORAGE_CONFIG } from '../types/article-media'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const VIDEO_DIR = path.join(process.cwd(), 'public', 'images', 'article-videos')
const ARTICLE_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const SKIP_SLUGS = new Set(['hf-ltx-smoke-test'])

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function guessContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.svg') return 'image/svg+xml'
  return 'image/png'
}

function inferVideoMetadata(slug: string): {
  width: number | null
  height: number | null
  durationSeconds: number | null
} {
  if (slug.startsWith('threshold-')) {
    return { width: 768, height: 512, durationSeconds: 6 }
  }

  if (slug.startsWith('residue-')) {
    return { width: 768, height: 448, durationSeconds: 6 }
  }

  if (slug.startsWith('cartography-')) {
    return { width: 768, height: 448, durationSeconds: 8 }
  }

  if (slug.startsWith('interface-')) {
    return { width: 768, height: 448, durationSeconds: 4 }
  }

  return { width: null, height: null, durationSeconds: null }
}

async function publishSlug(slug: string): Promise<'published' | 'updated' | 'skipped' | 'failed'> {
  const articlePath = path.join(ARTICLE_DIR, `${slug}.mdx`)
  const localVideoPath = path.join(VIDEO_DIR, `${slug}.mp4`)

  if (!fs.existsSync(articlePath) || !fs.existsSync(localVideoPath)) {
    return 'skipped'
  }

  const { data } = matter(fs.readFileSync(articlePath, 'utf-8'))
  const title = (data.title as string) || slug
  const description = (data.description as string) || `Video for article ${slug}`
  const series = typeof data.series === 'string' ? data.series : null
  const caption = series ? `Generated from ${series}` : description
  const { width, height, durationSeconds } = inferVideoMetadata(slug)

  const storagePath = `videos/${slug}/generated-video.mp4`
  const videoBuffer = fs.readFileSync(localVideoPath)
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_CONFIG.buckets.videos)
    .upload(storagePath, videoBuffer, { contentType: 'video/mp4', upsert: true })

  if (uploadError) {
    console.error(`Upload failed for ${slug}: ${uploadError.message}`)
    return 'failed'
  }

  let thumbnailPath: string | null = null
  const images = discoverArticleImages(slug)
  const thumbnailCandidate = images.heroImage || images.ogImage || images.thumbnail || null
  if (thumbnailCandidate && thumbnailCandidate.startsWith('/')) {
    const thumbnailDiskPath = path.join(process.cwd(), 'public', thumbnailCandidate.replace(/^\//, ''))
    if (fs.existsSync(thumbnailDiskPath)) {
      const thumbnailExtension = path.extname(thumbnailDiskPath).toLowerCase() || '.png'
      thumbnailPath = `videos/${slug}/thumbnail${thumbnailExtension}`
      const thumbnailBuffer = fs.readFileSync(thumbnailDiskPath)
      const { error: thumbnailError } = await supabase.storage
        .from(STORAGE_CONFIG.buckets.images)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: guessContentType(thumbnailDiskPath),
          upsert: true,
        })

      if (thumbnailError) {
        console.error(`Thumbnail upload failed for ${slug}: ${thumbnailError.message}`)
        thumbnailPath = null
      }
    }
  }

  const { data: existingRows, error: queryError } = await supabase
    .from('article_media')
    .select('id')
    .eq('article_slug', slug)
    .eq('media_type', 'video')
    .order('created_at', { ascending: false })

  if (queryError) {
    console.error(`Lookup failed for ${slug}: ${queryError.message}`)
    return 'failed'
  }

  const payload = {
    article_slug: slug,
    media_type: 'video' as const,
    storage_path: storagePath,
    thumbnail_path: thumbnailPath,
    title: `${title} — Video`,
    caption,
    mime_type: 'video/mp4',
    width,
    height,
    duration_seconds: durationSeconds,
    display_order: 0,
    status: 'ready' as const,
    position_x: 50,
    position_y: 50,
    scale: 1.0,
    rotation: 0,
    z_index: 10,
  }

  if (existingRows && existingRows.length > 0) {
    const { error: updateError } = await supabase
      .from('article_media')
      .update(payload)
      .eq('id', existingRows[0].id)

    if (updateError) {
      console.error(`DB update failed for ${slug}: ${updateError.message}`)
      return 'failed'
    }

    return 'updated'
  }

  const { error: insertError } = await supabase.from('article_media').insert(payload)
  if (insertError) {
    console.error(`DB insert failed for ${slug}: ${insertError.message}`)
    return 'failed'
  }

  return 'published'
}

async function main() {
  const slugs = fs
    .readdirSync(VIDEO_DIR)
    .filter((file) => file.endsWith('.mp4'))
    .map((file) => path.basename(file, '.mp4'))
    .filter((slug) => !SKIP_SLUGS.has(slug))
    .sort()

  let published = 0
  let updated = 0
  let skipped = 0
  let failed = 0

  for (const slug of slugs) {
    process.stdout.write(`${slug} ... `)
    const result = await publishSlug(slug)
    console.log(result)

    if (result === 'published') published += 1
    else if (result === 'updated') updated += 1
    else if (result === 'skipped') skipped += 1
    else failed += 1
  }

  console.log(`\nPublished: ${published}`)
  console.log(`Updated:   ${updated}`)
  console.log(`Skipped:   ${skipped}`)
  console.log(`Failed:    ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})