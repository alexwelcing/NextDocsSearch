-- Article Art Options Table
-- Stores multiple AI-generated art options per article for selection
-- Migration: 20260114000000_article_art_options.sql

-- Create enum for generation status
CREATE TYPE art_generation_status AS ENUM (
  'pending',      -- Request submitted to FAL queue
  'processing',   -- FAL is generating the image
  'completed',    -- Generation successful, image available
  'failed',       -- Generation failed
  'selected'      -- This image was chosen as the article's artwork
);

-- Create enum for model tier (for cost tracking)
CREATE TYPE model_tier AS ENUM (
  'fast',         -- Quick iterations, lower cost
  'balanced',     -- Good quality/speed tradeoff
  'quality',      -- Best results, higher cost
  'artistic',     -- Stylized outputs
  'experimental'  -- New/unique models
);

-- Main table for storing generated art options
CREATE TABLE IF NOT EXISTS public.article_art_options (
  id BIGSERIAL PRIMARY KEY,

  -- Article reference
  article_slug TEXT NOT NULL,

  -- Generation batch (groups 3 options together)
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  option_number INTEGER NOT NULL CHECK (option_number BETWEEN 1 AND 3),

  -- Model info
  model_id TEXT NOT NULL,           -- e.g., "fal-ai/flux/schnell"
  model_name TEXT NOT NULL,         -- Human readable name
  model_tier model_tier NOT NULL,

  -- Prompt used
  prompt TEXT NOT NULL,
  negative_prompt TEXT,

  -- Model parameters (stored as JSON)
  model_params JSONB DEFAULT '{}',

  -- Generation tracking
  fal_request_id TEXT,              -- FAL queue request ID
  status art_generation_status DEFAULT 'pending',
  error_message TEXT,

  -- Result
  image_url TEXT,                   -- FAL CDN URL (temporary)
  storage_path TEXT,                -- Supabase Storage path (permanent)
  thumbnail_path TEXT,              -- Smaller version for previews

  -- Image metadata
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  seed BIGINT,                      -- For reproducibility

  -- Cost tracking
  estimated_cost_usd DECIMAL(10, 6),
  actual_cost_usd DECIMAL(10, 6),
  generation_time_ms INTEGER,

  -- Selection
  is_selected BOOLEAN DEFAULT FALSE,
  selected_at TIMESTAMP WITH TIME ZONE,
  selected_by TEXT,                 -- Admin who selected

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create unique constraint: only one selected image per article
CREATE UNIQUE INDEX idx_article_art_options_selected
ON public.article_art_options (article_slug)
WHERE is_selected = TRUE;

-- Indexes for common queries
CREATE INDEX idx_article_art_options_slug ON public.article_art_options(article_slug);
CREATE INDEX idx_article_art_options_batch ON public.article_art_options(batch_id);
CREATE INDEX idx_article_art_options_status ON public.article_art_options(status);
CREATE INDEX idx_article_art_options_model ON public.article_art_options(model_id);
CREATE INDEX idx_article_art_options_created ON public.article_art_options(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_article_art_options_updated_at
BEFORE UPDATE ON public.article_art_options
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.article_art_options ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (public gallery)
CREATE POLICY "Public read access for article art options"
ON public.article_art_options
FOR SELECT
TO public
USING (true);

-- Policy: Service role can insert (generation script)
CREATE POLICY "Service role can insert article art options"
ON public.article_art_options
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Service role can update (status updates, selection)
CREATE POLICY "Service role can update article art options"
ON public.article_art_options
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- GENERATION BATCHES TABLE
-- Tracks overall generation jobs
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.art_generation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch metadata
  name TEXT,                        -- Optional batch name
  description TEXT,

  -- Scope
  article_slugs TEXT[],             -- Which articles are included
  total_articles INTEGER NOT NULL DEFAULT 0,

  -- Models used
  models_used TEXT[] NOT NULL,      -- Array of model IDs

  -- Progress tracking
  total_generations INTEGER NOT NULL DEFAULT 0,
  completed_generations INTEGER DEFAULT 0,
  failed_generations INTEGER DEFAULT 0,

  -- Cost tracking
  estimated_total_cost_usd DECIMAL(10, 4),
  actual_total_cost_usd DECIMAL(10, 4) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_art_generation_batches_updated_at
BEFORE UPDATE ON public.art_generation_batches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- HELPER VIEWS
-- ═══════════════════════════════════════════════════════════════

-- View: Articles awaiting art selection (have options but none selected)
CREATE OR REPLACE VIEW public.articles_pending_selection AS
SELECT
  article_slug,
  batch_id,
  COUNT(*) as option_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  MIN(created_at) as first_generated,
  MAX(completed_at) as last_completed
FROM public.article_art_options
WHERE NOT EXISTS (
  SELECT 1 FROM public.article_art_options aao2
  WHERE aao2.article_slug = article_art_options.article_slug
  AND aao2.is_selected = TRUE
)
GROUP BY article_slug, batch_id
HAVING COUNT(*) FILTER (WHERE status = 'completed') >= 1;

-- View: Selected artwork per article
CREATE OR REPLACE VIEW public.article_selected_artwork AS
SELECT
  article_slug,
  model_id,
  model_name,
  prompt,
  storage_path,
  thumbnail_path,
  width,
  height,
  selected_at
FROM public.article_art_options
WHERE is_selected = TRUE;

-- View: Model usage statistics
CREATE OR REPLACE VIEW public.art_model_stats AS
SELECT
  model_id,
  model_name,
  model_tier,
  COUNT(*) as total_generations,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE is_selected = TRUE) as times_selected,
  ROUND(AVG(generation_time_ms)::numeric, 0) as avg_generation_time_ms,
  SUM(actual_cost_usd) as total_cost_usd
FROM public.article_art_options
GROUP BY model_id, model_name, model_tier
ORDER BY total_generations DESC;

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function: Select an art option for an article
CREATE OR REPLACE FUNCTION select_article_artwork(
  p_article_slug TEXT,
  p_option_id BIGINT,
  p_selected_by TEXT DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Deselect any currently selected option for this article
  UPDATE public.article_art_options
  SET is_selected = FALSE, selected_at = NULL, selected_by = NULL
  WHERE article_slug = p_article_slug AND is_selected = TRUE;

  -- Select the new option
  UPDATE public.article_art_options
  SET
    is_selected = TRUE,
    selected_at = NOW(),
    selected_by = p_selected_by,
    status = 'selected'
  WHERE id = p_option_id AND article_slug = p_article_slug;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function: Get art options for an article
CREATE OR REPLACE FUNCTION get_article_art_options(p_article_slug TEXT)
RETURNS TABLE (
  id BIGINT,
  option_number INTEGER,
  model_name TEXT,
  model_tier model_tier,
  storage_path TEXT,
  thumbnail_path TEXT,
  status art_generation_status,
  is_selected BOOLEAN,
  generation_time_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    aao.id,
    aao.option_number,
    aao.model_name,
    aao.model_tier,
    aao.storage_path,
    aao.thumbnail_path,
    aao.status,
    aao.is_selected,
    aao.generation_time_ms
  FROM public.article_art_options aao
  WHERE aao.article_slug = p_article_slug
  ORDER BY aao.batch_id DESC, aao.option_number;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION select_article_artwork TO service_role;
GRANT EXECUTE ON FUNCTION get_article_art_options TO public;

-- ═══════════════════════════════════════════════════════════════
-- STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════

-- Create storage bucket for article artwork
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'article-artwork',
  'article-artwork',
  true,
  10485760,  -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public read access
CREATE POLICY "Public read access for article artwork"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'article-artwork');

-- Policy: Service role can upload
CREATE POLICY "Service role can upload article artwork"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'article-artwork');

-- Policy: Service role can update
CREATE POLICY "Service role can update article artwork"
ON storage.objects
FOR UPDATE
TO service_role
USING (bucket_id = 'article-artwork');

-- Policy: Service role can delete
CREATE POLICY "Service role can delete article artwork"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'article-artwork');
