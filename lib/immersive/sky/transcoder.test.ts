// The Basis transcoder in public/basis/ is version-locked to the installed three: KTX2Loader's
// worker source is generated from three's own code and talks to this wasm. A three upgrade that
// forgets to re-copy it fails here rather than as a black sky.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

describe('public/basis transcoder', () => {
  for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
    it(`${file} matches node_modules/three`, () => {
      const shipped = path.join(root, 'public', 'basis', file)
      const installed = path.join(
        root,
        'node_modules',
        'three',
        'examples',
        'jsm',
        'libs',
        'basis',
        file
      )
      expect(sha(shipped), `re-copy ${installed} to public/basis/`).toBe(sha(installed))
    })
  }
})
