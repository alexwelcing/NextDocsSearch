#!/usr/bin/env python3
"""SPIKE (H1 sky): stand-in 4x upscaler with realistic texture detail (Real-ESRGAN x4plus,
BSD-3-Clause, loaded via spandrel/MIT) so KTX2 file sizes and on-screen sharpness are
representative. Production is SeedVR2 (Apache-2.0) per the panorama report; this only
exercises the delivery path with an image that has genuine high-frequency content.

Equirect-aware: the input is padded with sky_prep.sphere_pad (horizontal wrap + across-pole
continuation) before tiling, then cropped, so the seam and poles stay continuous.

usage: upscale_esrgan.py weights.pth in.jpg out.png
"""
import os, sys, time
import numpy as np
import torch
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sky_prep import sphere_pad  # noqa: E402

P, TILE, OV = 32, 512, 32


def main():
    weights, src, dst = sys.argv[1:4]
    from spandrel import ModelLoader
    model = ModelLoader().load_from_file(weights).cuda().eval().half()
    s = model.scale
    a = np.asarray(Image.open(src).convert('RGB'))
    h, w = a.shape[:2]
    pad = sphere_pad(a, P)
    x = torch.from_numpy(pad).permute(2, 0, 1).unsqueeze(0).half().cuda() / 255
    H, W = x.shape[2:]
    out = torch.zeros((1, 3, H * s, W * s), dtype=torch.float16, device='cuda')
    t0 = time.time()
    with torch.no_grad():
        for y0 in range(0, H, TILE):
            for x0 in range(0, W, TILE):
                ya, xa = max(0, y0 - OV), max(0, x0 - OV)
                yb, xb = min(H, y0 + TILE + OV), min(W, x0 + TILE + OV)
                o = model(x[:, :, ya:yb, xa:xb])
                ty, tx = (y0 - ya) * s, (x0 - xa) * s
                th, tw = (min(H, y0 + TILE) - y0) * s, (min(W, x0 + TILE) - x0) * s
                out[:, :, y0 * s : y0 * s + th, x0 * s : x0 * s + tw] = o[:, :, ty : ty + th, tx : tx + tw]
    torch.cuda.synchronize()
    res = out[0, :, P * s : P * s + h * s, P * s : P * s + w * s]
    img = (res.clamp(0, 1) * 255).round().byte().permute(1, 2, 0).cpu().numpy()
    Image.fromarray(img).save(dst, compress_level=1)
    print(f'{src} -> {dst} {img.shape[1]}x{img.shape[0]} in {time.time() - t0:.1f}s, '
          f'peak {torch.cuda.max_memory_allocated() / 2**20:.0f} MiB', file=sys.stderr)


if __name__ == '__main__':
    main()
