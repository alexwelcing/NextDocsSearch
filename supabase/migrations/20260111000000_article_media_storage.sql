-- Create article_media table to store media assets linked to articles
-- Migration: 20260111000000_article_media_storage.sql

-- Create enum for media types
CREATE TYPE media_type AS ENUM ('image', 'video');

-- Create enum for media status
CREATE TYPE media_status AS ENUM ('pending', 'processing', 'ready', 'error');

-- Create article_media table
CREATE TABLE IF NOT EXISTS public.article_media (
  id BIGSERIAL PRIMARY KEY,
  article_slug TEXT NOT NULL,
  media_type media_type NOT NULL,
  storage_path TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Position and transform for desk surface
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  scale FLOAT DEFAULT 1.0,
  rotation FLOAT DEFAULT 0,
  z_index INTEGER DEFAULT 0,

  -- Media metadata
  title TEXT,
  alt_text TEXT,
  caption TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds FLOAT, -- for videos
  thumbnail_path TEXT, -- for videos

  -- Processing status
  status media_status DEFAULT 'ready',
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  CONSTRAINT article_media_article_slug_fkey FOREIGN KEY (article_slug) REFERENCES public.nods_page(path) ON DELETE CASCADE
);

-- Note: If nods_page doesn't use article slug as path, we'll skip the FK constraint
-- and rely on application-level validation instead
ALTER TABLE public.article_media DROP CONSTRAINT IF EXISTS article_media_article_slug_fkey;

-- Create indexes for common queries
CREATE INDEX idx_article_media_slug ON public.article_media(article_slug);
CREATE INDEX idx_article_media_type ON public.article_media(media_type);
CREATE INDEX idx_article_media_created_at ON public.article_media(created_at DESC);
CREATE INDEX idx_article_media_display_order ON public.article_media(article_slug, display_order);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_article_media_updated_at
BEFORE UPDATE ON public.article_media
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.article_media ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read media (public access)
CREATE POLICY "Public read access for article media"
ON public.article_media
FOR SELECT
TO public
USING (true);

-- Policy: Authenticated users can insert media (for admin interface)
CREATE POLICY "Authenticated users can insert article media"
ON public.article_media
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Authenticated users can update media
CREATE POLICY "Authenticated users can update article media"
ON public.article_media
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can delete media
CREATE POLICY "Authenticated users can delete article media"
ON public.article_media
FOR DELETE
TO authenticated
USING (true);

-- Create storage buckets for media
-- Note: Storage bucket creation is done via Supabase Dashboard or Storage API
-- This is a reference for what needs to be created:
--
-- Bucket: article-images
--   - Public: true
--   - File size limit: 10MB
--   - Allowed MIME types: image/webp, image/jpeg, image/png, image/gif
--
-- Bucket: article-videos
--   - Public: true
--   - File size limit: 50MB
--   - Allowed MIME types: video/mp4, video/webm

-- Create helper function to get media for an article
CREATE OR REPLACE FUNCTION get_article_media(p_article_slug TEXT)
RETURNS TABLE (
  id BIGINT,
  article_slug TEXT,
  media_type media_type,
  storage_path TEXT,
  display_order INTEGER,
  position_x FLOAT,
  position_y FLOAT,
  scale FLOAT,
  rotation FLOAT,
  z_index INTEGER,
  title TEXT,
  alt_text TEXT,
  caption TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds FLOAT,
  thumbnail_path TEXT,
  status media_status,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.article_slug,
    am.media_type,
    am.storage_path,
    am.display_order,
    am.position_x,
    am.position_y,
    am.scale,
    am.rotation,
    am.z_index,
    am.title,
    am.alt_text,
    am.caption,
    am.file_size_bytes,
    am.mime_type,
    am.width,
    am.height,
    am.duration_seconds,
    am.thumbnail_path,
    am.status,
    am.created_at
  FROM public.article_media am
  WHERE am.article_slug = p_article_slug
    AND am.status = 'ready'
  ORDER BY am.display_order ASC, am.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_article_media(TEXT) TO public;

COMMENT ON TABLE public.article_media IS 'Stores media assets (images, videos) associated with articles for the desk surface interface';
COMMENT ON FUNCTION get_article_media(TEXT) IS 'Retrieves all ready media assets for a given article slug, ordered by display_order';
