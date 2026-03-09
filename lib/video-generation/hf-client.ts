/**
 * Hugging Face Gradio Space client for LTX-2.3 video generation.
 *
 * Calls the Lightricks/ltx-video-distilled Space via Gradio API,
 * which runs on ZeroGPU (A10G) hardware.
 *
 * @see https://huggingface.co/spaces/Lightricks/ltx-video-distilled
 */

import * as fs from 'fs'
import * as pathLib from 'path'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { buildLtxParameters, validateLtxParameters } from './parameters'
import type { LtxMode, VideoGenerationResponse } from './types'

/**
 * Create a proxy-aware fetch function.
 * Node.js native fetch doesn't respect HTTP_PROXY/HTTPS_PROXY env vars,
 * so we use undici's ProxyAgent when a proxy is configured.
 */
function getProxyFetch(): typeof globalThis.fetch {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy
  if (proxyUrl) {
    const agent = new ProxyAgent(proxyUrl)
    return ((url: string | URL | Request, init?: RequestInit) =>
      undiciFetch(url as string, { ...init, dispatcher: agent } as never)) as unknown as typeof globalThis.fetch
  }
  return globalThis.fetch
}

const proxyFetch = getProxyFetch()

/**
 * Detect actual MIME type from file magic bytes (not extension).
 * These multi-art images are often JPEG with .png extension.
 */
function detectMimeType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp'
  return 'image/png'
}

function mimeToExt(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'image/webp') return '.webp'
  return '.png'
}

interface GradioFileData {
  url: string
  path: string
  meta: { _type: string }
}

/**
 * Upload a local image to the HF Gradio Space and register it for I2V.
 *
 * Two-step process required for multi-replica Spaces:
 * 1. Upload via /gradio_api/upload
 * 2. "Register" via /handle_image_upload_for_dims (makes file available to processing node)
 */
async function uploadAndRegisterImage(
  localPath: string,
  token: string,
  currentHeight: number,
  currentWidth: number
): Promise<{ fileData: GradioFileData; recHeight: number; recWidth: number }> {
  const imageBuffer = fs.readFileSync(localPath)
  const mimeType = detectMimeType(imageBuffer)
  const ext = mimeToExt(mimeType)
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="image${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  // Step 1: Upload
  const uploadRes = await proxyFetch(`${HF_SPACE_BASE}/gradio_api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })

  if (!uploadRes.ok) {
    throw new Error(`Image upload failed (${uploadRes.status}): ${await uploadRes.text()}`)
  }

  const paths = (await uploadRes.json()) as string[]
  const remotePath = paths[0]
  const remoteUrl = `${HF_SPACE_BASE}/gradio_api/file=${remotePath}`
  const fileData: GradioFileData = { url: remoteUrl, path: remotePath, meta: { _type: 'gradio.FileData' } }

  // Step 2: Register via handle_image_upload_for_dims
  // This ensures the file is accessible on the processing replica
  const dimsSubmitRes = await proxyFetch(
    `${HF_SPACE_BASE}/gradio_api/call/handle_image_upload_for_dims`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: [fileData, currentHeight, currentWidth] }),
    }
  )

  const dimsSubmit = (await dimsSubmitRes.json()) as { event_id: string }

  // Wait briefly then fetch the dims result
  await new Promise((r) => setTimeout(r, 1500))
  const dimsResultRes = await proxyFetch(
    `${HF_SPACE_BASE}/gradio_api/call/handle_image_upload_for_dims/${dimsSubmit.event_id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const dimsText = await dimsResultRes.text()

  // Parse recommended dimensions from SSE response
  let recHeight = currentHeight
  let recWidth = currentWidth
  const valueMatches = dimsText.match(/"value":\s*(\d+)/g)
  if (valueMatches && valueMatches.length >= 2) {
    recHeight = parseInt(valueMatches[0].match(/\d+/)![0])
    recWidth = parseInt(valueMatches[1].match(/\d+/)![0])
  }

  return { fileData, recHeight, recWidth }
}

/** Gradio Space base URL */
const HF_SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space'

/** Timeout for video generation (5 minutes — ZeroGPU cold starts can be slow) */
const HF_TIMEOUT_MS = 300_000

/** Poll interval when waiting for Gradio result (ms) */
const POLL_INTERVAL_MS = 3_000

export interface HfVideoRequest {
  prompt: string
  mode?: LtxMode
  negativePrompt?: string
  /** External URL for the source image (deprecated — prefer imagePath for reliability) */
  imageUrl?: string
  /** Local file path for the source image — will be uploaded to the HF Space */
  imagePath?: string
  durationS?: number
  width?: number
  height?: number
  seed?: number
  guidanceScale?: number
  improveTexture?: boolean
}

export interface HfVideoResult {
  success: boolean
  videoUrl?: string
  seed?: number
  width: number
  height: number
  frames: number
  durationS: number
  generationTimeMs: number
  error?: string
  rawResponse?: unknown
}

/** Max retries for transient failures (network, 5xx, queue full) */
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 5_000

function isRetryable(error: string): boolean {
  const retryPatterns = [
    'fetch failed',
    'EAI_AGAIN',
    'ECONNRESET',
    'ETIMEDOUT',
    'socket hang up',
    'timed out',
    '502',
    '503',
    '504',
    'queue',
    'overloaded',
    '404: not found',
    'error: null',
    'gradio error: null',
  ]
  const lower = error.toLowerCase()
  return retryPatterns.some((p) => lower.includes(p.toLowerCase()))
}

/**
 * Generate a video using the HF Gradio Space for LTX-Video.
 *
 * Uses the Gradio /text_to_video or /image_to_video endpoint.
 * Retries up to 3 times with exponential backoff on transient failures.
 */
export async function generateVideoViaHf(
  request: HfVideoRequest,
  token: string,
  outputPath?: string
): Promise<HfVideoResult> {
  let lastResult: HfVideoResult | undefined
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
      console.log(`   🔄 Retry ${attempt}/${MAX_RETRIES} after ${backoff / 1000}s...`)
      await new Promise((r) => setTimeout(r, backoff))
    }
    lastResult = await generateVideoViaHfCore(request, token, outputPath)
    if (lastResult.success) return lastResult
    if (!isRetryable(lastResult.error || '')) return lastResult
  }

  // If I2V keeps failing with 404 (replica routing issue), fall back to T2V
  if (request.mode === 'I2V' && lastResult && !lastResult.success) {
    const err = lastResult.error || ''
    if (err.includes('404') || err.includes('null')) {
      console.log(`   ⚡ Falling back to T2V mode (I2V upload routing failed)`)
      const t2vRequest = { ...request, mode: 'T2V' as const, imagePath: undefined, imageUrl: undefined }
      for (let attempt = 0; attempt <= 1; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, INITIAL_BACKOFF_MS))
        }
        lastResult = await generateVideoViaHfCore(t2vRequest, token, outputPath)
        if (lastResult.success) return lastResult
        if (!isRetryable(lastResult.error || '')) return lastResult
      }
    }
  }

  return lastResult!
}

