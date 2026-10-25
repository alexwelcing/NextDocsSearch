import { describe, expect, it } from 'vitest'
import { parseSkyDebug } from './debug'

describe('parseSkyDebug', () => {
  it('is all off without switches (what every visitor gets)', () => {
    expect(parseSkyDebug('')).toEqual({
      depth: false,
      look: null,
      still: false,
      tier: null,
      handle: false,
    })
    expect(parseSkyDebug('?world=ember&ref=x')).toEqual(parseSkyDebug(''))
  })

  it('reads a look as yaw,pitch[,fov] degrees', () => {
    expect(parseSkyDebug('?look=180,-80').look).toEqual({ yaw: 180, pitch: -80, fov: null })
    expect(parseSkyDebug('?look=-90.5,10,45').look).toEqual({ yaw: -90.5, pitch: 10, fov: 45 })
    expect(parseSkyDebug('?look=abc,1').look).toBeNull()
    expect(parseSkyDebug('?look=10').look).toBeNull()
    expect(parseSkyDebug('?look=,5').look).toBeNull()
  })

  it('accepts only real tiers for the cap', () => {
    expect(parseSkyDebug('?skytier=k4').tier).toBe('k4')
    expect(parseSkyDebug('?skytier=k16').tier).toBeNull()
  })

  it('needs exactly 1 for the boolean switches', () => {
    const on = parseSkyDebug('?depth=1&still=1&skydebug=1')
    expect([on.depth, on.still, on.handle]).toEqual([true, true, true])
    const off = parseSkyDebug('?depth=true&still=yes&skydebug=0')
    expect([off.depth, off.still, off.handle]).toEqual([false, false, false])
  })
})
