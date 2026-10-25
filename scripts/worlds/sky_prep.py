#!/usr/bin/env python3
"""Sky v2 asset prep: an equirect master -> a seam/pole-correct, dithered mip chain + preview.

usage: sky_prep.py MASTER.png OUTDIR [--width 4096] [--grain 1.0] [--preview 1024] [--seed 0]
                   [--no-chain]

Writes OUTDIR/L00.png .. Lnn.png (8-bit sRGB, the full chain down to 1x1, L00 = --width wide),
OUTDIR/preview.webp (--preview wide, 2:1) and OUTDIR/prep.json (sizes, mean luma, settings).
sky_encode.sh turns the chain into a UASTC KTX2 with `ktx create --levels`. --no-chain writes
only the preview (how the 12 legacy JPEG worlds got theirs).

Why our own chain instead of `ktx create --generate-mipmap`: its single --mipmap-wrap mode is
wrong for an equirect, which wraps horizontally but continues *across the pole* vertically
(rows mirrored and rolled by W/2). Wrap smears zenith into nadir at small mips; clamp breaks
the u=0|1 seam. Every resample here pads spherically, then crops.

Why grain: GPU block compression (even UASTC) and the 8-bit quantize of a downsample band smooth
dark gradients, and dark worlds (the-stacks: 60% of pixels below sRGB 16) are then lifted by
WorldDef.exposure at runtime, which doubles every step. All resampling happens in float and each
level is quantized with triangular (TPDF) dither of +-grain LSB, which trades the bands for
noise finer than PostFX's own film grain.

Runs on the forge VM (numpy + Pillow); never on the Mac.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

PAD = 16
Image.MAX_IMAGE_PIXELS = None  # 8192x4096 masters are expected


def sphere_pad(a: np.ndarray, p: int) -> np.ndarray:
    """Pad an HxWxC equirect by p px: wrap horizontally, continue across the poles vertically."""
    h, w = a.shape[:2]
    p = min(p, h)
    top = np.roll(a[:p][::-1], w // 2, axis=1)
    bot = np.roll(a[-p:][::-1], w // 2, axis=1)
    a = np.concatenate([top, a, bot], axis=0)
    return np.concatenate([a[:, -p:], a, a[:, :p]], axis=1)


def resize_float(a: np.ndarray, w: int, h: int, flt) -> np.ndarray:
    """Per-channel float resize (Pillow 'F' mode keeps the precision the 8-bit path throws away)."""
    chans = [
        np.asarray(Image.fromarray(np.ascontiguousarray(a[..., c]), mode='F').resize((w, h), flt))
        for c in range(a.shape[2])
    ]
    return np.stack(chans, axis=-1)


def resample(a: np.ndarray, w: int, h: int) -> np.ndarray:
    """Lanczos resize of a float equirect with spherical padding (cropped after)."""
    sh, sw = a.shape[:2]
    p = PAD if min(sh, sw) > PAD * 2 else max(1, min(sh, sw) // 2)
    padded = sphere_pad(a, p)
    sx, sy = w / sw, h / sh
    pw, ph = round(padded.shape[1] * sx), round(padded.shape[0] * sy)
    out = resize_float(padded, pw, ph, Image.LANCZOS)
    ox, oy = round(p * sx), round(p * sy)
    return np.ascontiguousarray(out[oy : oy + h, ox : ox + w])


def quantize(a: np.ndarray, grain: float, rng: np.random.Generator) -> np.ndarray:
    """Float 0..255 -> uint8 with TPDF dither of +-grain LSB (0 = plain rounding)."""
    if grain > 0:
        noise = (rng.random(a.shape, dtype=np.float32) - rng.random(a.shape, dtype=np.float32)) * grain
        a = a + noise
    return np.clip(np.rint(a), 0, 255).astype(np.uint8)


def mean_luma(u8: np.ndarray) -> float:
    return float((u8[..., :3].astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)).mean())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('master')
    ap.add_argument('outdir')
    ap.add_argument('--width', type=int, default=4096, help='level-0 width (2:1 equirect)')
    ap.add_argument('--grain', type=float, default=1.0, help='TPDF dither amplitude, LSB')
    ap.add_argument('--preview', type=int, default=1024, help='preview width (0 = none)')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--no-chain', action='store_true', help='write the preview only')
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    rng = np.random.default_rng(args.seed)
    src = np.asarray(Image.open(args.master).convert('RGB')).astype(np.float32)
    sh, sw = src.shape[:2]
    if sw != 2 * sh:
        sys.exit(f'{args.master}: {sw}x{sh} is not a 2:1 equirect')
    W = args.width
    H = W // 2
    base = src if sw == W else resample(src, W, H)

    levels = []
    level, cur = 0, base
    while not args.no_chain:
        u8 = quantize(cur, args.grain, rng)
        name = f'L{level:02d}.png'
        Image.fromarray(u8).save(os.path.join(args.outdir, name), compress_level=1)
        levels.append({'name': name, 'w': int(u8.shape[1]), 'h': int(u8.shape[0])})
        h, w = cur.shape[:2]
        if w == 1 and h == 1:
            break
        nw, nh = max(1, w // 2), max(1, h // 2)
        # Each level from the previous float level (classic chain), padded spherically. The last
        # few (<=2 px on a side) are plain box averages: there is nothing left to pad.
        if min(w, h) > 2:
            cur = resample(cur, nw, nh)
        else:
            cur = resize_float(cur, nw, nh, Image.BOX)
        level += 1

    info = {
        'master': os.path.basename(args.master),
        'master_size': [sw, sh],
        'width': W,
        'grain': args.grain,
        'seed': args.seed,
        'levels': levels,
        'mean_luma_l0': round(mean_luma(quantize(base, 0, rng)), 2),
    }
    if args.preview:
        pw = args.preview
        prev = quantize(resample(src, pw, pw // 2), args.grain, rng)
        path = os.path.join(args.outdir, 'preview.webp')
        Image.fromarray(prev).save(path, quality=82, method=6)
        info['preview'] = {'w': pw, 'h': pw // 2, 'bytes': os.path.getsize(path)}
    with open(os.path.join(args.outdir, 'prep.json'), 'w') as f:
        json.dump(info, f, indent=1)
    print(f'{args.master}: {len(levels)} levels from {W}x{H}, grain {args.grain}', file=sys.stderr)


if __name__ == '__main__':
    main()
