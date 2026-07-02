import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { gradeImage } from '../lib/image-grading/grader'

const TEST_IMAGE_PATH = path.join(process.cwd(), 'tests/fixtures/test-gradient.jpg')

describe('Image Grader', () => {
  beforeAll(async () => {
    // Ensure test fixtures directory exists
    const dir = path.dirname(TEST_IMAGE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Create a synthetic test image if it doesn't exist
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg({ quality: 90 })
        .toFile(TEST_IMAGE_PATH)
    }
  })

  it('grades a valid image with decent scores', async () => {
    const buffer = fs.readFileSync(TEST_IMAGE_PATH)
    const result = await gradeImage(buffer)

    expect(result.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.overallScore).toBeLessThanOrEqual(10)
    expect(result.technicalScore).toBeGreaterThanOrEqual(0)
    expect(result.aestheticScore).toBeGreaterThanOrEqual(0)
    expect(result.metrics.width).toBe(1024)
    expect(result.metrics.height).toBe(1024)
    expect(result.metrics.fileSizeBytes).toBeGreaterThan(0)
    expect(result.flags.tooSmall).toBe(false)
  })

  it('flags a tiny image as tooSmall', async () => {
    const tinyBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer()

    const result = await gradeImage(tinyBuffer)
    expect(result.flags.tooSmall).toBe(true)
    expect(result.technicalScore).toBeLessThan(6)
  })

  it('flags a blurry image as tooBlurry', async () => {
    // Create a very blurry image by heavily blurring a solid color
    const blurryBuffer = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 128, g: 128, b: 128 },
      },
    })
      .blur(20)
      .jpeg({ quality: 90 })
      .toBuffer()

    const result = await gradeImage(blurryBuffer)
    expect(result.flags.tooBlurry).toBe(true)
    expect(result.metrics.sharpness).toBeLessThan(10)
  })

  it('provides recommendations', async () => {
    const buffer = fs.readFileSync(TEST_IMAGE_PATH)
    const result = await gradeImage(buffer)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })
})
