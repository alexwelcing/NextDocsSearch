const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pnpmDir = path.join(root, 'node_modules', '.pnpm')

const indexSource = ''
const errorSource =
  "throw new Error('This module cannot be imported from a Server Component module. It should only be used from a Client Component.');\n"

function repairPackageDir(dir) {
  const pkg = path.join(dir, 'package.json')
  if (!fs.existsSync(pkg)) return false

  const indexFile = path.join(dir, 'index.js')
  const errorFile = path.join(dir, 'error.js')

  if (!fs.existsSync(indexFile)) fs.writeFileSync(indexFile, indexSource)
  if (!fs.existsSync(errorFile)) fs.writeFileSync(errorFile, errorSource)
  return true
}

function main() {
  if (!fs.existsSync(pnpmDir)) return

  let repaired = 0
  for (const entry of fs.readdirSync(pnpmDir)) {
    if (entry.startsWith('client-only@')) {
      const dir = path.join(pnpmDir, entry, 'node_modules', 'client-only')
      if (repairPackageDir(dir)) repaired += 1
    }

    if (entry.startsWith('styled-jsx@')) {
      const dir = path.join(pnpmDir, entry, 'node_modules', 'client-only')
      if (repairPackageDir(dir)) repaired += 1
    }
  }

  if (repaired > 0) {
    console.log(`Repaired client-only marker files in ${repaired} package location(s).`)
  }
}

main()
