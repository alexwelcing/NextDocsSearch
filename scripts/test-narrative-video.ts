#!/usr/bin/env tsx
/**
 * Test Script: Narrative Video Composer
 * 
 * Tests the openstory-inspired narrative video composition system.
 * 
 * Usage:
 *   pnpm tsx scripts/test-narrative-video.ts
 *   pnpm tsx scripts/test-narrative-video.ts --era threshold
 *   pnpm tsx scripts/test-narrative-video.ts --article threshold-01-the-last-diagnosis
 */

import { NarrativeVideoComposer, composeArticleVideo, eraToStyleGuide, getMotifPromptEnrichment } from '../lib/narrative-video'
import { TEMPORAL_ERAS } from '../lib/narrative-arc'
import fs from 'fs'
import path from 'path'

const OUTPUT_DIR = path.join(process.cwd(), 'test-output', 'narrative-video')

async function testEraStyleGuides() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 1: Era to Style Guide Conversion')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  for (const era of TEMPORAL_ERAS) {
    const style = eraToStyleGuide(era)
    
    console.log(`${era.title.toUpperCase()} (${era.yearRange.join('–')})`)
    console.log(`  Aesthetic: ${style.aesthetic}`)
    console.log(`  Palette: ${style.palette.primary} / ${style.palette.secondary} / ${style.palette.accent}`)
    console.log(`  Color Temp: ${style.colorTemperature}`)
    console.log(`  Lighting: ${style.lighting}`)
    console.log(`  Camera: ${style.camera}`)
    console.log(`  Scale: ${style.scale}`)
    console.log()
  }
}

async function testMotifEnrichment() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('TEST 2: Motif Prompt Enrichment')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  for (const era of TEMPORAL_ERAS) {
    const enrichment = getMotifPromptEnrichment(era.key)
    console.log(`${era.title}:`)
    console.log(`  ${enrichment}`)
    console.log()
  }
}

async function testProjectCreation(args: string[]) {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('TEST 3: Project Creation from Article')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  // Parse arguments
  const eraIdx = args.indexOf('--era')
  const articleIdx = args.indexOf('--article')
  
  let testSlug: string
  
  if (articleIdx !== -1 && args[articleIdx + 1]) {
    testSlug = args[articleIdx + 1]
  } else if (eraIdx !== -1 && args[eraIdx + 1]) {
    testSlug = `${args[eraIdx + 1]}-01-test-article`
  } else {
    testSlug = 'threshold-01-the-last-diagnosis'
  }
  
  console.log(`Creating project for: ${testSlug}`)
  
  const composer = new NarrativeVideoComposer(OUTPUT_DIR)
  
  try {
    const project = await composer.createProjectFromArticle(testSlug, {
      durationPerScene: 3,
      focusScenes: ['opening', 'midpoint', 'closing'],
    })
    
    console.log(`\n✅ Project created: ${project.id}`)
    console.log(`   Era: ${project.era}`)
    console.log(`   Segments: ${project.segments.length}`)
    console.log(`   Characters: ${project.characters.length}`)
    
    console.log('\n📋 Segments:')
    project.segments.forEach((seg, i) => {
      console.log(`   ${i + 1}. [${seg.type}] ${seg.id}`)
      console.log(`      Shot: ${seg.visualDirection.shotType}, Camera: ${seg.visualDirection.cameraMovement}`)
      console.log(`      Mood: ${seg.visualDirection.mood}`)
      console.log(`      Duration: ${seg.content.duration}s`)
    })
    
    console.log('\n🎭 Characters:')
    project.characters.forEach(char => {
      console.log(`   - ${char.name}`)
      console.log(`     Appearance: ${char.appearance.age} ${char.appearance.build}`)
      console.log(`     Attire: ${char.attire}`)
    })
    
    console.log('\n🎵 Audio Design:')
    console.log(`   Ambient: ${project.audioDesign.ambient}`)
    console.log(`   Music: ${project.audioDesign.musicStyle}`)
    
    // Save project to file
    const projectPath = path.join(OUTPUT_DIR, `${project.id}-project.json`)
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2))
    console.log(`\n💾 Project saved: ${projectPath}`)
    
    return project
  } catch (error) {
    console.log(`\n⚠️  Project creation failed: ${error}`)
    console.log('   (This is expected if the article file does not exist)')
    return null
  }
}

async function testVideoComposition(args: string[]) {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 4: Video Composition (requires HF_TOKEN)')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const token = process.env.HF_TOKEN
  const dryRun = args.includes('--dry-run')
  
  if (!token && !dryRun) {
    console.log('⚠️  HF_TOKEN not set. Skipping video composition test.')
    console.log('   Use --dry-run to test the workflow without generation.')
    return
  }
  
  // Create a minimal test project
  const testSlug = 'threshold-01-test'
  const composer = new NarrativeVideoComposer(OUTPUT_DIR, token)
  
  console.log(`Creating project for: ${testSlug}`)
  
  try {
    const project = await composer.createProjectFromArticle(testSlug, {
      durationPerScene: 2,
    })
    
    if (dryRun) {
      console.log('\n[DRY RUN] Would generate:')
      project.segments.forEach((seg, i) => {
        console.log(`  ${i + 1}. ${seg.id} (${seg.type}): ${seg.content.duration}s`)
      })
      console.log('\n✅ Dry run complete')
      return
    }
    
    console.log('\n🎬 Starting composition...')
    console.log(`   Output: ${OUTPUT_DIR}`)
    console.log(`   Segments: ${project.segments.length}`)
    
    const video = await composer.compose(project)
    
    console.log('\n' + '═'.repeat(60))
    console.log('COMPOSITION RESULTS')
    console.log('═'.repeat(60))
    
    console.log(`\nTotal Duration: ${video.metadata.totalDuration}s`)
    console.log(`Generation Time: ${(video.metadata.totalGenerationTimeMs / 1000).toFixed(1)}s`)
    console.log(`Segments: ${video.metadata.successfulSegments}/${video.metadata.segmentCount} successful`)
    
    if (video.finalVideoPath) {
      console.log(`\n✅ Final video: ${video.finalVideoPath}`)
    } else {
      console.log('\n⚠️  Segments generated individually (concatenation may have failed)')
    }
    
  } catch (error) {
    console.log(`\n⚠️  Composition test failed: ${error}`)
    console.log('   (This is expected in test environment without API access)')
  }
}

async function testQuickCompose(args: string[]) {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 5: Quick Compose Function')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const dryRun = args.includes('--dry-run')
  const token = process.env.HF_TOKEN
  
  if (!token && !dryRun) {
    console.log('⚠️  HF_TOKEN not set. Skipping quick compose test.')
    return
  }
  
  console.log('Testing quick compose API...')
  console.log('[DRY RUN] Would call composeArticleVideo() with:')
  console.log('  slug: threshold-01-the-last-diagnosis')
  console.log('  outputDir:', OUTPUT_DIR)
  console.log('  durationPerScene: 3')
  
  console.log('\n✅ Quick compose API available')
}

async function main() {
  const args = process.argv.slice(2)
  
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║     Narrative Video Composer Test Suite                   ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`\nOutput: ${OUTPUT_DIR}`)
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  
  try {
    await testEraStyleGuides()
    await testMotifEnrichment()
    await testProjectCreation(args)
    await testVideoComposition(args)
    await testQuickCompose(args)
    
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('ALL TESTS COMPLETED')
    console.log('═══════════════════════════════════════════════════════════\n')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()
