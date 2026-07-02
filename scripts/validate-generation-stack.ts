#!/usr/bin/env tsx
/**
 * Generation Stack Validation Script
 *
 * Tests the orchestrator and its components without doing actual image generation.
 * Validates health checks, ACC client connectivity, and circuit breaker logic.
 *
 * Usage:
 *   npx tsx scripts/validate-generation-stack.ts [--start-services]
 */

import { getGenerationOrchestrator } from '../lib/orchestrator/orchestrator'
import { getACCClient } from '../lib/acc-queue/client'

const args = process.argv.slice(2)
const startServices = args.includes('--start-services')

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

function pass(msg: string) {
  console.log(`${colors.green}✓ PASS${colors.reset} ${msg}`)
}

function fail(msg: string) {
  console.log(`${colors.red}✗ FAIL${colors.reset} ${msg}`)
}

function info(msg: string) {
  console.log(`${colors.cyan}ℹ INFO${colors.reset} ${msg}`)
}

function warn(msg: string) {
  console.log(`${colors.yellow}⚠ WARN${colors.reset} ${msg}`)
}

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║     Generation Stack Validation                            ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  const results = { passed: 0, failed: 0 }

  // ─── Test 1: ACC Client ────────────────────────────────────────────────────
  info('Testing ACC client health check...')
  const accClient = getACCClient()
  try {
    const health = await accClient.healthCheck()
    if (health.acc) {
      pass('ACC is reachable')
      results.passed++
      if (health.comfy) {
        pass('ACC reports ComfyUI as connected')
        results.passed++
      } else {
        warn('ACC is up but cannot reach ComfyUI')
      }
    } else {
      fail('ACC is not reachable at http://localhost:4000')
      results.failed++
      warn('Start the stack with: pnpm genstack:start')
    }
  } catch (e: any) {
    fail(`ACC client threw: ${e.message}`)
    results.failed++
  }

  // ─── Test 2: Queue Status ──────────────────────────────────────────────────
  info('Testing ACC queue status...')
  try {
    const status = await accClient.getQueueStatus()
    pass(`Queue: ${status.pending} pending, ${status.active} active, paused=${status.paused}`)
    results.passed++
  } catch (e: any) {
    fail(`Could not get queue status: ${e.message}`)
    results.failed++
  }

  // ─── Test 3: Orchestrator Health ───────────────────────────────────────────
  info('Testing orchestrator health aggregation...')
  const orchestrator = getGenerationOrchestrator({ autoStart: false })
  try {
    const stackHealth = await orchestrator.getHealth()
    info(`ComfyUI status: ${stackHealth.comfy.status}`)
    info(`ACC status: ${stackHealth.acc.status}`)
    info(`Circuit open: ${stackHealth.circuitOpen}`)
    info(`Stack ready: ${stackHealth.ready}`)
    pass('Orchestrator health check completed')
    results.passed++
  } catch (e: any) {
    fail(`Orchestrator health check threw: ${e.message}`)
    results.failed++
  }

  // ─── Test 4: Service Lifecycle (optional) ──────────────────────────────────
  if (startServices) {
    info('Testing service ensureReady with --start-services...')
    const liveOrchestrator = getGenerationOrchestrator({ autoStart: true })

    // Forward events for visibility
    liveOrchestrator.on('status', (e) => info(`[Orchestrator] ${e.message}`))
    liveOrchestrator.on('comfy:action', (e) => info(`[ComfyUI] ${e.message}`))
    liveOrchestrator.on('acc:action', (e) => info(`[ACC] ${e.message}`))
    liveOrchestrator.on('warning', (e) => warn(`[Warning] ${e.message}`))

    try {
      await liveOrchestrator.ensureReady()
      const health = await liveOrchestrator.getHealth()
      if (health.ready) {
        pass('ensureReady() brought stack to ready state')
        results.passed++
      } else {
        fail('ensureReady() completed but stack is not ready')
        results.failed++
      }

      // Verify ACC still sees ComfyUI
      const accHealth = await accClient.healthCheck()
      if (accHealth.comfy) {
        pass('ACC confirms ComfyUI link after orchestrator startup')
        results.passed++
      } else {
        warn('ACC lost ComfyUI link after orchestrator startup')
      }
    } catch (e: any) {
      fail(`ensureReady() failed: ${e.message}`)
      results.failed++
    }
  } else {
    info('Skipping service lifecycle test (pass --start-services to enable)')
  }

  // ─── Test 5: Circuit Breaker State ─────────────────────────────────────────
  info('Testing circuit breaker state...')
  const comfyService = orchestrator.getComfyService()
  const isOpen = comfyService.isCircuitOpen()
  if (isOpen) {
    warn('VRAM circuit breaker is currently OPEN')
    info(`VRAM: ${comfyService.getHealth().vram.percentUsed.toFixed(1)}%`)
  } else {
    pass('VRAM circuit breaker is CLOSED')
    results.passed++
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log('Validation Summary')
  console.log('═'.repeat(60))
  console.log(`Passed: ${results.passed}`)
  console.log(`Failed: ${results.failed}`)
  console.log('═'.repeat(60) + '\n')

  if (results.failed > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error('Validation script crashed:', e)
  process.exit(1)
})
