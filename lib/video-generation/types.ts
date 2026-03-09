/**
 * LTX-2.3 Article-to-Video Pipeline Types
 *
 * Types for the repeatable workflow that converts articles into
 * short, social-ready videos using LTX-2.3 video generation.
 *
 * @see https://huggingface.co/Lightricks/LTX-Video
 */

// ═══════════════════════════════════════════════════════════════
// ARTICLE INTERMEDIATE REPRESENTATION
// ═══════════════════════════════════════════════════════════════

export interface ArticleIntermediate {
  url: string
  slug: string
  title: string
  author: string
  date: string
  heroImage?: string
  sections: ArticleSection[]
  inlineImages: string[]
  quotes: ArticleQuote[]
}

export interface ArticleSection {
  heading: string
  paragraphs: string[]
  bullets: string[]
  codeBlocks: string[]
  images: string[]
  callouts: ArticleCallout[]
}

export interface ArticleCallout {
  text: string
  type: 'warning' | 'info' | 'tip' | 'note'
}

export interface ArticleQuote {
  text: string
  sectionHeading: string
  type: 'pull_quote' | 'warning' | 'definition' | 'claim'
}

// ═══════════════════════════════════════════════════════════════
// HOOK AND CLOSE SELECTION
// ═══════════════════════════════════════════════════════════════

export interface ScoredLine {
  text: string
  score: number
  sectionHeading: string
  reasons: string[]
}

// ═══════════════════════════════════════════════════════════════
// SCENE PLAN
// ═══════════════════════════════════════════════════════════════

export type ArticleType =
  | 'technical-tutorial'
  | 'product-strategy'
  | 'speculative-fiction'
  | 'warning-risk-memo'
  | 'general'

export type ClipRole =
  | 'hook'
  | 'why_it_matters'
  | 'key_concept'
  | 'mechanism'
  | 'example'
  | 'limits'
  | 'warning'
  | 'tradeoff'
  | 'framework'
  | 'recommendation'
  | 'escalation'
  | 'twist'
  | 'consequence'
  | 'risk_metaphor'
  | 'mitigation'
  | 'closing_thought'
  | 'cta'

export interface ScenePlan {
  articleSlug: string
  articleType: ArticleType
  totalClips: number
  estimatedDurationS: number
  hookLine: ScoredLine
  closeLine: ScoredLine
  clips: ClipPlan[]
  voiceoverScript: string[]
}

export interface ClipPlan {
  sceneId: string
  clipIndex: number
  role: ClipRole
  durationS: number
  captionText: string
  voiceoverText: string
  sourceSection?: string
  sourceTextSpan?: string
  ltxMode: LtxMode
  promptTemplate: string
  imageAnchor?: string
}

// ═══════════════════════════════════════════════════════════════
// LTX-2.3 GENERATION PARAMETERS
// ═══════════════════════════════════════════════════════════════

export type LtxMode = 'T2V' | 'I2V'

export type LtxCheckpoint = 'ltx-2.3-22b-distilled' | 'ltx-2.3-22b-dev'

export interface LtxParameters {
  mode: LtxMode
  prompt: string
  imageUrl?: string
  imagePath?: string
  checkpoint: LtxCheckpoint
  width: number
  height: number
  fps: number
  durationS: number
  frames: number
  seed?: number
  enhancePrompt: boolean
  highResolution: boolean
}

export interface LtxResolutionPreset {
  label: string
  width: number
  height: number
  aspectRatio: string
  use: string
}

// ═══════════════════════════════════════════════════════════════
// LINKEDIN OUTPUT SPECS
// ═══════════════════════════════════════════════════════════════

export type LinkedInAspectRatio = '4:5' | '9:16' | '1:1' | '16:9'

export interface LinkedInExportPreset {
  aspectRatio: LinkedInAspectRatio
  width: number
  height: number
  maxFileSizeMb: number
  maxDurationS: number
  description: string
}

// ═══════════════════════════════════════════════════════════════
// ASSET LOG (for reproducibility)
// ═══════════════════════════════════════════════════════════════

export type AssetRole = 'hero_anchor' | 'section_anchor' | 'motif' | 'b_roll' | 'hook_bg' | 'cta_bg'

export type QcRating = 'pass' | 'needs_fix' | 'rejected'

export interface AssetLogEntry {
  articleSlug: string
  sceneId: string
  intendedRole: AssetRole
  sourceTextSpan: string
  imageAssetId?: string
  imagePrompt?: string
  ltxMode: LtxMode
  ltxPrompt: string
  modelCheckpoint: LtxCheckpoint
  widthHeight: string
  fps: number
  durationS: number
  frames: number
  seed?: number
  promptEnhancer: boolean
  outputClipPath: string
  qcRating?: QcRating
  failureNotes?: string
  generatedAt: string
}

export interface AssetLog {
  articleSlug: string
  generatedAt: string
  entries: AssetLogEntry[]
  totalClips: number
  totalDurationS: number
}

// ═══════════════════════════════════════════════════════════════
// VIDEO GENERATION API
// ═══════════════════════════════════════════════════════════════

export interface VideoGenerationRequest {
  prompt: string
  mode: LtxMode
  imageUrl?: string
  durationS?: number
  width?: number
  height?: number
  seed?: number
  enhancePrompt?: boolean
  highResolution?: boolean
}

export interface VideoGenerationResponse {
  success: boolean
  videoUrl?: string
  seed?: number
  width?: number
  height?: number
  frames?: number
  durationS?: number
  generationTimeMs?: number
  error?: string
}
