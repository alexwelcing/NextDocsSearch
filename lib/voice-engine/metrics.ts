/**
 * Prose Metrics — Quantitative Analysis of Generated Text
 *
 * Computes measurable properties of prose that can be compared against
 * a VoiceProfile's target parameters. These are the "phenotype" measurements
 * that the fitness function uses to score profile-sample alignment.
 */

import type { MeasuredMetrics } from './types'

/**
 * Split text into sentences using a regex that handles common abbreviations,
 * dialogue, and edge cases. Not perfect, but good enough for statistical analysis.
 */
export function splitSentences(text: string): string[] {
  // Remove markdown headers and horizontal rules
  const cleaned = text
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^\*\*[^*]+\*\*$/gm, '') // standalone bold lines (section headers)
    .replace(/\*([^*]+)\*/g, '$1') // italics
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .trim()

  if (!cleaned) return []

  // Split on sentence-ending punctuation followed by space or end
  // Handle abbreviations: Dr., Mr., Mrs., Ms., vs., etc., e.g., i.e.
  const abbrevPattern = /(?:Dr|Mr|Mrs|Ms|Prof|vs|etc|e\.g|i\.e|St|Jr|Sr|Inc|Ltd|Corp)\./g
  const placeholder = '<<ABBREV>>'
  const protected_ = cleaned.replace(abbrevPattern, (match) => match.replace('.', placeholder))

  const sentences = protected_
    .split(/(?<=[.!?])\s+(?=[A-Z"'"(])/)
    .map((s) => s.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '.'))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length > 3) // filter out stray punctuation

  return sentences
}

/**
 * Split text into paragraphs (separated by blank lines).
 */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => !p.startsWith('#')) // skip headers
    .filter((p) => p !== '---') // skip horizontal rules
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

/**
 * Compute punctuation profile — counts of specific punctuation marks.
 */
