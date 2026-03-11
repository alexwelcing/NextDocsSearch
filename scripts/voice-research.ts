#!/usr/bin/env tsx
/**
 * Voice Research CLI
 *
 * Runs the autoresearch loop for authorial voice profiles.
 * Generates prose samples, evaluates them against the target profile,
 * mutates the profile based on feedback, and iterates toward convergence.
 *
 * Usage:
 *   pnpm tsx scripts/voice-research.ts --profile nkechi
 *   pnpm tsx scripts/voice-research.ts --profile pyotr --iterations 8
 *   pnpm tsx scripts/voice-research.ts --profile yemisi --threshold 90
 *   pnpm tsx scripts/voice-research.ts --profile nkechi --dry-run
 *   pnpm tsx scripts/voice-research.ts --profile nkechi --samples 5
 */

import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { runResearch } from '../lib/voice-engine/engine'
import { SEED_PROFILES } from '../lib/voice-engine/profiles'
import type { VoiceProfile, VoiceResearchRun, ResearchIteration, VoiceSample } from '../lib/voice-engine/types'

dotenv.config({ path: '.env.local' })

// ═══════════════════════════════════════════════════════════════
// CLI PARSING
// ═══════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2)
  const flags: Record<string, string> = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true'
      flags[key] = value
      if (value !== 'true') i++
    }
  }

  return {
    profile: flags.profile || '',
    iterations: parseInt(flags.iterations || '5', 10),
    threshold: parseInt(flags.threshold || '85', 10),
    samples: parseInt(flags.samples || '3', 10),
    dryRun: flags['dry-run'] === 'true',
    outputDir: flags.output || 'lib/voice-engine/runs',
  }
}

// ═══════════════════════════════════════════════════════════════
// DISPLAY
// ═══════════════════════════════════════════════════════════════

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`
}
function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`
}
function green(text: string): string {
  return `\x1b[32m${text}\x1b[0m`
}
function yellow(text: string): string {
  return `\x1b[33m${text}\x1b[0m`
}
function red(text: string): string {
  return `\x1b[31m${text}\x1b[0m`
}
function cyan(text: string): string {
  return `\x1b[36m${text}\x1b[0m`
}

function scoreColor(score: number): string {
  if (score >= 80) return green(String(score))
  if (score >= 60) return yellow(String(score))
  return red(String(score))
}

function printHeader() {
  console.log()
  console.log(bold('╔══════════════════════════════════════════════════╗'))
  console.log(bold('║         VOICE RESEARCH ENGINE v1.0               ║'))
  console.log(bold('║   autoresearch for prose style convergence        ║'))
  console.log(bold('╚══════════════════════════════════════════════════╝'))
  console.log()
}

function printProfileSummary(profile: VoiceProfile) {
  console.log(bold(`  Profile: ${profile.name} v${profile.version}`))
  console.log(dim(`  Series:  ${profile.series}`))
  console.log(dim(`  Heritage: ${profile.heritage.primary} × ${profile.heritage.secondary}`))
  console.log(dim(`  Rhythm:  avg ${profile.parameters.rhythm.avgSentenceLength} words, ` +
    `${Math.round(profile.parameters.rhythm.shortSentenceRatio * 100)}% short, ` +
    `${Math.round(profile.parameters.rhythm.longSentenceRatio * 100)}% long`))
  console.log(dim(`  Imagery: ${profile.parameters.imagery.metaphorDomains.join(', ')}`))
  console.log(dim(`  Narration: ${profile.parameters.narration.pov}, ` +
    `show/tell ${Math.round(profile.parameters.narration.showTellRatio * 100)}/${Math.round((1 - profile.parameters.narration.showTellRatio) * 100)}`))
  console.log()
}

function printIterationResult(iter: ResearchIteration) {
  console.log()
  console.log(bold(`  ┌─ Iteration ${iter.iteration + 1} Results ─────────────────────`))
  console.log(`  │ Avg Score: ${scoreColor(Math.round(iter.avgScore))} / 100`)
  console.log(`  │ Best Score: ${scoreColor(Math.round(iter.bestScore))} / 100`)

  // Print per-dimension averages
  const dimScores: Record<string, number[]> = {}
  for (const evaluation of iter.evaluations) {
    for (const [key, value] of Object.entries(evaluation.dimensions)) {
      if (!dimScores[key]) dimScores[key] = []
      const score = (value as { score: number })?.score
      if (typeof score === 'number') dimScores[key].push(score)
    }
  }

  console.log(`  │`)
  for (const [key, scores] of Object.entries(dimScores)) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    const bar = '█'.repeat(Math.floor(avg / 5)) + '░'.repeat(20 - Math.floor(avg / 5))
    console.log(`  │ ${key.padEnd(22)} ${bar} ${scoreColor(avg)}`)
  }

  // Print critical feedback
  const criticalFeedback = iter.evaluations.flatMap((e) => e.feedback)
    .filter((f) => f.severity === 'critical' || f.severity === 'major')
  if (criticalFeedback.length > 0) {
    console.log(`  │`)
    console.log(`  │ ${red('Critical/Major Feedback:')}`)
    for (const fb of criticalFeedback.slice(0, 5)) {
      console.log(`  │   • [${fb.dimension}] ${fb.feedback}`)
    }
  }

  console.log(`  └──────────────────────────────────────────────`)
}

