import { describe, expect, it } from 'vitest'
import { SkyCrossfade, type SkySlot } from './crossfade'

class Tex {
  disposed = 0
  constructor(readonly name: string) {}
  dispose() {
    this.disposed++
  }
}

function setup() {
  const shown: Array<[number, string | null]> = []
  const fade = new SkyCrossfade<Tex>({
    onSlot: (i, slot) => shown.push([i, slot ? slot.texture.name : null]),
  })
  const slot = (
    key: string,
    tier: string,
    rank: number,
    name = `${key}-${tier}`
  ): SkySlot<Tex> => ({
    texture: new Tex(name),
    key,
    tier,
    rank,
    exposure: 1,
    heroU: 0.5,
  })
  /** Textures held by the slots right now. */
  const resident = () => fade.slots.filter((s) => s !== null).map((s) => s!.texture.name)
  return { fade, slot, shown, resident }
}

describe('SkyCrossfade', () => {
  it('cuts straight to the first sky (it lands under the boot overlay)', () => {
    const { fade, slot, resident } = setup()
    fade.present(slot('stacks', 'preview', 0), 0.6)
    expect(fade.fading).toBe(false)
    expect(fade.current?.texture.name).toBe('stacks-preview')
    expect(resident()).toEqual(['stacks-preview'])
  })

  it('fades a new world in over the old one, then disposes the old one', () => {
    const { fade, slot, resident } = setup()
    const a = slot('stacks', 'k4', 2)
    fade.present(a, 0)
    fade.present(slot('train', 'legacy', 1), 0.5)
    expect(fade.fading).toBe(true)
    expect(fade.front).toBe(1)
    expect(resident()).toEqual(['stacks-k4', 'train-legacy'])
    fade.step(0.25)
    expect(fade.mix).toBeCloseTo(0.5, 9)
    expect(a.texture.disposed).toBe(0)
    fade.step(0.3)
    expect(fade.mix).toBe(1)
    expect(fade.fading).toBe(false)
    expect(a.texture.disposed).toBe(1)
    expect(resident()).toEqual(['train-legacy'])
  })

  it('ping-pongs: the next world fades back toward slot A', () => {
    const { fade, slot } = setup()
    fade.present(slot('a', 'k4', 2), 0)
    fade.present(slot('b', 'k4', 2), 0.5)
    fade.step(1)
    fade.present(slot('c', 'k4', 2), 0.5)
    expect(fade.front).toBe(0)
    fade.step(0.1)
    expect(fade.mix).toBeCloseTo(0.8, 9)
  })

  it('never holds more than two textures, however fast worlds are switched', () => {
    const { fade, slot, resident } = setup()
    const all: SkySlot<Tex>[] = []
    for (let i = 0; i < 10; i++) {
      const s = slot(`w${i}`, 'k4', 2)
      all.push(s)
      fade.present(s, 0.5)
      fade.step(0.1)
      expect(resident().length).toBeLessThanOrEqual(2)
    }
    fade.step(10)
    expect(resident()).toEqual(['w9-k4'])
    // every texture but the one on screen was disposed exactly once
    expect(all.slice(0, -1).every((s) => s.texture.disposed === 1)).toBe(true)
    expect(all[9].texture.disposed).toBe(0)
  })

  it('swaps a sharper tier of the incoming world in place mid-fade, keeping the fade going', () => {
    const { fade, slot, resident } = setup()
    fade.present(slot('a', 'k4', 2), 0)
    const preview = slot('b', 'preview', 0)
    fade.present(preview, 1)
    fade.step(0.4)
    fade.present(slot('b', 'k4', 2), 0.3)
    expect(preview.texture.disposed).toBe(1)
    expect(fade.mix).toBeCloseTo(0.4, 9) // not restarted
    expect(resident()).toEqual(['a-k4', 'b-k4'])
    fade.step(1)
    expect(resident()).toEqual(['b-k4'])
  })

  it('fades a sharper tier of the settled world in quickly', () => {
    const { fade, slot, resident } = setup()
    const p = slot('a', 'preview', 0)
    fade.present(p, 0)
    fade.present(slot('a', 'k4', 2), 0.3)
    expect(fade.fading).toBe(true)
    fade.step(0.3)
    expect(p.texture.disposed).toBe(1)
    expect(resident()).toEqual(['a-k4'])
  })

  it('refuses (and disposes) a tier no sharper than the one showing', () => {
    const { fade, slot, resident } = setup()
    fade.present(slot('a', 'k4', 2), 0)
    const late = slot('a', 'preview', 0)
    fade.present(late, 0.3)
    expect(late.texture.disposed).toBe(1)
    expect(fade.fading).toBe(false)
    expect(resident()).toEqual(['a-k4'])
  })

  it('a fade of 0 is a cut', () => {
    const { fade, slot, resident } = setup()
    const a = slot('a', 'k4', 2)
    fade.present(a, 0)
    fade.present(slot('b', 'k4', 2), 0)
    expect(fade.fading).toBe(false)
    expect(a.texture.disposed).toBe(1)
    expect(resident()).toEqual(['b-k4'])
  })

  it('mirrors every slot change to the shader, emptied slots included', () => {
    const { fade, slot, shown } = setup()
    fade.present(slot('a', 'k4', 2), 0)
    fade.present(slot('b', 'k4', 2), 0.5)
    fade.step(1)
    expect(shown).toEqual([
      [0, 'a-k4'],
      [1, 'b-k4'],
      [0, null],
    ])
  })

  it('disposes everything on dispose()', () => {
    const { fade, slot, resident } = setup()
    const a = slot('a', 'k4', 2)
    const b = slot('b', 'k4', 2)
    fade.present(a, 0)
    fade.present(b, 1)
    fade.dispose()
    expect([a.texture.disposed, b.texture.disposed]).toEqual([1, 1])
    expect(resident()).toEqual([])
  })
})
