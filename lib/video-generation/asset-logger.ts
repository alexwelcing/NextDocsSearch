/**
 * Asset Logger for Video Generation Pipeline
 *
 * Tracks all generation parameters for reproducibility,
 * following the asset log format defined in the pipeline spec.
 */

import type { AssetLog, AssetLogEntry, AssetRole, LtxMode, LtxCheckpoint, QcRating } from './types'

/**
 * Create a new asset log for an article
 */
export function createAssetLog(articleSlug: string): AssetLog {
  return {
    articleSlug,
    generatedAt: new Date().toISOString(),
    entries: [],
    totalClips: 0,
    totalDurationS: 0,
  }
}

/**
 * Add an entry to the asset log
 */
export function addLogEntry(
  log: AssetLog,
  entry: Omit<AssetLogEntry, 'generatedAt'>
): AssetLog {
  const fullEntry: AssetLogEntry = {
    ...entry,
    generatedAt: new Date().toISOString(),
  }

  return {
    ...log,
    entries: [...log.entries, fullEntry],
    totalClips: log.totalClips + 1,
    totalDurationS: log.totalDurationS + entry.durationS,
  }
}

/**
 * Build a log entry from generation parameters
 */
export function buildLogEntry(params: {
  articleSlug: string
  sceneId: string
  intendedRole: AssetRole
  sourceTextSpan: string
  imageAssetId?: string
  imagePrompt?: string
  ltxMode: LtxMode
  ltxPrompt: string
  modelCheckpoint: LtxCheckpoint
  width: number
  height: number
  fps: number
  durationS: number
  frames: number
  seed?: number
  promptEnhancer: boolean
  outputClipPath: string
  qcRating?: QcRating
  failureNotes?: string
}): Omit<AssetLogEntry, 'generatedAt'> {
  return {
    articleSlug: params.articleSlug,
    sceneId: params.sceneId,
    intendedRole: params.intendedRole,
    sourceTextSpan: params.sourceTextSpan,
    imageAssetId: params.imageAssetId,
    imagePrompt: params.imagePrompt,
    ltxMode: params.ltxMode,
    ltxPrompt: params.ltxPrompt,
    modelCheckpoint: params.modelCheckpoint,
    widthHeight: `${params.width}×${params.height}`,
    fps: params.fps,
    durationS: params.durationS,
    frames: params.frames,
    seed: params.seed,
    promptEnhancer: params.promptEnhancer,
    outputClipPath: params.outputClipPath,
    qcRating: params.qcRating,
    failureNotes: params.failureNotes,
  }
}

/**
 * Serialize asset log to JSON string
 */
export function serializeLog(log: AssetLog): string {
  return JSON.stringify(log, null, 2)
}
