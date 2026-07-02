/**
 * Generation Stack Orchestrator
 *
 * Manages the full lifecycle of ComfyUI + ACC as a unified stack.
 * Guarantees correct startup order, health monitoring, crash recovery,
 * and graceful shutdown for reliable batch image generation.
 */

import { EventEmitter } from 'events'
import { ComfyService, ComfyHealth } from '../film-bridge/service/comfy-service'
import { ACCService, ACCHealth } from './acc-service'

export interface StackHealth {
  ready: boolean
  comfy: ComfyHealth
  acc: ACCHealth
  circuitOpen: boolean
  queue?: {
    pending: number
    active: number
    connected: boolean
    paused: boolean
  }
}

export interface OrchestratorConfig {
  autoStart: boolean
  monitorIntervalMs: number
  comfyConfig?: ConstructorParameters<typeof ComfyService>[0]
  accConfig?: ConstructorParameters<typeof ACCService>[0]
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  autoStart: true,
  monitorIntervalMs: 5000,
}

export class GenerationOrchestrator extends EventEmitter {
  private comfy: ComfyService
  private acc: ACCService
  private config: OrchestratorConfig
  private monitorTimer: NodeJS.Timeout | null = null
  private isShuttingDown: boolean = false
  private ensureReadyPromise: Promise<void> | null = null

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super()
    this.config = { ...DEFAULT_CONFIG, ...config }

    this.comfy = new ComfyService(this.config.comfyConfig)
    this.acc = new ACCService(this.config.accConfig)

