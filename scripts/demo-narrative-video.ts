#!/usr/bin/env tsx
/**
 * Demo: Narrative Video Composer (Mock Mode)
 * 
 * Demonstrates the full pipeline without requiring live HF Spaces.
 * Creates project files, generates mock videos, and concatenates them.
 */

import { NarrativeVideoComposer, eraToStyleGuide, getMotifPromptEnrichment } from '../lib/narrative-video'
import { TEMPORAL_ERAS } from '../lib/narrative-arc'
import fs from 'fs'
import path from 'path'

const OUTPUT_DIR = path.join(process.cwd(), 'demo-output', 'narrative-video')

// Mock video generator - creates a simple test file
async function generateMockVideo(outputPath: string, segment: any, style: any): Promise<boolean> {
  // Create a dummy MP4 file (will be invalid but demonstrates the pipeline)
  const mockContent = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // ftyp
    0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x00, 0x00, // isom
    0x69, 0x73, 0x6F, 0x6D, 0x6D, 0x70, 0x34, 0x31, // mp41
    0x00, 0x00, 0x00, 0x08, 0x6D, 0x6F, 0x6F, 0x76, // moov
  ])
  
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, mockContent)
  
  // Simulate generation time
  await new Promise(r => setTimeout(r, 500))
  
  return true
}

// Extended composer with mock generation
class MockNarrativeComposer extends NarrativeVideoComposer {
  async generateSegmentWithMock(
    segment: any,
    project: any,
    index: number
  ): Promise<{ segmentId: string; success: boolean; outputPath?: string; error?: string }> {
    const outputPath = path.join(
      OUTPUT_DIR,
      `${project.id}-${String(index).padStart(2, '0')}-${segment.id}.mp4`
    )
    
    console.log(`\n[${index + 1}/5] ${segment.id} (${segment.type})`)
    console.log(`   Description: ${segment.content.description.slice(0, 60)}...`)
    console.log(`   Shot: ${segment.visualDirection.shotType}, Camera: ${segment.visualDirection.cameraMovement}`)
    console.log(`   Generating mock video...`)
    
    const success = await generateMockVideo(outputPath, segment, project.styleGuide)
    
    if (success) {
      console.log(`   ✅ Mock video created: ${path.basename(outputPath)}`)
    }
    
    return {
      segmentId: segment.id,
      success,
      outputPath: success ? outputPath : undefined,
      error: success ? undefined : 'Mock generation failed',
    }
  }
}

async function demoEraStyleGuides() {
  console.log('\n' + '═'.repeat(70))
  console.log('DEMO 1: Era-Based Style Guides')
  console.log('═'.repeat(70))
  
  for (const era of TEMPORAL_ERAS) {
    const style = eraToStyleGuide(era)
    
    console.log(`\n${era.title.toUpperCase()} (${era.yearRange.join('–')})`)
    console.log(`  Subtitle: "${era.subtitle}"`)
    console.log(`  Thesis: ${era.thesis.slice(0, 80)}...`)
    console.log(`  Style: ${style.aesthetic}`)
    console.log(`  Palette: ${style.palette.primary} / ${style.palette.secondary} / ${style.palette.accent}`)
    console.log(`  Lighting: ${style.lighting}`)
    console.log(`  Scale: ${style.scale}`)
  }
}

async function demoMotifEnrichment() {
  console.log('\n' + '═'.repeat(70))
  console.log('DEMO 2: Motif Prompt Enrichment')
  console.log('═'.repeat(70))
  
  for (const era of TEMPORAL_ERAS) {
    const enrichment = getMotifPromptEnrichment(era.key)
    console.log(`\n${era.title}:`)
    console.log(`  ${enrichment.slice(0, 150)}...`)
  }
}

async function demoProjectCreation() {
  console.log('\n' + '═'.repeat(70))
  console.log('DEMO 3: Project Creation')
  console.log('═'.repeat(70))
  
  const composer = new MockNarrativeComposer(OUTPUT_DIR)
  
  const slugs = [
    'threshold-01-the-last-diagnosis',
    'residue-01-the-last-prompt-engineer',
    'cartography-01-the-unnamed-continent',
  ]
  
  for (const slug of slugs) {
    console.log(`\n📄 Creating project for: ${slug}`)
    
    const project = await composer.createProjectFromArticle(slug, {
      durationPerScene: 3,
    })
    
    console.log(`   ✅ Project: ${project.id}`)
    console.log(`   Era: ${project.era}`)
    console.log(`   Segments: ${project.segments.length}`)
    console.log(`   Characters: ${project.characters.length}`)
    
    // Save project
    const projectPath = path.join(OUTPUT_DIR, `${project.id}-project.json`)
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2))
  }
}

async function demoVideoComposition() {
  console.log('\n' + '═'.repeat(70))
  console.log('DEMO 4: Video Composition (Mock)')
  console.log('═'.repeat(70))
  
  const composer = new MockNarrativeComposer(OUTPUT_DIR)
  
  const project = await composer.createProjectFromArticle(
    'threshold-01-the-last-diagnosis',
    { durationPerScene: 3 }
  )
  
  console.log(`\n🎬 Composing: ${project.id}`)
  console.log(`   Era: ${project.era}`)
  console.log(`   Segments: ${project.segments.length}`)
  console.log()
  
  const results: Array<{ segmentId: string; success: boolean; outputPath?: string }> = []
  
  for (let i = 0; i < project.segments.length; i++) {
    const result = await composer.generateSegmentWithMock(
      project.segments[i],
      project,
      i
    )
    results.push(result)
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70))
  console.log('COMPOSITION RESULTS')
  console.log('═'.repeat(70))
  
  const successful = results.filter(r => r.success).length
  const totalDuration = project.segments.reduce((sum, s) => sum + s.content.duration, 0)
  
  results.forEach((r, i) => {
    const status = r.success ? '✅' : '❌'
    console.log(`  ${status} ${project.segments[i].id.padEnd(15)} ${r.outputPath ? path.basename(r.outputPath) : 'FAILED'}`)
  })
  
  console.log(`\nTotal: ${successful}/${results.length} segments`)
  console.log(`Duration: ${totalDuration}s`)
  console.log(`Output: ${OUTPUT_DIR}`)
  
  // List generated files
  console.log('\n📁 Generated files:')
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.mp4') || f.endsWith('.json'))
  files.forEach(f => {
    const stat = fs.statSync(path.join(OUTPUT_DIR, f))
    console.log(`   - ${f} (${stat.size} bytes)`)
  })
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║     Narrative Video Composer - Full Demo (Mock Mode)                 ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')
  console.log(`\nOutput: ${OUTPUT_DIR}`)
  console.log('Note: Using mock video generation (HF Spaces currently unavailable)')
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  
  try {
    await demoEraStyleGuides()
    await demoMotifEnrichment()
    await demoProjectCreation()
    await demoVideoComposition()
    
    console.log('\n' + '═'.repeat(70))
    console.log('✅ DEMO COMPLETE')
    console.log('═'.repeat(70))
    console.log(`\nGenerated files in: ${OUTPUT_DIR}`)
    console.log('\nTo generate real videos:')
    console.log('  1. Ensure HF_TOKEN has access to required Spaces')
    console.log('  2. Wait for Spaces to be available')
    console.log('  3. Run: pnpm video:compose <article-slug>')
    console.log()
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error)
    process.exit(1)
  }
}

main()
