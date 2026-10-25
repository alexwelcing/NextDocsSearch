#!/usr/bin/env python3
"""Debug depth for ?depth=1: the world forge's DA-2 distance map -> an 8-bit disparity PNG.

usage: depth_disparity.py depth-2k-16.png OUT.png [--near 4] [--far 60] [--median 20]

Input is the forge pipeline's S4 output (uint16 = clip(distance / scale, 0, 1) * 65535, DA-2
scale-invariant radial distance). Output is what the runtime's debug depth path loads as a plain
texture: 2048x1024 grayscale, s = (1/r - 1/far) / (1/near - 1/far), with r the distance rescaled so
its median sits at --median scene units and clamped to [near, far]. Disparity, not distance:
parallax goes as 1/r, so 8 bits over 1/r keep it sub-pixel for a head-lean of a few tenths.

Conditioning (all wrap-aware horizontally), as in the H1 sky spike: median 5 against speckle,
grey dilation 9 so near silhouettes overgrow onto the background, gaussian sigma 2.

Depth parallax is NOT a shipped feature (the spike's verifier: over budget at 1440p, ghosting
looking down, far = 60 parallaxes 'infinity'); this only feeds the debug flag. Runs on the forge
VM (numpy, scipy, Pillow).
"""
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def to_disparity(dist: np.ndarray, near: float, far: float, median: float) -> np.ndarray:
    r = np.clip(dist / np.median(dist) * median, near, far)
    return np.clip((1.0 / r - 1.0 / far) / (1.0 / near - 1.0 / far), 0, 1)


def condition(s: np.ndarray) -> np.ndarray:
    p = 16
    a = np.concatenate([s[:, -p:], s, s[:, :p]], axis=1)
    a = ndi.median_filter(a, size=5, mode='nearest')
    a = ndi.grey_dilation(a, size=(9, 9), mode='nearest')
    a = ndi.gaussian_filter(a, sigma=2, mode='nearest')
    return a[:, p:-p]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('src')
    ap.add_argument('out')
    ap.add_argument('--near', type=float, default=4.0)
    ap.add_argument('--far', type=float, default=60.0)
    ap.add_argument('--median', type=float, default=20.0)
    args = ap.parse_args()
    d = np.asarray(Image.open(args.src)).astype(np.float64) / 65535.0
    d = np.maximum(d, 1e-6)
    s = condition(to_disparity(d, args.near, args.far, args.median))
    Image.fromarray(np.round(s * 255).astype(np.uint8), mode='L').save(args.out, optimize=True)


if __name__ == '__main__':
    main()
