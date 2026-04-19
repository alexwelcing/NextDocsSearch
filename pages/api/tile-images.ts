import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// ═══════════════════════════════════════════════════════════════════════════
//
// TILE IMAGES API — quality-ranked pool for the homepage mosaic
//
// Scans /public/images/multi-art and /public/images/articles, scores each
// image with a heuristic combining dimensions (via sharp), file size, path
// provenance, format, and recency, then returns a POOL_SIZE pool of the
// highest-scoring images (shuffled within the top window so repeated pulls
// surface variety).
//
// The HeroMosaic component on the client picks 12 random tiles out of this
// pool for each pageload.
//
// ═══════════════════════════════════════════════════════════════════════════

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const POOL_SIZE = 100;
const TOP_WINDOW = 150;       // Shuffle within top-N scored images
const RESULT_CACHE_TTL = 60 * 60 * 1000;      // 1 hour for the final 100-image response
const ANALYSIS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for per-image metadata

interface ScoredImage {
  src: string;
  alt: string;
  mtime: number;
  fileSize: number;
  width: number;
  height: number;
  score: number;
}

interface AnalysisCacheEntry {
  mtime: number;
  fileSize: number;
  width: number;
  height: number;
  score: number;
}

// Per-file analysis cache (mtime-keyed so we re-score if a file changes).
const analysisCache: Map<string, AnalysisCacheEntry> = new Map();
let analysisCacheBuiltAt = 0;

// Final response cache (shuffled pool of POOL_SIZE).
let responseCache: { images: { src: string; alt: string }[]; ts: number } | null = null;

// ─── Scoring ─────────────────────────────────────────────────────────────

function aspectScore(width: number, height: number): number {
  // Tiles render in a 4×3 grid over a wide hero, so roughly 4:3 landscape
  // reads best. Score the ratio; heavily penalise extreme portraits /
  // panoramics that look cropped in a square-ish cell.
  if (!width || !height) return 0;
  const ratio = width / height;
  const ideal = 4 / 3;
  // Gaussian-ish falloff: full score at 4:3, ~0.5 at 1:1 or 16:9, near 0 past 2:1
  const delta = Math.log(ratio / ideal);
  return Math.max(0, Math.exp(-(delta * delta) * 3));
}

function resolutionScore(width: number, height: number): number {
  if (!width || !height) return 0;
  const minSide = Math.min(width, height);
  // Under 512 is thumbnail-quality; 1024+ is ideal; above 2048 no extra benefit.
  if (minSide < 512) return (minSide / 512) * 0.5;
  if (minSide < 1024) return 0.5 + ((minSide - 512) / 512) * 0.5;
  return 1.0;
}

function fileSizeScore(bytes: number): number {
  // Sweet spot for a good-detail tile image is ~400KB–3MB.
  // Below that is almost certainly low-detail; above is fine but plateaus.
  const kb = bytes / 1024;
  if (kb < 50) return 0;
  if (kb < 200) return (kb - 50) / 150 * 0.4;       // ramps 0 → 0.4 across 50–200KB
  if (kb < 400) return 0.4 + (kb - 200) / 200 * 0.4;  // ramps 0.4 → 0.8 across 200–400KB
  if (kb < 3000) return 0.8 + Math.min(0.2, (kb - 400) / 2600 * 0.2); // caps at 1.0 by 3MB
  return 1.0;
}

function formatScore(ext: string): number {
  // Modern optimised formats suggest an intentional, tuned pipeline.
  switch (ext) {
    case '.avif': return 1.0;
    case '.webp': return 0.9;
    case '.png':  return 0.7;
    case '.jpg':
    case '.jpeg': return 0.5;
    default: return 0.3;
  }
}

function pathScore(src: string): number {
  let s = 0;
  // Curated multi-art generations tend to be hero-quality.
  if (src.includes('/multi-art/')) s += 0.4;
  // "option-1" is conventionally the primary / best model output (SDXL here).
  if (/option-1[-_.]/.test(src)) s += 0.4;
  else if (/option-2[-_.]/.test(src)) s += 0.15;
  else if (/option-3[-_.]/.test(src)) s -= 0.1;
  // Named article hero images (not generic slugs) get a small bump.
  if (src.includes('/articles/') && src.length > 40) s += 0.15;
  // Penalise obvious scratch / test artefacts.
  if (/\b(test|draft|wip|tmp|thumb|preview)\b/i.test(src)) s -= 0.5;
  return s;
}

function recencyScore(mtimeMs: number, now: number): number {
  // Images less than 90 days old: full score. Year old: ~0.3. Very old: ~0.1.
  const ageDays = (now - mtimeMs) / (1000 * 60 * 60 * 24);
  if (ageDays < 90) return 1.0;
  if (ageDays < 365) return 1.0 - ((ageDays - 90) / 275) * 0.7; // 1.0 → 0.3
  return Math.max(0.1, 0.3 - ((ageDays - 365) / 730) * 0.2);
}

