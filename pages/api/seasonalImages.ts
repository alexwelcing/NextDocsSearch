/**
 * Seasonal Images API
 * Returns background images appropriate for the current season
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { getCurrentSeason, getSeasonalTheme } from '../../lib/theme/seasonalTheme';

type ResponseData = {
  images: string[];
  season: string;
  theme: any;
};

type ErrorData = {
  error: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | ErrorData>
) {
  try {
    // Get current season
    const currentSeason = getCurrentSeason();
    const theme = getSeasonalTheme(currentSeason);

    // Read all background images
    const backgroundPath = path.join(process.cwd(), 'public', 'background');
    const files = fs.readdirSync(backgroundPath);

    // Filter for image files
    const imageFiles = files.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);
    });

    // Try to find season-specific images first
    const seasonalImages = imageFiles.filter((file) =>
      file.toLowerCase().includes(theme.backgroundPrefix.toLowerCase())
    );

    let selectedImages: string[];

    if (seasonalImages.length > 0) {
      // Use seasonal images if available
      selectedImages = seasonalImages;
    } else {
      // Fallback to all available images
      selectedImages = imageFiles;
    }

    // Return URLs for the images
    const imageUrls = selectedImages.map((file) => `/background/${file}`);

    res.status(200).json({
      images: imageUrls,
      season: currentSeason,
      theme: {
        colors: theme.colors,
        effectType: theme.effectType,
        backgroundColor: theme.backgroundColor,
      },
    });
  } catch (error) {
    console.error('Error loading seasonal images:', error);
    res.status(500).json({ error: 'Failed to load seasonal images' });
  }
}
