// public/images scan → lib/generated/image-manifest.json.
import { tsx } from '../lib'

export default function imageManifest() {
  return tsx('scripts/generate-image-manifest.ts')
}
