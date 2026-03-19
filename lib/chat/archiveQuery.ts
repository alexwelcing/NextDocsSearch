import { readdir, readFile } from 'fs/promises'
import matter from 'gray-matter'
import { basename, extname, join, relative } from 'path'
import articleManifest from '@/lib/generated/article-manifest.json'
import type { InstantAnswerItem } from '@/lib/chat/shipAnswer'

interface ArticleRecord {
  slug: string
  filename?: string
  title?: string
  description?: string
  searchText?: string
  keywords?: string[]
  domains?: string[]
  articleType?: string
}

interface ArchiveDocument {
  id: string
  path: string
  slug: string
  title: string
  description: string
  articleType?: string
  keywords: string[]
  domains: string[]
  paragraphs: string[]
}

interface PassageMatch {
  doc: ArchiveDocument
  passage: string
  score: number
}

export interface LocalArchiveQueryResult {
  profileIntent: boolean
  profileFacts: string[]
  context: string
  instantResults: InstantAnswerItem[]
}

const DOC_DIRECTORIES = ['pages/docs', 'content']

const stopWords = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'have',
  'what',
  'about',
  'would',
  'there',
  'their',
  'them',
  'then',
  'when',
  'where',
  'which',
  'while',
  'were',
  'been',
  'will',
  'just',
  'like',
  'than',
  'they',
  'that',
  'does',
  'dont',
  'about',
  'into',
  'really',
  'please',
  'tell',
  'know',
])

const profileIntentPattern = /(who (are|is) (you|alex)|what do (you|alex) do|where do (you|alex) (live|work)|where (are|is) (you|alex) based|what('?s| is) (your|alex'?s) purpose|what('?s| is) this site for|what is alex welcing|tell me about alex|tell me about yourself)/i
const profileEvidencePattern = /(alex welcing|based in new york|in new york|senior ai product manager|writer, technologist, and designer|writer, technologist|regulated industries|legal tech|healthcare|consulting|work explores|production commits)/i

let archiveCachePromise: Promise<ArchiveDocument[]> | null = null

function getManifestArticles(): ArticleRecord[] {
  if (Array.isArray(articleManifest)) {
    return articleManifest as ArticleRecord[]
  }

  const wrapped = (articleManifest as { default?: unknown }).default
  return Array.isArray(wrapped) ? (wrapped as ArticleRecord[]) : []
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function tokenize(value: string, extraTokens: string[] = []): string[] {
  return Array.from(
    new Set(
      normalizeWhitespace(`${value} ${extraTokens.join(' ')}`)
        .toLowerCase()
        .split(/[^a-z0-9+]+/)
        .filter((token) => token.length > 2 && !stopWords.has(token))
    )
  )
}

function stripMarkdown(value: string): string {
  return value
    .replace(/^import\s.+$/gm, ' ')
    .replace(/^export\s.+$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/[>*_~|]/g, ' ')
}

function splitParagraphs(value: string): string[] {
  return stripMarkdown(value)
    .split(/\n\s*\n+/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter((paragraph) => paragraph.length >= 60)
}

async function walk(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const resolvedPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        return walk(resolvedPath)
      }

      if (!/\.(md|mdx)$/i.test(entry.name)) {
        return []
      }

      return [resolvedPath]
    })
  )

  return nested.flat().sort((left, right) => left.localeCompare(right))
}

function getArticleMetadataByFile(): Map<string, ArticleRecord> {
  return new Map(
    getManifestArticles()
      .filter((article) => article.filename)
      .map((article) => [article.filename as string, article])
  )
}

function createArchiveDocument(filePath: string, rawContent: string, articleByFile: Map<string, ArticleRecord>): ArchiveDocument | null {
  const parsed = matter(rawContent)
  const fileName = basename(filePath)
  const manifestArticle = articleByFile.get(fileName)
  const title = String(parsed.data.title || manifestArticle?.title || basename(filePath, extname(filePath)))
  const slug = String(
    manifestArticle?.slug ||
      parsed.data.slug ||
      basename(filePath, extname(filePath)).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  )
  const description = String(parsed.data.description || manifestArticle?.description || '').trim()
  const keywords = Array.isArray(parsed.data.keywords)
    ? parsed.data.keywords.map((keyword) => String(keyword))
    : manifestArticle?.keywords || []
  const domains = manifestArticle?.domains || []
  const articleType = String(parsed.data.articleType || manifestArticle?.articleType || '').trim() || undefined
  const paragraphs = splitParagraphs(parsed.content)

  if (!paragraphs.length) {
    return null
  }

  return {
    id: relative(process.cwd(), filePath),
    path: relative(process.cwd(), filePath),
    slug,
    title,
    description,
    articleType,
    keywords,
    domains,
    paragraphs,
  }
}

async function loadArchiveDocuments(): Promise<ArchiveDocument[]> {
  const articleByFile = getArticleMetadataByFile()
  const files = (
    await Promise.all(DOC_DIRECTORIES.map((directory) => walk(join(process.cwd(), directory))))
  ).flat()

  const documents = await Promise.all(
    files.map(async (filePath) => {
      const rawContent = await readFile(filePath, 'utf8')
      return createArchiveDocument(filePath, rawContent, articleByFile)
    })
  )

  return documents.filter((document): document is ArchiveDocument => Boolean(document))
}

