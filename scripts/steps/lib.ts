// Shared plumbing for the build-step registry (scripts/run-steps.ts). A step is a module at
// scripts/steps/<phase>/NN-<name>.ts whose default export is a (possibly async) function. The
// runner awaits each in lexical order, so the two-digit prefix is the run order; leave gaps so a
// new step slots in without renaming its neighbours.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const PHASES = ['pre', 'post'] as const
export type Phase = (typeof PHASES)[number]

export type Step = () => void | Promise<void>

const STEP_FILE = /^\d{2}-[a-z0-9-]+\.ts$/
/** What a phase directory may hold besides steps: co-located tests, notes and dotfiles. */
const NOT_A_STEP = /^\.|\.test\.ts$|\.md$/

/**
 * The step files of one phase directory, in run order. Anything that is not a test, a note or a
 * dotfile must be named NN-<name>.ts: a misnamed step (`60-search_index.ts`, `060-x.ts`,
 * `60-x.mjs`) throws instead of being skipped, since a skipped step lets the build pass without
 * its output.
 */
export function listSteps(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir).filter((file) => !NOT_A_STEP.test(file))
  const misnamed = entries.filter((file) => !STEP_FILE.test(file))
  if (misnamed.length > 0) {
    const files = misnamed.map((file) => path.join(dir, file)).join(', ')
    throw new Error(`[steps] ${files}: a step must be named NN-<name>.ts (lowercase kebab-case)`)
  }
  return entries.sort()
}

/** Run a command from the repo root with inherited stdio; rejects on a non-zero exit. */
export function run(cmd: string, args: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`\`${[cmd, ...args].join(' ')}\` failed (${signal ?? `exit ${code}`})`))
    })
  })
}

/** Run one of the repo's TypeScript scripts in its own process, exactly as `tsx <script>` would. */
export const tsx = (script: string) => run('tsx', [script])
