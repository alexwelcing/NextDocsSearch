/**
 * Static list of background images available in public/background/.
 * Replaces the old /api/backgroundImages endpoint which failed in production
 * because serverless functions can't access the public/ directory via filesystem.
 */
const BACKGROUND_IMAGES = [
  'bg1.jpg',
  'bg2.jpg',
  'bg3.jpg',
  'bg4.jpg',
  'bg5.jpg',
  'bg6.jpg',
  'bg7.jpg',
  'bg8.jpg',
  'bg9.jpg',
  'cave.jpg',
  'scifi1.jpg',
  'space.jpg',
  'start.jpg',
  'train.jpg',
]

export function getRandomBackgroundImage(): string {
  const file = BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]
  return `./background/${file}`
}
