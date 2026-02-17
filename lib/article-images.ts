import fs from 'fs';
import path from 'path';

export interface MultiArtOption {
  path: string;
  option: number;
  model: string;
}

export interface ArticleImages {
  /** Best available image for hero display */
  heroImage: string | null;
  /** High-quality JPG from /images/articles/ */
  articleJpg: string | null;
  /** SVG from /images/articles/ */
  articleSvg: string | null;
  /** OG/social card SVG from /images/og/ */
  ogImage: string | null;
  /** All multi-art AI-generated options */
  multiArt: MultiArtOption[];
  /** Best small image for card thumbnails */
  thumbnail: string | null;
}

/**
 * Discover all available images for an article at build time.
 * Must only be called in Node.js context (getStaticProps, API routes).
 */
export function discoverArticleImages(slug: string): ArticleImages {
  const publicDir = path.join(process.cwd(), 'public');

  const jpgPath = `/images/articles/${slug}.jpg`;
  const jpgExists = fs.existsSync(path.join(publicDir, jpgPath));

  const svgPath = `/images/articles/${slug}.svg`;
  const svgExists = fs.existsSync(path.join(publicDir, svgPath));

  const ogPath = `/images/og/${slug}.svg`;
  const ogExists = fs.existsSync(path.join(publicDir, ogPath));

  // Discover multi-art options
  const multiArtDir = path.join(publicDir, 'images', 'multi-art', slug);
  let multiArt: MultiArtOption[] = [];
  if (fs.existsSync(multiArtDir)) {
    const files = fs.readdirSync(multiArtDir)
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

  return {
    heroImage,
    articleJpg: jpgExists ? jpgPath : null,
    articleSvg: svgExists ? svgPath : null,
    ogImage: ogExists ? ogPath : null,
    multiArt,
    thumbnail,
  };
}
