#!/usr/bin/env tsx
/**
 * Generation Stack Manager
 *
 * One-command lifecycle control for the full generation stack:
 *   ComfyUI + ACC (Agent Command Center)
 *
 * Usage:
 *   pnpm genstack:start    - Start ComfyUI + ACC
 *   pnpm genstack:stop     - Stop everything
 *   pnpm genstack:status   - Check stack health
 *   pnpm genstack:restart  - Restart everything
 *
 * This is the foundation for reliable batch image generation.
 */

import { GenerationOrchestrator, getGenerationOrchestrator } from '../lib/orchestrator/orchestrator'

const COMFY_PORT = 8188
const ACC_PORT = 4000

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const colorMap = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warn: colors.yellow,
  }
  console.log(`${colorMap[type]}[${type.toUpperCase()}]${colors.reset} ${message}`)
}

// ═══════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════

async function printStatus(): Promise<void> {
  const orchestrator = getGenerationOrchestrator({ autoStart: false })
  const health = await orchestrator.getHealth()

  console.log(`\n${colors.bold}╔════════════════════════════════════════════════════════════╗${colors.reset}`)
  console.log(`${colors.bold}║          Generation Stack Status                           ║${colors.reset}`)
  console.log(`${colors.bold}╠════════════════════════════════════════════════════════════╣${colors.reset}`)

  // ComfyUI
  const comfyStatus = health.comfy.status === 'healthy'
    ? `${colors.green}● RUNNING${colors.reset}`
    : `${colors.red}● STOPPED${colors.reset}`
  console.log(`║ ${comfyStatus} ComfyUI${' '.repeat(48)}║`)
  console.log(`║    Port: ${COMFY_PORT.toString().padEnd(4)}  URL: http://127.0.0.1:${COMFY_PORT.toString().padEnd(39)}║`)
  if (health.comfy.vram) {
    const vram = health.comfy.vram
    console.log(`║    VRAM: ${vram.usedMB.toFixed(0)}MB / ${vram.totalMB.toFixed(0)}MB (${vram.percentUsed.toFixed(1)}%)${' '.repeat(33 - vram.usedMB.toFixed(0).length - vram.totalMB.toFixed(0).length - vram.percentUsed.toFixed(1).length)}║`)
  }
  console.log(`${colors.bold}╠════════════════════════════════════════════════════════════╣${colors.reset}`)

  // ACC
  const accStatus = health.acc.status === 'healthy'
    ? `${colors.green}● RUNNING${colors.reset}`
    : `${colors.red}● STOPPED${colors.reset}`
  console.log(`║ ${accStatus} ACC Queue Manager${' '.repeat(34)}║`)
  console.log(`║    Port: ${ACC_PORT.toString().padEnd(4)}  URL: http://127.0.0.1:${ACC_PORT.toString().padEnd(39)}║`)
  if (health.queue) {
    const q = health.queue
    console.log(`║    Queue: ${q.pending} pending, ${q.active} active  Connected: ${q.connected ? 'YES' : 'NO'}${' '.repeat(28)}║`)
  }
  console.log(`${colors.bold}╠════════════════════════════════════════════════════════════╣${colors.reset}`)

  // Circuit Breaker
  if (health.circuitOpen) {
    console.log(`║ ${colors.red}⚠ CIRCUIT BREAKER OPEN${colors.reset}${' '.repeat(32)}║`)
    if (health.comfy.vram) {
      const vram = health.comfy.vram
      console.log(`║    VRAM: ${vram.percentUsed.toFixed(1)}% — pausing generation until VRAM drops${' '.repeat(10)}║`)
    }
    console.log(`${colors.bold}╠════════════════════════════════════════════════════════════╣${colors.reset}`)
  }

  // Overall
  const overall = health.ready
    ? `${colors.green}● READY FOR GENERATION${colors.reset}`
    : `${colors.red}● NOT READY${colors.reset}`
  console.log(`║ ${overall}${' '.repeat(55 - (health.ready ? 22 : 11))}║`)
  console.log(`${colors.bold}╚════════════════════════════════════════════════════════════╝${colors.reset}\n`)
}

// ═══════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════

async function startStack(): Promise<void> {
  console.log(`\n${colors.bold}${colors.cyan}`)
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║         Generation Stack Orchestrator                         ║')
  console.log('║         ComfyUI + ACC Queue Manager                           ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log(`${colors.reset}\n`)

  const orchestrator = getGenerationOrchestrator({
    autoStart: true,
    monitorIntervalMs: 5000,
  })

  // Forward events to console for visibility
  orchestrator.on('status', (e) => log(e.message, e.status === 'error' ? 'error' : 'info'))
  orchestrator.on('comfy:log', (e) => process.stdout.write(`[ComfyUI] ${e}`))
  orchestrator.on('comfy:error', (e) => log(String(e), 'error'))
  orchestrator.on('comfy:warning', (e) => log(e.message, 'warn'))
  orchestrator.on('comfy:action', (e) => log(e.message, 'info'))
  orchestrator.on('acc:log', (e) => process.stdout.write(`[ACC] ${e}`))
  orchestrator.on('acc:error', (e) => log(String(e), 'error'))
  orchestrator.on('acc:warning', (e) => log(e.message, 'warn'))
  orchestrator.on('acc:action', (e) => log(e.message, 'info'))
  orchestrator.on('warning', (e) => log(e.message, 'warn'))

  try {
    await orchestrator.ensureReady()
    await printStatus()

    console.log(`${colors.yellow}Press Ctrl+C to stop the generation stack${colors.reset}\n`)

    // Keep running so the orchestrator can monitor and handle signals
    await new Promise(() => {})
  } catch (error: any) {
    log(`Startup failed: ${error.message}`, 'error')
    await orchestrator.shutdown().catch(() => {})
    process.exit(1)
  }
}

// ═══════════════════════════════════════════════════════════════
// STOP
// ═══════════════════════════════════════════════════════════════

async function stopStack(): Promise<void> {
  log('Stopping generation stack...', 'info')

  const orchestrator = getGenerationOrchestrator({ autoStart: false })
  await orchestrator.shutdown()

  log('Generation stack stopped', 'success')
}

// ═══════════════════════════════════════════════════════════════
// RESTART
// ═══════════════════════════════════════════════════════════════

async function restartStack(): Promise<void> {
  log('Restarting generation stack...', 'info')

  const orchestrator = getGenerationOrchestrator({ autoStart: false })
  await orchestrator.restart()
  await printStatus()
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

const command = process.argv[2]

switch (command) {
  case 'start':
    startStack()
    break
  case 'stop':
    stopStack()
    break
  case 'status':
    printStatus()
    break
  case 'restart':
    restartStack()
    break
  default:
    console.log(`
${colors.bold}Generation Stack Manager${colors.reset}

Manages ComfyUI + ACC as a unified, crash-resistant stack.

Usage:
  pnpm genstack:start    Start ComfyUI + ACC
  pnpm genstack:stop     Stop all services
  pnpm genstack:status   Check service health
  pnpm genstack:restart  Restart all services

Services:
  ComfyUI   http://127.0.0.1:8188
  ACC       http://127.0.0.1:4000
`)
    printStatus()
}
