/**
 * Corpus Ingestion Pipeline
 *
 * Fetches, parses, chunks, embeds, and stores external knowledge sources.
 * Supports PDF documents and web pages. Called automatically when Ship AI
 * discovers a source worth absorbing, or manually via the ingest API.
 *
 * Pipeline: URL → fetch → parse → chunk → summarize → embed → store
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import type { LLMProvider } from './llm-provider'

// ── Types ─────────────────────────────────────────────────────

export interface IngestRequest {
  url: string
  title?: string
  sourceType?: 'discovered' | 'curated' | 'research'
  discoveredFromQuery?: string
  discoveredInChatId?: string
  metadata?: Record<string, unknown>
}

export interface IngestResult {
  entriesCreated: number
  url: string
  title: string
  chunks: number
  skipped: boolean
  reason?: string
}

interface ParsedDocument {
  title: string
  content: string
  contentType: 'pdf' | 'html' | 'text'
  byteLength: number
}

interface Chunk {
  content: string
  heading: string | null
  index: number
  tokenEstimate: number
}

// ── Constants ─────────────────────────────────────────────────

const MAX_FETCH_SIZE = 10 * 1024 * 1024 // 10MB
const FETCH_TIMEOUT = 30_000 // 30s
const TARGET_CHUNK_TOKENS = 400
const MAX_CHUNK_TOKENS = 800
const MIN_CHUNK_TOKENS = 50

// ── Supabase client ───────────────────────────────────────────

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase environment variables')
  return createClient(url, key)
}

// ── Fetch ─────────────────────────────────────────────────────

async function fetchDocument(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ShipAI-Corpus-Ingest/1.0',
        Accept: 'application/pdf, text/html, text/plain, */*',
      },
    })

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10)

    if (contentLength > MAX_FETCH_SIZE) {
      throw new Error(`Document too large: ${contentLength} bytes (max ${MAX_FETCH_SIZE})`)
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_FETCH_SIZE) {
      throw new Error(`Document too large: ${arrayBuffer.byteLength} bytes`)
    }

    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ── Parse ─────────────────────────────────────────────────────

async function parsePDF(buffer: Buffer, fallbackTitle: string): Promise<ParsedDocument> {
  // Dynamic import to avoid bundling pdf-parse in client code
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  const textResult = await parser.getText()
  const info = await parser.getInfo().catch(() => null)
  await parser.destroy()

  return {
    title: info?.info?.Title || fallbackTitle,
    content: textResult.text,
    contentType: 'pdf',
    byteLength: buffer.byteLength,
  }
}

