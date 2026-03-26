/**
 * daVinci-MagiHuman Video Generation Client
 * 
 * A TypeScript client for the daVinci-MagiHuman video generation model
 * via HuggingFace Gradio Space API.
 * 
 * daVinci-MagiHuman is a 15B parameter single-stream Transformer for
 * joint text-video-audio generation with exceptional human-centric quality.
 * 
 * @see https://huggingface.co/spaces/SII-GAIR/daVinci-MagiHuman
 * @see https://github.com/GAIR-NLP/daVinci-MagiHuman
 */

import fs from 'fs'
import path from 'path'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface DaVinciGenerationRequest {
  /** Enhanced prompt describing the scene, character, and performance */
  prompt: string
  /** Reference image path for character consistency (I2V mode) */
  referenceImagePath?: string
  /** Dialogue lines with character descriptions */
  dialogue?: DialogueLine[]
  /** Background sound description */
  backgroundSound?: string
  /** Target resolution */
  resolution?: '256p' | '540p' | '1080p'
  /** Video duration in seconds (default: 5) */
  duration?: number
  /** Random seed for reproducibility */
  seed?: number
  /** Whether to use distilled model (8 steps, faster) */
  useDistilled?: boolean
  /** Whether to enable audio generation */
  generateAudio?: boolean
}

export interface DialogueLine {
  /** Character description for voice consistency */
  characterDescription: string
  /** Language code: 'en', 'zh', 'ja', 'ko', 'de', 'fr' */
  language: string
  /** Spoken line */
  text: string
}

export interface DaVinciGenerationResult {
  success: boolean
  /** Path to generated video file */
  videoPath?: string
  /** Path to generated audio file (if separate) */
  audioPath?: string
  /** Generation metadata */
  metadata: {
    resolution: string
    duration: number
    seed: number
    generationTimeMs: number
    model: 'base' | 'distilled'
  }
  /** Error message if failed */
  error?: string
}

export interface SceneAnalysis {
  /** Detected scenes from script */
  scenes: Scene[]
  /** Overall visual style recommendation */
  visualStyle: VisualStyle
  /** Character consistency notes */
  characters: CharacterProfile[]
}

export interface Scene {
  id: string
  /** Start time in seconds */
  startTime: number
  /** End time in seconds */
  endTime: number
  /** Scene description */
  description: string
  /** Camera direction */
  camera: string
  /** Mood/atmosphere */
  mood: string
  /** Characters present */
  characters: string[]
  /** Background setting */
  setting: string
}

export interface VisualStyle {
  /** Overall aesthetic direction */
  aesthetic: string
  /** Color palette description */
  colorPalette: string
  /** Lighting approach */
  lighting: string
  /** Camera style */
  cameraStyle: string
}

export interface CharacterProfile {
  name: string
  /** Physical description */
  appearance: string
  /** Clothing/costume */
  attire: string
  /** Voice characteristics */
  voice: string
  /** Key visual identifiers for consistency */
  visualIdentifiers: string[]
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const SPACE_BASE_URL = 'https://sii-gair-davinci-magihuman.hf.space'
const DEFAULT_DURATION = 5
const DEFAULT_RESOLUTION = '256p'

// daVinci-MagiHuman uses a 2-step process:
// 1. /step1_enhance - enhances the prompt
// 2. /step2_generate - generates the video

// Resolution dimensions
const RESOLUTION_DIMS: Record<string, { width: number; height: number }> = {
  '256p': { width: 448, height: 256 },
  '540p': { width: 960, height: 540 },
  '1080p': { width: 1920, height: 1080 },
}

// ═══════════════════════════════════════════════════════════════
// CLIENT
// ═══════════════════════════════════════════════════════════════

export class DaVinciClient {
  private hfToken: string
  private spaceUrl: string

  constructor(hfToken?: string, spaceUrl: string = SPACE_BASE_URL) {
    this.hfToken = hfToken || process.env.HF_TOKEN || ''
    this.spaceUrl = spaceUrl
    
    if (!this.hfToken) {
      console.warn('HF_TOKEN not provided. Some features may be limited.')
    }
  }

