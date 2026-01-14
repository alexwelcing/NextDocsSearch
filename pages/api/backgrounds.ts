import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface BackgroundInfo {
  id: string;
  name: string;
  path: string;
  type: 'image';
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

    // Gaussian splat files disabled - using pano method only
    // const splatPath = path.join(process.cwd(), 'public', 'splats');
    // if (fs.existsSync(splatPath)) {
    //   const files = fs.readdirSync(splatPath);
    //   files.forEach((file) => {
    //     if (/\.(splat|ply|ksplat|spz)$/i.test(file)) {
    //       const stats = fs.statSync(path.join(splatPath, file));
    //       const name = file.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    //       // Splat backgrounds no longer supported
    //     }
    //   });
    // }

    // Cache for 10 minutes
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    res.status(200).json({ backgrounds });
  } catch (error) {
    console.error('Error fetching backgrounds:', error);
    res.status(200).json({ backgrounds: [] });
  }
}
