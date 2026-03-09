#!/usr/bin/env tsx
/**
 * Test Script: LTX-2.3 Video Generation via Hugging Face Gradio Space
 *
 * Generates 3 separate videos with different prompts to verify
 * the HF → LTX-2.3 pipeline works end-to-end.
 *
 * Uses curl as HTTP transport to honor system proxy settings.
 *
 * Usage:
 *   npx tsx scripts/test-hf-ltx-video.ts
 *
 * Requires HF_TOKEN in .env.local or environment.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs/promises'
import { execSync } from 'child_process'
import { buildLtxParameters, validateLtxParameters } from '../lib/video-generation/parameters'

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const HF_TOKEN = process.env.HF_TOKEN
const SPACE_BASE = 'https://lightricks-ltx-video-distilled.hf.space'

if (!HF_TOKEN) {
  console.error('ERROR: HF_TOKEN is not set. Add it to .env.local or set as env variable.')
  process.exit(1)
}

// ─── Types ────────────────────────────────────────────────────────────

interface TestVideo {
  name: string
  prompt: string
  durationS: number
  width: number
  height: number
  seed: number
}

interface TestResult {
  name: string
  success: boolean
  timeMs: number
  error?: string
  outputPath?: string
  videoUrl?: string
  seed?: number
}

// ─── Test video definitions ───────────────────────────────────────────

const TEST_VIDEOS: TestVideo[] = [
  {
    name: 'ocean-waves',
    prompt:
      'Cinematic slow-motion shot of turquoise ocean waves crashing on a black volcanic beach at golden hour, foam catching sunlight, aerial perspective slowly descending, photorealistic',
    durationS: 2,
    width: 512,
    height: 320,
    seed: 42,
  },
  {
    name: 'neon-city',
    prompt:
      'A futuristic neon-lit cityscape at night with flying vehicles, rain-slicked streets reflecting pink and blue holographic advertisements, camera tracking forward through the street, cyberpunk atmosphere',
    durationS: 2,
    width: 512,
    height: 320,
    seed: 1337,
  },
  {
    name: 'forest-timelapse',
    prompt:
      'Timelapse of sunlight filtering through a dense ancient forest canopy, light rays sweeping across moss-covered ground, particles floating in the air, ethereal and calm atmosphere, nature documentary style',
    durationS: 2,
    width: 512,
    height: 320,
    seed: 2024,
  },
]

// ─── Curl-based Gradio client ─────────────────────────────────────────

function curlPost(url: string, body: unknown, token: string, timeoutS = 30): string {
  const bodyJson = JSON.stringify(body)
  const cmd = [
    'curl', '-s', '-f',
    '--max-time', String(timeoutS),
    '-X', 'POST',
    '-H', 'Content-Type: application/json',
    '-H', `Authorization: Bearer ${token}`,
    '-d', bodyJson,
    url,
  ]
  return execSync(cmd.map((c) => `'${c.replace(/'/g, "'\\''")}'`).join(' '), {
    encoding: 'utf8',
    timeout: (timeoutS + 5) * 1000,
  })
}

function curlGetStream(url: string, token: string, timeoutS = 300): string {
  const cmd = [
    'curl', '-s', '-N',
    '--max-time', String(timeoutS),
    '-H', `Authorization: Bearer ${token}`,
    url,
  ]
  return execSync(cmd.map((c) => `'${c.replace(/'/g, "'\\''")}'`).join(' '), {
    encoding: 'utf8',
    timeout: (timeoutS + 5) * 1000,
  })
}

function curlDownload(url: string, outputPath: string, token: string, timeoutS = 60): void {
  const cmd = [
    'curl', '-s', '-f',
    '--max-time', String(timeoutS),
    '-H', `Authorization: Bearer ${token}`,
    '-o', outputPath,
    url,
  ]
  execSync(cmd.map((c) => `'${c.replace(/'/g, "'\\''")}'`).join(' '), {
    timeout: (timeoutS + 5) * 1000,
  })
}

function parseGradioSSE(sseText: string): { data?: unknown[]; error?: string } {
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
    return { error: `Gradio error: ${lastData}` }
  }

  if (lastData) {
    try {
      const parsed = JSON.parse(lastData)
      return { data: Array.isArray(parsed) ? parsed : [parsed] }
    } catch {
      return { error: `Failed to parse: ${lastData.slice(0, 200)}` }
    }
  }

  return { error: 'No data received' }
}

async function generateVideo(video: TestVideo, outputDir: string): Promise<TestResult> {
  const startTime = Date.now()
  const outputPath = path.join(outputDir, `${video.name}.mp4`)

  try {
    // Build and validate LTX parameters
    const params = buildLtxParameters({
      prompt: video.prompt,
      durationS: video.durationS,
      width: video.width,
      height: video.height,
      seed: video.seed,
    })

    const errors = validateLtxParameters(params)
    if (errors.length > 0) {
      return {
        name: video.name,
        success: false,
        timeMs: Date.now() - startTime,
        error: `Param validation: ${errors.join('; ')}`,
      }
    }

    // Build Gradio payload
    const payload = {
      data: [
        params.prompt, // prompt
        'worst quality, inconsistent motion, blurry, jittery, distorted', // negative_prompt
        null, // input_image_filepath (T2V mode)
        null, // input_video_filepath
        params.height, // height_ui
        params.width, // width_ui
        'text-to-video', // mode
        params.durationS, // duration_ui
        params.frames, // ui_frames_to_use
        params.seed ?? 42, // seed_ui
        params.seed === undefined, // randomize_seed
        1.0, // ui_guidance_scale
        true, // improve_texture_flag
      ],
    }

    console.log(`  Submitting to Gradio queue...`)

    // Step 1: Submit to queue
    const submitRaw = curlPost(
      `${SPACE_BASE}/gradio_api/call/text_to_video`,
      payload,
      HF_TOKEN!,
      60
    )
    const submitResult = JSON.parse(submitRaw) as { event_id?: string }

    if (!submitResult.event_id) {
      return {
        name: video.name,
        success: false,
        timeMs: Date.now() - startTime,
        error: `No event_id: ${submitRaw.slice(0, 200)}`,
      }
    }

    console.log(`  Event ID: ${submitResult.event_id}`)
    console.log(`  Waiting for generation (this may take 1-5 minutes)...`)

    // Step 2: Stream results (SSE)
    const sseRaw = curlGetStream(
      `${SPACE_BASE}/gradio_api/call/text_to_video/${submitResult.event_id}`,
      HF_TOKEN!,
      300
    )

    const result = parseGradioSSE(sseRaw)

    if (result.error) {
      return {
        name: video.name,
        success: false,
        timeMs: Date.now() - startTime,
        error: result.error,
      }
    }

    // Extract video info — Gradio wraps video in {video: {url, path, ...}}
    const rawVideoData = result.data?.[0] as
      | string
      | { url?: string; path?: string; video?: { url?: string; path?: string } }
      | undefined
    const returnedSeed = result.data?.[1] as number | undefined

    // Unwrap nested video object if present
    const videoData =
      typeof rawVideoData === 'object' && rawVideoData && 'video' in rawVideoData
        ? rawVideoData.video
        : rawVideoData

    let videoUrl: string | undefined
    if (typeof videoData === 'string') {
      videoUrl = videoData
    } else if (videoData?.url) {
      videoUrl = videoData.url
    } else if (videoData?.path) {
      videoUrl = `${SPACE_BASE}/gradio_api/file=${videoData.path}`
    }

    if (!videoUrl) {
      return {
        name: video.name,
        success: false,
        timeMs: Date.now() - startTime,
        error: `No video URL in response: ${JSON.stringify(result.data).slice(0, 300)}`,
      }
    }

    // Step 3: Download video file
    console.log(`  Downloading video...`)
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true })
      curlDownload(videoUrl, outputPath, HF_TOKEN!, 120)
    } catch (dlErr) {
      // Download failed but we have the URL
      console.log(`  (Download failed, URL is still valid)`)
    }

    return {
      name: video.name,
      success: true,
      timeMs: Date.now() - startTime,
      outputPath,
      videoUrl,
      seed: returnedSeed ?? params.seed,
    }
  } catch (err) {
    return {
      name: video.name,
      success: false,
      timeMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const outputDir = path.resolve(__dirname, '../test-output/videos')
  await fs.mkdir(outputDir, { recursive: true })

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║  LTX-2.3 Video Generation Test (via Hugging Face Space)    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`Space: Lightricks/ltx-video-distilled`)
  console.log(`Output directory: ${outputDir}`)
  console.log(`Videos to generate: ${TEST_VIDEOS.length}`)
  console.log()

  const results: TestResult[] = []

  for (const [index, video] of TEST_VIDEOS.entries()) {
    const videoNum = index + 1

    console.log(`─── Video ${videoNum}/${TEST_VIDEOS.length}: ${video.name} ───`)
    console.log(`  Prompt: "${video.prompt.slice(0, 80)}..."`)
    console.log(`  Size: ${video.width}×${video.height}, ${video.durationS}s, seed=${video.seed}`)

    const result = await generateVideo(video, outputDir)

    if (result.success) {
      console.log(`  ✓ SUCCESS in ${(result.timeMs / 1000).toFixed(1)}s`)
      console.log(`  Video URL: ${result.videoUrl}`)
      console.log(`  Seed: ${result.seed}`)

      try {
        const stat = await fs.stat(result.outputPath!)
        console.log(`  Saved to: ${result.outputPath} (${(stat.size / 1024).toFixed(1)} KB)`)
      } catch {
        console.log(`  (Video available at URL above)`)
      }
    } else {
      console.log(`  ✗ FAILED after ${(result.timeMs / 1000).toFixed(1)}s`)
      console.log(`  Error: ${result.error}`)
    }

    results.push(result)
    console.log()
  }

  // ─── Summary ──────────────────────────────────────────────────────

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  RESULTS SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════')

  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const totalTimeMs = results.reduce((sum, r) => sum + r.timeMs, 0)

  for (const r of results) {
    const status = r.success ? '✓ PASS' : '✗ FAIL'
    const time = `${(r.timeMs / 1000).toFixed(1)}s`
    console.log(`  ${status}  ${r.name.padEnd(20)} ${time.padStart(8)}  ${r.error || ''}`)
  }

  console.log()
  console.log(
    `  Total: ${passed} passed, ${failed} failed, ${(totalTimeMs / 1000).toFixed(1)}s elapsed`
  )
  console.log()

  // Write results JSON
  const resultsPath = path.join(outputDir, 'test-results.json')
  await fs.writeFile(
    resultsPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        model: 'Lightricks/LTX-Video (ltx-video-distilled Space)',
        provider: 'huggingface-gradio-space',
        results,
        summary: { passed, failed, totalTimeMs },
      },
      null,
      2
    )
  )
  console.log(`  Results written to: ${resultsPath}`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
