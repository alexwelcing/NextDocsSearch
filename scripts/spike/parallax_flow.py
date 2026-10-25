#!/usr/bin/env python3
"""SPIKE (H1 sky): quantify head-lean parallax from two screenshots (lean L vs R) with dense
Farneback flow: report horizontal flow percentiles (px at 1600x900). A flat sphere moves
near-uniformly; depth displacement spreads the distribution (near content moves more).
Shift sign: camera leans right -> content moves left; reported as positive px.
usage: parallax_flow.py DIR case view-L view-R [...]"""
import sys, json
import cv2
import numpy as np

d = sys.argv[1]
out = {}
for spec in sys.argv[2:]:
    case, l, r = spec.split(':')
    a = cv2.cvtColor(cv2.imread(f'{d}/{case}--{l}.png'), cv2.COLOR_BGR2GRAY)
    b = cv2.cvtColor(cv2.imread(f'{d}/{case}--{r}.png'), cv2.COLOR_BGR2GRAY)
    # ignore the UI chip strip and frame edges
    m = np.ones_like(a, bool); m[520:600, 650:950] = False; m[:20] = m[-20:] = False; m[:, :20] = m[:, -20:] = False
    # only textured pixels carry trustworthy flow (sky / white walls read as ~0)
    g = cv2.magnitude(cv2.Sobel(a, cv2.CV_32F, 1, 0), cv2.Sobel(a, cv2.CV_32F, 0, 1))
    m &= cv2.GaussianBlur(g, (0, 0), 3) > 12
    f = -cv2.calcOpticalFlowFarneback(a, b, None, 0.5, 5, 31, 5, 7, 1.5, 0)[..., 0][m]
    p = np.percentile(f, [5, 25, 50, 75, 95])
    out[f'{case} {l}->{r}'] = {'shift_px_p5': round(float(p[0]), 1), 'p50': round(float(p[2]), 1),
                               'p95': round(float(p[4]), 1), 'parallax_px_p95_minus_p5': round(float(p[4] - p[0]), 1),
                               'textured_frac': round(float(m.mean()), 2)}
print(json.dumps(out, indent=1))
