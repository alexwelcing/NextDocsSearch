import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export interface ArticleImage {
  id: string;
  url: string;
  type: 'media' | 'artwork';
  title?: string;
  alt_text?: string;
  caption?: string;
  width?: number;
  height?: number;
  is_selected?: boolean;
  model_name?: string;
  created_at: string;
}

export interface AllImagesResponse {
  success: boolean;
  images: ArticleImage[];
  selectedImage?: ArticleImage;
  count: number;
  error?: string;
}

/**
 * GET /api/media/all-images?slug=article-slug
 * Retrieves ALL images for an article (both uploaded media and generated artwork)
 * Returns a unified list sorted by creation date
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AllImagesResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      images: [],
      count: 0,
      error: 'Method not allowed',
    });
  }

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const { slug } = req.query;

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({
        success: false,
        images: [],
        count: 0,
        error: 'Article slug is required',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Fetch article media (uploaded images)
    const { data: mediaData, error: mediaError } = await supabase
      .from('article_media')
      .select('*')
      .eq('article_slug', slug)
      .eq('media_type', 'image')
      .eq('status', 'ready')
      .order('created_at', { ascending: true });

    if (mediaError) {
      console.error('Error fetching article media:', mediaError);
    }

    // Fetch generated artwork - prioritize those with storage_path (permanent URLs)
    const { data: artworkData, error: artworkError } = await supabase
      .from('article_art_options')
      .select('*')
      .eq('article_slug', slug)
      .eq('status', 'completed')
      .order('storage_path', { ascending: false, nullsFirst: false }) // Prioritize images with storage_path
      .order('created_at', { ascending: false }); // Then most recent

    if (artworkError) {
      console.error('Error fetching artwork:', artworkError);
    }

    const images: ArticleImage[] = [];
    let selectedImage: ArticleImage | undefined;

    // Process article media
    if (mediaData && mediaData.length > 0) {
      for (const media of mediaData) {
        const { data: urlData } = supabase.storage
          .from('article-images')
          .getPublicUrl(media.storage_path);

        const image: ArticleImage = {
          id: `media-${media.id}`,
          url: urlData.publicUrl,
          type: 'media',
          title: media.title,
          alt_text: media.alt_text,
          caption: media.caption,
          width: media.width,
          height: media.height,
          created_at: media.created_at,
        };

        images.push(image);
      }
    }

    // Process generated artwork
    if (artworkData && artworkData.length > 0) {
      for (const artwork of artworkData) {
        let publicUrl = artwork.image_url;

        // Prefer storage path over temporary FAL URL
        if (artwork.storage_path) {
          const { data: urlData } = supabase.storage
            .from('article-artwork')
            .getPublicUrl(artwork.storage_path);
          publicUrl = urlData?.publicUrl || artwork.image_url;
        }

        const image: ArticleImage = {
          id: `artwork-${artwork.id}`,
          url: publicUrl,
          type: 'artwork',
          title: `Generated with ${artwork.model_name}`,
          alt_text: artwork.prompt,
          caption: artwork.model_tier ? `${artwork.model_tier} tier` : undefined,
          width: artwork.width,
          height: artwork.height,
          is_selected: artwork.is_selected,
          model_name: artwork.model_name,
          created_at: artwork.created_at,
        };

        images.push(image);

        // Track selected image for og:image
        if (artwork.is_selected) {
          selectedImage = image;
        }
      }
    }

    // Sort all images - prioritize artwork with storage_path, then by date
    images.sort((a, b) => {
      // Prioritize artwork over media
      if (a.type === 'artwork' && b.type === 'media') return -1;
      if (a.type === 'media' && b.type === 'artwork') return 1;

      // Within artwork, prioritize those with storage_path (permanent URLs from Supabase)
      if (a.type === 'artwork' && b.type === 'artwork') {
        const aHasStorage = a.url.includes('supabase.co');
        const bHasStorage = b.url.includes('supabase.co');
        if (aHasStorage && !bHasStorage) return -1;
        if (!aHasStorage && bHasStorage) return 1;
      }

      // Finally sort by date (most recent first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // If no image is explicitly selected, auto-select the best one (first in sorted list)
    if (!selectedImage && images.length > 0) {
      selectedImage = images[0];
    }

    return res.status(200).json({
      success: true,
      images,
      selectedImage,
      count: images.length,
    });
  } catch (error) {
    console.error('Unexpected error in all-images API:', error);
    return res.status(500).json({
      success: false,
      images: [],
      count: 0,
      error: 'Internal server error',
    });
  }
}
