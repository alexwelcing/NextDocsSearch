/**
 * audit-sitemap-404s.ts
 *
 * Compares the URLs in sitemap-0.xml against actual MDX files to find
 * articles that are listed in the sitemap but don't have corresponding
 * content files (which would cause 404s).
 *
 * Also identifies articles that exist as files but aren't in the sitemap.
 *
 * RUN: npx tsx scripts/audit-sitemap-404s.ts
 */

import fs from 'fs'
import path from 'path'

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const SITEMAP_PATH = path.join(process.cwd(), 'public', 'sitemap-0.xml')

// Get all MDX article slugs
const mdxFiles = fs.readdirSync(ARTICLES_DIR)
  .filter(f => f.endsWith('.mdx'))
  .map(f => f.replace('.mdx', ''))

const mdxSlugs = new Set(mdxFiles)

// Parse sitemap for article URLs
let sitemapSlugs: string[] = []
if (fs.existsSync(SITEMAP_PATH)) {
  const sitemapContent = fs.readFileSync(SITEMAP_PATH, 'utf-8')
  const urlMatches = sitemapContent.matchAll(/<loc>https:\/\/alexwelcing\.com\/articles\/(.*?)<\/loc>/g)
  sitemapSlugs = [...urlMatches].map(m => m[1])
} else {
  console.log('WARNING: sitemap-0.xml not found at', SITEMAP_PATH)
  console.log('Run `pnpm build` first to generate the sitemap, then re-run this script.\n')
}

const sitemapSlugSet = new Set(sitemapSlugs)

// Find mismatches
console.log('=== SITEMAP AUDIT ===\n')

// Articles in sitemap but no MDX file (will 404)
const phantom = sitemapSlugs.filter(s => !mdxSlugs.has(s))
if (phantom.length > 0) {
  console.log(`PHANTOM URLS (in sitemap, no MDX file - will 404):`)
  phantom.forEach(s => console.log(`  /articles/${s}`))
} else {
  console.log('No phantom URLs found (all sitemap articles have MDX files)')
}

console.log('')

// MDX files not in sitemap (might be missing from index)
const missing = mdxFiles.filter(s => !sitemapSlugSet.has(s))
if (missing.length > 0) {
  console.log(`MISSING FROM SITEMAP (have MDX file but not in sitemap):`)
  missing.forEach(s => console.log(`  /articles/${s}`))
} else {
  console.log('All MDX files are represented in the sitemap')
}

console.log(`\nSummary:`)
console.log(`  MDX files: ${mdxFiles.length}`)
console.log(`  Sitemap article URLs: ${sitemapSlugs.length}`)
console.log(`  Phantom (404): ${phantom.length}`)
console.log(`  Missing from sitemap: ${missing.length}`)
