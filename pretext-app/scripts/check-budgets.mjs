import fs from 'fs'
import path from 'path'

const distAssets = path.join(process.cwd(), 'dist', 'assets')
const MAX_JS_BYTES = 350 * 1024
const MAX_CSS_BYTES = 80 * 1024

if (!fs.existsSync(distAssets)) {
  console.error('Missing dist/assets. Run build first.')
  process.exit(1)
}

let jsTotal = 0
let cssTotal = 0

for (const file of fs.readdirSync(distAssets)) {
  const fp = path.join(distAssets, file)
  const stat = fs.statSync(fp)
  if (file.endsWith('.js')) jsTotal += stat.size
  if (file.endsWith('.css')) cssTotal += stat.size
}

if (jsTotal > MAX_JS_BYTES || cssTotal > MAX_CSS_BYTES) {
  console.error(`Bundle budget exceeded: js=${jsTotal} css=${cssTotal}`)
  process.exit(1)
}

console.log(`Bundle budget ok: js=${jsTotal} css=${cssTotal}`)
