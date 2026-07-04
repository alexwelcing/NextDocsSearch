// Pre-build script: distills the (large, server-side) image manifest plus the film directory
// into the small public/arc/media.json the immersive client fetches once — which records have a
// companion film, and each record's multi-art plates for the reader's lightbox.
//
// Run AFTER generate-image-manifest.ts (reads lib/generated/image-manifest.json).

import fs from 'fs'
import path from 'path'

interface MultiArtOption {
  path: string
  option: number
  model: string
}

interface ArticleImageEntry {
  multiArt: MultiArtOption[]
}

function main() {
  const root = process.cwd()
  const manifestPath = path.join(root, 'lib', 'generated', 'image-manifest.json')
  const videosDir = path.join(root, 'public', 'images', 'article-videos')
  const outDir = path.join(root, 'public', 'arc')

  const manifest: Record<string, ArticleImageEntry> = JSON.parse(
    fs.readFileSync(manifestPath, 'utf8')
  )

  const films: string[] = fs.existsSync(videosDir)
    ? fs
        .readdirSync(videosDir)
        .filter((f) => f.endsWith('.mp4'))
        .map((f) => f.slice(0, -4))
        .sort()
    : []

  const plates: Record<string, string[]> = {}
  for (const slug of Object.keys(manifest).sort()) {
    const art = manifest[slug].multiArt
    if (art.length) plates[slug] = art.map((a) => a.path)
  }

  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'media.json')
  fs.writeFileSync(outPath, JSON.stringify({ films, plates }))

  console.log(
    `Generated media manifest: ${films.length} films, ${Object.keys(plates).length} records with plates, ${outPath}`
  )
}

main()
