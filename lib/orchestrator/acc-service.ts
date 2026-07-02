/**
 * ACC (Agent Command Center) Service Manager
 *
 * Handles lifecycle of the Elixir ACC application:
 * - start / stop / restart
 * - health checking
 * - crash detection and auto-restart
 * - graceful shutdown
 */

import { spawn, ChildProcess, exec } from 'child_process'
import { EventEmitter } from 'events'
import * as path from 'path'

export interface ACCHealth {
  status: 'starting' | 'healthy' | 'unhealthy' | 'stopped' | 'crashed'
  uptime: number
  lastResponse: number
  port: number
  url: string
}

export interface ACCServiceConfig {
  accDir: string
  port: number
  autoStart: boolean
  maxRetries: number
  healthCheckInterval: number
  startTimeout: number
}

export class ACCService extends EventEmitter {
  private process: ChildProcess | null = null
  private config: ACCServiceConfig
  private healthCheckTimer: NodeJS.Timeout | null = null
  private startTime: number = 0
  private retryCount: number = 0
  private isShuttingDown: boolean = false
  private lastHealthResponse: number = 0

  constructor(config: Partial<ACCServiceConfig> = {}) {
    super()

    this.config = {
      accDir: path.resolve(process.cwd(), '..', '..', 'agent-command-center-ex'),
      port: 4000,
      autoStart: false,
      maxRetries: 3,
      healthCheckInterval: 5000,
      startTimeout: 120000,
      ...config,
    }
  }

  /**
   * Start the ACC Elixir application.
   */
  async start(): Promise<void> {
    if (this.process && !this.process.killed) {
      throw new Error('ACC is already running')
    }

    this.isShuttingDown = false
    this.emit('status', { status: 'starting', message: 'Starting ACC...' })

    // Check if already running on port
    const alreadyRunning = await this.checkIfRunning()
    if (alreadyRunning) {
      this.emit('status', { status: 'healthy', message: 'ACC already running' })
      this.startTime = Date.now()
      this.lastHealthResponse = Date.now()
      this.startMonitoring()
      return
    }

    // Validate ACC directory exists
    const fs = await import('fs')
    if (!fs.existsSync(this.config.accDir)) {
      throw new Error(`ACC directory not found: ${this.config.accDir}`)
    }

    // Build command
    // On Windows, we use shell:true to resolve mix.bat properly
    const isWindows = process.platform === 'win32'
    const mixPath = findMixExecutable()
    const command = mixPath || (isWindows ? 'mix.bat' : 'mix')
    const args = ['phx.server']

    this.emit('log', `Starting: ${command} ${args.join(' ')} in ${this.config.accDir}`)

    this.process = spawn(command, args, {
      cwd: this.config.accDir,
      shell: isWindows,
      windowsHide: false,
      env: {
        ...process.env,
        PORT: this.config.port.toString(),
        PHX_HOST: 'localhost',
      },
    })

    this.startTime = Date.now()

    // Handle stdout/stderr
    this.process.stdout?.on('data', (data) => {
      const line = data.toString()
      this.emit('log', line.trim())
      this.parseLogLine(line)
    })

    this.process.stderr?.on('data', (data) => {
      const line = data.toString().trim()
      this.emit('error', line)
    })

    this.process.on('close', (code) => {
      this.handleExit(code)
    })

    this.process.on('error', (err) => {
      this.emit('error', `Process error: ${err.message}`)
      this.handleExit(1)
    })

    // Wait for healthy
    await this.waitForHealthy()
    this.startMonitoring()
  }

