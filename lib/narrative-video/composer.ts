/**
 * OpenStory-Inspired Narrative Video Composer
 * 
 * Transforms scripts into styled video productions using AI, with:
 * - Scene-by-scene breakdown with camera angles and mood treatments
 * - Style consistency across scenes (characters, locations, palettes)
 * - Continuity tracking between narrative segments
 * - Integration with daVinci-MagiHuman for character-driven video
 * 
 * Inspired by https://github.com/openstory-so/openstory
 * 
 * This system combines:
 * 1. The narrative engine (temporal eras, thematic bridges, voice profiles)
 * 2. HF-Mount for lazy-loaded model access
 * 3. daVinci-MagiHuman for expressive human-centric video
 * 4. LTX-Video for environmental/atmospheric shots
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { DaVinciClient, type DaVinciGenerationRequest, type DialogueLine, buildEnhancedPrompt } from '../video-generation/davinci/client'
import { generateVideoViaHf } from '../video-generation/hf-client'
import { buildNarrativeGraph, buildArticleGenerationContext, type NarrativePosition } from '../narrative-engine'
import { TEMPORAL_ERAS, type TemporalEra, getMotifVisualsForEra } from '../narrative-arc'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface NarrativeVideoProject {
  /** Project identifier */
  id: string
  /** Source narrative (article slug or custom script) */
  source: {
    type: 'article' | 'custom'
    slug?: string
    script?: string
  }
  /** Target temporal era for visual styling */
  era: string
  /** Video segments to generate */
  segments: VideoSegment[]
  /** Overall visual style guide */
  styleGuide: StyleGuide
  /** Character consistency profiles */
  characters: CharacterVisualProfile[]
  /** Audio design */
  audioDesign: AudioDesign
}

export interface VideoSegment {
  id: string
  type: 'character' | 'environmental' | 'transition' | 'montage'
  /** Narrative content */
  content: {
    description: string
    dialogue?: DialogueLine[]
    duration: number
  }
  /** Visual direction */
  visualDirection: {
    shotType: 'close-up' | 'medium' | 'wide' | 'establishing'
    cameraMovement: 'static' | 'pan' | 'track' | 'crane' | 'handheld'
    mood: string
    lighting: string
  }
  /** Style overrides (optional) */
  styleOverride?: Partial<StyleGuide>
  /** Reference to previous segment for continuity */
  continuityRef?: string
}

export interface StyleGuide {
  /** Overall aesthetic direction */
  aesthetic: string
  /** Color palette (primary, secondary, accent, shadow) */
  palette: {
    primary: string
    secondary: string
    accent: string
    shadow: string
  }
  /** Color temperature (0=cold, 1=warm) */
  colorTemperature: number
  /** Lighting approach */
  lighting: string
  /** Camera style */
  camera: string
  /** Texture/grain feel */
  texture: string
  /** Scale of environments */
  scale: 'intimate' | 'medium' | 'vast'
}

export interface CharacterVisualProfile {
  id: string
  name: string
  /** Detailed appearance for consistency */
  appearance: {
    age: string
    build: string
    features: string
    hair: string
  }
  /** Clothing/costume */
  attire: string
  /** Key visual identifiers */
  visualIdentifiers: string[]
  /** Reference image path (for I2V consistency) */
  referenceImage?: string
  /** Voice characteristics */
  voiceProfile: {
    tone: string
    pace: string
    accent?: string
  }
}

export interface AudioDesign {
  /** Ambient soundscape */
  ambient: string
  /** Background music style */
  musicStyle: string
  /** Sound effects needed */
  soundEffects: string[]
  /** Voice treatment */
  voiceTreatment: 'clean' | 'processed' | 'spatial'
}

export interface GenerationResult {
  segmentId: string
  success: boolean
  outputPath?: string
  generationTimeMs: number
  error?: string
}

export interface ComposedVideo {
  project: NarrativeVideoProject
  results: GenerationResult[]
  /** Concatenated final video path */
  finalVideoPath?: string
  /** Metadata for playback */
  metadata: {
    totalDuration: number
    totalGenerationTimeMs: number
    segmentCount: number
    successfulSegments: number
  }
}

// ═══════════════════════════════════════════════════════════════
// STYLE MAPPING FROM NARRATIVE ERAS
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a temporal era to a video style guide
 */
