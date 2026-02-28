import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase config' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  if (req.method === 'GET') {
    const { q, limit = '20' } = req.query
    const maxResults = Math.min(parseInt(String(limit), 10) || 20, 100)

    let query = supabase
      .from('corpus_entry')
      .select('id, url, title, summary, source_type, metadata, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(maxResults)

    if (q) {
      query = query.textSearch('fts', String(q), { type: 'websearch' })
    }

    const { data, error } = await query

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ entries: data, count: data?.length ?? 0 })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
