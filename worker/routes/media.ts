// The films (RANGED_PREFIXES) through the Worker, with byte ranges. Workers Static Assets ignore a
// Range header and send the whole file with a 200, and Safari will not play a video that way, so
// this route reads the plain file from env.ASSETS and answers a single `bytes=` range itself with
// 206 Partial Content, or 416 when the range lies past the end. A 206 from the assets service,
// should it start sending one, passes straight through.
//
// The assets binding hands the Worker a body without a Content-Length header (the runtime knows
// the length and sends it on a whole-file 200, but the Worker cannot read it), and its HEAD answer
// carries no length either (both measured on workers.dev). So the first ranged request or HEAD for
// a film in an isolate reads the file once to learn its size; every later one streams only the
// requested slice, and a `bytes=0-1` probe then reads one chunk and cancels the rest. The films
// are a few MiB at most and the per-file cap is 25 MiB, well inside an isolate's memory.
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
 * The plain-file request for the assets service: always a GET (its HEAD answer has no length) and
 * without the range headers (it never answers them with a 206). Conditional headers stay, so a
 * revalidation still gets its 304.
 */
function plainGet(request: Request): Request {
  const headers = new Headers(request.headers)
  headers.delete('range')
  headers.delete('if-range')
  return new Request(request.url, { method: 'GET', headers })
}

/** The body's length from Content-Length, or null when it is absent or malformed. */
function contentLength(response: Response): number | null {
  const value = response.headers.get('content-length')
  if (value === null || !/^\d+$/.test(value.trim())) return null
  const length = Number(value)
  return Number.isSafeInteger(length) ? length : null
}

/** File sizes learned in this isolate, by path and version. A deploy starts new isolates. */
const knownSizes = new Map<string, number>()
const KNOWN_SIZES_MAX = 512

function sizeKey(request: Request, asset: Response): string {
  return `${new URL(request.url).pathname} ${asset.headers.get('etag') ?? ''}`
}

function rememberSize(key: string, size: number): void {
  if (knownSizes.size >= KNOWN_SIZES_MAX) knownSizes.clear()
  knownSizes.set(key, size)
}

/** Forgets the learned sizes (tests). */
export function resetKnownSizes(): void {
  knownSizes.clear()
}

function discard(body: ReadableStream | null): void {
  body?.cancel().catch(() => undefined)
}

export async function media(request: Request, env: WorkerEnv): Promise<Response> {
  const head = request.method === 'HEAD'
  const rangeHeader = request.headers.get('range')
  const asset = await env.ASSETS.fetch(plainGet(request))
  if (asset.status === 206) {
    if (head) discard(asset.body)
    return new Response(head ? null : asset.body, { status: 206, headers: mediaHeaders(asset) })
  }
  // 304, the 404 page: as the assets service answered (without the body, for a HEAD).
  if (asset.status !== 200) {
    if (!head) return asset
    discard(asset.body)
    return new Response(null, { status: asset.status, headers: asset.headers })
  }

  const headers = mediaHeaders(asset)
  const key = sizeKey(request, asset)
  const wantsRange = rangeHeader !== null && ifRangeMatches(request, asset)
  let size = contentLength(asset) ?? knownSizes.get(key) ?? null
  // Read once to learn the size, only when a range or a HEAD needs it.
  let bytes: Uint8Array | null = null
  if (size === null && (wantsRange || head)) {
    bytes = new Uint8Array(await asset.arrayBuffer())
    size = bytes.byteLength
    rememberSize(key, size)
  }
  const range = size !== null && wantsRange ? parseRange(rangeHeader, size) : null
  const unread = bytes === null

  if (range === null) {
    if (size !== null) headers.set('Content-Length', String(size))
    if (head) {
      if (unread) discard(asset.body)
      return new Response(null, { status: 200, headers })
    }
    return new Response(bytes ?? asset.body, { status: 200, headers })
  }

  if (range === 'unsatisfiable') {
    if (unread) discard(asset.body)
    headers.delete('Content-Length')
    headers.set('Content-Range', `bytes */${size}`)
    return new Response(null, { status: 416, headers })
  }

  const length = range.end - range.start + 1
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
  headers.set('Content-Length', String(length))
  if (bytes) {
    const slice = head ? null : bytes.subarray(range.start, range.end + 1)
    return new Response(slice, { status: 206, headers })
  }
  if (head || !asset.body) {
    discard(asset.body)
    return new Response(null, { status: 206, headers })
  }
  const body = exactLength(asset.body.pipeThrough(sliceStream(range)), length)
  return new Response(body, { status: 206, headers })
}
