import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  ArticleMedia,
  ArticleMediaWithUrl,
  ArticleMediaResponse,
  STORAGE_CONFIG,
} from '@/types/article-media';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * GET /api/media/[slug]
 * Retrieves all media assets for a given article slug
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticleMediaResponse>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      media: [],
      count: 0,
      error: 'Method not allowed',
    });
  }

  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Get article slug from query
    const { slug } = req.query;

    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({
        success: false,
        media: [],
        count: 0,
        error: 'Article slug is required',
      });
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Query media using the helper function
    const { data: mediaData, error: mediaError } = await supabase.rpc(
      'get_article_media',
      { p_article_slug: slug }
    );

    if (mediaError) {
      console.error('Error fetching article media:', mediaError);
      return res.status(500).json({
        success: false,
        media: [],
        count: 0,
        error: 'Failed to fetch article media',
      });
    }

    // Generate public URLs for each media item
    const mediaWithUrls: ArticleMediaWithUrl[] = await Promise.all(
      (mediaData || []).map(async (media: ArticleMedia) => {
        const bucket =
          media.media_type === 'image'
            ? STORAGE_CONFIG.buckets.images
            : STORAGE_CONFIG.buckets.videos;

        // Get public URL from Supabase Storage
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(media.storage_path);

        const publicUrl = urlData.publicUrl;

        // If video, also get thumbnail URL
        let thumbnailUrl: string | undefined;
        if (media.media_type === 'video' && media.thumbnail_path) {
          const { data: thumbData } = supabase.storage
            .from(STORAGE_CONFIG.buckets.images)
            .getPublicUrl(media.thumbnail_path);
          thumbnailUrl = thumbData.publicUrl;
        }

        return {
          ...media,
          public_url: publicUrl,
          thumbnail_url: thumbnailUrl,
        };
      })
    );

    return res.status(200).json({
      success: true,
      media: mediaWithUrls,
      count: mediaWithUrls.length,
    });
  } catch (error) {
    console.error('Unexpected error in media API:', error);
    return res.status(500).json({
      success: false,
      media: [],
      count: 0,
      error: 'Internal server error',
    });
  }
}
