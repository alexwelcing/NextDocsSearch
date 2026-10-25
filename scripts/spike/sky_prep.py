#!/usr/bin/env python3
"""SPIKE (H1 sky): build an equirect test master + seam/pole-correct mip chain from a 2:1 JPEG.

Quality is not the point (plain Lanczos 4x, no SeedVR2) — this exists to prove the delivery
path. Equirect-aware resampling: horizontal padding wraps around the seam, vertical padding
continues *across the pole* (rows mirrored and rolled by W/2), so neither the upscale nor any
mip level bleeds the zenith into the nadir (ktx --mipmap-wrap can only do wrap OR clamp for
both axes; wrap smears zenith<->nadir at small mips, clamp breaks the seam).

usage: sky_prep.py in.jpg outdir [--width 8192] [--levels-from 0]
writes outdir/L00.png .. Lnn.png (full chain down to 1x1) and preview-1024.webp
"""
import argparse, os, sys
import numpy as np
from PIL import Image

PAD = 16


def sphere_pad(a: np.ndarray, p: int) -> np.ndarray:
    """Pad an HxWxC equirect by p px: wrap horizontally, continue across the poles vertically."""
    h, w = a.shape[:2]
    p = min(p, h)
    top = np.roll(a[:p][::-1], w // 2, axis=1)
    bot = np.roll(a[-p:][::-1], w // 2, axis=1)
    a = np.concatenate([top, a, bot], axis=0)
    return np.concatenate([a[:, -p:], a, a[:, :p]], axis=1)


def resample(a: np.ndarray, w: int, h: int) -> np.ndarray:
    """Lanczos resize of an equirect with spherical padding (crop after)."""
    sh, sw = a.shape[:2]
    p = PAD if min(sh, sw) > PAD * 2 else max(1, min(sh, sw) // 2)
    padded = sphere_pad(a, p)
    sx, sy = w / sw, h / sh
    pw, ph = round(padded.shape[1] * sx), round(padded.shape[0] * sy)
    im = Image.fromarray(padded).resize((pw, ph), Image.LANCZOS)
    out = np.asarray(im)
    ox, oy = round(p * sx), round(p * sy)
    return np.ascontiguousarray(out[oy : oy + h, ox : ox + w])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('outdir')
    ap.add_argument('--width', type=int, default=8192)
    args = ap.parse_args()
    os.makedirs(args.outdir, exist_ok=True)
    src = np.asarray(Image.open(args.src).convert('RGB'))
    W = args.width
    H = W // 2
    base = resample(src, W, H) if src.shape[1] != W else src
    level, cur = 0, base
    while True:
        Image.fromarray(cur).save(os.path.join(args.outdir, f'L{level:02d}.png'), compress_level=1)
        h, w = cur.shape[:2]
        if w == 1 and h == 1:
            break
        nw, nh = max(1, w // 2), max(1, h // 2)
        # Downsample each level from the previous one (classic chain) with spherical padding.
        cur = resample(cur, nw, nh) if min(w, h) > 2 else np.asarray(
            Image.fromarray(cur).resize((nw, nh), Image.BOX))
        level += 1
    prev = resample(base, 1024, 512)
    Image.fromarray(prev).save(os.path.join(args.outdir, 'preview-1024.webp'), quality=82, method=6)
    print(f'{args.src}: {level + 1} levels from {W}x{H}', file=sys.stderr)


if __name__ == '__main__':
    main()
