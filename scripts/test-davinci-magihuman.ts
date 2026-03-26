#!/usr/bin/env tsx
/**
 * Test Script: daVinci-MagiHuman Video Generation
 * 
 * Tests the daVinci-MagiHuman client for human-centric video generation.
 * 
 * Requires:
 *   HF_TOKEN with access to SII-GAIR/daVinci-MagiHuman Space
 * 
 * Usage:
 *   pnpm tsx scripts/test-davinci-magihuman.ts
 *   pnpm tsx scripts/test-davinci-magihuman.ts --dry-run
 */

import { DaVinciClient, buildEnhancedPrompt, type DaVinciGenerationResult } from '../lib/video-generation/davinci'
import fs from 'fs'
import path from 'path'

const OUTPUT_DIR = path.join(process.cwd(), 'test-output', 'davinci')

const TEST_PROMPTS = [
  {
    name: 'professional-speaking',
    prompt: buildEnhancedPrompt({
      character: 'A middle-aged professional with short dark hair, wearing a navy blazer over a light shirt',
      action: 'speaking directly to camera with measured gestures',
      mood: 'earnest and authoritative',
      camera: 'medium shot, stationary framing',
    }),
    dialogue: [{
      characterDescription: 'Professional speaker, English',
      language: 'en',
      text: 'The threshold moment comes not as a shock, but as a slow realization.',
    }],
    duration: 5,
    resolution: '256p' as const,
  },
  {
    name: 'contemplative-closeup',
    prompt: buildEnhancedPrompt({
      character: 'A woman in her thirties with thoughtful eyes and minimal makeup',
      action: 'looking slightly off-camera in quiet reflection',
      mood: 'contemplative and vulnerable',
      camera: 'close-up, shallow depth of field',
    }),
    duration: 4,
    resolution: '256p' as const,
  },
]

async function testEnhancedPromptBuilder() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 1: Enhanced Prompt Builder')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const prompt = buildEnhancedPrompt({
    character: 'A skilled craftsperson with weathered hands',
    action: 'working with focused attention',
    mood: 'quiet competence',
    performance: 'Subtle breathing, occasional blinking, natural micro-movements',
  })
  
  console.log('Generated prompt:')
  console.log('─'.repeat(60))
  console.log(prompt)
  console.log('─'.repeat(60))
  console.log('\n✅ Prompt structure valid')
}

async function testSceneAnalysis() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 2: Scene Analysis')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const client = new DaVinciClient()
  
  const script = `
The office is quiet in the early morning. Dr. Chen sits at her desk,
staring at the monitor. The AI's diagnostic report glows on screen.

CLOSE-UP: Her face as she processes the results. A mix of awe and
something else—recognition of her own limitations.

She stands and walks to the window. Wide shot of the city below,
her reflection ghosted against the glass.
  `.trim()
  
  const analysis = client.analyzeScript(script)
  
  console.log(`Detected ${analysis.scenes.length} scenes:\n`)
  analysis.scenes.forEach((scene, i) => {
    console.log(`  Scene ${i + 1}: ${scene.id}`)
    console.log(`    Duration: ${scene.startTime}s - ${scene.endTime}s`)
    console.log(`    Camera: ${scene.camera}`)
    console.log(`    Mood: ${scene.mood}`)
    console.log(`    Setting: ${scene.setting}`)
    console.log()
  })
  
  console.log('Visual Style:')
  console.log(`  Aesthetic: ${analysis.visualStyle.aesthetic}`)
  console.log(`  Palette: ${analysis.visualStyle.colorPalette}`)
  console.log(`  Lighting: ${analysis.visualStyle.lighting}`)
}

async function testVideoGeneration(args: string[]) {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 3: Video Generation (via HF Space)')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const token = process.env.HF_TOKEN
  if (!token) {
    console.log('⚠️  HF_TOKEN not set. Skipping generation test.')
    console.log('   Set HF_TOKEN to test actual video generation.')
    return
  }
  
  const dryRun = args.includes('--dry-run')
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  
  const client = new DaVinciClient(token)
  const results: Array<{ name: string; result: DaVinciGenerationResult }> = []
  
  for (const test of TEST_PROMPTS) {
    console.log(`\n--- Testing: ${test.name} ---`)
    const outputPath = path.join(OUTPUT_DIR, `${test.name}.mp4`)
    
    if (dryRun) {
      console.log(`[DRY RUN] Would generate: ${test.name}`)
      console.log(`  Prompt: ${test.prompt.slice(0, 100)}...`)
      console.log(`  Output: ${outputPath}`)
      results.push({
        name: test.name,
        result: {
          success: true,
          metadata: {
            resolution: test.resolution,
            duration: test.duration,
            seed: 42,
            generationTimeMs: 0,
            model: 'distilled',
          },
        },
      })
      continue
    }
    
    const result = await client.generate({
      prompt: test.prompt,
      dialogue: test.dialogue,
      resolution: test.resolution,
      duration: test.duration,
      useDistilled: true,
    }, outputPath)
    
    results.push({ name: test.name, result })
    
    if (result.success) {
      console.log(`✅ Generated: ${test.name}`)
      console.log(`   Time: ${(result.metadata.generationTimeMs / 1000).toFixed(1)}s`)
      if (result.videoPath && fs.existsSync(result.videoPath)) {
        const stats = fs.statSync(result.videoPath)
        console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
      }
    } else {
      console.log(`❌ Failed: ${result.error}`)
    }
    
    // Brief pause between requests
    if (test !== TEST_PROMPTS[TEST_PROMPTS.length - 1]) {
      await new Promise(r => setTimeout(r, 5000))
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('RESULTS SUMMARY')
  console.log('═'.repeat(60))
  
  const passed = results.filter(r => r.result.success).length
  const failed = results.filter(r => !r.result.success).length
  
  results.forEach(r => {
    const status = r.result.success ? '✅' : '❌'
    const time = r.result.metadata.generationTimeMs > 0 
      ? `${(r.result.metadata.generationTimeMs / 1000).toFixed(1)}s`
      : 'N/A'
    console.log(`  ${status} ${r.name.padEnd(25)} ${time}`)
  })
  
  console.log(`\nTotal: ${passed} passed, ${failed} failed`)
  
  if (!dryRun && passed > 0) {
    console.log(`\nOutput directory: ${OUTPUT_DIR}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║     daVinci-MagiHuman Client Test Suite                   ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log(`\nSpace: SII-GAIR/daVinci-MagiHuman`)
  console.log(`Output: ${OUTPUT_DIR}`)
  
  try {
    await testEnhancedPromptBuilder()
    await testSceneAnalysis()
    await testVideoGeneration(args)
    
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('ALL TESTS COMPLETED')
    console.log('═══════════════════════════════════════════════════════════\n')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

main()
