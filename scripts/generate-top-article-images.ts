import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

interface Article {
  slug: string
  filePath: string
  title: string
  description: string
  date: string
}

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles')
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images')

const argv = yargs(hideBin(process.argv))
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: 'Number of top articles to process',
    default: 5,
  })
  .option('all', {
    alias: 'A',
    type: 'boolean',
    description: 'Process all articles (overrides limit)',
    default: false,
  })
  .option('dry-run', {
    alias: 'd',
    type: 'boolean',
    description: 'Show what would be generated without writing files',
    default: false,
  })
  .help()
  .parseSync()

function getArticleFiles(): string[] {
  return fs
    .readdirSync(ARTICLES_DIR)
    .filter((file) => file.endsWith('.mdx'))
    .sort()
}

function parseArticle(filename: string): Article {
  const filePath = path.join(ARTICLES_DIR, filename)
  const fileContents = fs.readFileSync(filePath, 'utf-8')
  const { data } = matter(fileContents)
  const slug = filename.replace(/\.mdx$/, '')

  return {
    slug,
    filePath,
    title: data.title || slug,
    description: data.description || '',
    date: data.date || '',
  }
}

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function createRandom(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let result = Math.imul(t ^ (t >>> 15), 1 | t)
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function hsl(hue: number, saturation: number, lightness: number) {
  return `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`
}

function buildArticleSvg(
  title: string,
  slug: string,
  width: number,
  height: number
): string {
  const seed = hashString(`${slug}-${title}`)
  const random = createRandom(seed)

  const baseHue = seed % 360
  const secondaryHue = (baseHue + 45) % 360
  const accentHue = (baseHue + 160) % 360

  const backgroundStart = hsl(baseHue, 55, 14)
  const backgroundEnd = hsl(secondaryHue, 65, 20)
  const accent = hsl(accentHue, 70, 55)
  const glow = hsl((accentHue + 40) % 360, 80, 60)

  const circles = Array.from({ length: 5 }, (_, index) => {
    const cx = Math.round(random() * width)
    const cy = Math.round(random() * height)
    const radius = Math.round((0.2 + random() * 0.35) * height)
    const opacity = (0.08 + random() * 0.18).toFixed(2)
    const hueOffset = (accentHue + index * 20) % 360

    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${hsl(
      hueOffset,
      70,
      45
    )}" opacity="${opacity}" />`
  }).join('\n')

  const lines = Array.from({ length: 3 }, () => {
    const x1 = Math.round(random() * width)
    const y1 = Math.round(random() * height)
    const x2 = Math.round(random() * width)
    const y2 = Math.round(random() * height)
    const opacity = (0.2 + random() * 0.3).toFixed(2)

    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${accent}" stroke-width="2" opacity="${opacity}" />`
  }).join('\n')

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${backgroundStart}" />
          <stop offset="100%" stop-color="${backgroundEnd}" />
        </linearGradient>
        <radialGradient id="glow" cx="0.2" cy="0.2" r="0.8">
          <stop offset="0%" stop-color="${glow}" stop-opacity="0.5" />
          <stop offset="100%" stop-color="${glow}" stop-opacity="0" />
        </radialGradient>
        <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="30" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect width="100%" height="100%" fill="url(#glow)" />
      <g filter="url(#blur)">
        ${circles}
      </g>
      <g>
        ${lines}
      </g>
      <rect x="${Math.round(width * 0.65)}" y="${Math.round(
    height * 0.15
  )}" width="${Math.round(width * 0.25)}" height="${Math.round(
    height * 0.12
  )}" rx="${Math.round(height * 0.04)}" fill="${accent}" opacity="0.18" />
    </svg>
  `.trim()
}

async function ensureDirectory(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true })
}

async function writeSvg(svg: string, outputPath: string) {
  await fs.promises.writeFile(outputPath, svg, 'utf-8')
}

function updateArticleFrontmatter(filePath: string, ogPath: string): void {
  const fileContents = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(fileContents)

  data.ogImage = ogPath

  const updatedContent = matter.stringify(content, data)
  fs.writeFileSync(filePath, updatedContent, 'utf-8')
}

async function generateImages(article: Article) {
  const heroDir = path.join(OUTPUT_DIR, 'articles')
  const ogDir = path.join(OUTPUT_DIR, 'og')

  await ensureDirectory(heroDir)
  await ensureDirectory(ogDir)

  const heroPath = path.join(heroDir, `${article.slug}.svg`)
  const ogPath = path.join(ogDir, `${article.slug}.svg`)

  const heroSvg = buildArticleSvg(article.title, article.slug, 1792, 1024)
  const ogSvg = buildArticleSvg(article.title, article.slug, 1200, 630)

  await writeSvg(heroSvg, heroPath)
  await writeSvg(ogSvg, ogPath)

  updateArticleFrontmatter(article.filePath, `/images/og/${article.slug}.svg`)

  return { heroPath, ogPath }
}

async function main() {
  console.log('\n🖼️  Generating top article images (system method)')
  console.log('===============================================\n')

  const articleFiles = getArticleFiles()
  const articles = articleFiles.map(parseArticle)

  const sorted = [...articles].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime()
    const dateB = new Date(b.date || 0).getTime()
    return dateB - dateA
  })

  const articlesToProcess = argv.all
    ? sorted
    : sorted.slice(0, Math.max(0, argv.limit || 0))

  if (articlesToProcess.length === 0) {
    console.log('No articles found to process.')
    return
  }

  console.log(`Found ${articles.length} total articles.`)
  console.log(`Processing ${articlesToProcess.length} articles.\n`)

  articlesToProcess.forEach((article, index) => {
    console.log(`${index + 1}. ${article.slug} (${article.date || 'no date'})`)
  })

  if (argv.dryRun) {
    console.log('\nDry run enabled. No files generated.')
    return
  }

  for (const article of articlesToProcess) {
    console.log(`\n✨ Generating images for ${article.slug}...`)
    const { heroPath, ogPath } = await generateImages(article)
    console.log(`   ✅ Hero: ${heroPath}`)
    console.log(`   ✅ OG:   ${ogPath}`)
  }

  console.log('\n✅ Image generation complete.')
}

main().catch((error) => {
  console.error('❌ Image generation failed:', error)
  process.exit(1)
})
