/**
 * fix-mdx-duplicate-h1.ts
 *
 * Removes the first `# Title` (h1) heading from all MDX article files.
 *
 * WHY: The article page template ([slug].tsx) already renders the frontmatter
 * `title` as an <h1> in the hero section. When the MDX content ALSO starts
 * with `# Title`, Google sees two <h1> tags on the same page — a significant
 * SEO issue that confuses crawlers about the page's primary topic.
 *
 * WHAT IT DOES:
 * - Reads each .mdx file in pages/docs/articles/
 * - If the first non-empty line after frontmatter is an h1 (# ...), removes it
 * - Preserves all other content unchanged
 *
 * RUN: npx tsx scripts/fix-mdx-duplicate-h1.ts
 * SAFE: Run with --dry-run first to preview changes
 */

import fs from 'fs'
import path from 'path'

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const DRY_RUN = process.argv.includes('--dry-run')

function fixFile(filePath: string): { changed: boolean; title?: string } {
  const content = fs.readFileSync(filePath, 'utf-8')

  // Split frontmatter from content
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return { changed: false }

  const frontmatter = fmMatch[1]
  const body = fmMatch[2]

  // Check if the first non-empty line of body is an h1
  const lines = body.split('\n')
  let firstContentLineIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      firstContentLineIdx = i
      break
    }
  }

  if (firstContentLineIdx === -1) return { changed: false }

  const firstLine = lines[firstContentLineIdx].trim()
  const h1Match = firstLine.match(/^#\s+(.+)$/)

  if (!h1Match) return { changed: false }

  // Remove the h1 line (and any immediately following empty line)
  lines.splice(firstContentLineIdx, 1)
  if (lines[firstContentLineIdx]?.trim() === '') {
    lines.splice(firstContentLineIdx, 1)
  }

  const newContent = `---\n${frontmatter}\n---\n${lines.join('\n')}`

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf-8')
  }

  return { changed: true, title: h1Match[1] }
}

// Main
const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.mdx'))
let changedCount = 0

console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Scanning ${files.length} MDX files for duplicate h1...\n`)

for (const file of files) {
  const filePath = path.join(ARTICLES_DIR, file)
  const result = fixFile(filePath)
  if (result.changed) {
    changedCount++
    console.log(`  ${DRY_RUN ? 'WOULD FIX' : 'FIXED'}: ${file} — removed h1: "${result.title}"`)
  }
}

console.log(`\n${DRY_RUN ? 'Would fix' : 'Fixed'} ${changedCount} of ${files.length} files.`)
if (DRY_RUN) {
  console.log('\nRun without --dry-run to apply changes.')
}