export function eraToStyleGuide(era: TemporalEra): StyleGuide {
  const vi = era.visualIdentity
  
  return {
    aesthetic: `${era.key}-era ${vi.texture}`,
    palette: vi.palette,
    colorTemperature: vi.colorTemperature,
    lighting: vi.lighting,
    camera: vi.camera,
    texture: vi.texture,
    scale: vi.scale,
  }
}

/**
 * Get era-specific motif visuals for prompt enrichment
 */
export function getMotifPromptEnrichment(eraKey: string): string {
  const motifs = getMotifVisualsForEra(eraKey)
  
  const enrichments: string[] = []
  
  if (motifs['amber-light']) {
    enrichments.push(`amber lighting: ${motifs['amber-light']}`)
  }
  if (motifs['hands']) {
    enrichments.push(`hand imagery: ${motifs['hands']}`)
  }
  if (motifs['threshold-space']) {
    enrichments.push(`threshold imagery: ${motifs['threshold-space']}`)
  }
  if (motifs['silence']) {
    enrichments.push(`atmospheric quality: ${motifs['silence']}`)
  }
  
  return enrichments.join(', ')
}

// ═══════════════════════════════════════════════════════════════
// NARRATIVE VIDEO COMPOSER
// ═══════════════════════════════════════════════════════════════

export class NarrativeVideoComposer {
  private outputDir: string
  private hfToken: string
  private davinciClient: DaVinciClient

  constructor(outputDir: string, hfToken?: string) {
    this.outputDir = outputDir
    this.hfToken = hfToken || process.env.HF_TOKEN || ''
    this.davinciClient = new DaVinciClient(this.hfToken)
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
  }

  /**
   * Create a video project from a narrative article
   * 
   * @example
   * ```typescript
   * const composer = new NarrativeVideoComposer('./output', process.env.HF_TOKEN)
   * 
   * const project = await composer.createProjectFromArticle(
   *   'threshold-01-the-last-diagnosis',
   *   {
   *     focusScenes: ['opening', 'diagnosis', 'reflection'],
   *     durationPerScene: 5,
   *   }
   * )
   * 
   * const video = await composer.compose(project)
   * ```
   */
  async createProjectFromArticle(
    slug: string,
    options: {
      focusScenes?: string[]
      durationPerScene?: number
      includeDialogue?: boolean
    } = {}
  ): Promise<NarrativeVideoProject> {
    const { focusScenes = [], durationPerScene = 5, includeDialogue = true } = options
    
    // Get narrative context
    const era = this.getEraForSlug(slug)
    if (!era) {
      throw new Error(`No era found for slug: ${slug}`)
    }
    
    // Build style guide from era
    const styleGuide = eraToStyleGuide(era)
    
    // Create character profiles based on era
    const characters = this.createEraCharacters(era)
    
    // Generate segments based on narrative structure
    const segments = this.createSegmentsFromNarrative(
      slug,
      era,
      focusScenes,
      durationPerScene,
      includeDialogue
    )
    
    // Audio design based on era
    const audioDesign = this.createEraAudioDesign(era)
    
    return {
      id: `nv-${slug}-${Date.now()}`,
      source: { type: 'article', slug },
      era: era.key,
      segments,
      styleGuide,
      characters,
      audioDesign,
    }
  }

  /**
   * Compose the final video from a project
   */
  async compose(project: NarrativeVideoProject): Promise<ComposedVideo> {
    console.log(`\n🎬 Narrative Video Composition: ${project.id}`)
    console.log(`   Era: ${project.era}`)
    console.log(`   Segments: ${project.segments.length}`)
    console.log(`   Style: ${project.styleGuide.aesthetic}`)
    console.log()
    
    const results: GenerationResult[] = []
    const startTime = Date.now()
    
    for (let i = 0; i < project.segments.length; i++) {
      const segment = project.segments[i]
      console.log(`\n[${i + 1}/${project.segments.length}] ${segment.id} (${segment.type})`)
      
      const result = await this.generateSegment(segment, project, i)
      results.push(result)
      
      if (result.success) {
        console.log(`   ✅ ${path.basename(result.outputPath || '')}`)
      } else {
        console.log(`   ❌ ${result.error}`)
      }
      
      // Brief pause between requests
      if (i < project.segments.length - 1) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }
    
    const totalTime = Date.now() - startTime
    const successful = results.filter(r => r.success).length
    
    // Concatenate segments if all successful
    let finalVideoPath: string | undefined
    if (successful === project.segments.length) {
      finalVideoPath = await this.concatenateSegments(results, project.id)
    }
    
    const totalDuration = project.segments.reduce((sum, s) => sum + s.content.duration, 0)
    
    return {
      project,
      results,
      finalVideoPath,
      metadata: {
        totalDuration,
        totalGenerationTimeMs: totalTime,
        segmentCount: project.segments.length,
        successfulSegments: successful,
      },
    }
  }

