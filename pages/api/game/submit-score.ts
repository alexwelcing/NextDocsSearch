import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Simple in-memory rate limiter: max 5 submissions per IP per minute
const submissionsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = submissionsByIp.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  submissionsByIp.set(ip, recent);
  return recent.length >= RATE_LIMIT_MAX;
}

function sanitizeName(name: string): string {
  // Strip control characters, zero-width chars, and normalize whitespace
  return name
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }

  try {
    // Check for required environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return res.status(503).json({
        success: false,
        error: 'Leaderboard not configured',
      });
    }

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

    const sanitizedName = sanitizeName(player_name);

    // Validate player name length
    if (sanitizedName.length > 20 || sanitizedName.length < 1) {
      return res.status(400).json({ error: 'Player name must be between 1 and 20 characters' });
    }

    // Record submission timestamp for rate limiting
    submissionsByIp.set(ip, [...(submissionsByIp.get(ip) || []), Date.now()]);

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
          player_name: sanitizedName,
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
      return res.status(500).json({
        success: false,
        error: 'Failed to save score',
      });
    }

    // Return the inserted record
    return res.status(200).json({
      success: true,
      entry: data,
    });
  } catch (error: unknown) {
    console.error('Error submitting score:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
