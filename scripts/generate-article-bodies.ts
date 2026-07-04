// Emit every article's full body as structured blocks into public/arc/records/<slug>.json,
// consumed by the in-scene ARC article reader (windfoil text pagination). Static files on the
// CDN — no server-side MDX reads at request time.

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const OUT_DIR = path.join(process.cwd(), 'public', 'arc', 'records')

export interface RecordBlock {
  /** h = heading, p = paragraph, l = list item, q = quote */
  t: 'h' | 'p' | 'l' | 'q'
  x: string
}

function cleanInline(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1') // code spans
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
    .replace(/<[^>]+>/g, '') // stray tags
    .replace(/\s+/g, ' ')
    .trim()
}

function mdxToBlocks(content: string): RecordBlock[] {
  const blocks: RecordBlock[] = []
  // strip imports/exports and fenced code
  const body = content
    .replace(/^(import|export)\s[^\n]*$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    // strip JSX component blocks (lines that are pure tags)
    .replace(/^<\/?[A-Z][^>]*>\s*$/gm, '')

  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) {
      const text = cleanInline(paragraph.join(' '))
      if (text) blocks.push({ t: 'p', x: text })
      paragraph = []
    }
  }

  for (const raw of body.split('\n')) {
    const line = raw.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) {
      flush()
      continue
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (heading) {
      flush()
      const text = cleanInline(heading[2])
      if (text) blocks.push({ t: 'h', x: text })
      continue
    }
    const list = /^[-*+]\s+(.*)$/.exec(trimmed)
    if (list) {
      flush()
      const text = cleanInline(list[1])
      if (text) blocks.push({ t: 'l', x: text })
      continue
    }
    const quote = /^>\s?(.*)$/.exec(trimmed)
    if (quote) {
      flush()
      const text = cleanInline(quote[1])
      if (text) blocks.push({ t: 'q', x: text })
      continue
    }
    if (/^<\/?[A-Za-z]/.test(trimmed) && trimmed.endsWith('>')) continue // single-line tag
    if (/^([-*_]\s*){3,}$/.test(trimmed)) {
      flush() // horizontal rule
      continue
    }
    paragraph.push(trimmed)
  }
  flush()
  return blocks
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const files = fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.mdx'))
let ok = 0
let totalBlocks = 0
for (const file of files) {
  const slug = file.replace(/\.mdx$/, '')
  try {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8')
    const { data, content } = matter(raw)
    const blocks = mdxToBlocks(content)
    totalBlocks += blocks.length
    const record = {
      slug,
      title: data.title ?? slug,
      date: String(data.date ?? ''),
      description: data.description ?? '',
      hero: data.heroImage ?? data.ogImage ?? null,
      blocks,
    }
    fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(record))
    ok++
  } catch (err) {
    console.error(`[article-bodies] ${slug}:`, err)
  }
}
console.log(`[article-bodies] wrote ${ok}/${files.length} records, ${totalBlocks} blocks`)
