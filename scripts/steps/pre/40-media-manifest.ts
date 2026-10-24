// Image manifest + film directory → public/arc/media.json. Must run after 30-image-manifest.
import { tsx } from '../lib'

export default function mediaManifest() {
  return tsx('scripts/generate-media-manifest.ts')
}
