// The filesystem MDX walk that answered Ship before lib/retrieval is gone: lib/ship/handleShip.ts
// ranks with getShipContext. What remains is the result shape and profile-intent check that the
// lib/retrieval suites still pin themselves against; delete this file once they import
// lib/retrieval/types and lib/retrieval/profile directly.
import type { RetrievalResult } from '../retrieval/types'

export { detectProfileIntent } from '../retrieval/profile'

export type LocalArchiveQueryResult = Pick<
  RetrievalResult,
  'profileIntent' | 'profileFacts' | 'context' | 'instantResults'
>