  /**
   * Generate a video using daVinci-MagiHuman
   * 
   * @example
   * ```typescript
   * const client = new DaVinciClient(process.env.HF_TOKEN)
   * 
   * const result = await client.generate({
   *   prompt: buildEnhancedPrompt({
   *     character: 'A young woman with long dark hair...',
   *     action: 'speaking with animated gestures',
   *     mood: 'earnest and passionate'
   *   }),
   *   dialogue: [{
   *     characterDescription: 'Young woman, English',
   *     language: 'en',
   *     text: 'This is the future we are building together.'
   *   }],
   *   resolution: '540p',
   *   duration: 5
   * })
   * ```
   */
  async generate(
    request: DaVinciGenerationRequest,
    outputPath: string
  ): Promise<DaVinciGenerationResult> {
    const startTime = Date.now()
    
    try {
      // Build enhanced prompt if simple prompt provided
      const enhancedPrompt = this.buildEnhancedPrompt(request)
      
      // Determine resolution
      const resolution = request.resolution || DEFAULT_RESOLUTION
      const dims = RESOLUTION_DIMS[resolution]
      
      // Submit to Space
      console.log(`🎬 Submitting to daVinci-MagiHuman...`)
      console.log(`   Duration: ${request.duration || DEFAULT_DURATION}s`)
      console.log(`   Seed: ${request.seed ?? 'random'}`)
      
      const videoUrl = await this.submitToGradio(enhancedPrompt, request, dims)
      
      if (!videoUrl) {
        return {
          success: false,
          metadata: {
            resolution,
            duration: request.duration || DEFAULT_DURATION,
            seed: request.seed || 0,
            generationTimeMs: Date.now() - startTime,
            model: request.useDistilled ? 'distilled' : 'base',
          },
          error: 'No video URL returned from Gradio',
        }
      }
      
      // Download video
      await this.downloadVideo(videoUrl, outputPath)
      
      const generationTimeMs = Date.now() - startTime
      
      console.log(`✅ Generated in ${(generationTimeMs / 1000).toFixed(1)}s`)
      console.log(`   Saved: ${outputPath}`)
      
      return {
        success: true,
        videoPath: outputPath,
        metadata: {
          resolution,
          duration: request.duration || DEFAULT_DURATION,
          seed: request.seed || 0,
          generationTimeMs,
          model: request.useDistilled ? 'distilled' : 'base',
        },
      }
      
    } catch (error) {
      return {
        success: false,
        metadata: {
          resolution: request.resolution || DEFAULT_RESOLUTION,
          duration: request.duration || DEFAULT_DURATION,
          seed: request.seed || 0,
          generationTimeMs: Date.now() - startTime,
          model: request.useDistilled ? 'distilled' : 'base',
        },
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Build an enhanced prompt from structured input
   * 
   * daVinci-MagiHuman works best with detailed, clinical descriptions
   * of character appearance, facial dynamics, and performance.
   */
  private buildEnhancedPrompt(request: DaVinciGenerationRequest): string {
    // If already an enhanced prompt (has Main Body structure), use as-is
    if (request.prompt.includes('Main Body') || request.prompt.length > 300) {
      return this.appendDialogueAndSound(request.prompt, request)
    }
    
    // Otherwise, wrap simple prompt in enhanced format
    const basePrompt = request.prompt
    
    return `${basePrompt}

${this.formatDialogueSection(request.dialogue)}

${this.formatBackgroundSound(request.backgroundSound)}`
  }

  /**
   * Format dialogue section for enhanced prompt
   */
  private formatDialogueSection(dialogue?: DialogueLine[]): string {
    if (!dialogue || dialogue.length === 0) {
      return 'Dialogue:\n<No dialogue>'
    }
    
    const lines = dialogue.map(d => 
      `<${d.characterDescription}, ${d.language}>: "${d.text}"`
    )
    
    return `Dialogue:\n${lines.join('\n')}`
  }

  /**
   * Format background sound section
   */
  private formatBackgroundSound(sound?: string): string {
    return `Background Sound:\n${sound || '<No prominent background sound>'}`
  }

  /**
   * Append dialogue and sound to existing prompt
   */
  private appendDialogueAndSound(prompt: string, request: DaVinciGenerationRequest): string {
    let enhanced = prompt
    
    if (!prompt.includes('Dialogue:')) {
      enhanced += '\n\n' + this.formatDialogueSection(request.dialogue)
    }
    
    if (!prompt.includes('Background Sound:')) {
      enhanced += '\n\n' + this.formatBackgroundSound(request.backgroundSound)
    }
    
    return enhanced
  }

  /**
   * Build Gradio API payload
   */
  private buildGradioPayload(
    prompt: string,
    request: DaVinciGenerationRequest,
    dims: { width: number; height: number }
  ): unknown[] {
    // Standard payload for daVinci-MagiHuman Gradio Space
    // Note: Actual parameters may vary based on Space implementation
    return [
      prompt,                                    // [0] Enhanced prompt
      request.referenceImagePath || null,        // [1] Reference image (optional)
      dims.height,                               // [2] Height
      dims.width,                                // [3] Width
      request.duration || DEFAULT_DURATION,      // [4] Duration
      request.seed ?? Math.floor(Math.random() * 1000000), // [5] Seed
      request.useDistilled ?? false,             // [6] Use distilled model
      request.generateAudio ?? true,             // [7] Generate audio
    ]
  }

  /**
   * Submit job to Gradio Space using the 2-step process:
   * 1. /step1_enhance - enhances the prompt
   * 2. /step2_generate - generates the video
   */
  private async submitToGradio(
    prompt: string,
    request: DaVinciGenerationRequest,
    dims: { width: number; height: number }
  ): Promise<string | null> {
    const seed = request.seed ?? Math.floor(Math.random() * 1000000)
    const duration = request.duration ?? DEFAULT_DURATION
    
    // Step 1: Enhance the prompt
    console.log(`   Step 1: Enhancing prompt...`)
    const enhanced = await this.callGradioEndpoint('/step1_enhance', [
      null, // image (optional)
      prompt,
      seed,
      duration,
    ])
    
    if (!enhanced || !enhanced[0]) {
      throw new Error('Prompt enhancement failed')
    }
    
    console.log(`   ✓ Enhanced prompt received`)
    
    // Step 2: Generate video
    console.log(`   Step 2: Generating video...`)
    const result = await this.callGradioEndpoint('/step2_generate', [
      null, // image (optional)
      enhanced[0], // enhanced prompt
      seed,
      duration,
    ])
    
    if (!result || !result[0]) {
      throw new Error('Video generation failed')
    }
    
    // Extract video URL from result
    return this.extractVideoUrl(result[0])
  }

  /**
   * Call a Gradio endpoint and return the result
   */
  private async callGradioEndpoint(endpoint: string, data: unknown[]): Promise<unknown[] | null> {
    const url = `${this.spaceUrl}/gradio_api/call${endpoint}`
    
    // Submit job
    const submitResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.hfToken}`,
      },
      body: JSON.stringify({ data }),
    })
    
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text()
      throw new Error(`Submit failed (${submitResponse.status}): ${errorText.slice(0, 500)}`)
    }
    
    const submitData = await submitResponse.json() as { event_id?: string }
    
    if (!submitData.event_id) {
      throw new Error(`No event_id returned`)
    }
    
    // Poll for result via SSE
    const resultUrl = `${url}/${submitData.event_id}`
    const resultResponse = await fetch(resultUrl, {
      headers: { 'Authorization': `Bearer ${this.hfToken}` },
    })
    
    if (!resultResponse.ok) {
      throw new Error(`Result fetch failed (${resultResponse.status})`)
    }
    
    const resultText = await resultResponse.text()
    return this.parseSSEResponse(resultText)
  }

  /**
   * Parse SSE response from Gradio
   */
  private parseSSEResponse(sseText: string): unknown[] | null {
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
      throw new Error(`Gradio error: ${lastData}`)
    }
    
    if (lastEventType === 'complete' && lastData) {
      try {
        return JSON.parse(lastData)
      } catch {
        throw new Error(`Failed to parse response: ${lastData.slice(0, 200)}`)
      }
    }
    
    return null
  }

  /**
   * Extract video URL from Gradio result
   */
  private extractVideoUrl(data: unknown): string | null {
    if (typeof data === 'string') {
      return data
    }
    
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      if (obj.url) return obj.url as string
      if (obj.video?.url) return (obj.video as { url: string }).url
      if (obj.path) return `${this.spaceUrl}/gradio_api/file=${obj.path}`
    }
    
    return null
  }

  /**
   * Parse video URL from SSE stream
   */
  private parseVideoUrlFromSSE(sseText: string): string | null {
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
      throw new Error(`Gradio error: ${lastData}`)
    }
    
    if (lastEventType === 'complete' && lastData) {
      try {
        const parsed = JSON.parse(lastData)
        
        // Extract video URL from various possible formats
        const videoData = parsed[0]
        
        if (typeof videoData === 'string') {
          return videoData
        }
        
        if (videoData?.url) {
          return videoData.url
        }
        
        if (videoData?.video?.url) {
          return videoData.video.url
        }
        
        if (videoData?.path) {
          return `${this.spaceUrl}/gradio_api/file=${videoData.path}`
        }
        
      } catch {
        // Fall through
      }
    }
    
    return null
  }

  /**
   * Download video from URL
   */
  private async downloadVideo(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.hfToken}` },
    })
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`)
    }
    
    const buffer = Buffer.from(await response.arrayBuffer())
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, buffer)
  }

  /**
   * Analyze a script and break it into scenes
   * 
   * This is a helper method for the narrative video workflow.
   * In production, this would use an LLM for analysis.
   */
  analyzeScript(script: string): SceneAnalysis {
    // Simple heuristic-based scene detection
    // In production, use an LLM for proper scene breakdown
    const scenes: Scene[] = []
    const paragraphs = script.split(/\n\n+/).filter(p => p.trim().length > 0)
    
    let currentTime = 0
    
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i]
      const duration = this.estimateDuration(para)
      
      scenes.push({
        id: `scene-${i + 1}`,
        startTime: currentTime,
        endTime: currentTime + duration,
        description: para.slice(0, 200),
        camera: this.detectCameraDirection(para),
        mood: this.detectMood(para),
        characters: this.extractCharacters(para),
        setting: this.detectSetting(para),
      })
      
      currentTime += duration
    }
    
    return {
      scenes,
      visualStyle: this.inferVisualStyle(script),
      characters: this.extractCharacterProfiles(script),
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER METHODS (heuristic-based, replace with LLM in production)
  // ═══════════════════════════════════════════════════════════════

  private estimateDuration(text: string): number {
    // Rough estimate: ~150 words per scene, ~5 seconds per scene
    const wordCount = text.split(/\s+/).length
    return Math.max(3, Math.min(10, Math.ceil(wordCount / 30)))
  }

  private detectCameraDirection(text: string): string {
    if (text.includes('close-up') || text.includes('face')) return 'close-up'
    if (text.includes('wide') || text.includes('panorama')) return 'wide shot'
    if (text.includes('over shoulder')) return 'over-the-shoulder'
    return 'medium shot'
  }

  private detectMood(text: string): string {
    const moodWords: Record<string, string[]> = {
      tense: ['tense', 'anxious', 'nervous', 'urgent'],
      calm: ['calm', 'peaceful', 'serene', 'quiet'],
      joyful: ['joy', 'happy', 'celebrate', 'laugh'],
      melancholy: ['sad', 'melancholy', 'somber', 'reflective'],
    }
    
    const lower = text.toLowerCase()
    for (const [mood, words] of Object.entries(moodWords)) {
      if (words.some(w => lower.includes(w))) return mood
    }
    
    return 'neutral'
  }

  private extractCharacters(text: string): string[] {
    // Simple character extraction (would use NER in production)
    const charPattern = /\b([A-Z][a-z]+)\b/g
    const matches = text.match(charPattern) || []
    return Array.from(new Set(matches)).slice(0, 3)
  }

  private detectSetting(text: string): string {
    const settings = [
      { pattern: /office|desk|computer/i, name: 'office' },
      { pattern: /street|city|urban/i, name: 'city street' },
      { pattern: /forest|woods|tree/i, name: 'forest' },
      { pattern: /home|house|room/i, name: 'interior' },
    ]
    
    for (const setting of settings) {
      if (setting.pattern.test(text)) return setting.name
    }
    
    return 'undefined'
  }

  private inferVisualStyle(script: string): VisualStyle {
    // Infer visual style from script content
    const lower = script.toLowerCase()
    
    if (lower.includes('future') || lower.includes('sci-fi') || lower.includes('technology')) {
      return {
        aesthetic: 'futuristic sci-fi',
        colorPalette: 'cool blues and neon accents',
        lighting: 'volumetric with dramatic shadows',
        cameraStyle: 'smooth tracking shots',
      }
    }
    
    if (lower.includes('past') || lower.includes('historical') || lower.includes('vintage')) {
      return {
        aesthetic: 'period drama',
        colorPalette: 'warm sepia and muted tones',
        lighting: 'natural window light',
        cameraStyle: 'static compositions with slow pans',
      }
    }
    
    return {
      aesthetic: 'contemporary realistic',
      colorPalette: 'naturalistic with subtle saturation',
      lighting: 'motivated practical lighting',
      cameraStyle: 'handheld documentary style',
    }
  }

  private extractCharacterProfiles(script: string): CharacterProfile[] {
    // Extract character profiles from script
    // In production, use an LLM for proper extraction
    return [{
      name: 'Protagonist',
      appearance: 'Determined and expressive',
      attire: 'Contemporary professional clothing',
      voice: 'Clear and confident',
      visualIdentifiers: ['distinctive posture', 'engaging eye contact'],
    }]
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Build an enhanced prompt from components
 * 
 * daVinci-MagiHuman expects a specific format with three parts:
 * 1. Main Body (150-200 words) - clinical description
 * 2. Dialogue - formatted spoken lines
 * 3. Background Sound - ambient audio description
 */
export function buildEnhancedPrompt(components: {
  /** Character description (appearance, expression) */
  character: string
  /** What the character is doing */
  action: string
  /** Emotional tone */
  mood: string
  /** Camera/framing notes */
  camera?: string
  /** Additional performance details */
  performance?: string
}): string {
  const { character, action, mood, camera = 'stationary framing', performance = '' } = components
  
  return `${character} ${action}. The disposition is ${mood}. ${performance}

The cinematography is ${camera}, maintaining consistent framing throughout the shot.

Dialogue:
<No dialogue>

Background Sound:
<No prominent background sound>`
}

/**
 * Convenience function for single video generation
 */
export async function generateVideo(
  request: DaVinciGenerationRequest,
  outputPath: string,
  hfToken?: string
): Promise<DaVinciGenerationResult> {
  const client = new DaVinciClient(hfToken)
  return client.generate(request, outputPath)
}
