import type { NextApiRequest, NextApiResponse } from 'next'
import { buildLtxParameters, validateLtxParameters } from '@/lib/video-generation/parameters'
import type { VideoGenerationResponse, LtxMode } from '@/lib/video-generation/types'

const FAL_KEY = process.env.FAL_KEY

/**
 * FAL AI LTX Video model IDs
 * Uses the distilled checkpoint for fast iteration by default.
 */
const LTX_VIDEO_MODELS = {
  't2v': 'fal-ai/ltx-video',
  'i2v': 'fal-ai/ltx-video/image-to-video',
} as const

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VideoGenerationResponse | { message: string; code?: string }>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const {
    prompt,
    mode = 'T2V',
    imageUrl,
    durationS,
    width,
    height,
    seed,
    enhancePrompt,
    highResolution,
  } = req.body as {
    prompt?: string
    mode?: LtxMode
    imageUrl?: string
    durationS?: number
    width?: number
    height?: number
    seed?: number
    enhancePrompt?: boolean
    highResolution?: boolean
  }

  if (!prompt) {
    return res.status(400).json({ message: 'Prompt is required' })
  }

  if (!FAL_KEY) {
    console.error('FAL_KEY is not set')
    return res.status(503).json({
      message: 'Video generation services are temporarily offline (configuration error).',
      code: 'CONFIG_ERROR',
    })
  }

  // Build and validate parameters
  const params = buildLtxParameters({
    prompt,
    mode,
    imageUrl,
    durationS,
    width,
    height,
    seed,
    enhancePrompt,
    highResolution,
  })

  const errors = validateLtxParameters(params)
  if (errors.length > 0) {
    return res.status(400).json({
      message: `Invalid parameters: ${errors.join('; ')}`,
      code: 'INVALID_PARAMS',
    })
  }

  // Select model based on mode
  const modelId = mode === 'I2V' ? LTX_VIDEO_MODELS.i2v : LTX_VIDEO_MODELS.t2v

  try {
    const body: Record<string, unknown> = {
      prompt: params.prompt,
      num_frames: params.frames,
      width: params.width,
      height: params.height,
      fps: params.fps,
    }

    if (params.seed !== undefined) {
      body.seed = params.seed
    }

    if (params.mode === 'I2V' && params.imageUrl) {
      body.image_url = params.imageUrl
    }

    const startTime = Date.now()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 min timeout for video

    const response = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 402 || response.status === 401) {
        return res.status(503).json({
          message: 'Video generation credits are exhausted. Please try again later.',
          code: 'OUT_OF_CREDITS',
        })
      }
      const errorText = await response.text()
      console.error('FAL Video API Error:', errorText)
      throw new Error(`FAL API error: ${response.status}`)
    }

    const data = (await response.json()) as {
      video?: { url: string } | Array<{ url: string }>
      seed?: number
      timings?: Record<string, number>
    }

    const generationTimeMs = Date.now() - startTime

    // Extract video URL from response
    const videoUrl = Array.isArray(data.video)
      ? data.video[0]?.url
      : data.video?.url

    if (!videoUrl) {
      console.error('FAL Video response missing video URL:', JSON.stringify(data).slice(0, 500))
      return res.status(500).json({
        success: false,
        error: 'No video URL in generation response',
      })
    }

    return res.status(200).json({
      success: true,
      videoUrl,
      seed: data.seed ?? params.seed,
      width: params.width,
      height: params.height,
      frames: params.frames,
      durationS: params.durationS,
      generationTimeMs,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Video generation timed out')
      return res.status(504).json({
        success: false,
        error: 'Video generation timed out after 3 minutes',
      })
    }
    console.error('Video generation failed:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate video. Please try again.',
    })
  }
}
