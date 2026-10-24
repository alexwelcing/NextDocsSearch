import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { listSteps, run, type Step } from './lib'

const STEPS_DIR = fileURLToPath(new URL('.', import.meta.url))

describe('listSteps', () => {
  const dirs: string[] = []
  const phaseDir = (files: string[]) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'steps-'))
    dirs.push(dir)
    for (const file of files) fs.writeFileSync(path.join(dir, file), '')
    return dir
  }
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
  })

  it('returns NN-<name>.ts files in run order, ignoring tests, notes and dotfiles', () => {
    const dir = phaseDir(['20-b.ts', '05-a.ts', '10-x.test.ts', 'README.md', '.DS_Store'])
    expect(listSteps(dir)).toEqual(['05-a.ts', '20-b.ts'])
  })

  // A skipped step would let the build pass and ship without its output, so a bad name is fatal.
  it.each([
    '100-c.ts',
    '060-c.ts',
    '60-search_index.ts',
    '60-searchIndex.ts',
    '60-c.mjs',
    'lib.ts',
  ])('throws on the misnamed step %s instead of skipping it', (file) => {
    const dir = phaseDir(['05-a.ts', file])
    expect(() => listSteps(dir)).toThrow(path.join(dir, file))
  })

  it('treats a missing phase directory as no steps', () => {
    expect(listSteps(path.join(os.tmpdir(), 'no-such-steps-dir'))).toEqual([])
  })
})

describe('the build registry', () => {
  // The generators feed each other (media reads the image manifest, articles read it too), so the
  // order is part of the contract, not an accident of file naming.
  it('runs the guard and the generators in the order the build depends on', () => {
    expect(listSteps(path.join(STEPS_DIR, 'pre'))).toEqual([
      '05-guard-media.ts',
      '10-font-atlas.ts',
      '20-article-bodies.ts',
      '30-image-manifest.ts',
      '40-media-manifest.ts',
      '50-article-manifest.ts',
    ])
    expect(listSteps(path.join(STEPS_DIR, 'post'))).toEqual(['10-next-sitemap.ts'])
  })

  it('every step default-exports a function', async () => {
    for (const phase of ['pre', 'post']) {
      for (const file of listSteps(path.join(STEPS_DIR, phase))) {
        const url = pathToFileURL(path.join(STEPS_DIR, phase, file)).href
        const mod: { default: Step } = await import(url)
        expect(typeof mod.default, `${phase}/${file}`).toBe('function')
      }
    }
  })
})

describe('run', () => {
  it('resolves on exit 0', async () => {
    await expect(run(process.execPath, ['-e', ''])).resolves.toBeUndefined()
  })

  it('rejects with the command and exit code on failure', async () => {
    await expect(run(process.execPath, ['-e', 'process.exit(3)'])).rejects.toThrow(/exit 3/)
  })
})
