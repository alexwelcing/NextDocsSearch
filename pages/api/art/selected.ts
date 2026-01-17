import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API: Get Selected Article Artwork
 *
 * GET /api/art/selected?slug=article-slug
 * Returns the selected artwork for an article (or null if none selected)
 *
 * Used by the frontend to display article images.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Article slug is required' });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    const { data, error } = await supabase
      .from('article_art_options')
      .select(`
        id,
        model_name,
        model_tier,
        storage_path,
        image_url,
        width,
        height,
        prompt
      `)
      .eq('article_slug', slug)
      .eq('is_selected', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch artwork' });
    }

    if (!data) {
      return res.status(200).json({
        hasArtwork: false,
        artwork: null
      });
    }

    // Get public URL for storage path
    let publicUrl = data.image_url;
    if (data.storage_path) {
      const { data: urlData } = supabase.storage
        .from('media')
        .getPublicUrl(data.storage_path);
      publicUrl = urlData?.publicUrl || data.image_url;
    }

    return res.status(200).json({
      hasArtwork: true,
      artwork: {
        id: data.id,
        url: publicUrl,
        width: data.width,
        height: data.height,
        modelName: data.model_name,
        modelTier: data.model_tier,
        prompt: data.prompt,
      },
    });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
