/**
 * OpenStory-Inspired Narrative Video Composer
 * 
 * Transforms scripts into styled video productions with:
 * - Scene-by-scene breakdown with continuity tracking
 * - Style consistency across temporal eras
 * - Character-driven video via daVinci-MagiHuman
 * - Environmental shots via LTX-Video
 * 
 * @example
 * ```typescript
 * import { NarrativeVideoComposer, composeArticleVideo } from '@/lib/narrative-video'
 * 
 * // Full composer
 * const composer = new NarrativeVideoComposer('./output', process.env.HF_TOKEN)
 * const project = await composer.createProjectFromArticle('threshold-01-the-last-diagnosis')
 * const video = await composer.compose(project)
 * 
 * // Quick compose
 * const video = await composeArticleVideo('threshold-01-the-last-diagnosis', './output')
 * ```
 * 
 * @see https://github.com/openstory-so/openstory
 */

export {
  NarrativeVideoComposer,
  composeArticleVideo,
  eraToStyleGuide,
  getMotifPromptEnrichment,
} from './composer'

export type {
  NarrativeVideoProject,
  VideoSegment,
  StyleGuide,
  CharacterVisualProfile,
  AudioDesign,
  GenerationResult,
  ComposedVideo,
} from './composer'
