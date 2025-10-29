import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      player_name,
      score,
      combo_max = 0,
      accuracy = 0,
      total_clicks = 0,
      successful_clicks = 0,
    } = req.body;

    // Validate required fields
    if (!player_name || typeof score !== 'number') {
      return res.status(400).json({ error: 'Missing required fields: player_name and score' });
    }

    // Validate player name length
    if (player_name.length > 20 || player_name.length < 1) {
      return res.status(400).json({ error: 'Player name must be between 1 and 20 characters' });
    }

    // Validate score range (reasonable limits)
    if (score < 0 || score > 100000) {
      return res.status(400).json({ error: 'Invalid score range' });
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Insert score into database
    const { data, error } = await supabaseClient
      .from('sphere_hunter_scores')
      .insert([
        {
          player_name: player_name.trim(),
          score,
          combo_max,
          accuracy,
          total_clicks,
          successful_clicks,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to save score', details: error.message });
    }

    // Return the inserted record
    return res.status(200).json({
      success: true,
      entry: data,
    });
  } catch (error: any) {
    console.error('Error submitting score:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