function scoreImage(
  opts: {
    src: string;
    ext: string;
    mtimeMs: number;
    fileSize: number;
    width: number;
    height: number;
  },
  now: number
): number {
  // Weighted sum. Tunable; weights sum to ~2.7 before clamping.
  const w = {
    resolution: 0.85,
    aspect:     0.70,
    fileSize:   0.45,
    format:     0.25,
    path:       0.60,
    recency:    0.35,
  };

  const score =
    w.resolution * resolutionScore(opts.width, opts.height) +
    w.aspect     * aspectScore(opts.width, opts.height) +
    w.fileSize   * fileSizeScore(opts.fileSize) +
    w.format     * formatScore(opts.ext) +
    w.path       * pathScore(opts.src) +
    w.recency    * recencyScore(opts.mtimeMs, now);

  return score;
}

// ─── Scan + analyse ──────────────────────────────────────────────────────

interface Candidate {
  src: string;         // public URL path
  alt: string;
  fullPath: string;
  mtime: number;
  fileSize: number;
  ext: string;
}

function collectMultiArtCandidates(baseDir: string): Candidate[] {
  const results: Candidate[] = [];
  if (!fs.existsSync(baseDir)) return results;

  for (const folder of fs.readdirSync(baseDir)) {
    const folderPath = path.join(baseDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    // Consider ALL image options per folder (scored individually, best can
    // rise to the top — previously we picked one at random per folder).
    for (const file of fs.readdirSync(folderPath)) {
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const fullPath = path.join(folderPath, file);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      results.push({
        src: `/images/multi-art/${folder}/${file}`,
        alt: folder.replace(/-/g, ' '),
        fullPath,
        mtime: stat.mtimeMs,
        fileSize: stat.size,
        ext,
      });
    }
  }
  return results;
}

function collectArticleCandidates(baseDir: string): Candidate[] {
  const results: Candidate[] = [];
  if (!fs.existsSync(baseDir)) return results;

  for (const file of fs.readdirSync(baseDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    if (ext === '.svg') continue;
    const fullPath = path.join(baseDir, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;
    results.push({
      src: `/images/articles/${file}`,
      alt: path.basename(file, ext).replace(/-/g, ' '),
      fullPath,
      mtime: stat.mtimeMs,
      fileSize: stat.size,
      ext,
    });
  }
  return results;
}

async function readDimensionsSafe(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const md = await sharp(filePath).metadata();
    return { width: md.width ?? 0, height: md.height ?? 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}

async function buildScoredPool(now: number): Promise<ScoredImage[]> {
  const publicDir = path.join(process.cwd(), 'public');
  const candidates = [
    ...collectMultiArtCandidates(path.join(publicDir, 'images', 'multi-art')),
    ...collectArticleCandidates(path.join(publicDir, 'images', 'articles')),
  ];

  // Batch metadata reads — sharp does the actual work on header only.
  // Per-file cache keyed on fullPath + mtime, so unchanged files are free.
  const CONCURRENCY = 16;
  const scored: ScoredImage[] = [];
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (c) => {
      const cacheKey = c.fullPath;
      const cached = analysisCache.get(cacheKey);
      if (cached && cached.mtime === c.mtime && cached.fileSize === c.fileSize) {
        return {
          src: c.src,
          alt: c.alt,
          mtime: c.mtime,
          fileSize: c.fileSize,
          width: cached.width,
          height: cached.height,
          score: cached.score,
        } as ScoredImage;
      }
      const dims = await readDimensionsSafe(c.fullPath);
      const score = scoreImage({
        src: c.src,
        ext: c.ext,
        mtimeMs: c.mtime,
        fileSize: c.fileSize,
        width: dims.width,
        height: dims.height,
      }, now);
      analysisCache.set(cacheKey, {
        mtime: c.mtime,
        fileSize: c.fileSize,
        width: dims.width,
        height: dims.height,
        score,
      });
      return {
        src: c.src,
        alt: c.alt,
        mtime: c.mtime,
        fileSize: c.fileSize,
        width: dims.width,
        height: dims.height,
        score,
      } as ScoredImage;
    }));
    scored.push(...results);
  }

  analysisCacheBuiltAt = now;
  return scored;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Handler ─────────────────────────────────────────────────────────────

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const now = Date.now();

    if (responseCache && now - responseCache.ts < RESULT_CACHE_TTL) {
      return res.status(200).json(responseCache.images);
    }

    // Invalidate stale analysis cache so we re-read any files whose mtime
    // has changed. (fs.statSync in the candidate collectors picks up new
    // mtimes; only images whose mtime hasn't changed stay in the cache.)
    if (now - analysisCacheBuiltAt > ANALYSIS_CACHE_TTL) {
      analysisCache.clear();
    }

    const scored = await buildScoredPool(now);

    // Sort by score desc, take the top window, shuffle for variety, keep 100.
    scored.sort((a, b) => b.score - a.score);
    const topWindow = scored.slice(0, Math.min(TOP_WINDOW, scored.length));
    const pool = shuffle(topWindow).slice(0, POOL_SIZE);

    const images = pool.map(({ src, alt }) => ({ src, alt }));
    responseCache = { images, ts: now };
    res.status(200).json(images);
  } catch (error) {
    console.error('tile-images scan error:', error);
    res.status(500).json({ error: 'Unable to scan tile images.' });
  }
}
