/**
 * HF-Mount Integration for NextDocsSearch
 * 
 * Provides filesystem-like access to HuggingFace models, datasets, and buckets
 * without downloading entire repositories. Uses lazy loading via FUSE/NFS.
 * 
 * @example
 * ```typescript
 * import { mountRepo, HfModelLoader } from '@/lib/hf-mount'
 * 
 * // Quick mount
 * const model = await mountRepo('gpt2', '/tmp/gpt2')
 * const config = JSON.parse(model.readFile('config.json').toString())
 * 
 * // Or use the loader class
 * const loader = new HfModelLoader('SII-GAIR/daVinci-MagiHuman')
 * await loader.mount()
 * const config = loader.readConfig('config.json')
 * ```
 * 
 * @see https://github.com/huggingface/hf-mount
 */

export {
  // Core functions
  mountRepo,
  mountBucket,
  unmount,
  getMountStatus,
  cleanup,
  
  // Class-based API
  HfModelLoader,
  
  // Types
  type HfMountConfig,
  type HfMountStatus,
  type MountedModel,
} from './mount'
