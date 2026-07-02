/**
 * ACC (Agent Command Center) ComfyUI Queue Manager Client
 *
 * TypeScript client for the Elixir ACC queue manager located at
 * ../agent-command-center-ex
 *
 * Provides backpressure-aware workflow submission, job tracking,
 * and ComfyUI-compatible proxy endpoints.
 */

export interface ACCJob {
  id: string
  prompt_id: string | null
  status: 'pending' | 'queued' | 'executing' | 'completed' | 'failed' | 'cancelled'
  priority: number
  outputs?: Record<string, any>
  error?: any
  created_at: string
  queued_at?: string
  started_at?: string
  completed_at?: string
}

export interface ACCQueueStatus {
  pending: number
  active: number
  total_submitted: number
  total_completed: number
  total_failed: number
  total_cancelled: number
  paused: boolean
  connected: boolean
}

export interface ACCClientConfig {
  accBaseUrl: string
  comfyBaseUrl: string
  pollIntervalMs: number
}

const DEFAULT_CONFIG: ACCClientConfig = {
  accBaseUrl: process.env.ACC_URL || 'http://localhost:4000',
  comfyBaseUrl: process.env.COMFYUI_URL || 'http://localhost:8188',
  pollIntervalMs: 1500,
}

export class ACCQueueClient {
  private config: ACCClientConfig

  constructor(config: Partial<ACCClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Submit a ComfyUI workflow to the ACC queue manager.
   */
  async submitWorkflow(
    workflow: Record<string, any>,
    options: { priority?: number; extra_data?: Record<string, any> } = {}
  ): Promise<{ job_id: string; status: string; prompt_id: string | null }> {
    const url = `${this.config.accBaseUrl}/api/comfy/submit`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow,
        priority: options.priority ?? 0,
        extra_data: options.extra_data,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ACC submit failed: ${error}`)
    }

    return response.json()
  }

  /**
   * Get current ACC queue status.
   */
  async getQueueStatus(): Promise<ACCQueueStatus> {
    const url = `${this.config.accBaseUrl}/api/comfy/status`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to get ACC queue status: ${response.statusText}`)
    }
    return response.json()
  }

  /**
   * Get a specific job by its ACC job ID.
   */
  async getJob(jobId: string): Promise<ACCJob> {
    const url = `${this.config.accBaseUrl}/api/history/${jobId}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to get job ${jobId}: ${response.statusText}`)
    }

    const data = await response.json()

    // The proxy returns {jobId: {outputs: ...}} or empty if not complete
    const jobData = data[jobId]
    if (jobData && jobData.outputs) {
      return {
        id: jobId,
        prompt_id: jobId,
        status: 'completed',
        priority: 0,
        outputs: jobData.outputs,
        created_at: new Date().toISOString(),
      } as ACCJob
    }

    // Fallback: treat as pending if empty
    return {
      id: jobId,
      prompt_id: null,
      status: 'pending',
      priority: 0,
      created_at: new Date().toISOString(),
    } as ACCJob
  }

  /**
   * Poll until a job reaches a terminal state.
   */
  async waitForCompletion(
    jobId: string,
    timeoutMs: number = 600000
  ): Promise<ACCJob> {
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      const job = await this.getJob(jobId)

      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        return job
      }

      await sleep(this.config.pollIntervalMs)
    }

    throw new Error(`Timeout waiting for ACC job ${jobId}`)
  }

  /**
   * Download an output image from ComfyUI directly.
   * ACC does not proxy /view, so we hit ComfyUI directly.
   */
  async downloadOutput(
    filename: string,
    subfolder: string = '',
    type: 'output' | 'temp' = 'output'
  ): Promise<Buffer> {
    const params = new URLSearchParams({ filename, subfolder, type })
    const url = `${this.config.comfyBaseUrl}/view?${params.toString()}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download ${filename}: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /**
   * Proxy-compatible prompt submission (mimics ComfyUI /prompt endpoint).
   * Useful for dropping this client into existing code that expects ComfyUI API shape.
   */
  async proxyPrompt(workflow: Record<string, any>, clientId?: string): Promise<{ prompt_id: string }> {
    const url = `${this.config.accBaseUrl}/api/prompt`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: workflow,
        client_id: clientId || `acc-proxy-${Date.now()}`,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`ACC proxy prompt failed: ${error}`)
    }

    return response.json()
  }

  /**
   * Check if ACC and ComfyUI are reachable.
   * Checks ACC via queue status and ComfyUI directly via HTTP.
   */
  async healthCheck(): Promise<{ acc: boolean; comfy: boolean }> {
    let acc = false
    let comfy = false

    try {
      await this.getQueueStatus()
      acc = true
    } catch {
      // leave as false
    }

    try {
      const response = await fetch(`${this.config.comfyBaseUrl}/system_stats`, {
        signal: AbortSignal.timeout(3000),
      })
      comfy = response.ok
    } catch {
      // leave as false
    }

    return { acc, comfy }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Singleton for convenience
let defaultClient: ACCQueueClient | null = null

export function getACCClient(config?: Partial<ACCClientConfig>): ACCQueueClient {
  if (!defaultClient) {
    defaultClient = new ACCQueueClient(config)
  }
  return defaultClient
}
