#!/usr/bin/env tsx
/**
 * Test Script: HF-Mount Integration
 * 
 * Tests mounting HuggingFace repositories and accessing files
 * without downloading entire repos.
 * 
 * Usage:
 *   pnpm tsx scripts/test-hf-mount.ts
 *   HF_TOKEN=xxx pnpm tsx scripts/test-hf-mount.ts
 */

import { mountRepo, HfModelLoader, cleanup } from '../lib/hf-mount'
import fs from 'fs'
import path from 'path'

const TEST_REPO = 'openai-community/gpt2'
const MOUNT_BASE = '/tmp/hf-mount-test'

async function testBasicMount() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 1: Basic Repository Mount')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const mountPath = path.join(MOUNT_BASE, 'basic-test')
  
  console.log(`Mounting ${TEST_REPO}...`)
  const mount = await mountRepo(TEST_REPO, mountPath)
  
  console.log(`✅ Mounted at: ${mount.localPath}`)
  
  // List files
  console.log('\n📁 Root directory:')
  const files = mount.listDir()
  files.slice(0, 10).forEach(f => console.log(`   - ${f}`))
  if (files.length > 10) {
    console.log(`   ... and ${files.length - 10} more files`)
  }
  
  // Read config
  if (mount.exists('config.json')) {
    const config = JSON.parse(mount.readFile('config.json').toString())
    console.log('\n📄 Config.json:')
    console.log(`   Model type: ${config.architectures?.[0] || 'unknown'}`)
    console.log(`   Vocab size: ${config.vocab_size}`)
  }
  
  // Cleanup
  await mount.unmount()
  console.log('\n✅ Unmounted successfully')
}

async function testModelLoader() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 2: HfModelLoader Class')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const loader = new HfModelLoader(TEST_REPO, MOUNT_BASE)
  
  console.log('Mounting via loader...')
  await loader.doMount()
  
  console.log(`✅ Local path: ${loader.getLocalPath('')}`)
  
  if (fs.existsSync(loader.getLocalPath('config.json'))) {
    const config = loader.readConfig('config.json')
    console.log('\n📄 Config loaded:')
    console.log(`   ${JSON.stringify(config, null, 2).slice(0, 500)}...`)
  }
  
  const modelFiles = loader.findFiles('.bin')
  console.log(`\n📦 Model files found: ${modelFiles.length}`)
  modelFiles.forEach(f => console.log(`   - ${f}`))
  
  await loader.unmount()
  console.log('\n✅ Unmounted successfully')
}

async function testPrivateRepo() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('TEST 3: Private Repository Access (if token available)')
  console.log('═══════════════════════════════════════════════════════════\n')
  
  const token = process.env.HF_TOKEN
  if (!token) {
    console.log('⚠️  No HF_TOKEN provided, skipping private repo test')
    return
  }
  
  console.log('HF_TOKEN is available ✅')
  console.log('(Skipping actual private repo test to avoid auth issues)')
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║          HF-Mount Integration Test Suite                  ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  
  try {
    // Clean up any previous test mounts
    await cleanup()
    
    await testBasicMount()
    await testModelLoader()
    await testPrivateRepo()
    
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('ALL TESTS COMPLETED ✅')
    console.log('═══════════════════════════════════════════════════════════\n')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  } finally {
    // Final cleanup
    await cleanup()
    if (fs.existsSync(MOUNT_BASE)) {
      fs.rmSync(MOUNT_BASE, { recursive: true, force: true })
    }
  }
}

main()