  /**
   * Stop the ACC application gracefully.
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true
    this.stopMonitoring()

    if (!this.process || this.process.killed) {
      // Try to kill by port as fallback
      await this.killByPort()
      return
    }

    this.emit('status', { status: 'stopping', message: 'Shutting down ACC...' })

    // Graceful shutdown
    this.process.kill('SIGTERM')

    // Force kill after timeout
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL')
      }
    }, 10000)

    return new Promise((resolve) => {
      this.process?.on('close', () => {
        this.process = null
        resolve()
      })
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await new Promise((r) => setTimeout(r, 2000))
    await this.start()
  }

  /**
   * Check if ACC is responding on its health endpoint.
   */
  private async checkIfRunning(): Promise<boolean> {
    try {
      const response = await fetch(`http://127.0.0.1:${this.config.port}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private async waitForHealthy(timeout: number = this.config.startTimeout): Promise<void> {
    const start = Date.now()

    return new Promise((resolve, reject) => {
      const check = async () => {
        const healthy = await this.checkIfRunning()

        if (healthy) {
          this.retryCount = 0
          this.lastHealthResponse = Date.now()
          this.emit('status', { status: 'healthy', message: 'ACC ready' })
          resolve()
          return
        }

        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for ACC to start on port ${this.config.port}`))
          return
        }

        setTimeout(check, 1500)
      }

      check()
    })
  }

  private startMonitoring(): void {
    if (this.healthCheckTimer) return

    this.healthCheckTimer = setInterval(async () => {
      const healthy = await this.checkIfRunning()

      if (healthy) {
        this.lastHealthResponse = Date.now()
      } else if (!this.isShuttingDown) {
        this.emit('status', { status: 'unhealthy', message: 'ACC not responding' })
        this.handleUnhealthy()
      }
    }, this.config.healthCheckInterval)
  }

  private stopMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  private handleExit(code: number | null): void {
    this.process = null
    this.stopMonitoring()

    if (this.isShuttingDown) {
      this.emit('status', { status: 'stopped', message: 'ACC stopped' })
      return
    }

    if (code !== 0) {
      this.emit('status', { status: 'crashed', message: `ACC crashed (code ${code})` })

      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++
        this.emit('action', {
          type: 'restart',
          message: `Restarting ACC (attempt ${this.retryCount}/${this.config.maxRetries})...`,
        })

        setTimeout(() => this.start(), 5000)
      } else {
        this.emit('action', {
          type: 'max_retries_exceeded',
          message: `ACC exceeded max restart attempts (${this.config.maxRetries})`,
        })
      }
    }
  }

  private handleUnhealthy(): void {
    if (this.retryCount < this.config.maxRetries) {
      this.restart()
    }
  }

  private async killByPort(): Promise<void> {
    return new Promise((resolve) => {
      exec(
        `netstat -ano | findstr :${this.config.port} | findstr LISTENING`,
        (err, stdout) => {
          if (!stdout) {
            resolve()
            return
          }

          const lines = stdout.trim().split('\n')
          for (const line of lines) {
            const parts = line.trim().split(/\s+/)
            const pid = parts[parts.length - 1]
            if (pid && !isNaN(Number(pid))) {
              exec(`taskkill /PID ${pid} /F`, () => {})
            }
          }
          setTimeout(resolve, 1000)
        }
      )
    })
  }

  private parseLogLine(line: string): void {
    // Detect when Phoenix has finished starting
    if (line.includes('Access ACCWeb.Endpoint at')) {
      this.emit('log', 'ACC endpoint ready detected from logs')
    }

    // Detect database connection issues
    if (line.includes('Postgrex.Error') || line.includes('connection refused')) {
      this.emit('warning', { type: 'database', message: 'ACC database connection issue detected' })
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  getHealth(): ACCHealth {
    return {
      status: this.process ? 'healthy' : 'stopped',
      uptime: this.process ? Date.now() - this.startTime : 0,
      lastResponse: this.lastHealthResponse,
      port: this.config.port,
      url: `http://127.0.0.1:${this.config.port}`,
    }
  }

  isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  getConfig(): ACCServiceConfig {
    return { ...this.config }
  }
}

function findMixExecutable(): string | null {
  const fs = require('fs')
  const path = require('path')

  const candidates = [
    'C:\\ProgramData\\chocolatey\\lib\\elixir\\tools\\bin\\mix.bat',
    'C:\\tools\\elixir\\bin\\mix.bat',
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

// Singleton
let service: ACCService | null = null

export function getACCService(config?: Partial<ACCServiceConfig>): ACCService {
  if (!service) {
    service = new ACCService(config)
  }
  return service
}
