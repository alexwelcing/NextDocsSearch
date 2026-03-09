import { describe, it, expect } from 'vitest'
import {
  isDimensionValid,
  roundDimensionUp,
  roundDimensionNearest,
  isFrameCountValid,
  roundFrameCount,
  calculateFrames,
  calculateDuration,
  validateLtxParameters,
  buildLtxParameters,
  DIMENSION_DIVISOR,
  MAX_FRAMES,
  DEFAULT_FPS,
} from './parameters'

describe('parameters', () => {
  describe('isDimensionValid', () => {
    it('accepts dimensions divisible by 32', () => {
      expect(isDimensionValid(32)).toBe(true)
      expect(isDimensionValid(64)).toBe(true)
      expect(isDimensionValid(512)).toBe(true)
      expect(isDimensionValid(768)).toBe(true)
      expect(isDimensionValid(1024)).toBe(true)
      expect(isDimensionValid(1280)).toBe(true)
    })

    it('rejects dimensions not divisible by 32', () => {
      expect(isDimensionValid(100)).toBe(false)
      expect(isDimensionValid(1080)).toBe(false)
      expect(isDimensionValid(33)).toBe(false)
      expect(isDimensionValid(500)).toBe(false)
    })

    it('rejects zero and negative', () => {
      expect(isDimensionValid(0)).toBe(false)
      expect(isDimensionValid(-32)).toBe(false)
    })

    it('rejects non-integers', () => {
      expect(isDimensionValid(32.5)).toBe(false)
    })
  })

  describe('roundDimensionUp', () => {
    it('rounds up to nearest multiple of 32', () => {
      expect(roundDimensionUp(100)).toBe(128)
      expect(roundDimensionUp(1080)).toBe(1088)
      expect(roundDimensionUp(1920)).toBe(1920)
    })

    it('keeps already valid dimensions unchanged', () => {
      expect(roundDimensionUp(512)).toBe(512)
      expect(roundDimensionUp(768)).toBe(768)
      expect(roundDimensionUp(1024)).toBe(1024)
    })
  })

  describe('roundDimensionNearest', () => {
    it('rounds to nearest multiple of 32', () => {
      expect(roundDimensionNearest(100)).toBe(96)
      expect(roundDimensionNearest(1080)).toBe(1088)
      expect(roundDimensionNearest(520)).toBe(512)
    })
  })

  describe('isFrameCountValid', () => {
    it('accepts valid frame counts (8k+1)', () => {
      expect(isFrameCountValid(1)).toBe(true)     // 8*0+1
      expect(isFrameCountValid(9)).toBe(true)     // 8*1+1
      expect(isFrameCountValid(17)).toBe(true)    // 8*2+1
      expect(isFrameCountValid(121)).toBe(true)   // 8*15+1
      expect(isFrameCountValid(145)).toBe(true)   // 8*18+1
      expect(isFrameCountValid(257)).toBe(true)   // 8*32+1
    })

    it('rejects invalid frame counts', () => {
      expect(isFrameCountValid(2)).toBe(false)
      expect(isFrameCountValid(8)).toBe(false)
      expect(isFrameCountValid(10)).toBe(false)
      expect(isFrameCountValid(120)).toBe(false)
      expect(isFrameCountValid(256)).toBe(false)
    })

    it('rejects zero and negative', () => {
      expect(isFrameCountValid(0)).toBe(false)
      expect(isFrameCountValid(-1)).toBe(false)
    })
  })

  describe('roundFrameCount', () => {
    it('rounds to nearest 8k+1', () => {
      expect(roundFrameCount(120)).toBe(121)
      expect(roundFrameCount(122)).toBe(121)
      expect(roundFrameCount(144)).toBe(145)
      expect(roundFrameCount(256)).toBe(257)
    })

    it('returns minimum 1 for small values', () => {
      expect(roundFrameCount(0)).toBe(1)
      expect(roundFrameCount(-5)).toBe(1)
    })
  })

  describe('calculateFrames', () => {
    it('calculates 8k+1 compliant frame count', () => {
      // 5s at 24fps = 120 → rounds to 121
      expect(calculateFrames(5, 24)).toBe(121)
      // 6s at 24fps = 144 → rounds to 145
      expect(calculateFrames(6, 24)).toBe(145)
      // 10s at 24fps = 240 → rounds to 241
      expect(calculateFrames(10, 24)).toBe(241)
    })

    it('caps at MAX_FRAMES', () => {
      expect(calculateFrames(15, 30)).toBeLessThanOrEqual(MAX_FRAMES)
    })

    it('returns valid frame counts', () => {
      const frames = calculateFrames(7, DEFAULT_FPS)
      expect(isFrameCountValid(frames)).toBe(true)
    })
  })

  describe('calculateDuration', () => {
    it('calculates duration from frames and fps', () => {
      expect(calculateDuration(121, 24)).toBeCloseTo(5.042, 2)
      expect(calculateDuration(145, 24)).toBeCloseTo(6.042, 2)
      expect(calculateDuration(241, 24)).toBeCloseTo(10.042, 2)
    })
  })

  describe('validateLtxParameters', () => {
    const validParams = {
      mode: 'T2V' as const,
      prompt: 'A cinematic scene',
      checkpoint: 'ltx-2.3-22b-distilled' as const,
      width: 768,
      height: 512,
      fps: 24,
      durationS: 6.0,
      frames: 145,
      enhancePrompt: false,
      highResolution: false,
    }

    it('passes for valid parameters', () => {
      expect(validateLtxParameters(validParams)).toEqual([])
    })

    it('reports invalid width', () => {
      const errors = validateLtxParameters({ ...validParams, width: 1080 })
      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('Width')
    })

    it('reports invalid height', () => {
      const errors = validateLtxParameters({ ...validParams, height: 1080 })
      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('Height')
    })

    it('reports invalid frame count', () => {
      const errors = validateLtxParameters({ ...validParams, frames: 120 })
      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('Frame count')
    })

    it('reports excessive duration', () => {
      const errors = validateLtxParameters({ ...validParams, durationS: 15 })
      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('Duration')
    })

    it('reports missing prompt', () => {
      const errors = validateLtxParameters({ ...validParams, prompt: '' })
      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('Prompt')
    })

    it('reports missing imageUrl for I2V', () => {
      const errors = validateLtxParameters({ ...validParams, mode: 'I2V' })
      expect(errors.length).toBe(1)
      expect(errors[0]).toContain('Image URL')
    })

    it('reports multiple errors', () => {
      const errors = validateLtxParameters({
        ...validParams,
        width: 100,
        height: 100,
        frames: 10,
        prompt: '',
      })
      expect(errors.length).toBe(4)
    })
  })

  describe('buildLtxParameters', () => {
    it('builds valid parameters with safe defaults', () => {
      const params = buildLtxParameters({ prompt: 'Test scene' })
      expect(isDimensionValid(params.width)).toBe(true)
      expect(isDimensionValid(params.height)).toBe(true)
      expect(isFrameCountValid(params.frames)).toBe(true)
      expect(params.frames).toBeLessThanOrEqual(MAX_FRAMES)
      expect(params.durationS).toBeLessThanOrEqual(10)
      expect(params.enhancePrompt).toBe(false)
    })

    it('rounds user-provided dimensions', () => {
      const params = buildLtxParameters({
        prompt: 'Test',
        width: 1080,
        height: 1920,
      })
      expect(isDimensionValid(params.width)).toBe(true)
      expect(isDimensionValid(params.height)).toBe(true)
      expect(params.width).toBe(1088)
      expect(params.height).toBe(1920)
    })

    it('caps duration at maximum', () => {
      const params = buildLtxParameters({
        prompt: 'Test',
        durationS: 20,
      })
      expect(params.durationS).toBe(10)
    })

    it('preserves seed', () => {
      const params = buildLtxParameters({
        prompt: 'Test',
        seed: 42,
      })
      expect(params.seed).toBe(42)
    })
  })
})