function parseHTML(buffer: Buffer, fallbackTitle: string): ParsedDocument {
  const html = buffer.toString('utf-8')

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || fallbackTitle

  // Strip HTML to plain text — progressive reduction
  let text = html
    // Remove scripts, styles, nav, footer
    .replace(/<(script|style|nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert block elements to newlines
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return {
    title,
    content: text,
    contentType: 'html',
    byteLength: buffer.byteLength,
  }
}

function parsePlainText(buffer: Buffer, fallbackTitle: string): ParsedDocument {
  const text = buffer.toString('utf-8')
  // Use first line as title if short enough
  const firstLine = text.split('\n')[0]?.trim() || fallbackTitle
  const title = firstLine.length <= 120 ? firstLine : fallbackTitle

  return {
    title,
    content: text,
    contentType: 'text',
    byteLength: buffer.byteLength,
  }
}

async function parseDocument(
  buffer: Buffer,
  contentType: string,
  fallbackTitle: string
): Promise<ParsedDocument> {
  if (contentType.includes('pdf')) {
    return parsePDF(buffer, fallbackTitle)
  }
  if (contentType.includes('html')) {
    return parseHTML(buffer, fallbackTitle)
  }
  return parsePlainText(buffer, fallbackTitle)
}

// ── Chunk ─────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token for English text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Semantic chunking — splits on natural document boundaries:
 * 1. First try splitting on headings (markdown-style or newline patterns)
 * 2. Then split long sections on paragraph boundaries
 * 3. Finally, hard-split on sentence boundaries if still too long
 */
export function chunkDocument(content: string): Chunk[] {
  const chunks: Chunk[] = []

  // Split on heading patterns (markdown or uppercase lines preceded by blank lines)
  const sections = content.split(/\n(?=#{1,4}\s|[A-Z][A-Z\s]{5,}$)/m)

  for (const section of sections) {
    const trimmed = section.trim()
    if (!trimmed) continue

    // Extract heading if present
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)/)
    const heading = headingMatch?.[2]?.trim() ?? null
    const body = headingMatch ? trimmed.slice(headingMatch[0].length).trim() : trimmed
    const textForChunk = heading ? `${heading}\n${body}` : body

    const tokens = estimateTokens(textForChunk)

    if (tokens <= MAX_CHUNK_TOKENS) {
      if (tokens >= MIN_CHUNK_TOKENS) {
        chunks.push({
          content: textForChunk,
          heading,
          index: chunks.length,
          tokenEstimate: tokens,
        })
      }
      continue
    }

    // Section is too long — split on paragraph boundaries
    const paragraphs = body.split(/\n\n+/)
    let buffer = heading ? `${heading}\n` : ''
    let bufferHeading = heading

    for (const para of paragraphs) {
      const combined = buffer + (buffer ? '\n\n' : '') + para
      const combinedTokens = estimateTokens(combined)

      if (combinedTokens > TARGET_CHUNK_TOKENS && estimateTokens(buffer) >= MIN_CHUNK_TOKENS) {
        chunks.push({
          content: buffer.trim(),
          heading: bufferHeading,
          index: chunks.length,
          tokenEstimate: estimateTokens(buffer),
        })
        buffer = para
        bufferHeading = null
      } else {
        buffer = combined
      }
    }

    // Flush remaining buffer
    if (estimateTokens(buffer) >= MIN_CHUNK_TOKENS) {
      chunks.push({
        content: buffer.trim(),
        heading: bufferHeading,
        index: chunks.length,
        tokenEstimate: estimateTokens(buffer),
      })
    }
  }

  return chunks
}

// ── Relevance Gate ────────────────────────────────────────────

/**
 * Ask the LLM whether this document is worth deep-ingesting.
 * Returns a 1-5 score and a one-line rationale.
 */
async function evaluateRelevance(
  title: string,
  preview: string,
  query: string | undefined,
  llm: LLMProvider
): Promise<{ score: number; rationale: string }> {
  const prompt = `You are evaluating whether a document is worth adding to a knowledge base focused on AI, technology futures, and professional expertise.

Title: "${title}"
Context query: "${query ?? 'none'}"
Preview (first 500 chars):
${preview.slice(0, 500)}

Rate relevance 1-5:
1 = Irrelevant (spam, off-topic, marketing)
2 = Tangential (loosely related)
3 = Moderately relevant (related domain)
4 = Highly relevant (directly useful)
5 = Essential (core knowledge)

Respond ONLY with JSON: {"score": N, "rationale": "one sentence"}`

  try {
    const response = await llm.createChatCompletion({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 80,
      temperature: 0,
      stream: false,
    })

    if (!response.ok) return { score: 3, rationale: 'Evaluation failed, defaulting to moderate' }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(content)
    return {
      score: Math.min(5, Math.max(1, parsed.score ?? 3)),
      rationale: parsed.rationale ?? 'No rationale provided',
    }
  } catch {
    return { score: 3, rationale: 'Evaluation failed, defaulting to moderate' }
  }
}

// ── Summarize ─────────────────────────────────────────────────

async function summarizeChunk(
  chunk: string,
  docTitle: string,
  llm: LLMProvider
): Promise<string> {
  try {
    const response = await llm.createChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'Summarize the following section in 1-2 sentences. Focus on key claims, data, or insights. Be factual.',
        },
        {
          role: 'user',
          content: `Document: "${docTitle}"\n\nSection:\n${chunk.slice(0, 1500)}`,
        },
      ],
      maxTokens: 120,
      temperature: 0.2,
      stream: false,
    })

    if (!response.ok) return chunk.slice(0, 200)

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() ?? chunk.slice(0, 200)
  } catch {
    return chunk.slice(0, 200)
  }
}

// ── Main Pipeline ─────────────────────────────────────────────

