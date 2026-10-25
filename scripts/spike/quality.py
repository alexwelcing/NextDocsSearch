#!/usr/bin/env python3
"""SPIKE (H1 sky): objective encode quality per KTX2 tier vs its source level.
Decodes level 0 with `ktx extract --transcode rgb8` and reports PSNR overall and on dark
pixels (source luma < 40/255 — where ETC1S banding shows on the dark worlds), plus a banding
proxy: the fraction of 4x4 blocks in smooth dark regions whose decoded output collapsed to a
single flat value while the source block was not flat.
usage: quality.py KTX2_DIR CHAIN_ROOT id[,id...]"""
import glob, json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def psnr(a, b, mask=None):
    d = (a.astype(np.float32) - b.astype(np.float32)) ** 2
    if mask is not None:
        d = d[mask]
    mse = d.mean()
    return float('inf') if mse == 0 else float(10 * np.log10(255 ** 2 / mse))


def main():
    kdir, chain_root, ids = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
    rep = {}
    for wid in ids:
        for f in sorted(glob.glob(os.path.join(kdir, f'{wid}-[48]k-*.ktx2'))):
            tier = os.path.basename(f)[len(wid) + 1 : -5]
            lvl = 0 if tier.startswith('8k') else 1
            src = np.asarray(Image.open(os.path.join(chain_root, wid, f'L{lvl:02d}.png')).convert('RGB'))
            with tempfile.TemporaryDirectory() as t:
                out = os.path.join(t, 'l0.png')
                subprocess.run(['ktx', 'extract', '--transcode', 'rgb8', '--level', '0', f, out], check=True)
                dec = np.asarray(Image.open(out).convert('RGB'))
            luma = src.astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            dark = luma < 40
            h, w = luma.shape
            bs = luma[: h // 4 * 4, : w // 4 * 4].reshape(h // 4, 4, w // 4, 4)
            bd = dec[: h // 4 * 4, : w // 4 * 4].astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            bd = bd.reshape(h // 4, 4, w // 4, 4)
            src_rng = bs.max(axis=(1, 3)) - bs.min(axis=(1, 3))
            dec_rng = bd.max(axis=(1, 3)) - bd.min(axis=(1, 3))
            smooth_dark = (bs.mean(axis=(1, 3)) < 40) & (src_rng > 1.5) & (src_rng < 8)
            flat = (dec_rng < 0.5) & smooth_dark
            rep[f'{wid}/{tier}'] = {
                'bytes': os.path.getsize(f),
                'psnr': round(psnr(src, dec), 2),
                'psnr_dark': round(psnr(src, dec, dark), 2),
                'dark_frac': round(float(dark.mean()), 3),
                'flattened_dark_gradient_blocks': round(float(flat.sum() / max(1, smooth_dark.sum())), 3),
            }
            print(wid, tier, rep[f'{wid}/{tier}'], file=sys.stderr)
    print(json.dumps(rep, indent=1))


if __name__ == '__main__':
    main()
