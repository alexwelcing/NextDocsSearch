// Two-slot crossfade for the Sky v2 material: slot A and slot B each hold one sky texture, and a
// single uMix uniform blends them in the shader (no transparent second sphere, no second pipeline).
// Pure and generic over the texture type, so the rules are unit-tested without a GPU.
//
// Rules:
//  - At most two sky textures are ever resident (VRAM: ~85 MiB even for an 8K-to-8K fade). The
//    outgoing one is disposed the moment its fade completes.
//  - The first sky ever presented appears at once (it lands under the boot overlay).
//  - A new world fades in over the old one. A sharper tier of the world already showing fades over
//    it quickly. A sharper tier of the world that is still fading in replaces it in place, so the
//    fade carries on with the better texture instead of starting again.
//  - Presenting while a fade runs between two different worlds finishes that fade first (the
//    stale world is retired), so the slots never hold three worlds.

export interface Disposable {
  dispose(): void
}

export interface SkySlot<T extends Disposable> {
  texture: T
  /** World id: tiers of one world share a key. */
  key: string
  /** Tier label, for logs and probes. */
  tier: string
  /** Tier rank (TIER_RANK) — higher is sharper. */
  rank: number
  /** Linear gain on the sky (WorldDef.exposure). */
  exposure: number
  /** Where the start view looks in this image (equirect.ts). */
  heroU: number
}

/** Slot index: 0 = A, 1 = B. */
export type SlotIndex = 0 | 1

export interface CrossfadeListener<T extends Disposable> {
  /** A slot's contents changed (null = emptied; show the placeholder). */
  onSlot(index: SlotIndex, slot: SkySlot<T> | null): void
}

export class SkyCrossfade<T extends Disposable> {
  readonly slots: [SkySlot<T> | null, SkySlot<T> | null] = [null, null]
  /** The slot that is showing, or fading in. */
  front: SlotIndex = 0
  /** Shader blend: 0 shows slot A, 1 shows slot B. */
  mix = 0
  private rate = 0

  constructor(private readonly listener: CrossfadeListener<T>) {}

  /** The shader's resting value for the current front slot. */
  get target(): number {
    return this.front
  }

  get fading(): boolean {
    return this.mix !== this.target
  }

  /** What is showing (or fading in) right now. */
  get current(): SkySlot<T> | null {
    return this.slots[this.front]
  }

  /**
   * Show `slot`, fading over `fadeSeconds` (0 = cut). Takes ownership of its texture: it is
   * disposed when replaced or retired, or right away if it is no sharper than what it would
   * replace for the same world.
   */
  present(slot: SkySlot<T>, fadeSeconds: number): void {
    const cur = this.slots[this.front]
    if (cur && cur.key === slot.key && slot.rank <= cur.rank) {
      slot.texture.dispose()
      return
    }
    if (cur && cur.key === slot.key && this.fading) {
      // The incoming world got sharper mid-fade: swap in place, keep fading.
      cur.texture.dispose()
      this.set(this.front, slot)
      return
    }
    if (this.fading) this.finish()
    if (!this.slots[this.front]) {
      // Nothing showing yet: cut straight to it.
      this.set(this.front, slot)
      return
    }
    const back: SlotIndex = this.front === 0 ? 1 : 0
    this.slots[back]?.texture.dispose() // defensive: a settled back slot is always empty
    this.set(back, slot)
    this.front = back
    this.rate = fadeSeconds > 0 ? 1 / fadeSeconds : Infinity
    if (!Number.isFinite(this.rate)) this.finish()
  }

  /** Advance the fade by `delta` seconds; retires the outgoing slot when it completes. */
  step(delta: number): void {
    if (!this.fading) return
    const t = this.target
    const d = Math.max(delta, 0) * this.rate
    this.mix = this.mix < t ? Math.min(t, this.mix + d) : Math.max(t, this.mix - d)
    if (this.mix === t) this.retire()
  }

  /** Jump to the end of a running fade. */
  finish(): void {
    this.mix = this.target
    this.retire()
  }

  /** Release every texture (unmount). */
  dispose(): void {
    for (const i of [0, 1] as const) {
      this.slots[i]?.texture.dispose()
      this.slots[i] = null
    }
  }

  private retire(): void {
    const back: SlotIndex = this.front === 0 ? 1 : 0
    const old = this.slots[back]
    if (!old) return
    old.texture.dispose()
    this.set(back, null)
  }

  private set(index: SlotIndex, slot: SkySlot<T> | null): void {
    this.slots[index] = slot
    this.listener.onSlot(index, slot)
  }
}
