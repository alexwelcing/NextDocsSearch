// Fail before any generator runs when the checkout has no media (see scripts/guard-media.ts).
import { guardMedia } from '../../guard-media'

export default function mediaGuard() {
  guardMedia()
}
