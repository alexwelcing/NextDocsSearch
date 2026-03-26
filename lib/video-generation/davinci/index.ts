/**
 * daVinci-MagiHuman Video Generation
 * 
 * A 15B parameter single-stream Transformer for joint text-video-audio generation
 * with exceptional human-centric quality.
 * 
 * @example
 * ```typescript
 * import { DaVinciClient, buildEnhancedPrompt } from '@/lib/video-generation/davinci'
 * 
 * const client = new DaVinciClient(process.env.HF_TOKEN)
 * 
 * const result = await client.generate({
 *   prompt: buildEnhancedPrompt({
 *     character: 'A young woman with expressive eyes...',
 *     action: 'speaking with conviction',
 *     mood: 'earnest and hopeful'
 *   }),
 *   resolution: '540p',
 *   duration: 5
 * }, './output.mp4')
 * ```
 * 
 * @see https://huggingface.co/spaces/SII-GAIR/daVinci-MagiHuman
 * @see https://github.com/GAIR-NLP/daVinci-MagiHuman
 */

export {
  DaVinciClient,
  buildEnhancedPrompt,
  generateVideo,
} from './client'

export type {
  DaVinciGenerationRequest,
  DaVinciGenerationResult,
  DialogueLine,
  SceneAnalysis,
  Scene,
  VisualStyle,
  CharacterProfile,
} from './client'
