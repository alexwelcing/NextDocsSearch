// Node target (Vercel / next start): the Ship handler's deps from the deployment's own files,
// plus the IncomingMessage <-> Web Request/Response bridge. Index assets are read from disk
// (traced into the function by next.config.js) — never self-fetched through an origin derived
// from the Host header, which is client-controlled and 401s behind Deployment Protection.
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { huggingFaceChatFromEnv } from '../ai/providers/huggingface'
import { listRecords } from '../archive/server'
import type { SearchManifest } from '../retrieval/types'
import type { ShipDeps } from './handleShip'
import { SHIP_LIMITS } from './request'

const ASSET_PATH = /^\/search\/[\w-][\w.-]*$/

/** RetrievalDeps.fetchAsset over public/: only the flat /search/ index directory is served. */
export async function fetchPublicAsset(
  assetPath: string,
  publicDir = path.join(process.cwd(), 'public')
): Promise<Response> {
  if (!ASSET_PATH.test(assetPath)) return new Response('not found', { status: 404 })
  try {
    return new Response(new Uint8Array(await readFile(path.join(publicDir, assetPath))))
  } catch {
    return new Response('not found', { status: 404 })
  }
}

const manifests = new Map<string, Promise<SearchManifest | null>>()

/** lib/generated/search-manifest.json when the build emitted it, else null (records-only). */
export function readSearchManifest(
  file = path.join(process.cwd(), 'lib/generated/search-manifest.json')
): Promise<SearchManifest | null> {
  let pending = manifests.get(file)
  if (!pending) {
    pending = readFile(file, 'utf8').then(
      (text) => {
        const manifest = JSON.parse(text) as SearchManifest
        return manifest?.schema === 1 && manifest.assets ? manifest : null
      },
      () => null
    )
    // A missing manifest is retried (a dev server may build it later); a parsed one is kept.
    pending.then((manifest) => manifest ?? manifests.delete(file))
    manifests.set(file, pending)
  }
  return pending
}

export function nodeShipDeps(env: Record<string, string | undefined> = process.env): ShipDeps {
  return {
    fetchAsset: (assetPath) => fetchPublicAsset(assetPath),
    manifest: () => readSearchManifest(),
    records: () => listRecords(),
    chat: huggingFaceChatFromEnv(env),
  }
}

// ---- IncomingMessage <-> Request/Response ------------------------------------------------------

/** A fixed internal origin: the handler never needs, and must never trust, the Host header. */
const INTERNAL_ORIGIN = 'http://ship.internal'
const HOP_BY_HOP = new Set([
  'connection',
  'content-length',
  'expect',
  'host',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
])

/** Collects at most `cap` bytes and drains the rest, so an oversized body stays cheap. */
function readBody(req: IncomingMessage, cap: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      if (size >= cap) return
      chunks.push(chunk)
      size += chunk.length
    })
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks).subarray(0, cap))))
    req.on('error', reject)
  })
}

export async function toWebRequest(
  req: IncomingMessage,
  routePath = '/api/vector-search'
): Promise<Request> {
  const method = req.method ?? 'GET'
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP_BY_HOP.has(key)) continue
    for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item)
  }
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await readBody(req, SHIP_LIMITS.bodyBytes + 1)
  return new Request(new URL(routePath, INTERNAL_ORIGIN), { method, headers, body })
}

/** Streams a Web Response into res, flushing each chunk; a closed client cancels the body. */
export async function sendWebResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  if (!response.body) {
    res.end()
    return
  }
  const reader = response.body.getReader()
  const cancel = () => {
    reader.cancel().catch(() => undefined)
  }
  res.on('close', cancel)
  try {
    res.flushHeaders()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
      // `next start` compression buffers until flushed; Vercel streams either way.
      ;(res as ServerResponse & { flush?: () => void }).flush?.()
    }
  } catch {
    // the client went away mid-stream
  } finally {
    res.off('close', cancel)
    res.end()
  }
}
