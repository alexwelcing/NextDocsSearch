import { describe, it, expect } from 'vitest'
import { GenerationOrchestrator } from '../lib/orchestrator/orchestrator'

describe('GenerationOrchestrator', () => {
  it('creates with default config', () => {
    const orch = new GenerationOrchestrator({ autoStart: false })
    expect(orch).toBeDefined()
  })

  it('returns not ready when services are stopped', async () => {
    const orch = new GenerationOrchestrator({ autoStart: false })
    const health = await orch.getHealth()

    expect(health.ready).toBe(false)
    expect(health.comfy.status).toBe('stopped')
    expect(health.acc.status).toBe('stopped')
    expect(health.circuitOpen).toBe(false)
  })

  it('exposes ComfyService and ACCService', () => {
    const orch = new GenerationOrchestrator({ autoStart: false })
    expect(orch.getComfyService()).toBeDefined()
    expect(orch.getACCService()).toBeDefined()
  })

  it('circuit breaker defaults to closed', () => {
    const orch = new GenerationOrchestrator({ autoStart: false })
    expect(orch.getComfyService().isCircuitOpen()).toBe(false)
  })
})
