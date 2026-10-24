// Test helpers: a small in-memory index served the way env.ASSETS would serve it.
import { OPERATOR_PANELS } from '../immersive/operatorData'
import type { ArchiveRecord } from '../archive/types'
import { buildSearchIndex, emitSearchIndex, type BuildRecord, type VectorSource } from './build'
import type { RetrievalDeps } from './types'

/** Deterministic PRNG (mulberry32) for reproducible random vectors. */
export function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomVector(random: () => number, dims: number): Float32Array {
  return Float32Array.from({ length: dims }, () => random() * 2 - 1)
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / Math.sqrt(na * nb)
}

/** About 510 characters: past the heading break, short of a closed chunk. */
const paragraph = (topic: string, n: number) =>
  Array.from(
    { length: 3 },
    () =>
      `This passage about ${topic} is paragraph ${n}. It explains ${topic} in enough words to ` +
      `fill a realistic block of archive text, so the chunker has something to pack.`
  ).join(' ')

export const FIXTURE_RECORDS: BuildRecord[] = [
  {
    slug: 'quantum-key-distribution',
    title: 'Quantum Key Distribution',
    date: '2025-11-03',
    description: 'BB84 and photon polarization for unbreakable keys.',
    type: 'research',
    keywords: ['QKD', 'quantum cryptography'],
    domains: ['security'],
    blocks: [
      { t: 'p', x: paragraph('quantum key exchange', 1) },
      { t: 'h', x: 'The BB84 Protocol' },
      { t: 'p', x: paragraph('photon polarization', 2) },
      { t: 'p', x: paragraph('eavesdropper detection', 3) },
      { t: 'h', x: 'Limits' },
      { t: 'p', x: paragraph('distance limits for fiber', 4) },
    ],
  },
  {
    slug: 'agent-authentication',
    title: 'Agents Need Their Own Credentials',
    date: '2026-02-01',
    description: 'Scoped, revocable credentials for AI agents.',
    type: 'research',
    keywords: ['agent security', 'OAuth'],
    domains: ['AI agents'],
    blocks: [
      { t: 'p', x: paragraph('agent credentials and delegation', 1) },
      { t: 'h', x: 'Scopes' },
      { t: 'p', x: paragraph('time-bounded agent tokens', 2) },
      { t: 'p', x: paragraph('audit trails for agents', 3) },
    ],
  },
  {
    slug: 'the-last-cartographer',
    title: 'The Last Cartographer',
    date: '2064-07-22',
    description: 'A cartographer sets down her instruments.',
    type: 'fiction',
    keywords: ['cognitive cartography'],
    domains: ['cartography'],
    blocks: [
      { t: 'p', x: paragraph('the final expedition', 1) },
      { t: 'p', x: paragraph('maps of the space between minds', 2) },
      { t: 'p', x: paragraph('retirement and instruments', 3) },
    ],
  },
]

/** ArchiveRecord view of the fixtures, as the article manifest would provide them. */
export const FIXTURE_ARCHIVE: ArchiveRecord[] = FIXTURE_RECORDS.map((record) => ({
  slug: record.slug,
  title: record.title,
  date: record.date,
  description: record.description,
  type: record.type ?? 'article',
  minutes: 3,
  keywords: record.keywords ?? [],
  domains: record.domains ?? [],
  mechanics: [],
  searchText: record.blocks.map((block) => block.x).join(' '),
  hero: null,
}))

export async function fixtureIndex(vectorSources: (hashes: string[]) => VectorSource[] = () => []) {
  const input = { records: FIXTURE_RECORDS, operatorPanels: Object.values(OPERATOR_PANELS) }
  const lexical = await buildSearchIndex(input)
  const sources = vectorSources(lexical.chunks.chunks.map((chunk) => chunk.hash))
  const built = sources.length
    ? await buildSearchIndex({ ...input, vectorSources: sources })
    : lexical
  const { assets, manifest } = await emitSearchIndex(built)
  const files = new Map(assets.map((asset) => [asset.path, asset.bytes]))
  const calls: string[] = []
  const fetchAsset: RetrievalDeps['fetchAsset'] = async (path) => {
    calls.push(path)
    const bytes = files.get(path)
    return bytes ? new Response(bytes) : new Response('missing', { status: 404 })
  }
  return { built, manifest, assets, fetchAsset, calls }
}
