-- ═══════════════════════════════════════════════════════════════
-- CORPUS AND FULL-TEXT SEARCH
-- Ship AI knowledge corpus + hybrid search infrastructure
-- ═══════════════════════════════════════════════════════════════

-- Library corpus table for AI-discovered external sources
CREATE TABLE public.corpus_entry (
  id bigserial PRIMARY KEY,
  url text,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  source_type text NOT NULL DEFAULT 'discovered',
  discovered_in_chat_id text,
  discovered_from_query text,
  metadata jsonb DEFAULT '{}',
  token_count int,
  embedding vector(1536),
  checksum text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.corpus_entry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read corpus" ON public.corpus_entry
  FOR SELECT TO public USING (true);

CREATE POLICY "Service write corpus" ON public.corpus_entry
  FOR ALL TO service_role USING (true);

-- Unique constraint for URL deduplication
CREATE UNIQUE INDEX idx_corpus_entry_url
  ON public.corpus_entry(url) WHERE url IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- FULL-TEXT SEARCH INDEXES
-- ═══════════════════════════════════════════════════════════════

-- FTS column on existing article sections for BM25-style search
ALTER TABLE public.nods_page_section
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_nods_page_section_fts
  ON public.nods_page_section USING gin(fts);

-- FTS column on corpus entries
ALTER TABLE public.corpus_entry
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_corpus_entry_fts
  ON public.corpus_entry USING gin(fts);

-- ═══════════════════════════════════════════════════════════════
-- HYBRID SEARCH FUNCTION
-- BM25 full-text + vector semantic with Reciprocal Rank Fusion
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_count int DEFAULT 20,
  rrf_k int DEFAULT 60,
  fts_weight float DEFAULT 1.0,
  vector_weight float DEFAULT 1.0,
  min_content_length int DEFAULT 50
)
RETURNS TABLE (
  id bigint,
  page_id bigint,
  slug text,
  heading text,
  content text,
  source_type text,
  fts_rank float,
  vector_rank float,
  rrf_score float
)
LANGUAGE sql
AS $$
  WITH fts_results AS (
    SELECT
      s.id, s.page_id, s.slug, s.heading, s.content,
      'article'::text AS source_type,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(s.fts, websearch_to_tsquery('english', query_text)) DESC
      ) AS rank
    FROM nods_page_section s
    WHERE s.fts @@ websearch_to_tsquery('english', query_text)
      AND length(s.content) >= min_content_length
    LIMIT match_count * 2
  ),
  vector_results AS (
    SELECT
      s.id, s.page_id, s.slug, s.heading, s.content,
      'article'::text AS source_type,
      ROW_NUMBER() OVER (
        ORDER BY s.embedding <#> query_embedding
      ) AS rank
    FROM nods_page_section s
    WHERE length(s.content) >= min_content_length
      AND (s.embedding <#> query_embedding) * -1 > 0.5
    LIMIT match_count * 2
  ),
  corpus_fts AS (
    SELECT
      c.id, NULL::bigint AS page_id, NULL::text AS slug,
      c.title AS heading, c.content, c.source_type,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(c.fts, websearch_to_tsquery('english', query_text)) DESC
      ) AS rank
    FROM corpus_entry c
    WHERE c.fts @@ websearch_to_tsquery('english', query_text)
      AND length(c.content) >= min_content_length
    LIMIT match_count
  ),
  corpus_vector AS (
    SELECT
      c.id, NULL::bigint AS page_id, NULL::text AS slug,
      c.title AS heading, c.content, c.source_type,
      ROW_NUMBER() OVER (
        ORDER BY c.embedding <#> query_embedding
      ) AS rank
    FROM corpus_entry c
    WHERE length(c.content) >= min_content_length
      AND c.embedding IS NOT NULL
      AND (c.embedding <#> query_embedding) * -1 > 0.5
    LIMIT match_count
  ),
  all_results AS (
    SELECT id, page_id, slug, heading, content, source_type, rank, 'fts' AS method
      FROM fts_results
    UNION ALL
    SELECT id, page_id, slug, heading, content, source_type, rank, 'vector' AS method
      FROM vector_results
    UNION ALL
    SELECT id, page_id, slug, heading, content, source_type, rank, 'fts' AS method
      FROM corpus_fts
    UNION ALL
    SELECT id, page_id, slug, heading, content, source_type, rank, 'vector' AS method
      FROM corpus_vector
  ),
  scored AS (
    SELECT
      id, page_id, slug, heading, content, source_type,
      COALESCE(
        SUM(CASE WHEN method = 'fts' THEN fts_weight / (rrf_k + rank) END), 0
      ) AS fts_rank,
      COALESCE(
        SUM(CASE WHEN method = 'vector' THEN vector_weight / (rrf_k + rank) END), 0
      ) AS vector_rank,
      SUM(
        CASE WHEN method = 'fts' THEN fts_weight / (rrf_k + rank) ELSE 0 END +
        CASE WHEN method = 'vector' THEN vector_weight / (rrf_k + rank) ELSE 0 END
      ) AS rrf_score
    FROM all_results
    GROUP BY id, page_id, slug, heading, content, source_type
  )
  SELECT id, page_id, slug, heading, content, source_type, fts_rank, vector_rank, rrf_score
  FROM scored
  ORDER BY rrf_score DESC
  LIMIT match_count;
$$;

-- ═══════════════════════════════════════════════════════════════
-- CORPUS UPSERT HELPER
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION upsert_corpus_entry(
  p_url text,
  p_title text,
  p_content text,
  p_summary text,
  p_source_type text,
  p_discovered_in_chat_id text,
  p_discovered_from_query text,
  p_metadata jsonb,
  p_embedding vector(1536)
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  entry_id bigint;
BEGIN
  INSERT INTO public.corpus_entry (
    url, title, content, summary, source_type,
    discovered_in_chat_id, discovered_from_query, metadata, embedding
  )
  VALUES (
    p_url, p_title, p_content, p_summary, p_source_type,
    p_discovered_in_chat_id, p_discovered_from_query, p_metadata, p_embedding
  )
  ON CONFLICT (url) WHERE url IS NOT NULL
  DO UPDATE SET
    content = EXCLUDED.content,
    summary = EXCLUDED.summary,
    metadata = EXCLUDED.metadata,
    embedding = EXCLUDED.embedding,
    updated_at = now()
  RETURNING id INTO entry_id;

  RETURN entry_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION hybrid_search TO public;
GRANT EXECUTE ON FUNCTION upsert_corpus_entry TO service_role;
