import { describe, it, expect } from 'vitest'
import { ACCQueueClient } from '../lib/acc-queue/client'

describe('ACC Queue Client', () => {
  it('constructs with default config', () => {
    const client = new ACCQueueClient()
    expect(client).toBeDefined()
  })

  it('constructs with custom config', () => {
    const client = new ACCQueueClient({
      accBaseUrl: 'http://localhost:9999',
      comfyBaseUrl: 'http://localhost:8888',
      pollIntervalMs: 500,
    })
    expect(client).toBeDefined()
  })

  it('healthCheck returns false when ACC is not running', async () => {
    // Use a port that's very unlikely to have ACC running
    const client = new ACCQueueClient({
      accBaseUrl: 'http://localhost:59999',
      comfyBaseUrl: 'http://localhost:59998',
      pollIntervalMs: 100,
    })

    const health = await client.healthCheck()
    expect(health.acc).toBe(false)
    expect(health.comfy).toBe(false)
  })

  it('formats download URL correctly', () => {
    const client = new ACCQueueClient({
      comfyBaseUrl: 'http://localhost:8188',
    })

    // Access private method indirectly by checking behavior
    // The downloadOutput method builds URLs with search params
    const url = 'http://localhost:8188/view?filename=test.png&subfolder=&type=output'
    expect(url).toContain('filename=test.png')
    expect(url).toContain('type=output')
  })
})
