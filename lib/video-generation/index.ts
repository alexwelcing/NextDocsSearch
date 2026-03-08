/**
 * Video Generation Pipeline — Barrel Exports
 *
 * LTX-2.3 article-to-video pipeline for generating short,
 * social-ready videos from alexwelcing.com articles.
 */

// Types
export type {
  ArticleIntermediate,
  ArticleSection,
  ArticleCallout,
  ArticleQuote,
  ArticleType,
  ScoredLine,
  ScenePlan,
  ClipPlan,
  ClipRole,
  LtxMode,
  LtxCheckpoint,
  LtxParameters,
  LtxResolutionPreset,
  LinkedInAspectRatio,
  LinkedInExportPreset,
  AssetRole,
  QcRating,
  AssetLogEntry,
  AssetLog,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from './types'

// Article parsing
export { parseArticle, getHeadings, getLeadParagraphs } from './article-parser'

// Scene planning
export {
  scoreHook,
  scoreClose,
  selectHook,
  selectClose,
  detectArticleType,
  generateScenePlan,
} from './scene-planner'

// LTX parameter validation
export {
  DIMENSION_DIVISOR,
  FRAME_MODULUS,
  MAX_FRAMES,
  DEFAULT_FPS,
  MAX_DURATION_S,
  MIN_DURATION_S,
  RESOLUTION_PRESETS,
  LINKEDIN_EXPORT_PRESETS,
  isDimensionValid,
  roundDimensionUp,
  roundDimensionNearest,
  isFrameCountValid,
  roundFrameCount,
  calculateFrames,
  calculateDuration,
  findClosestPreset,
  validateLtxParameters,
  buildLtxParameters,
} from './parameters'

// Prompt templates
export {
  getTemplatesForRole,
  fillTemplate,
  buildPrompt,
  buildVariablesFromClip,
  getAllTemplates,
} from './prompt-templates'
export type { PromptVariables, PromptTemplate } from './prompt-templates'

// Asset logging
export {
  createAssetLog,
  addLogEntry,
  buildLogEntry,
  serializeLog,
} from './asset-logger'