    this.setupEventForwarding()
    this.setupSignalHandlers()
  }

  private setupEventForwarding(): void {
    // Forward ComfyUI events
    this.comfy.on('status', (e) => this.emit('comfy:status', e))
    this.comfy.on('log', (e) => this.emit('comfy:log', e))
    this.comfy.on('error', (e) => this.emit('comfy:error', e))
    this.comfy.on('vram', (e) => this.emit('comfy:vram', e))
    this.comfy.on('warning', (e) => this.emit('comfy:warning', e))
    this.comfy.on('action', (e) => this.emit('comfy:action', e))
    this.comfy.on('model_loaded', (e) => this.emit('comfy:model_loaded', e))
    this.comfy.on('circuit_open', (e) => this.emit('comfy:circuit_open', e))
    this.comfy.on('circuit_closed', (e) => this.emit('comfy:circuit_closed', e))

    // Forward ACC events
    this.acc.on('status', (e) => this.emit('acc:status', e))
    this.acc.on('log', (e) => this.emit('acc:log', e))
    this.acc.on('error', (e) => this.emit('acc:error', e))
    this.acc.on('warning', (e) => this.emit('acc:warning', e))
    this.acc.on('action', (e) => this.emit('acc:action', e))
  }

  private setupSignalHandlers(): void {
    const shutdown = async () => {
      if (this.isShuttingDown) return
      this.isShuttingDown = true
      console.log('\n🛑 Orchestrator received shutdown signal...')
      await this.shutdown()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Windows doesn't support SIGINT well for child processes
    if (process.platform === 'win32') {
      process.on('message', (msg) => {
        if (msg === 'shutdown') shutdown()
      })
    }
  }

  /**
   * Ensure the full stack is ready for generation.
   * Startup order: ComfyUI → ACC
   */
  async ensureReady(): Promise<void> {
    if (this.ensureReadyPromise) {
      return this.ensureReadyPromise
    }

    this.ensureReadyPromise = this.doEnsureReady()

    try {
      await this.ensureReadyPromise
    } finally {
      this.ensureReadyPromise = null
    }
  }

  private async doEnsureReady(): Promise<void> {
    this.emit('status', { status: 'starting', message: 'Ensuring generation stack is ready...' })

    // Step 1: Ensure ComfyUI is running
    const comfyHealthy = this.comfy.isRunning() || (await this.isComfyHealthy())
    if (!comfyHealthy) {
      if (!this.config.autoStart) {
        throw new Error('ComfyUI is not running and autoStart is disabled')
      }
      this.emit('status', { status: 'starting', message: 'Starting ComfyUI...' })
      await this.comfy.start()
    } else if (!this.comfy.isRunning()) {
      // Running externally — call start() to attach monitoring
      this.emit('status', { status: 'healthy', message: 'ComfyUI already running (attaching monitor)' })
      await this.comfy.start()
    } else {
      this.emit('status', { status: 'healthy', message: 'ComfyUI already running' })
    }

    // Small delay to let ComfyUI stabilize
    await new Promise((r) => setTimeout(r, 1500))

    // Step 2: Ensure ACC is running
    const accHealthy = this.acc.isRunning() || (await this.isACCHealthy())
    if (!accHealthy) {
      if (!this.config.autoStart) {
        throw new Error('ACC is not running and autoStart is disabled')
      }
      this.emit('status', { status: 'starting', message: 'Starting ACC...' })
      await this.acc.start()
    } else if (!this.acc.isRunning()) {
      // Running externally — call start() to attach monitoring
      this.emit('status', { status: 'healthy', message: 'ACC already running (attaching monitor)' })
      await this.acc.start()
    } else {
      this.emit('status', { status: 'healthy', message: 'ACC already running' })
    }

    // Step 3: Verify ACC can talk to ComfyUI via queue status endpoint
    await this.verifyACCComfyLink()

    this.emit('status', { status: 'ready', message: 'Generation stack is ready' })
    this.startMonitoring()
  }

  /**
   * Gracefully shut down the entire stack.
   * Order: ACC first (so it can finish queue items), then ComfyUI.
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    this.stopMonitoring()
    this.emit('status', { status: 'stopping', message: 'Shutting down generation stack...' })

    // Stop ACC first to finish any queued items gracefully
    try {
      if (this.acc.isRunning()) {
        await this.acc.stop()
      }
    } catch (e: any) {
      this.emit('error', { message: `Failed to stop ACC: ${e.message}` })
    }

    // Then stop ComfyUI
    try {
      if (this.comfy.isRunning()) {
        await this.comfy.stop()
      }
    } catch (e: any) {
      this.emit('error', { message: `Failed to stop ComfyUI: ${e.message}` })
    }

    this.emit('status', { status: 'stopped', message: 'Generation stack stopped' })
  }

  /**
   * Restart the entire stack.
   */
  async restart(): Promise<void> {
    await this.shutdown()
    await new Promise((r) => setTimeout(r, 3000))
    this.isShuttingDown = false
    await this.ensureReady()
  }

  /**
   * Get current health of the full stack.
   */
  async getHealth(): Promise<StackHealth> {
    const comfy = this.comfy.getHealth()
    const acc = this.acc.getHealth()

    let queue = undefined
    if (acc.status === 'healthy') {
      try {
        const res = await fetch(`http://127.0.0.1:${acc.url.split(':').pop()}/api/comfy/status`, {
          signal: AbortSignal.timeout(3000),
        })
        if (res.ok) {
          queue = await res.json()
        }
      } catch {
        // ignore
      }
    }

    const circuitOpen = this.comfy.isCircuitOpen()
    const ready = comfy.status === 'healthy' && acc.status === 'healthy' && !circuitOpen

    return {
      ready,
      comfy,
      acc,
      circuitOpen,
      queue,
    }
  }

  /**
   * Periodically check stack health and restart services if needed.
   */
  private startMonitoring(): void {
    if (this.monitorTimer) return

    this.monitorTimer = setInterval(async () => {
      if (this.isShuttingDown) return

      try {
        const health = await this.getHealth()

        if (!health.ready) {
          if (health.circuitOpen) {
            this.emit('warning', {
              type: 'vram_circuit_open',
              message: 'VRAM circuit breaker is open — pausing generation until VRAM drops',
              health,
            })
            return
          }

          this.emit('warning', {
            type: 'stack_degraded',
            message: 'Generation stack degraded — attempting recovery',
            health,
          })

          if (!health.comfy || health.comfy.status !== 'healthy') {
            this.emit('action', { type: 'restart_comfy', message: 'Restarting ComfyUI...' })
            await this.comfy.restart()
            await new Promise((r) => setTimeout(r, 2000))
          }

          if (!health.acc || health.acc.status !== 'healthy') {
            this.emit('action', { type: 'restart_acc', message: 'Restarting ACC...' })
            await this.acc.restart()
          }
        }
      } catch (error: any) {
        this.emit('error', { message: `Health monitor error: ${error.message}` })
      }
    }, this.config.monitorIntervalMs)
  }

  private stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer)
      this.monitorTimer = null
    }
  }

  private async isComfyHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:8188/system_stats`, {
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async isACCHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${this.acc.getConfig().port}/api/health`, {
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async verifyACCComfyLink(): Promise<void> {
    const port = this.acc.getConfig().port
    const start = Date.now()
    const timeout = 30000

    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/comfy/status`, {
          signal: AbortSignal.timeout(3000),
        })

        if (res.ok) {
          const status = await res.json()
          if (status.connected) {
            this.emit('status', { status: 'ready', message: 'ACC ↔ ComfyUI link verified' })
            return
          }
        }
      } catch {
        // retry
      }

      await new Promise((r) => setTimeout(r, 2000))
    }

    this.emit('warning', {
      type: 'acc_comfy_link_uncertain',
      message: 'Could not verify ACC ComfyUI connection, but proceeding',
    })
  }

  // ═══════════════════════════════════════════════════════════════
  // DIRECT SERVICE ACCESS
  // ═══════════════════════════════════════════════════════════════

  getComfyService(): ComfyService {
    return this.comfy
  }

  getACCService(): ACCService {
    return this.acc
  }
}

// Singleton
let orchestrator: GenerationOrchestrator | null = null

export function getGenerationOrchestrator(config?: Partial<OrchestratorConfig>): GenerationOrchestrator {
  if (!orchestrator) {
    orchestrator = new GenerationOrchestrator(config)
  }
  return orchestrator
}
