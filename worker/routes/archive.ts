// GET /api/arc/archive: the legacy alias of the static archive index, kept until P4 deletes it. The
// default view is the slim /arc/archive.json and ?view=full the complete /arc/archive-full.json,
// the same `{ records, total }` files the dock fetches directly, read through env.ASSETS.
import { ARCHIVE_FULL_URL, ARCHIVE_URL } from '../../lib/archive/http'
import type { WorkerEnv } from '../env'
import { fetchAsset } from './assets'

/** The static index's own policy (out/_headers /arc/*): a deploy shows within five minutes. */
export const ARCHIVE_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=86400'

export async function archive(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return Response.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: 'GET' } }
    )
  }
  const view = new URL(request.url).searchParams.get('view')
  const file = view === 'full' ? ARCHIVE_FULL_URL : ARCHIVE_URL
  const asset = await fetchAsset(env.ASSETS, file, { method: request.method })
  if (!asset.ok) {
    console.error(`archive: ${file} answered ${asset.status}`)
    return Response.json({ error: 'Archive unavailable' }, { status: 503 })
  }
  return new Response(asset.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ARCHIVE_CACHE_CONTROL,
      ...(asset.headers.get('etag') ? { ETag: asset.headers.get('etag') as string } : {}),
    },
  })
}
