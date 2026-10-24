// TTF → windfoil glyph atlases in public/fonts/.
import { tsx } from '../lib'

export default function fontAtlas() {
  return tsx('scripts/generate-font-atlas.ts')
}
