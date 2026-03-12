#!/usr/bin/env tsx
/**
 * Measure a prose sample against a voice profile.
 * Usage: pnpm tsx scripts/measure-sample.ts <sample-file> <profile-key>
 */

import * as fs from 'fs'
import { computeMetrics, splitSentences, countWords } from '../lib/voice-engine/metrics'
import { SEED_PROFILES } from '../lib/voice-engine/profiles'

const samplePath = process.argv[2]
const profileKey = process.argv[3] || 'nkechi'

if (!samplePath) {
  console.error('Usage: pnpm tsx scripts/measure-sample.ts <sample-file> [profile-key]')
  process.exit(1)
}

const text = fs.readFileSync(samplePath, 'utf-8')
const profile = SEED_PROFILES[profileKey]
if (!profile) {
  console.error(`Unknown profile: ${profileKey}. Available: ${Object.keys(SEED_PROFILES).join(', ')}`)
  process.exit(1)
}

const metrics = computeMetrics(text, profile.constraints.forbidden)
const p = profile.parameters

console.log('\n╔══════════════════════════════════════════════════╗')
console.log('║           VOICE METRICS ANALYSIS                 ║')
console.log('╚══════════════════════════════════════════════════╝\n')

console.log(`Profile: ${profile.name} v${profile.version}`)
console.log(`Sample:  ${samplePath}`)
console.log(`Words:   ${countWords(text)}`)
console.log()

// Rhythm comparison
console.log('── RHYTHM ──────────────────────────────────────────')
const rhythmTarget = p.rhythm
console.log(`  Avg sentence length:   ${metrics.avgSentenceLength} words  (target: ~${rhythmTarget.avgSentenceLength})`)
const lenDelta = Math.abs(metrics.avgSentenceLength - rhythmTarget.avgSentenceLength)
console.log(`    Delta: ${lenDelta.toFixed(1)} words  ${lenDelta < 4 ? '✓ CLOSE' : lenDelta < 8 ? '~ FAIR' : '✗ OFF'}`)

console.log(`  Short ratio (≤8w):     ${metrics.shortSentenceRatio}  (target: ~${rhythmTarget.shortSentenceRatio})`)
const shortDelta = Math.abs(metrics.shortSentenceRatio - rhythmTarget.shortSentenceRatio)
console.log(`    Delta: ${shortDelta.toFixed(2)}  ${shortDelta < 0.05 ? '✓ CLOSE' : shortDelta < 0.1 ? '~ FAIR' : '✗ OFF'}`)

console.log(`  Long ratio (≥50w):     ${metrics.longSentenceRatio}  (target: ~${rhythmTarget.longSentenceRatio})`)
const longDelta = Math.abs(metrics.longSentenceRatio - rhythmTarget.longSentenceRatio)
console.log(`    Delta: ${longDelta.toFixed(2)}  ${longDelta < 0.05 ? '✓ CLOSE' : longDelta < 0.1 ? '~ FAIR' : '✗ OFF'}`)

console.log(`  Variance:              ${metrics.sentenceLengthVariance}  (target: ~${rhythmTarget.sentenceLengthVariance})`)
console.log()

// Punctuation
console.log('── PUNCTUATION ─────────────────────────────────────')
for (const [key, val] of Object.entries(metrics.punctuationProfile)) {
  console.log(`  ${key.padEnd(16)} ${val} per 1000 words`)
}
console.log(`  Target signature: ${rhythmTarget.signaturePunctuation}`)
console.log()

// Imagery
console.log('── IMAGERY ─────────────────────────────────────────')
console.log(`  Detected domains:  ${metrics.detectedMetaphorDomains.join(', ') || 'none'}`)
console.log(`  Target domains:    ${p.imagery.metaphorDomains.join(', ')}`)
console.log(`  Forbidden domains: ${p.imagery.forbiddenDomains.join(', ')}`)
const forbiddenHits = metrics.detectedMetaphorDomains.filter(
  d => p.imagery.forbiddenDomains.includes(d)
)
if (forbiddenHits.length > 0) {
  console.log(`  ✗ VIOLATION: forbidden domains detected: ${forbiddenHits.join(', ')}`)
} else {
  console.log(`  ✓ No forbidden domain violations`)
}
const targetHits = metrics.detectedMetaphorDomains.filter(
  d => p.imagery.metaphorDomains.includes(d)
)
console.log(`  Target domain coverage: ${targetHits.length}/${p.imagery.metaphorDomains.length}`)
console.log()

// Constraints
console.log('── CONSTRAINTS ─────────────────────────────────────')
if (metrics.constraintViolations.length === 0) {
  console.log('  ✓ No forbidden pattern violations')
} else {
  for (const v of metrics.constraintViolations) {
    console.log(`  ✗ ${v}`)
  }
}
console.log()

// Sentence length distribution
const sentences = splitSentences(text)
const lengths = sentences.map(countWords)
const buckets = [0, 0, 0, 0, 0] // ≤8, 9-16, 17-30, 31-50, 50+
for (const l of lengths) {
  if (l <= 8) buckets[0]++
  else if (l <= 16) buckets[1]++
  else if (l <= 30) buckets[2]++
  else if (l <= 50) buckets[3]++
  else buckets[4]++
}
console.log('── SENTENCE LENGTH DISTRIBUTION ─────────────────────')
const labels = ['≤8', '9-16', '17-30', '31-50', '50+']
for (let i = 0; i < 5; i++) {
  const pct = Math.round((buckets[i] / sentences.length) * 100)
  const bar = '█'.repeat(Math.floor(pct / 2))
  console.log(`  ${labels[i].padEnd(6)} ${bar} ${pct}% (${buckets[i]})`)
}
console.log(`  Total sentences: ${sentences.length}`)
console.log()