export async function ingestDocument(
  request: IngestRequest,
  llm: LLMProvider
): Promise<IngestResult> {
  const supabase = getSupabase()

  // 1. Check for duplicate URL
  const checksum = createHash('sha256').update(request.url).digest('hex')
  const { data: existing } = await supabase
    .from('corpus_entry')
    .select('id, checksum')
    .eq('url', request.url)
    .maybeSingle()

  if (existing?.checksum === checksum) {
    return {
      entriesCreated: 0,
      url: request.url,
      title: request.title ?? request.url,
      chunks: 0,
      skipped: true,
      reason: 'Document already ingested (checksum match)',
    }
  }

  // 2. Fetch
  const { buffer, contentType } = await fetchDocument(request.url)

  // 3. Parse
  const doc = await parseDocument(buffer, contentType, request.title ?? request.url)
  const contentChecksum = createHash('sha256').update(doc.content).digest('hex')

  // Skip if content hasn't changed
  if (existing?.checksum === contentChecksum) {
    return {
      entriesCreated: 0,
      url: request.url,
      title: doc.title,
      chunks: 0,
      skipped: true,
      reason: 'Content unchanged since last ingestion',
    }
  }

  // 4. Relevance gate — skip low-quality sources
  const relevance = await evaluateRelevance(
    doc.title,
    doc.content,
    request.discoveredFromQuery,
    llm
  )

  if (relevance.score < 2) {
    return {
      entriesCreated: 0,
      url: request.url,
      title: doc.title,
      chunks: 0,
      skipped: true,
      reason: `Below relevance threshold (score: ${relevance.score}/5 — ${relevance.rationale})`,
    }
  }

  // 5. Chunk
  const chunks = chunkDocument(doc.content)

  if (chunks.length === 0) {
    return {
      entriesCreated: 0,
      url: request.url,
      title: doc.title,
      chunks: 0,
      skipped: true,
      reason: 'No meaningful content extracted',
    }
  }

  // 6. Embed and store each chunk
  let entriesCreated = 0

  // Store parent entry (full document summary)
  const docSummary = await summarizeChunk(doc.content.slice(0, 3000), doc.title, llm)
  const parentEmbeddingText = `${doc.title}. ${docSummary}`
  const { embedding: parentEmbedding } = await llm.createEmbedding(parentEmbeddingText)

  const { data: parentId } = await supabase.rpc('upsert_corpus_entry', {
    p_url: request.url,
    p_title: doc.title,
    p_content: docSummary,
    p_summary: docSummary,
    p_source_type: request.sourceType ?? 'discovered',
    p_discovered_in_chat_id: request.discoveredInChatId ?? null,
    p_discovered_from_query: request.discoveredFromQuery ?? null,
    p_metadata: {
      ...request.metadata,
      contentType: doc.contentType,
      byteLength: doc.byteLength,
      chunkCount: chunks.length,
      relevanceScore: relevance.score,
      relevanceRationale: relevance.rationale,
      ingestedAt: new Date().toISOString(),
    },
    p_embedding: parentEmbedding,
  })

  if (parentId) entriesCreated++

  // Store individual chunks with unique URLs
  for (const chunk of chunks) {
    try {
      const summary = chunks.length > 3
        ? await summarizeChunk(chunk.content, doc.title, llm)
        : chunk.content.slice(0, 200)

      const embeddingText = `${chunk.heading ?? doc.title}. ${summary}`
      const { embedding } = await llm.createEmbedding(embeddingText)

      const chunkUrl = `${request.url}#chunk-${chunk.index}`

      await supabase.rpc('upsert_corpus_entry', {
        p_url: chunkUrl,
        p_title: chunk.heading ? `${doc.title} — ${chunk.heading}` : doc.title,
        p_content: chunk.content,
        p_summary: summary,
        p_source_type: request.sourceType ?? 'discovered',
        p_discovered_in_chat_id: request.discoveredInChatId ?? null,
        p_discovered_from_query: request.discoveredFromQuery ?? null,
        p_metadata: {
          parentUrl: request.url,
          chunkIndex: chunk.index,
          tokenEstimate: chunk.tokenEstimate,
          contentType: doc.contentType,
        },
        p_embedding: embedding,
      })

      entriesCreated++
    } catch (err) {
      console.error(`Failed to store chunk ${chunk.index} of ${request.url}:`, err)
    }
  }

  // Update parent checksum now that all chunks are stored
  if (parentId) {
    await supabase
      .from('corpus_entry')
      .update({ checksum: contentChecksum })
      .eq('id', parentId)
  }

  return {
    entriesCreated,
    url: request.url,
    title: doc.title,
    chunks: chunks.length,
    skipped: false,
  }
}