async function getArchiveDocuments(): Promise<ArchiveDocument[]> {
  if (!archiveCachePromise) {
    archiveCachePromise = loadArchiveDocuments()
  }

  return archiveCachePromise
}

function isProfileIntent(query: string): boolean {
  return profileIntentPattern.test(query)
}

function scorePassage(passage: string, query: string, queryTokens: string[], profileIntent: boolean, doc: ArchiveDocument): number {
  const normalizedPassage = normalizeWhitespace(passage)
  const lowerPassage = normalizedPassage.toLowerCase()
  const lowerQuery = query.trim().toLowerCase()

  let score = 0

  for (const token of queryTokens) {
    if (lowerPassage.includes(token)) {
      score += Math.min(10, Math.max(3, token.length + 1))
    }
  }

  if (lowerQuery && lowerPassage.includes(lowerQuery)) {
    score += 30
  }

  if (profileIntent) {
    if (profileEvidencePattern.test(normalizedPassage)) {
      score += 32
    }

    if (/alex welcing/i.test(normalizedPassage)) {
      score += 12
    }

    if (/new york/i.test(normalizedPassage)) {
      score += 10
    }

    if (/the-reaching-anthology\.md$/i.test(doc.path)) {
      score += 8
    }
  }

  if (doc.description && lowerPassage.includes(doc.description.toLowerCase())) {
    score += 6
  }

  return score
}

function createSnippet(passage: string, maxLength = 420): string {
  const normalized = normalizeWhitespace(passage)

  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 4).trim()} ...`
}

function rankMatches(documents: ArchiveDocument[], query: string, profileIntent: boolean): PassageMatch[] {
  const queryTokens = tokenize(query, profileIntent ? ['alex', 'welcing', 'profile'] : [])

  return documents
    .flatMap((doc) =>
      doc.paragraphs.map((passage) => ({
        doc,
        passage,
        score: scorePassage(passage, query, queryTokens, profileIntent, doc),
      }))
    )
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
}

function dedupeFacts(matches: PassageMatch[]): string[] {
  const facts: string[] = []
  const seen = new Set<string>()

  for (const match of matches) {
    const snippet = createSnippet(match.passage, 260)
    const key = snippet.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    facts.push(snippet)

    if (facts.length >= 4) {
      break
    }
  }

  return facts
}

function buildContext(matches: PassageMatch[], profileFacts: string[]): string {
  const sections: string[] = []

  if (profileFacts.length) {
    sections.push(
      [
        'Canonical profile evidence:',
        ...profileFacts.map((fact, index) => `${index + 1}. ${fact}`),
      ].join('\n')
    )
  }

  const uniqueMatches = new Map<string, PassageMatch>()
  for (const match of matches) {
    if (!uniqueMatches.has(match.doc.slug)) {
      uniqueMatches.set(match.doc.slug, match)
    }
    if (uniqueMatches.size >= 6) {
      break
    }
  }

  for (const match of Array.from(uniqueMatches.values())) {
    sections.push(
      [
        `Title: ${match.doc.title}`,
        `Slug: ${match.doc.slug}`,
        `Path: ${match.doc.path}`,
        `Type: ${match.doc.articleType || 'document'}`,
        `Description: ${match.doc.description || 'No description available.'}`,
        `Matched passage: ${createSnippet(match.passage)}`,
      ].join('\n')
    )
  }

  return sections.join('\n\n---\n\n')
}

function buildInstantResults(matches: PassageMatch[]): InstantAnswerItem[] {
  const deduped = new Map<string, InstantAnswerItem>()

  for (const match of matches) {
    if (deduped.has(match.doc.slug)) {
      continue
    }

    deduped.set(match.doc.slug, {
      slug: match.doc.slug,
      title: match.doc.title,
      description: match.doc.description || 'Relevant archive match.',
      snippet: createSnippet(match.passage, 280),
      articleType: match.doc.articleType,
      score: match.score,
      keywords: match.doc.keywords,
      domains: match.doc.domains,
    })

    if (deduped.size >= 5) {
      break
    }
  }

  return Array.from(deduped.values())
}

export async function queryLocalArchive(query: string): Promise<LocalArchiveQueryResult> {
  const documents = await getArchiveDocuments()
  const profileIntent = isProfileIntent(query)
  const matches = rankMatches(documents, query, profileIntent)
  const profileFacts = profileIntent
    ? dedupeFacts(matches.filter((match) => profileEvidencePattern.test(match.passage)))
    : []

  return {
    profileIntent,
    profileFacts,
    context: buildContext(matches, profileFacts),
    instantResults: buildInstantResults(matches),
  }
}

export function resetArchiveDocumentCache() {
  archiveCachePromise = null
}

export function detectProfileIntent(query: string): boolean {
  return isProfileIntent(query)
}