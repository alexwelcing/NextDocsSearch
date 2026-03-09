/**
 * Hugging Face Gradio Space client for LTX-2.3 video generation.
 *
 * Calls the Lightricks/ltx-video-distilled Space via Gradio API,
 * which runs on ZeroGPU (A10G) hardware.
 *
 * @see https://huggingface.co/spaces/Lightricks/ltx-video-distilled
 */

import { buildLtxParameters, validateLtxParameters } from './parameters'
import type { LtxMode, VideoGenerationResponse } from './types'

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
  imageUrl?: string
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

/**
 * Generate a video using the HF Gradio Space for LTX-Video.
 *
 * Uses the Gradio /text_to_video or /image_to_video endpoint.
 */
export async function generateVideoViaHf(
  request: HfVideoRequest,
  token: string,
  outputPath?: string
): Promise<HfVideoResult> {
  const params = buildLtxParameters({
    prompt: request.prompt,
    mode: request.mode,
    imageUrl: request.imageUrl,
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

    // Build Gradio API call payload
    const gradioPayload = {
      data: [
        params.prompt, // prompt
        request.negativePrompt ||
          'worst quality, inconsistent motion, blurry, jittery, distorted', // negative_prompt
        params.mode === 'I2V' && params.imageUrl
          ? { url: params.imageUrl, meta: { _type: 'gradio.FileData' } }
          : null, // input_image_filepath
        null, // input_video_filepath
        params.height, // height_ui
        params.width, // width_ui
        params.mode === 'I2V' ? 'image-to-video' : 'text-to-video', // mode
        params.durationS, // duration_ui
        params.frames, // ui_frames_to_use
        params.seed ?? 42, // seed_ui
        params.seed === undefined, // randomize_seed
        request.guidanceScale ?? 1.0, // ui_guidance_scale
        request.improveTexture ?? true, // improve_texture_flag
      ],
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HF_TIMEOUT_MS)

    // Submit job to Gradio queue
    const submitResponse = await fetch(`${HF_SPACE_BASE}/gradio_api/call${endpoint}`, {
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
    const resultResponse = await fetch(
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
        const downloadResponse = await fetch(videoUrl, {
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
