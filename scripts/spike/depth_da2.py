#!/usr/bin/env python3
"""SPIKE (H1 sky): equirect distance with DA-2 (Apache-2.0, haodongli/DA-2) -> 8-bit disparity
maps the WebGPU runtime can load as a plain Texture.

Run on the forge L4 inside ~/work/venvs/da2 (torch 2.9 cu129 + `pip install -e DA-2/src`):
  python depth_da2.py --da2 ~/work/spike/DA-2 --out OUTDIR img.jpg:world-id [...]

Per world it writes:
  <id>-distance.npy        float32 HxW scale-invariant radial distance (DA-2 output)
  <id>-depth-raw.png       8-bit disparity, 2048x1024: 1 = NEAR units, 0 = FAR units
  <id>-depth.png           same, edge-conditioned (median, near-dilation, blur) — see --help
  <id>-depth-vis.jpg       colourised preview for the PR

Disparity, not distance: parallax ~ offset / r, so 8 bits spread over 1/r give uniform
(sub-pixel) parallax error for head-lean; 8 bits over r would band near geometry.
"""
import argparse, json, os, sys, time
import numpy as np

NEAR, FAR, MEDIAN_UNITS = 4.0, 60.0, 20.0


def to_disparity(dist: np.ndarray) -> np.ndarray:
    r = dist / np.median(dist) * MEDIAN_UNITS
    r = np.clip(r, NEAR, FAR)
    s = (1.0 / r - 1.0 / FAR) / (1.0 / NEAR - 1.0 / FAR)
    return np.clip(s, 0, 1)


def condition(s: np.ndarray) -> np.ndarray:
    """Edge conditioning for vertex displacement (all wrap-aware horizontally):
    - median 5: kill speckle that would read as surface noise,
    - grey dilation 9 on disparity: grow near silhouettes outward so the stretched band lands
      on background pixels (a background smear reads better than a torn foreground edge),
    - gaussian sigma 2: spread the remaining step over several vertices."""
    from scipy import ndimage as ndi
    p = 16
    a = np.concatenate([s[:, -p:], s, s[:, :p]], axis=1)
    a = ndi.median_filter(a, size=5, mode='nearest')
    a = ndi.grey_dilation(a, size=(9, 9), mode='nearest')
    a = ndi.gaussian_filter(a, sigma=2, mode='nearest')
    return a[:, p:-p]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--da2', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--size', default='2048x1024')
    ap.add_argument('items', nargs='+')
    args = ap.parse_args()
    import cv2, torch
    sys.path.insert(0, os.path.join(args.da2, 'src'))
    from da2.model.spherevit import SphereViT

    cfg = json.load(open(os.path.join(args.da2, 'configs', 'infer.json')))
    dev = torch.device('cuda')
    t0 = time.time()
    model = SphereViT.from_pretrained('haodongli/DA-2', config=cfg).to(dev).eval()
    print(f'model load {time.time() - t0:.1f}s', file=sys.stderr)
    W, H = map(int, args.size.split('x'))
    os.makedirs(args.out, exist_ok=True)
    report = {}
    for item in args.items:
        path, wid = item.split(':')
        img = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
        x = torch.from_numpy(img.transpose(2, 0, 1) / 255.0).float().unsqueeze(0).to(dev)
        torch.cuda.synchronize(); t1 = time.time()
        with torch.no_grad(), torch.autocast('cuda', dtype=torch.float16):
            dist = model(x)[0].float().cpu().numpy()
        torch.cuda.synchronize(); t2 = time.time()
        np.save(os.path.join(args.out, f'{wid}-distance.npy'), dist.astype(np.float32))
        dist = cv2.resize(dist, (W, H), interpolation=cv2.INTER_LINEAR)
        s = to_disparity(dist)
        sc = condition(s)
        for name, a in (('depth-raw', s), ('depth', sc)):
            cv2.imwrite(os.path.join(args.out, f'{wid}-{name}.png'),
                        np.round(a * 255).astype(np.uint8), [cv2.IMWRITE_PNG_COMPRESSION, 9])
        vis = cv2.applyColorMap(np.round(s * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
        cv2.imwrite(os.path.join(args.out, f'{wid}-depth-vis.jpg'),
                    np.concatenate([cv2.resize(cv2.cvtColor(img, cv2.COLOR_RGB2BGR), (W, H)), vis], 0),
                    [cv2.IMWRITE_JPEG_QUALITY, 85])
        report[wid] = {
            'infer_s': round(t2 - t1, 2),
            'peak_vram_mib': round(torch.cuda.max_memory_allocated() / 2**20),
            'dist_min_med_max': [float(dist.min()), float(np.median(dist)), float(dist.max())],
        }
        print(wid, report[wid], file=sys.stderr)
    json.dump(report, open(os.path.join(args.out, 'depth-report.json'), 'w'), indent=1)
    del model
    torch.cuda.empty_cache()


if __name__ == '__main__':
    main()