async function generateVideoViaHfCore(
  request: HfVideoRequest,
  token: string,
  outputPath?: string
): Promise<HfVideoResult> {
  const params = buildLtxParameters({
    prompt: request.prompt,
    mode: request.mode,
    imageUrl: request.imageUrl,
    imagePath: request.imagePath,
    durationS: request.durationS,
    width: request.width,
    height: request.height,
    seed: request.seed,
  })

  const errors = validateLtxParameters(params)
  if (errors.length > 0) {
    return {
      success: false,
      error: `Invalid parameters: ${errors.join('; ')}`,
      width: params.width,
      height: params.height,
      frames: params.frames,
      durationS: params.durationS,
      generationTimeMs: 0,
    }
  }

  const startTime = Date.now()

  try {
    // Select Gradio endpoint based on mode
    const endpoint = params.mode === 'I2V' ? '/image_to_video' : '/text_to_video'

    // For I2V mode: upload and register the source image on the Space
    let imageFileData: GradioFileData | null = null
    if (params.mode === 'I2V') {
      if (request.imagePath && fs.existsSync(request.imagePath)) {
        // Upload + register (two-step for multi-replica Spaces)
        const uploaded = await uploadAndRegisterImage(
          request.imagePath,
          token,
          params.height,
          params.width
        )
        imageFileData = uploaded.fileData
      } else if (params.imageUrl) {
        imageFileData = {
          url: params.imageUrl,
          path: params.imageUrl,
          meta: { _type: 'gradio.FileData' },
        }
      }
    }

    // Build Gradio API call payload
    const gradioPayload = {
      data: [
        params.prompt, // prompt
        request.negativePrompt ||
          'worst quality, inconsistent motion, blurry, jittery, distorted', // negative_prompt
        imageFileData, // input_image_filepath
        null, // input_video_filepath
        params.height, // height_ui
        params.width, // width_ui
        params.mode === 'I2V' ? 'image-to-video' : 'text-to-video', // mode
        params.durationS, // duration_ui
        params.frames, // ui_frames_to_use
        params.seed ?? 42, // seed_ui
        params.seed === undefined, // randomize_seed
        request.guidanceScale ?? 1.0, // ui_guidance_scale
        request.improveTexture !== undefined ? request.improveTexture : false, // improve_texture_flag
      ],
    }

    if (process.env.DEBUG_HF) {
      console.log('   [DEBUG] Payload data (image redacted):', JSON.stringify(gradioPayload.data.map((d, i) => {
        if (i === 2 && d && typeof d === 'object') return { ...d, url: ((d as { url?: string }).url || '').slice(0, 60) + '...' }
        return d
      })))
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HF_TIMEOUT_MS)

    // Submit job to Gradio queue
    const submitResponse = await proxyFetch(`${HF_SPACE_BASE}/gradio_api/call${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gradioPayload),
      signal: controller.signal,
    })

    if (!submitResponse.ok) {
      clearTimeout(timeoutId)
      const errText = await submitResponse.text()
      return {
        success: false,
        error: `Gradio submit failed (${submitResponse.status}): ${errText.slice(0, 300)}`,
        width: params.width,
        height: params.height,
        frames: params.frames,
        durationS: params.durationS,
        generationTimeMs: Date.now() - startTime,
      }
    }

    const submitData = (await submitResponse.json()) as { event_id: string }
    const eventId = submitData.event_id

    if (!eventId) {
      clearTimeout(timeoutId)
      return {
        success: false,
        error: 'No event_id returned from Gradio submit',
        width: params.width,
        height: params.height,
        frames: params.frames,
        durationS: params.durationS,
        generationTimeMs: Date.now() - startTime,
        rawResponse: submitData,
      }
    }

    // Poll for result via SSE stream
    const resultResponse = await proxyFetch(
      `${HF_SPACE_BASE}/gradio_api/call${endpoint}/${eventId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!resultResponse.ok) {
      const errText = await resultResponse.text()
      return {
        success: false,
        error: `Gradio result fetch failed (${resultResponse.status}): ${errText.slice(0, 300)}`,
        width: params.width,
        height: params.height,
        frames: params.frames,
        durationS: params.durationS,
        generationTimeMs: Date.now() - startTime,
      }
    }

    // Parse SSE stream for the final result
    const resultText = await resultResponse.text()
    if (process.env.DEBUG_HF) {
      console.log('   [DEBUG] SSE response:', resultText.slice(0, 500))
      console.log('   [DEBUG] Payload:', JSON.stringify(gradioPayload.data.map((d, i) => i === 2 && d ? '{...image}' : d)))
    }
    const result = parseGradioSSE(resultText)

    const generationTimeMs = Date.now() - startTime

    if (result.error) {
      return {
        success: false,
        error: result.error,
        width: params.width,
        height: params.height,
        frames: params.frames,
        durationS: params.durationS,
        generationTimeMs,
        rawResponse: result.raw,
      }
    }

    // Extract video URL from Gradio result
    // Gradio may wrap the video in {video: {url, path, ...}} or return it directly
    const rawVideoData = result.data?.[0] as
      | string
      | { url?: string; path?: string; video?: { url?: string; path?: string } }
      | undefined
    const videoData =
      typeof rawVideoData === 'object' && rawVideoData && 'video' in rawVideoData
        ? rawVideoData.video
        : rawVideoData
    const videoUrl =
      typeof videoData === 'string'
        ? videoData
        : videoData?.url
          ? videoData.url
          : videoData?.path
            ? `${HF_SPACE_BASE}/gradio_api/file=${videoData.path}`
            : undefined

    const returnedSeed = result.data?.[1]

    if (!videoUrl) {
      return {
        success: false,
        error: 'No video URL in Gradio response',
        width: params.width,
        height: params.height,
        frames: params.frames,
        durationS: params.durationS,
        generationTimeMs,
        rawResponse: result.data,
      }
    }

    // If outputPath specified, download the video
    if (outputPath) {
      try {
        const downloadResponse = await proxyFetch(videoUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (downloadResponse.ok) {
          const fs = await import('fs/promises')
          const path = await import('path')
          await fs.mkdir(path.dirname(outputPath), { recursive: true })
          const buffer = Buffer.from(await downloadResponse.arrayBuffer())
          await fs.writeFile(outputPath, buffer)
        }
      } catch {
        // Download failed but generation succeeded — still return the URL
      }
    }

    return {
      success: true,
      videoUrl,
      seed: typeof returnedSeed === 'number' ? returnedSeed : params.seed,
      width: params.width,
      height: params.height,
      frames: params.frames,
      durationS: params.durationS,
      generationTimeMs,
    }
  } catch (error) {
    const generationTimeMs = Date.now() - startTime

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: `Request timed out after ${HF_TIMEOUT_MS / 1000}s`,
        width: params.width,
        height: params.height,
        frames: params.frames,
        durationS: params.durationS,
        generationTimeMs,
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      width: params.width,
      height: params.height,
      frames: params.frames,
      durationS: params.durationS,
      generationTimeMs,
    }
  }
}

/**
 * Parse Gradio SSE stream for the final complete event.
 *
 * Gradio SSE events look like:
 *   event: generating
 *   data: [...]
 *
 *   event: complete
 *   data: [video_data, seed]
 */
function parseGradioSSE(sseText: string): {
  data?: unknown[]
  error?: string
  raw?: string
} {
  const lines = sseText.split('\n')
  let lastEventType = ''
  let lastData = ''

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      lastEventType = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      lastData = line.slice(6)
    }
  }

  if (lastEventType === 'error') {
    return { error: `Gradio error: ${lastData}`, raw: sseText }
  }

  if (lastEventType === 'complete' && lastData) {
    try {
      const parsed = JSON.parse(lastData)
      return { data: parsed }
    } catch {
      return { error: `Failed to parse Gradio response: ${lastData.slice(0, 200)}`, raw: sseText }
    }
  }

  // If we got data but no complete event, try to parse the last data
  if (lastData) {
    try {
      const parsed = JSON.parse(lastData)
      return { data: Array.isArray(parsed) ? parsed : [parsed] }
    } catch {
      return { error: `Unexpected Gradio response format`, raw: sseText }
    }
  }

  return { error: 'No data received from Gradio', raw: sseText }
}
