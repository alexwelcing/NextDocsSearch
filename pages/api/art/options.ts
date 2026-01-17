import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API: Get Art Options for Article
 *
 * GET /api/art/options?slug=article-slug
 * Returns all generated art options for an article
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Article slug is required' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('article_art_options')
      .select(`
        id,
        option_number,
        model_id,
        model_name,
        model_tier,
        prompt,
        status,
        image_url,
        storage_path,
        width,
        height,
        generation_time_ms,
        is_selected,
        selected_at,
        created_at
      `)
      .eq('article_slug', slug)
      .order('batch_id', { ascending: false })
      .order('option_number', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch art options' });
    }

    // Get public URLs for storage paths
    const options = data?.map(option => {
      let publicUrl = option.image_url;

      if (option.storage_path) {
        const { data: urlData } = supabase.storage
          .from('media')
          .getPublicUrl(option.storage_path);
        publicUrl = urlData?.publicUrl || option.image_url;
      }

      return {
        ...option,
        public_url: publicUrl,
      };
    }) || [];

    return res.status(200).json({
      slug,
      options,
      hasSelection: options.some(o => o.is_selected),
      totalOptions: options.length,
    });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