function printSamplePreview(sample: VoiceSample, index: number) {
  const preview = sample.text.slice(0, 200).replace(/\n/g, ' ')
  console.log(dim(`    Sample ${index + 1} (${sample.sampleType}, ${sample.wordCount} words): `) +
    `"${preview}..."`)
  console.log(dim(`    Metrics: avg sentence ${sample.metrics.avgSentenceLength} words, ` +
    `${sample.metrics.detectedMetaphorDomains.join(', ') || 'no domains detected'}`))
}

// ═══════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════

function saveRun(run: VoiceResearchRun, outputDir: string) {
  const dir = path.resolve(outputDir)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const filename = `${run.series}-${run.runId}.json`
  const filepath = path.join(dir, filename)
  fs.writeFileSync(filepath, JSON.stringify(run, null, 2))
  console.log(dim(`  Saved run to ${filepath}`))

  // Also save the best profile separately for easy access
  const bestIteration = run.iterations.reduce((best, iter) =>
    iter.bestScore > best.bestScore ? iter : best
  , run.iterations[0])

  if (bestIteration) {
    const profilePath = path.join(dir, `${run.series}-best-profile.json`)
    fs.writeFileSync(profilePath, JSON.stringify(bestIteration.profile, null, 2))
    console.log(dim(`  Saved best profile to ${profilePath}`))

    // Save best samples
    const bestSamples = bestIteration.evaluations
      .filter((e) => e.keepAsSample)
      .map((e) => bestIteration.samples.find((s) => s.id === e.sampleId))
      .filter(Boolean)

    if (bestSamples.length > 0) {
      const samplesPath = path.join(dir, `${run.series}-best-samples.json`)
      fs.writeFileSync(samplesPath, JSON.stringify(bestSamples, null, 2))
      console.log(dim(`  Saved ${bestSamples.length} best samples to ${samplesPath}`))
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  printHeader()

  const args = parseArgs()

  if (!args.profile || !SEED_PROFILES[args.profile]) {
    console.log(red('  Error: --profile required. Available profiles:'))
    for (const key of Object.keys(SEED_PROFILES)) {
      console.log(`    ${cyan(key)} — ${SEED_PROFILES[key].name} (${SEED_PROFILES[key].series})`)
    }
    process.exit(1)
  }

  const apiKey = process.env.OPENAI_KEY
  if (!apiKey && !args.dryRun) {
    console.log(red('  Error: OPENAI_KEY not set in .env.local'))
    process.exit(1)
  }

  const seedProfile = SEED_PROFILES[args.profile]

  console.log(bold('  Configuration'))
  console.log(dim(`  Iterations:  ${args.iterations}`))
  console.log(dim(`  Threshold:   ${args.threshold}`))
  console.log(dim(`  Samples/iter: ${args.samples}`))
  console.log(dim(`  Dry run:     ${args.dryRun}`))
  console.log()

  printProfileSummary(seedProfile)

  if (args.dryRun) {
    console.log(yellow('  DRY RUN — showing profile and system prompt, no generation'))
    console.log()
    console.log(dim('  System Prompt Preview:'))
    console.log(dim('  ' + seedProfile.promptFragments.systemPreamble))
    console.log()
    console.log(dim('  Style Directive:'))
    console.log(dim('  ' + seedProfile.promptFragments.styleDirective))
    console.log()
    console.log(dim('  Constraints:'))
    console.log(dim('  ' + seedProfile.promptFragments.constraintDirective))
    console.log()
    console.log(green('  Profile is valid. Remove --dry-run to start research.'))
    return
  }

  console.log(bold('  Starting research loop...'))
  console.log()

  const run = await runResearch(apiKey!, seedProfile, {
    maxIterations: args.iterations,
    convergenceThreshold: args.threshold,
    samplesPerIteration: args.samples,
    callbacks: {
      onIterationStart: (iteration, profile) => {
        console.log(cyan(`  ── Iteration ${iteration + 1} ──────────────────────────────`))
        console.log(dim(`  Profile: ${profile.name} v${profile.version}`))
        console.log(dim(`  Generating ${args.samples} samples...`))
      },
      onSampleGenerated: (sample, index) => {
        printSamplePreview(sample, index)
      },
      onEvaluation: (evaluation) => {
        console.log(dim(`    Evaluated: ${scoreColor(evaluation.overallScore)}/100`))
      },
      onMutation: (_oldProfile, newProfile) => {
        console.log()
        console.log(yellow(`  Mutated → ${newProfile.name} v${newProfile.version}`))
      },
      onIterationComplete: (iteration) => {
        printIterationResult(iteration)
      },
    },
  })

  // Final summary
  console.log()
  console.log(bold('╔══════════════════════════════════════════════════╗'))
  console.log(bold('║                RESEARCH COMPLETE                 ║'))
  console.log(bold('╚══════════════════════════════════════════════════╝'))
  console.log()
  console.log(`  Status:     ${run.status === 'converged' ? green(run.status) : yellow(run.status)}`)
  console.log(`  Iterations: ${run.iterations.length}`)
  console.log(`  Best Score: ${scoreColor(Math.round(run.bestScore))}/100`)
  console.log(`  Best Profile: ${run.bestProfileId}`)
  console.log()

  // Score trajectory
  console.log(bold('  Score Trajectory:'))
  for (const iter of run.iterations) {
    const bar = '█'.repeat(Math.floor(iter.avgScore / 5))
    console.log(`    Iter ${iter.iteration + 1}: ${bar} ${scoreColor(Math.round(iter.avgScore))}`)
  }
  console.log()

  // Save results
  saveRun(run, args.outputDir)
  console.log()
  console.log(green('  Done.'))
}

main().catch((err) => {
  console.error(red(`  Fatal error: ${err.message}`))
  process.exit(1)
})
