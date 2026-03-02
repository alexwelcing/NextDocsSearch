/**
 * POST /api/corpus/ingest — Deep ingestion endpoint
 *
 * Accepts a URL (web page or plain text) and fetches + parses it,
 * or accepts pre-parsed content directly (e.g. PDF text extracted externally).
 * Chunks semantically, evaluates relevance, and stores each chunk
 * with embeddings in the corpus_entry table.
 *
 * Pre-parsed content example:
 *   { "url": "https://example.com/paper.pdf", "title": "Paper Title", "content": "extracted text..." }
 *
 * Requires admin API key via x-admin-api-key header.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdminAuth } from '@/lib/auth/admin-auth'
import { createLLMProvider } from '@/lib/ai/llm-provider'
import { ingestDocument, type IngestRequest, type IngestResult } from '@/lib/ai/corpus-ingest'

interface IngestResponse {
  success: boolean
  results: IngestResult[]
  error?: string
}

export default withAdminAuth<IngestResponse>(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      results: [],
      error: 'Method not allowed',
    })
  }

  const body = req.body

  // Accept single URL or batch of URLs
  const requests: IngestRequest[] = Array.isArray(body.urls)
    ? body.urls.map((entry: string | IngestRequest) =>
        typeof entry === 'string' ? { url: entry } : entry
      )
    : body.url
      ? [
          {
            url: body.url,
            title: body.title,
            content: body.content,
            sourceType: body.sourceType,
            discoveredFromQuery: body.discoveredFromQuery,
            metadata: body.metadata,
          },
        ]
      : []

  if (requests.length === 0) {
    return res.status(400).json({
      success: false,
      results: [],
      error: 'Missing url or urls in request body',
    })
  }

  // Validate URLs
  for (const req of requests) {
    try {
      new URL(req.url)
    } catch {
      return res.status(400).json({
        success: false,
        results: [],
        error: `Invalid URL: ${req.url}`,
      })
    }
  }

  const llm = createLLMProvider()
  const results: IngestResult[] = []

  for (const request of requests) {
    try {
      const result = await ingestDocument(request, llm)
      results.push(result)
    } catch (err) {
      console.error(`Ingestion failed for ${request.url}:`, err)
      results.push({
        entriesCreated: 0,
        url: request.url,
        title: request.title ?? request.url,
        chunks: 0,
        skipped: false,
        reason: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const totalCreated = results.reduce((sum, r) => sum + r.entriesCreated, 0)

  return res.status(200).json({
    success: totalCreated > 0 || results.every((r) => r.skipped),
    results,
  })
})
