/**
 * Article Parser for Video Generation Pipeline
 *
 * Converts raw article content (MDX frontmatter + body) into a structured
 * intermediate representation used by downstream scene planning and prompting.
 */

import type {
  ArticleIntermediate,
  ArticleSection,
  ArticleCallout,
  ArticleQuote,
} from './types'

// ═══════════════════════════════════════════════════════════════
// PARSING UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Extract H2 sections from markdown/MDX content
 */
function extractSections(body: string): ArticleSection[] {
  // Split on H2 headings (## ...)
  const h2Regex = /^## (.+)$/gm
  const headings: { heading: string; startIndex: number }[] = []
  let match: RegExpExecArray | null

  while ((match = h2Regex.exec(body)) !== null) {
    headings.push({ heading: match[1].trim(), startIndex: match.index })
  }

  if (headings.length === 0) {
    // No H2 sections found; treat entire body as one section
    return [parseSectionContent('Introduction', body)]
  }

  const sections: ArticleSection[] = []

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].startIndex
    const end = i + 1 < headings.length ? headings[i + 1].startIndex : body.length
    const content = body.slice(start, end)
    sections.push(parseSectionContent(headings[i].heading, content))
  }

  return sections
}

/**
 * Parse a section's markdown content into structured data
 */
function parseSectionContent(heading: string, content: string): ArticleSection {
  const lines = content.split('\n')

  const paragraphs: string[] = []
  const bullets: string[] = []
  const codeBlocks: string[] = []
  const images: string[] = []
  const callouts: ArticleCallout[] = []

  let inCodeBlock = false
  let currentCode = ''
  let currentParagraph = ''

  for (const line of lines) {
    // Skip heading lines
    if (line.startsWith('## ')) continue

    // Code block boundaries
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        codeBlocks.push(currentCode.trim())
        currentCode = ''
        inCodeBlock = false
      } else {
        if (currentParagraph.trim()) {
          paragraphs.push(currentParagraph.trim())
          currentParagraph = ''
        }
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      currentCode += line + '\n'
      continue
    }

    // Bullet points
    if (/^\s*[-*+]\s/.test(line)) {
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim())
        currentParagraph = ''
      }
      bullets.push(line.replace(/^\s*[-*+]\s/, '').trim())
      continue
    }

    // Images
    const imgMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      images.push(imgMatch[2])
      continue
    }

    // Callouts (⚠️ or similar emoji markers)
    const calloutMatch = line.match(/^[⚠️🔴🟡🟢💡📌ℹ️]\s*(.+)/)
    if (calloutMatch) {
      const type = line.startsWith('⚠') ? 'warning' : line.startsWith('💡') ? 'tip' : 'info'
      callouts.push({ text: calloutMatch[1].trim(), type })
      continue
    }

    // Blank line = paragraph break
    if (line.trim() === '') {
      if (currentParagraph.trim()) {
        paragraphs.push(currentParagraph.trim())
        currentParagraph = ''
      }
      continue
    }

    currentParagraph += ' ' + line
  }

  if (currentParagraph.trim()) {
    paragraphs.push(currentParagraph.trim())
  }

  return { heading, paragraphs, bullets, codeBlocks, images, callouts }
}

/**
 * Extract quotes/pull-quotes from article content
 */
function extractQuotes(sections: ArticleSection[]): ArticleQuote[] {
  const quotes: ArticleQuote[] = []

  for (const section of sections) {
    // Warning callouts become quotes
    for (const callout of section.callouts) {
      if (callout.type === 'warning') {
        quotes.push({
          text: callout.text,
          sectionHeading: section.heading,
          type: 'warning',
        })
      }
    }

    // Sentences with strong claims become pull quotes (slightly longer minimum than hook scoring)
    for (const para of section.paragraphs) {
      const sentences = para.split(/(?<=[.!?])\s+/)
      for (const sentence of sentences) {
        if (
          sentence.length > 30 &&
          sentence.length < 200 &&
          (sentence.includes('must') ||
            sentence.includes('critical') ||
            sentence.includes('essential') ||
            sentence.includes('never'))
        ) {
          quotes.push({
            text: sentence.trim(),
            sectionHeading: section.heading,
            type: 'claim',
          })
        }
      }
    }
  }

  return quotes
}

/**
 * Extract all inline images from markdown content
 */
function extractInlineImages(body: string): string[] {
  const images: string[] = []
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let match: RegExpExecArray | null

  while ((match = imgRegex.exec(body)) !== null) {
    images.push(match[2])
  }

  return images
}

// ═══════════════════════════════════════════════════════════════
// MAIN PARSER
// ═══════════════════════════════════════════════════════════════

/**
 * Parse article frontmatter and body into structured intermediate representation.
 *
 * @param frontmatter - Parsed frontmatter object (title, author, date, etc.)
 * @param body - Raw markdown/MDX body content (without frontmatter)
 * @param slug - Article slug identifier
 */
export function parseArticle(
  frontmatter: {
    title?: string
    author?: string | string[]
    date?: string
    image?: string
    heroImage?: string
    [key: string]: unknown
  },
  body: string,
  slug: string
): ArticleIntermediate {
  const sections = extractSections(body)
  const quotes = extractQuotes(sections)
  const inlineImages = extractInlineImages(body)

  const author = Array.isArray(frontmatter.author)
    ? frontmatter.author.join(', ')
    : frontmatter.author || 'Unknown'

  return {
    url: `https://www.alexwelcing.com/articles/${slug}`,
    slug,
    title: frontmatter.title || slug,
    author,
    date: frontmatter.date || new Date().toISOString(),
    heroImage: frontmatter.heroImage || frontmatter.image,
    sections,
    inlineImages,
    quotes,
  }
}

/**
 * Extract heading list from article intermediate for downstream use
 */
export function getHeadings(article: ArticleIntermediate): string[] {
  return article.sections.map((s) => s.heading)
}

/**
 * Get the first N paragraphs across all sections (for hook selection)
 */
export function getLeadParagraphs(article: ArticleIntermediate, count = 3): string[] {
  const result: string[] = []
  for (const section of article.sections) {
    for (const para of section.paragraphs) {
      result.push(para)
      if (result.length >= count) return result
    }
  }
  return result
}
