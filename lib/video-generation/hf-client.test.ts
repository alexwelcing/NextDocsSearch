import { describe, it, expect, vi } from 'vitest'
import { generateVideoViaHf } from './hf-client'

/**
 * Unit tests for the HF Gradio Space client module.
 * Tests parameter validation and error handling with mocked fetch.
 *
 * For live integration tests, run: npx tsx scripts/test-hf-ltx-video.ts
 */

/** Create a mock Response-like object with all needed methods */
function mockResponse(body: unknown, init: { ok: boolean; status?: number; contentType?: string }) {
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    headers: new Headers({ 'content-type': init.contentType || 'application/json' }),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => bodyStr,
    arrayBuffer: async () => new TextEncoder().encode(bodyStr).buffer,
  }
}

/** Mock the two-step Gradio flow: submit → SSE result */
function mockGradioFlow(videoUrl: string, seed = 42) {
  let callCount = 0
  return vi.fn().mockImplementation(() => {
    callCount++
    if (callCount === 1) {
      // Submit response
      return Promise.resolve(mockResponse({ event_id: 'test-event-123' }, { ok: true }))
    }
    // SSE result response
    const sseBody = [
      'event: complete',
      `data: [{"url": "${videoUrl}", "path": "tmp/video.mp4", "meta": {"_type": "gradio.FileData"}}, ${seed}]`,
    ].join('\n')
    return Promise.resolve(
      mockResponse(sseBody, { ok: true, contentType: 'text/event-stream' })
    )
  })
}

describe('hf-client', () => {
  describe('generateVideoViaHf — validation (no network)', () => {
    it('rejects empty prompt', async () => {
      const result = await generateVideoViaHf({ prompt: '' }, 'fake-token')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Prompt')
      expect(result.generationTimeMs).toBe(0)
    })

    it('rejects missing imageUrl for I2V mode', async () => {
      const result = await generateVideoViaHf(
        { prompt: 'Test scene', mode: 'I2V' },
        'fake-token'
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('Image URL')
      expect(result.generationTimeMs).toBe(0)
    })
  })

  describe('generateVideoViaHf — with mocked Gradio flow', () => {
    it('caps duration at maximum and returns video URL', async () => {
      const mockFetch = mockGradioFlow('https://example.com/video.mp4', 99)
      vi.stubGlobal('fetch', mockFetch)

      const result = await generateVideoViaHf(
        { prompt: 'Test scene', durationS: 15 },
        'test-token'
      )

      expect(result.durationS).toBeLessThanOrEqual(10)
      expect(result.success).toBe(true)
      expect(result.videoUrl).toContain('video.mp4')
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Verify submit call had correct auth header
      const [, submitOpts] = mockFetch.mock.calls[0]
      expect(submitOpts.headers.Authorization).toBe('Bearer test-token')

      vi.unstubAllGlobals()
    })

    it('rounds dimensions to nearest valid multiples of 32', async () => {
      const mockFetch = mockGradioFlow('https://example.com/video.mp4')
      vi.stubGlobal('fetch', mockFetch)

      const result = await generateVideoViaHf(
        { prompt: 'Test scene', width: 1080, height: 1920 },
        'test-token'
      )

      expect(result.width % 32).toBe(0)
      expect(result.height % 32).toBe(0)
      expect(result.success).toBe(true)

      vi.unstubAllGlobals()
    })

    it('returns correct frame count (8k+1 compliant)', async () => {
      const mockFetch = mockGradioFlow('https://example.com/video.mp4')
      vi.stubGlobal('fetch', mockFetch)

      const result = await generateVideoViaHf(
        { prompt: 'Test', durationS: 5 },
        'test-token'
      )

      expect((result.frames - 1) % 8).toBe(0)
      expect(result.success).toBe(true)

      vi.unstubAllGlobals()
    })

    it('handles Gradio submit failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse('Queue is full', { ok: false, status: 503 })
      )
      vi.stubGlobal('fetch', mockFetch)

      const result = await generateVideoViaHf({ prompt: 'Test' }, 'test-token')

      expect(result.success).toBe(false)
      expect(result.error).toContain('503')

      vi.unstubAllGlobals()
    })

    it('handles Gradio error event in SSE', async () => {
      let callCount = 0
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(mockResponse({ event_id: 'err-event' }, { ok: true }))
        }
        const sseBody = 'event: error\ndata: GPU quota exceeded'
        return Promise.resolve(
          mockResponse(sseBody, { ok: true, contentType: 'text/event-stream' })
        )
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await generateVideoViaHf({ prompt: 'Test' }, 'test-token')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Gradio error')

      vi.unstubAllGlobals()
    })

    it('handles missing event_id', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockResponse({ no_event_id: true }, { ok: true })
      )
      vi.stubGlobal('fetch', mockFetch)

      const result = await generateVideoViaHf({ prompt: 'Test' }, 'test-token')

      expect(result.success).toBe(false)
      expect(result.error).toContain('event_id')

      vi.unstubAllGlobals()
    })

    it('passes correct Gradio payload shape', async () => {
      const mockFetch = mockGradioFlow('https://example.com/v.mp4', 42)
      vi.stubGlobal('fetch', mockFetch)

      await generateVideoViaHf(
        { prompt: 'A test prompt', seed: 123, durationS: 3, width: 512, height: 320 },
        'my-token'
      )

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/gradio_api/call/text_to_video')
      const body = JSON.parse(opts.body)
      expect(body.data[0]).toBe('A test prompt') // prompt
      expect(body.data[9]).toBe(123) // seed_ui (index 9)
      expect(body.data[10]).toBe(false) // randomize_seed = false when seed is provided

      vi.unstubAllGlobals()
    })
  })
})
