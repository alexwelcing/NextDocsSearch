// The films (RANGED_PREFIXES) through the Worker, with byte ranges. Workers Static Assets ignore a
// Range header and send the whole file with a 200, and Safari will not play a video that way, so
// this route reads the file from env.ASSETS and answers a single `bytes=` range itself with 206
// Partial Content, or 416 when the range lies past the end. A 206 from the assets service, should
// it start sending one, passes straight through. Everything stays a stream: a `bytes=0-1` probe
// reads one chunk and cancels the rest.
import type { WorkerEnv } from '../env'
import { MEDIA_CACHE } from '../policy'

export interface ByteRange {
  start: number
  /** Inclusive. */
  end: number
}

/**
 * One `bytes=` range of a body of `size` bytes: the range to send, 'unsatisfiable' (416), or null
 * to send the whole body, for no header or one this server may ignore (RFC 9110 §14.2: several
 * ranges, another unit, or a malformed or inverted range).
 */
export function parseRange(
  header: string | null,
  size: number
): ByteRange | 'unsatisfiable' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match || (!match[1] && !match[2])) return null
  const [, first, last] = match
  if (!first) {
    // A suffix range: the last N bytes.
    const length = Number(last)
    if (length === 0 || size === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - length), end: size - 1 }
  }
  const start = Number(first)
  if (last && Number(last) < start) return null
  if (start >= size) return 'unsatisfiable'
  return { start, end: last ? Math.min(Number(last), size - 1) : size - 1 }
}

/** Passes bytes [start, end] of the stream through, then ends it (cancelling the source). */
export function sliceStream({ start, end }: ByteRange): TransformStream<Uint8Array, Uint8Array> {
  let offset = 0
  return new TransformStream({
    transform(chunk, controller) {
      const chunkStart = offset
      offset += chunk.byteLength
      if (offset <= start) return
      const from = Math.max(0, start - chunkStart)
      const to = Math.min(chunk.byteLength, end + 1 - chunkStart)
      if (to > from) controller.enqueue(chunk.subarray(from, to))
      if (offset > end) controller.terminate()
    },
  })
}

type FixedLengthStreamCtor = new (length: number) => TransformStream<Uint8Array, Uint8Array>

/** workerd's FixedLengthStream sends an exact Content-Length for a streamed body. */
function exactLength(body: ReadableStream<Uint8Array>, length: number): ReadableStream<Uint8Array> {
  const Fixed = (globalThis as { FixedLengthStream?: FixedLengthStreamCtor }).FixedLengthStream
  return Fixed ? body.pipeThrough(new Fixed(length)) : body
}

/** An If-Range that names another version of the file means: send all of it. */
function ifRangeMatches(request: Request, asset: Response): boolean {
  const ifRange = request.headers.get('if-range')
  if (!ifRange) return true
  return ifRange === asset.headers.get('etag') || ifRange === asset.headers.get('last-modified')
}

function mediaHeaders(asset: Response): Headers {
  const headers = new Headers(asset.headers)
  headers.set('Cache-Control', MEDIA_CACHE)
  headers.set('Accept-Ranges', 'bytes')
  return headers
}

/**
 * The request without its range. The assets service does not answer a Range with a 206, and its
 * answer to one is not the plain file (it carries no length), so ranges are cut from the plain
 * file here.
 */
function withoutRange(request: Request): Request {
  const headers = new Headers(request.headers)
  headers.delete('range')
  headers.delete('if-range')
  return new Request(request.url, { method: request.method, headers })
}

/** The body's length from Content-Length, or null when it is absent or malformed. */
function contentLength(response: Response): number | null {
  const value = response.headers.get('content-length')
  if (value === null || !/^\d+$/.test(value.trim())) return null
  const length = Number(value)
  return Number.isSafeInteger(length) ? length : null
}

export async function media(request: Request, env: WorkerEnv): Promise<Response> {
  const rangeHeader = request.headers.get('range')
  const asset = await env.ASSETS.fetch(rangeHeader ? withoutRange(request) : request)
  const debug = `${asset.status};cl=${asset.headers.get('content-length')};te=${asset.headers.get('transfer-encoding')};body=${asset.body ? 1 : 0}`
  if (asset.status === 206) {
    return new Response(asset.body, { status: 206, headers: mediaHeaders(asset) })
  }
  // 304, the 404 page, a refused method: as the assets service answered.
  if (asset.status !== 200) return asset

  const headers = mediaHeaders(asset)
  headers.set('X-Asset-Debug', debug)
  const size = contentLength(asset)
  const range =
    size !== null && ifRangeMatches(request, asset) ? parseRange(rangeHeader, size) : null
  if (range === null) return new Response(asset.body, { status: 200, headers })

  if (range === 'unsatisfiable') {
    asset.body?.cancel().catch(() => undefined)
    headers.delete('Content-Length')
    headers.set('Content-Range', `bytes */${size}`)
    return new Response(null, { status: 416, headers })
  }
  const length = range.end - range.start + 1
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
  headers.set('Content-Length', String(length))
  if (request.method === 'HEAD' || !asset.body) {
    asset.body?.cancel().catch(() => undefined)
    return new Response(null, { status: 206, headers })
  }
  const body = exactLength(asset.body.pipeThrough(sliceStream(range)), length)
  return new Response(body, { status: 206, headers })
}
