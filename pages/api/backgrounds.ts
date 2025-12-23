import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface BackgroundInfo {
  id: string;
  name: string;
  path: string;
  type: 'image' | 'splat';
  size?: number;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ backgrounds: BackgroundInfo[] }>
) {
  try {
    const backgrounds: BackgroundInfo[] = [];

    // Scan for panoramic images
    const bgPath = path.join(process.cwd(), 'public', 'background');
    if (fs.existsSync(bgPath)) {
      const files = fs.readdirSync(bgPath);
      files.forEach((file) => {
        if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
          const stats = fs.statSync(path.join(bgPath, file));
          const name = file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          backgrounds.push({
            id: `bg-${file}`,
            name: name.charAt(0).toUpperCase() + name.slice(1),
            path: `/background/${file}`,
            type: 'image',
            size: stats.size,
          });
        }
      });
    }

    // Scan for Gaussian splat files
    const splatPath = path.join(process.cwd(), 'public', 'splats');
    if (fs.existsSync(splatPath)) {
      const files = fs.readdirSync(splatPath);
      files.forEach((file) => {
        if (/\.(splat|ply|ksplat|spz)$/i.test(file)) {
          const stats = fs.statSync(path.join(splatPath, file));
          const name = file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
          backgrounds.push({
            id: `splat-${file}`,
            name: `3D: ${name.charAt(0).toUpperCase() + name.slice(1)}`,
            path: `/splats/${file}`,
            type: 'splat',
            size: stats.size,
          });
        }
      });
    }

    // Cache for 10 minutes
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    res.status(200).json({ backgrounds });
  } catch (error) {
    console.error('Error fetching backgrounds:', error);
    res.status(200).json({ backgrounds: [] });
  }
}
