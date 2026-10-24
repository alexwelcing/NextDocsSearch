// Build-step registry runner. `pnpm build` is
//
//   tsx scripts/run-steps.ts pre && next build --webpack && tsx scripts/run-steps.ts post
//
// and each phase runs every scripts/steps/<phase>/NN-<name>.ts in order (see scripts/steps/lib.ts).
// A new generator is a new step file, never another edit to the package.json build line. The first
// failing step stops the build with a non-zero exit.

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PHASES, listSteps, type Phase, type Step } from './steps/lib'

async function main() {
  const phase = process.argv[2] as Phase
  if (!PHASES.includes(phase)) {
    console.error(`usage: tsx scripts/run-steps.ts <${PHASES.join('|')}>`)
    process.exit(2)
  }

  const dir = path.join(process.cwd(), 'scripts', 'steps', phase)
  const files = listSteps(dir)
  // An empty phase means the runner was started outside the repo root, not that there is no work.
  if (files.length === 0) throw new Error(`[steps] no steps in ${dir}`)

  for (const file of files) {
    const name = `${phase}/${file.slice(0, -3)}`
    const step: Step | undefined = (await import(pathToFileURL(path.join(dir, file)).href)).default
    if (typeof step !== 'function') throw new Error(`[steps] ${name} has no default export`)

    console.log(`[steps] ${name}`)
    const started = Date.now()
    try {
      await step()
    } catch (err) {
      throw new Error(`[steps] ${name} failed: ${err instanceof Error ? err.message : err}`)
    }
    console.log(`[steps] ${name} done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
