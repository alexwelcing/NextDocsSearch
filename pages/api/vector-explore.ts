import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { createLLMProvider } from '@/lib/ai/llm-provider'

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
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase config' })
  }

  const { query } = req.body
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing query' })
  }

  try {
    const llm = createLLMProvider()
    const supabase = createClient(supabaseUrl, supabaseKey)

    const sanitized = query.trim()
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

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    const results: VectorExploreResult[] = (data ?? []).map(
      (r: Record<string, unknown>) => ({
        id: r.id,
        slug: r.slug,
        heading: r.heading,
        content: String(r.content).slice(0, 200),
        source_type: r.source_type,
        rrf_score: r.rrf_score,
      })
    )

    return res.status(200).json({
      results,
      query: sanitized,
      embedding: embedding.slice(0, 3),
    } satisfies VectorExploreResponse)
  } catch (err) {
    console.error('Vector explore error:', err)
    return res.status(500).json({ error: 'Search failed' })
  }
}
