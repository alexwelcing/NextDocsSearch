// POST /api/vector-search on the Worker: the shared Ship handler (lib/ship/handleShip.ts) with
// Workers AI for generation (and, once a vector set built with EMBED_MODEL ships, for the query
// embedding), the search index and records read through env.ASSETS, and SHIP_LIMITER in front of
// the model. The search manifest is imported statically, so the Worker and the index assets it
// names always come from the same deploy.
import searchManifest from '../../lib/generated/search-manifest.json'
import { createWorkersAiChat, parseModelList } from '../../lib/ai/providers/workersAi'
import { ARCHIVE_FULL_URL, HttpIndexSource } from '../../lib/archive/http'
import { listRecords } from '../../lib/archive/load'
import type { ArchiveSource } from '../../lib/archive/types'
import type { SearchManifest, VectorSetEntry } from '../../lib/retrieval/types'
import { clientIp, limiterKey } from '../../lib/server/scores'
import { handleShip, type ShipDeps, type ShipLimiter } from '../../lib/ship/handleShip'
import type { AssetsLike, WorkerEnv } from '../env'
import { fetchAsset } from './assets'

const MANIFEST = searchManifest as SearchManifest

/** The query instruction for a vector set that does not carry its own. */
export const EMBED_INSTRUCTION =
  "Given a question about Alex Welcing's essays, speculative fiction and AI product work, " +
  'retrieve passages that answer it'

/** The vector set the configured embedder can query, if the index has one. */
export function denseVectorSet(
  manifest: SearchManifest,
  embedModel: string | undefined
): VectorSetEntry | undefined {
  if (!embedModel) return undefined
  return manifest.vectors.find((set) => set.runtime === embedModel)
}

/** One source per assets binding, so the records load once per isolate (failures retry). */
const recordSources = new WeakMap<AssetsLike, ArchiveSource>()

function recordSource(assets: AssetsLike): ArchiveSource {
  let source = recordSources.get(assets)
  if (!source) {
    source = new HttpIndexSource(ARCHIVE_FULL_URL, (path) => fetchAsset(assets, path))
    recordSources.set(assets, source)
  }
  return source
}

/** SHIP_LIMITER keyed on the client (an IPv6 client on its /64), like the score limiter. */
export function shipLimiter(env: Pick<WorkerEnv, 'SHIP_LIMITER'>): ShipLimiter {
  return {
    async allowChat(request) {
      const key = `${limiterKey(clientIp(request.headers))}:ship`
      const { success } = await env.SHIP_LIMITER.limit({ key })
      return success
    },
  }
}

function embedder(env: WorkerEnv, set: VectorSetEntry): ShipDeps['embedQuery'] {
  const model = env.EMBED_MODEL as string
  return async (q, signal) => {
    const result = (await env.AI.run(
      model,
      { queries: [q], instruction: set.queryInstruction ?? EMBED_INSTRUCTION },
      { signal }
    )) as { data?: number[][] }
    const row = result?.data?.[0]
    if (!Array.isArray(row) || row.length === 0) throw new Error('no embedding in the response')
    // shipContext truncates a Matryoshka vector to the set's dims and checks it before use.
    return Float32Array.from(row)
  }
}

export function shipDeps(env: WorkerEnv, manifest: SearchManifest = MANIFEST): ShipDeps {
  const set = denseVectorSet(manifest, env.EMBED_MODEL)
  return {
    fetchAsset: (path) => fetchAsset(env.ASSETS, path),
    manifest,
    records: () => listRecords(recordSource(env.ASSETS)),
    chat: createWorkersAiChat({
      ai: env.AI,
      models: parseModelList(env.SHIP_CHAT_MODELS),
      gatewayId: env.AI_GATEWAY_ID || undefined,
    }),
    limiter: shipLimiter(env),
    ...(set ? { embedQuery: embedder(env, set), embedModel: set.model } : {}),
  }
}

export function ship(request: Request, env: WorkerEnv): Promise<Response> {
  return handleShip(request, shipDeps(env))
}
