"""Density gaps and weirdness from record vectors (pure Python; numpy when it is installed).

- 5-NN gap radius: for each record, the mean cosine distance to its 5 nearest other records;
  report.density.mean_5nn_gap_radius is the mean over records, and top_gaps are the records with
  the largest radius, each with its 5 neighbours (ties by slug).
- weirdness: 1 - cos(Procrustes(W0), W1) per record: W0's record vectors rotated onto W1's by the
  orthogonal Procrustes solution R = argmin ||W0 R - W1||_F (the polar factor of W0^T W1), then
  compared with W1 record by record; plus the 10-NN rewiring, the share of a record's 10 nearest
  neighbours under W0 that are not among its 10 nearest under W1.

Record vectors are read from safetensors (fp16 or fp32) by a stdlib reader, with the row order
named in __metadata__.row_order or given explicitly.
"""

from __future__ import annotations

import json
import math
import struct
from collections.abc import Mapping, Sequence
from typing import Any

from arcforge.eval.agreement import round6

_DTYPES = {'F16': ('e', 2), 'F32': ('f', 4), 'F64': ('d', 8)}


def read_safetensors(data: bytes) -> tuple[dict[str, list[list[float]]], dict[str, str]]:
    """({tensor name: rows}, __metadata__) for 2-D float tensors (stdlib only)."""
    (header_len,) = struct.unpack('<Q', data[:8])
    header = json.loads(data[8 : 8 + header_len])
    meta = header.pop('__metadata__', {}) or {}
    base = 8 + header_len
    out: dict[str, list[list[float]]] = {}
    for name, info in header.items():
        fmt = _DTYPES.get(info['dtype'])
        shape = info['shape']
        if fmt is None or len(shape) != 2:
            continue
        start, end = info['data_offsets']
        code, size = fmt
        count = (end - start) // size
        flat = struct.unpack(f'<{count}{code}', data[base + start : base + end])
        rows, cols = shape
        out[name] = [list(flat[r * cols : (r + 1) * cols]) for r in range(rows)]
    return out, meta


def _norm(v: Sequence[float]) -> list[float]:
    n = math.sqrt(math.fsum(x * x for x in v))
    return [x / n for x in v] if n else list(v)


def _cos(a: Sequence[float], b: Sequence[float]) -> float:
    return math.fsum(x * y for x, y in zip(a, b, strict=True))


def knn(vectors: Mapping[str, Sequence[float]], k: int) -> dict[str, list[tuple[float, str]]]:
    """{slug: [(cosine distance, neighbour)] of its k nearest others}, ties by slug."""
    slugs = sorted(vectors)
    unit = {s: _norm(vectors[s]) for s in slugs}
    out = {}
    for s in slugs:
        dists = sorted((1.0 - _cos(unit[s], unit[t]), t) for t in slugs if t != s)
        out[s] = dists[:k]
    return out


def density(vectors: Mapping[str, Sequence[float]], top: int = 5) -> dict[str, Any]:
    if len(vectors) < 6:
        return {'mean_5nn_gap_radius': None, 'top_gaps': []}
    neighbours = knn(vectors, 5)
    radius = {s: math.fsum(d for d, _ in nn) / len(nn) for s, nn in neighbours.items()}
    ranked = sorted(radius, key=lambda s: (-radius[s], s))[:top]
    return {
        'mean_5nn_gap_radius': round6(math.fsum(radius.values()) / len(radius)),
        'top_gaps': [
            {'gap_id': f'gap:{s}', 'radius': round6(radius[s]), 'neighbours': [t for _, t in neighbours[s]]}
            for s in ranked
        ],
    }


def _matmul(a: Sequence[Sequence[float]], b: Sequence[Sequence[float]]) -> list[list[float]]:
    cols = list(zip(*b, strict=True))
    return [[math.fsum(x * y for x, y in zip(row, col, strict=True)) for col in cols] for row in a]


def _transpose(a: Sequence[Sequence[float]]) -> list[list[float]]:
    return [list(r) for r in zip(*a, strict=True)]


def _inverse(m: Sequence[Sequence[float]]) -> list[list[float]]:
    n = len(m)
    aug = [list(row) + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(m)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(aug[r][col]))
        if abs(aug[pivot][col]) < 1e-12:
            raise ValueError('singular matrix')
        aug[col], aug[pivot] = aug[pivot], aug[col]
        p = aug[col][col]
        aug[col] = [x / p for x in aug[col]]
        for r in range(n):
            if r != col and aug[r][col]:
                f = aug[r][col]
                aug[r] = [x - f * y for x, y in zip(aug[r], aug[col], strict=True)]
    return [row[n:] for row in aug]


def procrustes(w0: Sequence[Sequence[float]], w1: Sequence[Sequence[float]]) -> list[list[float]]:
    """The orthogonal R minimizing ||W0 R - W1||: the polar factor of M = W0^T W1."""
    try:
        import numpy as np  # noqa: PLC0415

        u, _, vt = np.linalg.svd(np.asarray(w0, dtype=float).T @ np.asarray(w1, dtype=float))
        return (u @ vt).tolist()
    except ImportError:
        pass
    m = _matmul(_transpose(w0), w1)
    x = [row[:] for row in m]
    for _ in range(100):  # Newton's iteration for the polar factor: X <- (X + X^-T) / 2
        inv_t = _transpose(_inverse(x))
        nxt = [[(a + b) / 2 for a, b in zip(r1, r2, strict=True)] for r1, r2 in zip(x, inv_t, strict=True)]
        delta = max(abs(a - b) for r1, r2 in zip(nxt, x, strict=True) for a, b in zip(r1, r2, strict=True))
        x = nxt
        if delta < 1e-12:
            break
    return x


def weirdness(
    w0: Mapping[str, Sequence[float]], w1: Mapping[str, Sequence[float]], k: int = 10
) -> list[dict[str, Any]]:
    slugs = sorted(set(w0) & set(w1))
    if len(slugs) < 2:
        return []
    a = [_norm(w0[s]) for s in slugs]
    b = [_norm(w1[s]) for s in slugs]
    rotation = procrustes(a, b)
    rotated = _matmul(a, rotation)
    nn0 = knn({s: v for s, v in zip(slugs, a, strict=True)}, min(k, len(slugs) - 1))
    nn1 = knn({s: v for s, v in zip(slugs, b, strict=True)}, min(k, len(slugs) - 1))
    out = []
    for i, s in enumerate(slugs):
        before = {t for _, t in nn0[s]}
        after = {t for _, t in nn1[s]}
        out.append(
            {
                'slug': s,
                'weirdness': round6(1.0 - _cos(_norm(rotated[i]), b[i])),
                'rewired_10nn': round6(len(before - after) / len(before)) if before else 0.0,
            }
        )
    return out
