/**
 * Layout Algorithms — Pure positioning functions for 3D article visualization
 *
 * Each layout function takes an article's metadata and its index within the
 * collection and returns a world-space [x, y, z] position. Functions are pure,
 * testable, and runtime-swappable.
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface LayoutArticle {
  id: string
  polarity?: number
  horizon?: string
  category?: string
  mechanics?: string[]
  publishedAt?: Date
}

export interface LayoutContext {
  article: LayoutArticle
  index: number
  totalCount: number
}

export type LayoutFunction = (ctx: LayoutContext) => [number, number, number]

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const HORIZON_SCALE: Record<string, number> = {
  NQ: 1,
  NY: 2,
  N5: 5,
  N20: 12,
  N50: 18,
  N100: 24,
}

export const MECHANIC_ANGLES: Record<string, number> = {
  'labor-substitution': 0,
  'discovery-compression': 0.9,
  'governance-lag': 1.8,
  'epistemic-erosion': 2.7,
  'scarcity-inversion': 3.6,
  'competence-erosion': 4.5,
  'identity-dissolution': 5.4,
}

export const POLARITY_COLORS: Record<number, string> = {
  [-3]: '#ff2244',
  [-2]: '#ff5566',
  [-1]: '#ff8899',
  0: '#888899',
  1: '#88cccc',
  2: '#44ddee',
  3: '#00ffcc',
}

export function polarityColor(polarity: number): string {
  return POLARITY_COLORS[Math.round(polarity)] ?? '#888899'
}

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function categoryHash(category: string | undefined): number {
  if (!category || category.length < 2) return 50
  return (category.charCodeAt(0) * 7 + category.charCodeAt(1) * 13) % 100
}

function jitter(range: number): number {
  return (Math.random() - 0.5) * range
}

// ═══════════════════════════════════════════════════════════════
// LAYOUT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Semantic axes: X = polarity, Y = horizon, Z = mechanic/category
 * The default for VectorSpaceExplorer — meaningful, interpretable axes.
 */
export function semanticAxesLayout({ article }: LayoutContext): [number, number, number] {
  const x = (article.polarity ?? 0) * 5 + jitter(1.5)

  const h = article.horizon ? HORIZON_SCALE[article.horizon] ?? 8 : 8
  const y = h - 12 + jitter(1.5)

  const mechanic = article.mechanics?.[0]
  const angle = mechanic ? MECHANIC_ANGLES[mechanic] ?? 0 : 0
  const radial = 4 + (categoryHash(article.category) / 100) * 10
  const z = radial * Math.sin(angle) + jitter(2)

  return [x, y, z]
}

/**
 * Fibonacci sphere — even distribution across a sphere surface.
 * Good for seeing everything at once without clustering.
 */
export function sphereLayout(
  { index, totalCount }: LayoutContext,
  radius = 20
): [number, number, number] {
  const phi = Math.acos(-1 + (2 * index) / totalCount)
  const theta = Math.sqrt(totalCount * Math.PI) * phi

  return [
    radius * Math.cos(theta) * Math.sin(phi) + jitter(0.5),
    radius * Math.sin(theta) * Math.sin(phi) * 0.6,
    radius * Math.cos(phi) + jitter(0.5),
  ]
}

/**
 * Galaxy spiral — articles arranged along spiral arms.
 * Visually dramatic, groups articles along 3 arms.
 */
export function galaxyLayout(
  { index, totalCount }: LayoutContext,
  radius = 25
): [number, number, number] {
  const arms = 3
  const armIndex = index % arms
  const posInArm = Math.floor(index / arms)
  const armAngle = (armIndex / arms) * Math.PI * 2

  const distance = (posInArm / (totalCount / arms)) * radius
  const spiralAngle = armAngle + distance * 0.3

  return [
    distance * Math.cos(spiralAngle),
    jitter(3),
    distance * Math.sin(spiralAngle),
  ]
}

/**
 * Timeline — linear horizontal spread, Y = polarity height.
 * Good for chronological exploration.
 */
export function timelineLayout(
  { article, index, totalCount }: LayoutContext,
  width = 40
): [number, number, number] {
  const x = ((index / totalCount) * 2 - 1) * width
  const y = (article.polarity ?? 0) * 5
  const z = jitter(5)
  return [x, y, z]
}

/**
 * Cluster — articles grouped by category, clusters arranged in a ring.
 */
export function clusterLayout(
  { article, index, totalCount }: LayoutContext,
  radius = 18
): [number, number, number] {
  const cat = article.category ?? 'uncategorized'
  const catNum = categoryHash(cat)
  const clusterAngle = (catNum / 100) * Math.PI * 2

  const clusterX = radius * 0.6 * Math.cos(clusterAngle)
  const clusterZ = radius * 0.6 * Math.sin(clusterAngle)

  // Spread within cluster
  const localAngle = (index / totalCount) * Math.PI * 2
  const localRadius = 2 + jitter(3)

  return [
    clusterX + localRadius * Math.cos(localAngle),
    jitter(4),
    clusterZ + localRadius * Math.sin(localAngle),
  ]
}

/**
 * Helix — double helix with positive polarity on one strand,
 * negative on the other. Neutral articles form the backbone.
 */
export function helixLayout(
  { article, index, totalCount }: LayoutContext,
  radius = 8,
  height = 40
): [number, number, number] {
  const t = index / totalCount
  const polarity = article.polarity ?? 0
  const strand = polarity >= 0 ? 0 : 1
  const strandOffset = strand * Math.PI

  const angle = t * Math.PI * 6 + strandOffset
  const x = radius * Math.cos(angle)
  const y = (t - 0.5) * height
  const z = radius * Math.sin(angle)

  return [x + jitter(0.5), y, z + jitter(0.5)]
}

// ═══════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════

export type LayoutName =
  | 'semantic-axes'
  | 'sphere'
  | 'galaxy'
  | 'timeline'
  | 'clusters'
  | 'helix'

export const LAYOUT_REGISTRY: Record<LayoutName, LayoutFunction> = {
  'semantic-axes': semanticAxesLayout,
  sphere: sphereLayout,
  galaxy: galaxyLayout,
  timeline: timelineLayout,
  clusters: clusterLayout,
  helix: helixLayout,
}

/**
 * Compute positions for a set of articles using a named layout.
 */
export function computePositions(
  articles: LayoutArticle[],
  layout: LayoutName | LayoutFunction = 'semantic-axes'
): Map<string, [number, number, number]> {
  const fn = typeof layout === 'function' ? layout : LAYOUT_REGISTRY[layout]
  const positions = new Map<string, [number, number, number]>()

  articles.forEach((article, index) => {
    positions.set(
      article.id,
      fn({ article, index, totalCount: articles.length })
    )
  })

  return positions
}
