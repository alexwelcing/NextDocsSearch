#!/usr/bin/env python3
"""Synthesize the ARC Terminal SFX set into public/sounds/arc/*.wav.

Design goals (see lib/immersive/audio.ts, the WebAudio bus that plays these):
- Warm, not harsh: pure sine/triangle partials, no square/noise, everything low-mids.
- No clicks: every one-shot opens with a sin^2 attack and dies on an exponential decay.
- Quiet masters: peaks well under full scale; the runtime gain table sets the final mix.
- hum.wav loops seamlessly: 12 seconds built ONLY from partials with an integer number of
  cycles over the loop (freq = k/12 Hz), so sample 0 continues sample N-1 exactly.

Pure stdlib (wave + math) so it runs anywhere. Run: python3 scripts/generate-arc-sfx.py
"""

import math
import os
import struct
import wave

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'sounds', 'arc')


def triangle(phase):
    """Triangle wave from phase in cycles — odd harmonics only, mellow."""
    return 2.0 * abs(2.0 * (phase - math.floor(phase + 0.5))) - 1.0


def render(duration, partials, attack=0.003, tau=0.08, sweep=1.0):
    """One-shot: sum of (freq, amp, shape) partials under sin^2 attack * exp decay.

    sweep < 1 glides every partial's frequency down to sweep*freq by the end (close/deny
    gestures fall, confirm/open gestures stay put or rise with sweep > 1).
    """
    n = int(duration * SR)
    samples = [0.0] * n
    for freq, amp, shape in partials:
        phase = 0.0
        for i in range(n):
            t = i / SR
            # linear frequency glide; integrate so the phase stays continuous
            f = freq * (1.0 + (sweep - 1.0) * (t / duration))
            phase += f / SR
            v = triangle(phase) if shape == 'tri' else math.sin(2.0 * math.pi * phase)
            env = math.sin(min(t / attack, 1.0) * math.pi / 2.0) ** 2 * math.exp(-t / tau)
            samples[i] += amp * v * env
    return samples


def render_hum(duration=12.0):
    """Loopable room tone: every partial (and the slow breathing LFO) completes an integer
    number of cycles over the loop, so the seam is inaudible."""
    n = int(duration * SR)

    def cycles(freq):  # snap to an integer cycle count over the loop
        return round(freq * duration) / duration

    partials = [
        (cycles(55.0), 0.45, 'sine'),
        (cycles(110.0), 0.30, 'sine'),
        (cycles(165.0), 0.14, 'tri'),
        (cycles(220.0), 0.08, 'sine'),
        (cycles(330.0), 0.03, 'sine'),
    ]
    lfo_f = cycles(0.25)  # 3 full breaths per loop
    samples = [0.0] * n
    for freq, amp, shape in partials:
        for i in range(n):
            t = i / SR
            phase = freq * t
            v = triangle(phase) if shape == 'tri' else math.sin(2.0 * math.pi * phase)
            breath = 1.0 + 0.12 * math.sin(2.0 * math.pi * lfo_f * t)
            samples[i] += amp * v * breath
    return samples


def master(samples, peak):
    top = max(abs(s) for s in samples) or 1.0
    return [s * (peak / top) for s in samples]


def write_wav(name, samples):
    path = os.path.join(OUT_DIR, name + '.wav')
    frames = b''.join(
        struct.pack('<h', max(-32767, min(32767, int(s * 32767)))) for s in samples
    )
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)
    print(f'  {name}.wav  {len(samples) / SR:.2f}s  peak {max(abs(s) for s in samples):.2f}')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f'writing {os.path.abspath(OUT_DIR)}')

    # key: soft felt-tipped tick — short, mid-range, mostly fundamental
    write_wav('key', master(render(
        0.09, [(1046.5, 1.0, 'sine'), (1568.0, 0.25, 'tri')], tau=0.022), 0.42))

    # tab: slightly lower, rounder thock than key
    write_wav('tab', master(render(
        0.13, [(784.0, 1.0, 'sine'), (1175.0, 0.3, 'tri')], tau=0.035), 0.42))

    # open: warm rising fifth (C5 -> presence), a small upward glide
    write_wav('open', master(render(
        0.34, [(523.25, 1.0, 'sine'), (784.0, 0.5, 'sine'), (1046.5, 0.15, 'tri')],
        tau=0.11, sweep=1.06), 0.45))

    # close: the inverse gesture — falling glide, darker partials
    write_wav('close', master(render(
        0.3, [(587.3, 1.0, 'sine'), (392.0, 0.6, 'sine'), (880.0, 0.12, 'tri')],
        tau=0.09, sweep=0.82), 0.45))

    # confirm: bright consonant dyad with a hint of sparkle, quick decay
    write_wav('confirm', master(render(
        0.26, [(659.25, 1.0, 'sine'), (987.75, 0.55, 'sine'), (1318.5, 0.18, 'tri')],
        tau=0.07), 0.45))

    # deny: low beating minor-second buzz — clearly negative, still soft-edged
    write_wav('deny', master(render(
        0.4, [(220.0, 1.0, 'tri'), (233.1, 0.85, 'tri'), (110.0, 0.4, 'sine')],
        tau=0.14, sweep=0.94), 0.45))

    # boot: slow low swell into a warm chord, the longest gesture in the set
    write_wav('boot', master(render(
        1.4, [(110.0, 1.0, 'sine'), (164.8, 0.55, 'sine'), (220.0, 0.4, 'sine'),
              (329.6, 0.18, 'tri')],
        attack=0.28, tau=0.55, sweep=1.03), 0.5))

    # hum: 12s seamless room tone, mastered quiet
    write_wav('hum', master(render_hum(12.0), 0.2))


if __name__ == '__main__':
    main()
