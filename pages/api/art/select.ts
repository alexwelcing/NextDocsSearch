import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

/**
 * API: Select Art Option for Article
 *
 * POST /api/art/select
 * Body: { optionId: number, articleSlug: string }
 *
 * Selects an art option as the active artwork for an article.
 * Deselects any previously selected option.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminApiKey = process.env.ADMIN_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate admin key
  const authHeader = req.headers.authorization;
  const providedKey = authHeader?.replace('Bearer ', '');

  if (adminApiKey && providedKey !== adminApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { optionId, articleSlug } = req.body;

  if (!optionId || !articleSlug) {
    return res.status(400).json({ error: 'optionId and articleSlug are required' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // First, deselect any currently selected option for this article
    await supabase
      .from('article_art_options')
      .update({
        is_selected: false,
        selected_at: null,
      })
      .eq('article_slug', articleSlug)
      .eq('is_selected', true);

    // Now select the new option
    const { data, error } = await supabase
      .from('article_art_options')
      .update({
        is_selected: true,
        selected_at: new Date().toISOString(),
        status: 'selected',
      })
      .eq('id', optionId)
      .eq('article_slug', articleSlug)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to select art option' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Art option not found' });
    }

    return res.status(200).json({
      success: true,
      selected: {
        id: data.id,
        modelName: data.model_name,
        storagePath: data.storage_path,
      },
    });

  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