export function computePunctuationProfile(text: string): Record<string, number> {
  const wordCount = countWords(text)
  if (wordCount === 0) return {}

  // Count per 1000 words for normalization
  const normalize = (count: number) => Math.round((count / wordCount) * 1000 * 10) / 10

  return {
    'em-dash': normalize((text.match(/—/g) || []).length),
    semicolon: normalize((text.match(/;/g) || []).length),
    colon: normalize((text.match(/:/g) || []).length),
    ellipsis: normalize((text.match(/\.\.\./g) || []).length),
    parenthetical: normalize((text.match(/\(/g) || []).length),
    question: normalize((text.match(/\?/g) || []).length),
  }
}

/**
 * Detect metaphor domains present in the text.
 * Uses keyword clusters to identify which conceptual domains
 * metaphors are being drawn from.
 */
export function detectMetaphorDomains(text: string): string[] {
  const lower = text.toLowerCase()
  const domains: Record<string, string[]> = {
    cartography: [
      'map', 'territory', 'shore', 'coastline', 'continent', 'landscape',
      'terrain', 'border', 'boundary', 'horizon', 'compass', 'navigate',
    ],
    architecture: [
      'scaffold', 'foundation', 'ceiling', 'floor', 'framework', 'structure',
      'edifice', 'pillar', 'cornerstone', 'architect', 'blueprint',
    ],
    body: [
      'breathe', 'pulse', 'heartbeat', 'nerve', 'muscle', 'bone', 'skin',
      'hand', 'eye', 'finger', 'stomach', 'spine', 'shoulder', 'throat',
      'thumb', 'palm', 'wrist', 'callus', 'posture', 'inhale', 'exhale',
      'mouth', 'nose', 'tongue', 'swallow', 'jaw', 'knuckle', 'elbow',
      'chest', 'rib', 'knee', 'ankle', 'heel', 'forehead', 'temple',
      'cardigan', 'wool', 'cotton', 'sleeve', 'collar',
    ],
    geology: [
      'sediment', 'stratum', 'strata', 'erosion', 'tectonic', 'fossil',
      'bedrock', 'mineral', 'crystal', 'seismic', 'volcanic', 'magma',
    ],
    weather: [
      'storm', 'pressure', 'current', 'tide', 'cloud', 'lightning',
      'wind', 'rain', 'fog', 'haze', 'temperature', 'climate', 'season',
    ],
    ecology: [
      'ecology', 'ecosystem', 'symbiosis', 'organism', 'habitat',
      'migration', 'species', 'evolution', 'niche', 'bloom', 'spore',
    ],
    physics: [
      'wave', 'interference', 'refraction', 'frequency', 'resonance',
      'amplitude', 'spectrum', 'particle', 'field', 'gravity', 'orbit',
    ],
    archaeology: [
      'excavat', 'artifact', 'ruin', 'relic', 'vestige', 'residue',
      'patina', 'decay', 'preserve', 'archive', 'fossil', 'layer',
    ],
    workshop: [
      'forge', 'anvil', 'hammer', 'chisel', 'lathe', 'grain',
      'temper', 'weld', 'polish', 'calibrat', 'instrument', 'tool',
      'bench', 'cork', 'glass', 'decant', 'pour', 'blade',
      'wheel', 'spindle', 'needle', 'thread', 'stitch', 'loom',
    ],
    clinic: [
      'diagnos', 'symptom', 'patient', 'treatment', 'scan', 'prognos',
      'chronic', 'acute', 'patholog', 'clinical', 'surgical', 'dose',
      'tast', 'palate', 'aroma', 'volatile', 'acidity', 'evaluat',
    ],
    ocean: [
      'ocean', 'sea', 'wave', 'tide', 'depth', 'surface', 'shore',
      'current', 'drift', 'submerge', 'float', 'abyss', 'deep',
    ],
    light: [
      'luminous', 'glow', 'shadow', 'illuminate', 'radiant', 'dim',
      'bright', 'shimmer', 'flicker', 'beam', 'ray', 'reflection',
    ],
  }

  const found: string[] = []
  for (const [domain, keywords] of Object.entries(domains)) {
    const hits = keywords.filter((kw) => lower.includes(kw))
    // Require at least 2 keyword hits to register a domain
    if (hits.length >= 2) {
      found.push(domain)
    }
  }

  return found
}

/**
 * Check for constraint violations — forbidden patterns appearing in text.
 */
export function findConstraintViolations(text: string, forbidden: string[]): string[] {
  const violations: string[] = []
  for (const pattern of forbidden) {
    const regex = new RegExp(pattern, 'gi')
    const matches = text.match(regex)
    if (matches) {
      violations.push(`"${pattern}" found ${matches.length}x`)
    }
  }
  return violations
}

/**
 * Compute standard deviation.
 */
function stddev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map((v) => (v - mean) ** 2)
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Compute all measurable metrics for a prose sample.
 */
export function computeMetrics(text: string, forbiddenPatterns: string[] = []): MeasuredMetrics {
  const sentences = splitSentences(text)
  const sentenceLengths = sentences.map(countWords)
  const paragraphs = splitParagraphs(text)
  const paragraphSentenceCounts = paragraphs.map((p) => splitSentences(p).length)

  const totalSentences = sentenceLengths.length || 1
  const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / totalSentences

  return {
    avgSentenceLength: Math.round(avgLen * 10) / 10,
    sentenceLengthVariance: Math.round(stddev(sentenceLengths) * 10) / 10,
    shortSentenceRatio:
      Math.round((sentenceLengths.filter((l) => l <= 8).length / totalSentences) * 100) / 100,
    longSentenceRatio:
      Math.round((sentenceLengths.filter((l) => l >= 50).length / totalSentences) * 100) / 100,
    punctuationProfile: computePunctuationProfile(text),
    avgParagraphLength:
      Math.round(
        (paragraphSentenceCounts.reduce((a, b) => a + b, 0) / (paragraphSentenceCounts.length || 1)) *
          10
      ) / 10,
    detectedMetaphorDomains: detectMetaphorDomains(text),
    constraintViolations: findConstraintViolations(text, forbiddenPatterns),
  }
}