  /**
   * Generate a single video segment
   */
  private async generateSegment(
    segment: VideoSegment,
    project: NarrativeVideoProject,
    index: number
  ): Promise<GenerationResult> {
    const segmentStart = Date.now()
    const outputPath = path.join(this.outputDir, `${project.id}-${String(index).padStart(2, '0')}-${segment.id}.mp4`)
    
    try {
      // Merge style guides
      const style = { ...project.styleGuide, ...segment.styleOverride }
      
      // Build prompt based on segment type
      let result: { success: boolean; error?: string }
      
      if (segment.type === 'character') {
        result = await this.generateCharacterSegment(segment, style, project, outputPath)
      } else if (segment.type === 'environmental') {
        result = await this.generateEnvironmentalSegment(segment, style, project, outputPath)
      } else {
        result = await this.generateTransitionSegment(segment, style, project, outputPath)
      }
      
      return {
        segmentId: segment.id,
        success: result.success,
        outputPath: result.success ? outputPath : undefined,
        generationTimeMs: Date.now() - segmentStart,
        error: result.error,
      }
      
    } catch (error) {
      return {
        segmentId: segment.id,
        success: false,
        generationTimeMs: Date.now() - segmentStart,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Generate a character-focused segment using daVinci-MagiHuman
   * Falls back to LTX-Video if daVinci fails
   */
  private async generateCharacterSegment(
    segment: VideoSegment,
    style: StyleGuide,
    project: NarrativeVideoProject,
    outputPath: string
  ): Promise<{ success: boolean; error?: string }> {
    // Try daVinci first
    const prompt = this.buildCharacterPrompt(segment, style, project)
    const character = project.characters[0]
    
    const request: DaVinciGenerationRequest = {
      prompt,
      referenceImagePath: character?.referenceImage,
      dialogue: segment.content.dialogue,
      resolution: '540p',
      duration: segment.content.duration,
      useDistilled: true,
      generateAudio: true,
    }
    
    const result = await this.davinciClient.generate(request, outputPath)
    
    if (result.success) {
      return { success: true }
    }
    
    // Fall back to LTX-Video with character-focused prompt
    console.log(`   ⚠️  daVinci failed, falling back to LTX-Video...`)
    return this.generateEnvironmentalSegment(segment, style, project, outputPath)
  }

  /**
   * Generate an environmental/atmospheric segment using LTX-Video
   */
  private async generateEnvironmentalSegment(
    segment: VideoSegment,
    style: StyleGuide,
    project: NarrativeVideoProject,
    outputPath: string
  ): Promise<{ success: boolean; error?: string }> {
    // Build prompt for LTX
    const prompt = this.buildEnvironmentalPrompt(segment, style, project)
    
    const dims = this.getResolutionDimensions('768p')
    
    try {
      const result = await generateVideoViaHf(
        {
          prompt,
          mode: 'T2V',
          durationS: segment.content.duration,
          width: dims.width,
          height: dims.height,
          negativePrompt: 'worst quality, blurry, distorted, text, watermark, logo, people, faces',
        },
        this.hfToken,
        outputPath
      )
      
      return {
        success: result.success,
        error: result.error,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Generate a transition segment
   */
  private async generateTransitionSegment(
    segment: VideoSegment,
    style: StyleGuide,
    project: NarrativeVideoProject,
    outputPath: string
  ): Promise<{ success: boolean; error?: string }> {
    // Transitions use LTX for smooth environmental shots
    const prompt = `Cinematic transition: ${segment.content.description}. ` +
      `${style.lighting}, ${style.texture}, ${getMotifPromptEnrichment(project.era)}`
    
    const dims = this.getResolutionDimensions('768p')
    
    try {
      const result = await generateVideoViaHf(
        {
          prompt,
          mode: 'T2V',
          durationS: segment.content.duration,
          width: dims.width,
          height: dims.height,
          negativePrompt: 'busy, distracting, text, watermark',
        },
        this.hfToken,
        outputPath
      )
      
      return {
        success: result.success,
        error: result.error,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Build character-focused prompt
   */
  private buildCharacterPrompt(
    segment: VideoSegment,
    style: StyleGuide,
    project: NarrativeVideoProject
  ): string {
    const character = project.characters[0]
    
    const characterDesc = character
      ? `${character.appearance.age} ${character.appearance.build} with ${character.appearance.hair}. ` +
        `Wearing ${character.attire}. ${character.appearance.features}`
      : 'A person'
    
    const mood = segment.visualDirection.mood
    const camera = segment.visualDirection.cameraMovement === 'static'
      ? 'stationary framing'
      : `${segment.visualDirection.cameraMovement} camera movement`
    
    const motifEnrichment = getMotifPromptEnrichment(project.era)
    
    return buildEnhancedPrompt({
      character: characterDesc,
      action: segment.content.description,
      mood,
      camera,
      performance: motifEnrichment,
    })
  }

  /**
   * Build environmental prompt
   */
  private buildEnvironmentalPrompt(
    segment: VideoSegment,
    style: StyleGuide,
    project: NarrativeVideoProject
  ): string {
    const motifEnrichment = getMotifPromptEnrichment(project.era)
    
    return `${segment.content.description}. ${style.lighting}, ${style.texture}. ` +
      `${segment.visualDirection.mood} atmosphere. ${motifEnrichment}. ` +
      `Cinematic ${segment.visualDirection.shotType} shot with ` +
      `${segment.visualDirection.cameraMovement} movement.`
  }

  /**
   * Concatenate video segments using ffmpeg
   */
  private async concatenateSegments(
    results: GenerationResult[],
    projectId: string
  ): Promise<string> {
    const finalPath = path.join(this.outputDir, `${projectId}-final.mp4`)
    const listPath = path.join(this.outputDir, `${projectId}-concat-list.txt`)
    
    // Create concat list
    const listContent = results
      .filter(r => r.success && r.outputPath)
      .map(r => `file '${r.outputPath}'`)
      .join('\n')
    
    fs.writeFileSync(listPath, listContent)
    
    try {
      // Use ffmpeg to concatenate
      execSync(
        `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${finalPath}" -y`,
        { stdio: 'ignore' }
      )
      
      // Clean up list file
      fs.unlinkSync(listPath)
      
      console.log(`\n✅ Final video: ${finalPath}`)
      return finalPath
    } catch {
      console.log('\n⚠️  Concatenation failed. Segments available individually.')
      return ''
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════

  private getEraForSlug(slug: string): TemporalEra | undefined {
    return TEMPORAL_ERAS.find(e => 
      slug.startsWith(`${e.key}-`) || slug.includes(e.key)
    )
  }

  private createEraCharacters(era: TemporalEra): CharacterVisualProfile[] {
    // Create era-appropriate character profiles
    const baseCharacters: Record<string, CharacterVisualProfile[]> = {
      threshold: [{
        id: 'protagonist-t',
        name: 'Professional at the Threshold',
        appearance: {
          age: 'middle-aged',
          build: 'professional build',
          features: 'expressive face showing quiet competence',
          hair: 'well-kept, practical',
        },
        attire: 'professional clothing, warm amber tones',
        visualIdentifiers: ['determined expression', 'practiced gestures'],
        voiceProfile: { tone: 'measured', pace: 'deliberate' },
      }],
      residue: [{
        id: 'protagonist-r',
        name: 'Curator of the Forgotten',
        appearance: {
          age: 'varies',
          build: 'adapted to work',
          features: 'weathered by time and purpose',
          hair: 'practical, possibly showing age',
        },
        attire: 'functional clothing in desaturated tones',
        visualIdentifiers: ['careful movements', 'attentive to detail'],
        voiceProfile: { tone: 'quiet', pace: 'unhurried' },
      }],
      cartography: [{
        id: 'protagonist-c',
        name: 'Explorer of New Territories',
        appearance: {
          age: 'indeterminate',
          build: 'adaptable',
          features: 'awe and wonder visible',
          hair: 'unaffected by conventional styling',
        },
        attire: 'functional gear for exploration',
        visualIdentifiers: ['wide-eyed observation', 'gestures of discovery'],
        voiceProfile: { tone: 'wondering', pace: 'variable' },
      }],
    }
    
    return baseCharacters[era.key] || baseCharacters.threshold
  }

  private createSegmentsFromNarrative(
    slug: string,
    era: TemporalEra,
    focusScenes: string[],
    durationPerScene: number,
    includeDialogue: boolean
  ): VideoSegment[] {
    // Create segments based on era narrative structure
    const segments: VideoSegment[] = []
    
    // Opening: Character introduction
    segments.push({
      id: 'opening',
      type: 'character',
      content: {
        description: era.emotionalArc.opening,
        duration: durationPerScene,
      },
      visualDirection: {
        shotType: 'medium',
        cameraMovement: 'static',
        mood: 'contemplative',
        lighting: era.visualIdentity.lighting,
      },
    })
    
    // Environmental establishing shot
    segments.push({
      id: 'establishing',
      type: 'environmental',
      content: {
        description: `${era.title}: ${era.subtitle}. ${era.visualIdentity.scale} scale.`,
        duration: durationPerScene,
      },
      visualDirection: {
        shotType: 'establishing',
        cameraMovement: 'pan',
        mood: 'expansive',
        lighting: era.visualIdentity.lighting,
      },
    })
    
    // Midpoint: Dramatic moment
    segments.push({
      id: 'midpoint',
      type: 'character',
      content: {
        description: era.emotionalArc.midpoint,
        duration: durationPerScene,
      },
      visualDirection: {
        shotType: 'close-up',
        cameraMovement: 'static',
        mood: 'tense',
        lighting: era.visualIdentity.lighting,
      },
    })
    
    // Transition
    segments.push({
      id: 'transition',
      type: 'transition',
      content: {
        description: `Passage of time from ${era.yearRange[0]} to ${era.yearRange[1]}`,
        duration: Math.max(2, Math.floor(durationPerScene / 2)),
      },
      visualDirection: {
        shotType: 'wide',
        cameraMovement: 'crane',
        mood: 'transitional',
        lighting: era.visualIdentity.lighting,
      },
    })
    
    // Closing
    segments.push({
      id: 'closing',
      type: 'character',
      content: {
        description: era.emotionalArc.closing,
        duration: durationPerScene,
      },
      visualDirection: {
        shotType: 'medium',
        cameraMovement: 'track',
        mood: 'resolute',
        lighting: era.visualIdentity.lighting,
      },
    })
    
    return segments
  }

  private createEraAudioDesign(era: TemporalEra): AudioDesign {
    const baseDesigns: Record<string, AudioDesign> = {
      threshold: {
        ambient: 'quiet room tone, occasional distant sounds',
        musicStyle: 'minimal piano, subtle strings',
        soundEffects: ['paper rustling', 'quiet typing', 'breathing'],
        voiceTreatment: 'clean',
      },
      residue: {
        ambient: 'air circulation, faint mechanical hum',
        musicStyle: 'ambient pads, occasional piano',
        soundEffects: ['footsteps on concrete', 'switch clicks', 'distant traffic'],
        voiceTreatment: 'spatial',
      },
      cartography: {
        ambient: 'ethereal space tone, subtle particles',
        musicStyle: 'orchestral swells, electronic textures',
        soundEffects: ['shimmering', 'deep resonance', 'crystalline tones'],
        voiceTreatment: 'processed',
      },
    }
    
    return baseDesigns[era.key] || baseDesigns.threshold
  }

  private getResolutionDimensions(resolution: string): { width: number; height: number } {
    const dims: Record<string, { width: number; height: number }> = {
      '256p': { width: 448, height: 256 },
      '540p': { width: 960, height: 540 },
      '768p': { width: 768, height: 448 },
      '1080p': { width: 1920, height: 1080 },
    }
    
    return dims[resolution] || dims['768p']
  }
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════

/**
 * Quick compose function for single article
 */
export async function composeArticleVideo(
  slug: string,
  outputDir: string,
  options?: {
    hfToken?: string
    durationPerScene?: number
    focusScenes?: string[]
  }
): Promise<ComposedVideo> {
  const composer = new NarrativeVideoComposer(
    outputDir,
    options?.hfToken
  )
  
  const project = await composer.createProjectFromArticle(slug, {
    durationPerScene: options?.durationPerScene,
    focusScenes: options?.focusScenes,
  })
  
  return composer.compose(project)
}
