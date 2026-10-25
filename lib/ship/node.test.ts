import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ChatProvider } from '../ai/chatProvider'
import { resetSearchIndexCache } from '../retrieval/load'
import { FIXTURE_ARCHIVE, fixtureIndex } from '../retrieval/testing'
import { handleShip, type ShipDeps } from './handleShip'
import { fetchPublicAsset, readSearchManifest, sendWebResponse, toWebRequest } from './node'
import { SHIP_LIMITS } from './request'

const dir = mkdtempSync(path.join(tmpdir(), 'ship-node-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('fetchPublicAsset', () => {
  beforeAll(() => {
    mkdirSync(path.join(dir, 'public/search'), { recursive: true })
    writeFileSync(path.join(dir, 'public/search/chunks.abc.json'), '{"ok":true}')
    writeFileSync(path.join(dir, 'secret.txt'), 'nope')
  })

  it('serves files from the flat /search/ directory', async () => {
    const response = await fetchPublicAsset('/search/chunks.abc.json', path.join(dir, 'public'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it.each([
    '/search/missing.json',
    '/search/../../secret.txt',
    '/search/..',
    '/search/.hidden',
    '/secret.txt',
    'search/chunks.abc.json',
    '/search/nested/file.json',
  ])('answers 404 for %s', async (assetPath) => {
    expect((await fetchPublicAsset(assetPath, path.join(dir, 'public'))).status).toBe(404)
  })
})

describe('readSearchManifest', () => {
  it('is null until the build emits a valid manifest', async () => {
    const file = path.join(dir, 'search-manifest.json')
    expect(await readSearchManifest(file)).toBeNull()
    writeFileSync(file, '{"schema": 2}')
    expect(await readSearchManifest(file)).toBeNull()
    const { manifest } = await fixtureIndex()
    writeFileSync(file, JSON.stringify(manifest))
    expect(await readSearchManifest(file)).toEqual(manifest)
  })
})

describe('the Node adapter', () => {
  let server: Server
  let origin = ''
  let deps: ShipDeps

  beforeAll(async () => {
    const { manifest, fetchAsset } = await fixtureIndex()
    const chat: ChatProvider = {
      async stream(request) {
        for (const delta of ['Photon polarization ', 'carries the key.']) {
          await new Promise((resolve) => setTimeout(resolve, 5))
          request.onDelta(delta)
        }
        return { text: 'Photon polarization carries the key.', provider: 'fake:model' }
      },
    }
    deps = { manifest, fetchAsset, records: FIXTURE_ARCHIVE, chat, log: () => undefined }
    server = createServer(async (req, res) => {
      await sendWebResponse(await handleShip(await toWebRequest(req), deps), res)
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    resetSearchIndexCache()
    await new Promise((resolve) => server.close(resolve))
  })

  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(`${origin}/api/vector-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    })

  it('streams the NDJSON events in order, chunk by chunk', async () => {
    const response = await post(JSON.stringify({ prompt: 'photon polarization' }))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8')
    expect(response.headers.get('x-ship-retrieval')).toBe('lexical')
    const reader = (response.body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    const chunks: string[] = []
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value))
    }
    expect(chunks.length).toBeGreaterThan(1)
    const types = chunks
      .join('')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).type)
    expect(types[0]).toBe('instant-results')
    expect(types[types.length - 1]).toBe('final-answer')
    expect(types).toContain('answer-delta')
    expect(types).not.toContain('error')
  })

  it('passes the handler 4xx answers and text/plain tricks through', async () => {
    const help = await post(JSON.stringify({ prompt: '/help' }))
    expect(help.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await help.text()).toContain('/story')

    const bad = await post('{"prompt":')
    expect(bad.status).toBe(400)

    const get = await fetch(`${origin}/api/vector-search`)
    expect(get.status).toBe(405)
  })

  it('caps the body it buffers', async () => {
    const huge = JSON.stringify({ prompt: 'hi', pad: 'x'.repeat(SHIP_LIMITS.bodyBytes * 4) })
    expect((await post(huge)).status).toBe(413)
  })

  it('never builds the request URL from the Host header', async () => {
    const request = await new Promise<Request>((resolve) => {
      const probe = createServer(async (req, res) => {
        resolve(await toWebRequest(req))
        res.end()
      })
      probe.listen(0, '127.0.0.1', async () => {
        const { port } = probe.address() as AddressInfo
        await fetch(`http://127.0.0.1:${port}/api/vector-search`, {
          method: 'POST',
          headers: { 'X-Forwarded-Host': 'evil.example', 'User-Agent': 'probe' },
          body: '{}',
        })
        probe.close()
      })
    })
    expect(new URL(request.url).host).toBe('ship.internal')
    expect(request.headers.get('user-agent')).toBe('probe')
    expect(request.headers.has('host')).toBe(false)
  })
})
