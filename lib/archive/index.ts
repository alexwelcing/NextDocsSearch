// Browser-safe entrypoint. Node filesystem loading lives only in ./server.
export type { ArchiveRecord, ArcRecordSlim, ArchiveSource, SearchHit } from './types'
export { toSlim } from './records'
export { listRecords } from './load'
export { HttpIndexSource } from './http'
export { searchRecords } from './search'
