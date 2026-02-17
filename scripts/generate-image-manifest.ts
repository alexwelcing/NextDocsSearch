/**
 * Pre-build script: scans public/images/ and generates a JSON manifest.
 * This avoids runtime fs calls that cause Vercel to bundle 650MB of images
 * into serverless functions.
 *
 * Run: tsx scripts/generate-image-manifest.ts
 */

import fs from 'fs';
import path from 'path';

interface MultiArtOption {
  path: string;
  option: number;
  model: string;
}

interface ArticleImageEntry {
  heroImage: string | null;
  articleJpg: string | null;
  articleSvg: string | null;
  ogImage: string | null;
  multiArt: MultiArtOption[];
  thumbnail: string | null;
}

function main() {
  const publicDir = path.join(process.cwd(), 'public');
  const articlesDir = path.join(publicDir, 'images', 'articles');
  const ogDir = path.join(publicDir, 'images', 'og');
  const multiArtDir = path.join(publicDir, 'images', 'multi-art');

  // Collect all known article slugs from multi-art directories + article images
  const slugs = new Set<string>();

  if (fs.existsSync(multiArtDir)) {
    for (const dir of fs.readdirSync(multiArtDir, { withFileTypes: true })) {
      if (dir.isDirectory()) slugs.add(dir.name);
    }
  }

  if (fs.existsSync(articlesDir)) {
    for (const file of fs.readdirSync(articlesDir)) {
      const match = file.match(/^(.+)\.(jpg|svg)$/);
      if (match) slugs.add(match[1]);
    }
  }

  if (fs.existsSync(ogDir)) {
    for (const file of fs.readdirSync(ogDir)) {
      const match = file.match(/^(.+)\.svg$/);
      if (match) slugs.add(match[1]);
    }
  }

  const manifest: Record<string, ArticleImageEntry> = {};

  for (const slug of Array.from(slugs).sort()) {
    const jpgPath = `/images/articles/${slug}.jpg`;
    const jpgExists = fs.existsSync(path.join(publicDir, jpgPath));

    const svgPath = `/images/articles/${slug}.svg`;
    const svgExists = fs.existsSync(path.join(publicDir, svgPath));

    const ogPath = `/images/og/${slug}.svg`;
    const ogExists = fs.existsSync(path.join(publicDir, ogPath));

    // Discover multi-art options
    const slugMultiArtDir = path.join(multiArtDir, slug);
    let multiArt: MultiArtOption[] = [];
    if (fs.existsSync(slugMultiArtDir)) {
      const files = fs.readdirSync(slugMultiArtDir)
        .filter(f => f.endsWith('.png'))
        .sort();
      multiArt = files.map(f => {
        const match = f.match(/^option-(\d+)-(.+)\.png$/);
        return {
          path: `/images/multi-art/${slug}/${f}`,
          option: match ? parseInt(match[1]) : 0,
          model: match ? match[2] : 'unknown',
        };
      });
    }

    // Hero priority: JPG > first multi-art > article SVG > OG SVG
    const heroImage = jpgExists
      ? jpgPath
      : multiArt.length > 0
        ? multiArt[0].path
        : svgExists
          ? svgPath
          : ogExists
            ? ogPath
            : null;

    // Thumbnail priority: first multi-art > JPG > SVG > OG
    const thumbnail = multiArt.length > 0
      ? multiArt[0].path
      : jpgExists
        ? jpgPath
        : svgExists
          ? svgPath
          : ogExists
            ? ogPath
            : null;

    manifest[slug] = {
      heroImage,
      articleJpg: jpgExists ? jpgPath : null,
      articleSvg: svgExists ? svgPath : null,
      ogImage: ogExists ? ogPath : null,
      multiArt,
      thumbnail,
    };
  }

  const outPath = path.join(process.cwd(), 'lib', 'generated', 'image-manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));

  console.log(`Generated image manifest: ${Object.keys(manifest).length} articles, ${outPath}`);
}

main();
