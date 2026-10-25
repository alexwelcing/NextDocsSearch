#!/usr/bin/env python3
"""SPIKE (H1 sky): equirect calibration pattern for seam / pole / orientation checks.
10-degree checker + graticule offset by half a cell (so u=0|1 and u=0.5 fall mid-cell and a
sampling seam cannot hide under a drawn line), latitude rings at +-80 (yellow), +-85 (orange), +-89 (red),
longitude labels on the equator (u*360). Continuous across u=0|1, so ANY line at the seam
in a render is a sampling artifact. usage: test_grid.py out.png [width=8192]"""
import sys
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 8192
H = W // 2
im = Image.new('RGB', (W, H))
d = ImageDraw.Draw(im)
cw = W / 36
off = cw / 2
for j in range(18):
    for i in range(-1, 36):
        c = (48, 56, 64) if (i + j) % 2 == 0 else (82, 92, 100)
        d.rectangle([round(i * cw + off), round(j * cw), round((i + 1) * cw + off) - 1, round((j + 1) * cw) - 1], fill=c)
lw = max(1, W // 4096)
for i in range(36):
    x = round(i * cw + off)
    d.line([(x, 0), (x, H)], fill=(200, 200, 200), width=lw)
for j in range(1, 18):
    y = round(j * cw)
    d.line([(0, y), (W, y)], fill=(200, 200, 200), width=lw)
for lat, col in ((80, (255, 220, 0)), (85, (255, 140, 0)), (89, (255, 40, 40))):
    for s in (1, -1):
        y = round((0.5 - s * lat / 180) * H)
        d.line([(0, y), (W, y)], fill=col, width=lw * 3)
try:
    font = ImageFont.load_default(size=W // 60)
except TypeError:
    font = ImageFont.load_default()
for k in range(12):
    u = k / 12
    d.text((u * W + W / 72, H / 2 + W / 200), f'u={u:.2f}', fill=(255, 255, 255), font=font)
d.text((W / 2 - W / 20, H * 0.08), 'ZENITH SIDE', fill=(255, 255, 255), font=font)
im.save(out)
