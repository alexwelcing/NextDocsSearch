-- ═══════════════════════════════════════════════════════════════
-- CORPUS INGESTION LOG
-- Tracks deep ingestion pipeline runs for observability,
-- debugging, and corpus health monitoring.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.corpus_ingestion_log (
  id bigserial PRIMARY KEY,
  url text NOT NULL,
  title text,
  source_type text DEFAULT 'discovered',
  status text NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed | skipped
  chunks_created int DEFAULT 0,
  entries_created int DEFAULT 0,
  relevance_score smallint,                -- 1-5 from LLM evaluation
  relevance_rationale text,
  content_type text,                       -- pdf | html | text
  byte_length int,
  error_message text,
  discovered_from_query text,
  metadata jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.corpus_ingestion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ingestion log" ON public.corpus_ingestion_log
  FOR SELECT TO public USING (true);

CREATE POLICY "Service write ingestion log" ON public.corpus_ingestion_log
  FOR ALL TO service_role USING (true);

-- Index for querying recent ingestions and failures
CREATE INDEX idx_ingestion_log_status ON public.corpus_ingestion_log(status);
CREATE INDEX idx_ingestion_log_created ON public.corpus_ingestion_log(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- Add parent_url column to corpus_entry for chunk→parent linking
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.corpus_entry
  ADD COLUMN IF NOT EXISTS parent_url text;

CREATE INDEX IF NOT EXISTS idx_corpus_entry_parent_url
  ON public.corpus_entry(parent_url) WHERE parent_url IS NOT NULL;
