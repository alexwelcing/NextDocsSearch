import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

interface TileImage {
  src: string;
  alt: string;
  mtime: number;
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const POOL_SIZE = 100;

let cache: { images: { src: string; alt: string }[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function scanMultiArt(baseDir: string): TileImage[] {
  const results: TileImage[] = [];
  if (!fs.existsSync(baseDir)) return results;

  for (const folder of fs.readdirSync(baseDir)) {
    const folderPath = path.join(baseDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath)
      .filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
    if (files.length === 0) continue;

    // Pick a random option from this folder
    const pick = files[Math.floor(Math.random() * files.length)];
    const fullPath = path.join(folderPath, pick);
    const stat = fs.statSync(fullPath);

    results.push({
      src: `/images/multi-art/${folder}/${pick}`,
      alt: folder.replace(/-/g, ' '),
      mtime: stat.mtimeMs,
    });
  }
  return results;
}

function scanArticles(baseDir: string): TileImage[] {
  const results: TileImage[] = [];
  if (!fs.existsSync(baseDir)) return results;

  for (const file of fs.readdirSync(baseDir)) {
    if (!IMAGE_EXTS.has(path.extname(file).toLowerCase())) continue;
    if (file.endsWith('.svg')) continue;

    const fullPath = path.join(baseDir, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    results.push({
      src: `/images/articles/${file}`,
      alt: path.basename(file, path.extname(file)).replace(/-/g, ' '),
      mtime: stat.mtimeMs,
    });
  }
  return results;
}

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now();
    if (cache && now - cache.ts < CACHE_TTL) {
      return res.status(200).json(cache.images);
    }

    const publicDir = path.join(process.cwd(), 'public');
    const multiArt = scanMultiArt(path.join(publicDir, 'images', 'multi-art'));
    const articles = scanArticles(path.join(publicDir, 'images', 'articles'));

    // Bias toward newer artwork: take the top 150 by mtime, then shuffle
    // and keep 100. Caps the pool the mosaic picks from at 100 while
    // still refreshing what's in the pool when new art is added.
    const sortedNewest = [...multiArt, ...articles].sort((a, b) => b.mtime - a.mtime);
    const biasedWindow = sortedNewest.slice(0, Math.max(POOL_SIZE, Math.min(sortedNewest.length, POOL_SIZE + 50)));
    const pool = shuffle(biasedWindow).slice(0, POOL_SIZE);

    // Strip mtime from response
    const images = pool.map(({ src, alt }) => ({ src, alt }));

    cache = { images, ts: now };
    res.status(200).json(images);
  } catch (error) {
    console.error('tile-images scan error:', error);
    res.status(500).json({ error: 'Unable to scan tile images.' });
  }
}
