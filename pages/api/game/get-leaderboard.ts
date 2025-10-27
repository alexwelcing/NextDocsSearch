import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface LeaderboardEntry {
  id: number;
  player_name: string;
  score: number;
  combo_max: number;
  accuracy: number;
  total_clicks: number;
  successful_clicks: number;
  created_at: string;
  session_id: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get top 5 scores
    const { data, error } = await supabaseClient
      .from('sphere_hunter_scores')
      .select('*')
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard', details: error.message });
    }

    // Return leaderboard
    return res.status(200).json({
      success: true,
      leaderboard: data as LeaderboardEntry[],
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
