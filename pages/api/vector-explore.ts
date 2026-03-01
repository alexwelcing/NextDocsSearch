import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createLLMProvider } from '@/lib/ai/llm-provider'
import articleManifest from '@/lib/generated/article-manifest.json'

// ── Types ─────────────────────────────────────────────────────

interface ManifestArticle {
  slug: string
  title: string
  description?: string
  keywords?: string[]
  domains?: string[]
}

const manifest = articleManifest as ManifestArticle[]

const validSlugs = new Set(manifest.map((a) => a.slug))

export interface VectorExploreResult {
  id: number
  slug: string | null
  heading: string | null
  content: string
  source_type: string
  rrf_score: number
}

export interface VectorExploreResponse {
  results: VectorExploreResult[]
  query: string
  embedding: number[]
  source: 'hybrid' | 'manifest'
}

// ── Manifest fallback search ──────────────────────────────────
// When the vector DB is empty or unreachable, do a simple
// multi-field text match against the article manifest so the
// graph always has nodes to render.

function manifestSearch(query: string, limit = 15): VectorExploreResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1)

  if (terms.length === 0) return []

  const scored = manifest
    .map((article, idx) => {
      const fields = [
        article.title,
        article.description ?? '',
        ...(article.keywords ?? []),
        ...(article.domains ?? []),
      ]
        .join(' ')
        .toLowerCase()

      let score = 0
      for (const term of terms) {
        // Exact word match
        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
        const matches = fields.match(regex)
        if (matches) {
          score += matches.length * 2
        }
        // Partial match (substring)
        if (fields.includes(term)) {
          score += 1
        }
        // Title match gets extra weight
        if (article.title.toLowerCase().includes(term)) {
          score += 3
        }
      }

      return { article, score, idx }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  if (scored.length === 0) return []

  const maxScore = scored[0].score
  return scored.map((s) => ({
    id: s.idx,
    slug: s.article.slug,
    heading: s.article.title,
    content: (s.article.description ?? '').slice(0, 200),
    source_type: 'article',
    rrf_score: s.score / maxScore,
  }))
}

// ── Handler ───────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { query } = req.body
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query' })
  }

  const sanitized = query.trim()

  // ── Try hybrid vector search first ──────────────────────────

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const llm = createLLMProvider()
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { embedding } = await llm.createEmbedding(sanitized)

      const { data, error } = await supabase.rpc('hybrid_search', {
        query_text: sanitized,
        query_embedding: embedding,
        match_count: 25,
        rrf_k: 60,
        fts_weight: 1.0,
        vector_weight: 1.0,
        min_content_length: 50,
      })

      if (!error) {
        const results: VectorExploreResult[] = (data ?? [])
          .filter(
            (r: Record<string, unknown>) =>
              typeof r.slug === 'string' && validSlugs.has(r.slug)
          )
          .map((r: Record<string, unknown>) => ({
            id: r.id,
            slug: r.slug,
            heading: r.heading,
            content: String(r.content).slice(0, 200),
            source_type: r.source_type,
            rrf_score: r.rrf_score,
          }))

        if (results.length > 0) {
          return res.status(200).json({
            results,
            query: sanitized,
            embedding: embedding.slice(0, 3),
            source: 'hybrid',
          } satisfies VectorExploreResponse)
        }
      }
      // If error or no results, fall through to manifest search
      if (error) {
        console.warn('Hybrid search error, falling back to manifest:', error.message)
      }
    } catch (err) {
      console.warn('Vector search failed, falling back to manifest:', err)
    }
  }

  // ── Fallback: text search against article manifest ──────────

  const fallbackResults = manifestSearch(sanitized)

  return res.status(200).json({
    results: fallbackResults,
    query: sanitized,
    embedding: [],
    source: 'manifest',
  } satisfies VectorExploreResponse)
}
