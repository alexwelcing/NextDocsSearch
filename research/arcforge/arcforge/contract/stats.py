"""Row statistics: a VerdictRow's numbers, recomputed from its per-query score file.

One implementation serves both the S13 stage that writes verdicts.json and `arcforge verdict`,
which recomputes it. Each row's random streams are seeded from its comparison id, the code is
pure Python (random.Random is Mersenne Twister; floats are IEEE 754, summed in a fixed order),
so a recomputation is bit-for-bit identical on any machine.

Estimators (the score file's `estimator`, arc-scores/1):
- pigeonhole: the two-way pigeonhole bootstrap over source and target records (Owen 2007). Each
  resample draws the source records and the target records with replacement, independently; a
  query weighs its source's multiplicity times the mean multiplicity of its targets (B queries
  have several). The statistic is the macro-average over parts (AB = mean of A and B) of the
  weighted mean of seed-averaged per-query differences a - b.
- cluster_ratio: ratio rows (H6). The statistic is mean(a) / mean(b), macro-averaged per part,
  under a one-way bootstrap over target records.
- refit_pooled: P@k rows (H3). For the point fit and each refit, `refit_resamples` resamples of
  the labelled items; the CI pools all replicates. P@k = hits / min(R, k), R = the number of
  re-meant labels, which is P@k normalized by the maximum achievable when R < k.

p_raw is a two-sided paired randomization test with `permutations` sign flips (ratio rows swap
a and b per query; P@k rows flip each item's contribution). Percentile CIs interpolate linearly
between order statistics. Holm step-down follows report_schema: rank the family's rows by p_raw,
give rank r alpha / (m - r + 1), and once a row fails to reject every later row keeps that alpha.
"""

from __future__ import annotations

import hashlib
import math
import random
import statistics
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any


class ScoresError(ValueError):
    """A score file that cannot yield its row (malformed, degenerate, or for another row)."""


@dataclass(frozen=True)
class RowStats:
    point: float
    ci_lo_raw: float
    ci_hi_raw: float
    p_raw: float
    seed_sd: float
    n_seeds: int
    n_queries: int
    n_clusters: int
    replicates: tuple[float, ...]  # sorted bootstrap replicates, for the Holm-adjusted CI

    def ci(self, alpha: float) -> tuple[float, float]:
        return quantile(self.replicates, alpha / 2), quantile(self.replicates, 1 - alpha / 2)


def rng_for(comparison_id: str, stream: str) -> random.Random:
    digest = hashlib.sha256(f'{comparison_id}|{stream}'.encode()).digest()
    return random.Random(int.from_bytes(digest[:8], 'big'))


def quantile(sorted_values: Sequence[float], q: float) -> float:
    """Linear interpolation between order statistics (numpy's default 'linear' method)."""
    n = len(sorted_values)
    if n == 0:
        raise ScoresError('no bootstrap replicates')
    h = (n - 1) * q
    lo = math.floor(h)
    hi = min(lo + 1, n - 1)
    return sorted_values[lo] + (h - lo) * (sorted_values[hi] - sorted_values[lo])


def holm(p_values: Mapping[str, float], alpha: float) -> dict[str, tuple[int, int, float, float]]:
    """{comparison id: (rank, m, alpha_adj, p_holm)} for one Holm family."""
    order = sorted(p_values, key=lambda cid: (p_values[cid], cid))
    m = len(order)
    out: dict[str, tuple[int, int, float, float]] = {}
    stopped: float | None = None
    running = 0.0
    for rank, cid in enumerate(order, start=1):
        if stopped is not None:
            alpha_adj = stopped
        else:
            alpha_adj = alpha / (m - rank + 1)
            if p_values[cid] > alpha_adj:
                stopped = alpha_adj  # fails to reject: later rows keep this alpha
        running = max(running, min(1.0, (m - rank + 1) * p_values[cid]))
        out[cid] = (rank, m, alpha_adj, running)
    return out


def compute(
    scores: Mapping[str, Any],
    *,
    comparison_id: str,
    alpha: float,
    resamples: int,
    permutations: int,
    refit_resamples: int,
) -> RowStats:
    estimator = scores.get('estimator')
    if estimator == 'refit_pooled':
        return _refit_pooled(scores, comparison_id, alpha, refit_resamples, permutations)
    if estimator not in ('pigeonhole', 'cluster_ratio'):
        raise ScoresError(f'unknown estimator {estimator!r}')
    design = _Design.from_scores(scores, ratio=estimator == 'cluster_ratio')
    if estimator == 'pigeonhole':
        return _pigeonhole(design, comparison_id, alpha, resamples, permutations)
    return _cluster_ratio(design, comparison_id, alpha, resamples, permutations)


# ---- query designs ----------------------------------------------------------------------------


def _finite(values: Any, where: str) -> list[float]:
    if not isinstance(values, list) or not values:
        raise ScoresError(f'{where}: expected a non-empty list of numbers')
    out = []
    for v in values:
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ScoresError(f'{where}: {v!r} is not a finite number')
        out.append(float(v))
    return out


def _mean(values: Sequence[float]) -> float:
    return math.fsum(values) / len(values)


@dataclass
class _Design:
    """Items with seed-averaged a and b, their part, source cluster and target clusters."""

    n_parts: int
    part: list[int]
    src: list[int]  # -1 when the item has no source factor
    tgts: list[tuple[int, ...]]
    n_src: int
    n_tgt: int
    a: list[float]
    b: list[float]
    a_seeds: list[list[float]]
    b_seeds: list[list[float]]
    n_seeds: int

    @property
    def n(self) -> int:
        return len(self.part)

    @classmethod
    def from_scores(cls, scores: Mapping[str, Any], ratio: bool) -> _Design:
        seeds = scores.get('seeds')
        items = scores.get('items')
        if not isinstance(seeds, list) or not seeds:
            raise ScoresError('seeds: expected a non-empty list')
        if not isinstance(items, list) or not items:
            raise ScoresError('items: expected a non-empty list')
        n_seeds = len(seeds)
        parts = sorted({str(it.get('part')) for it in items if isinstance(it, dict)})
        part_index = {p: i for i, p in enumerate(parts)}
        src_index: dict[str, int] = {}
        tgt_index: dict[str, int] = {}
        design = cls(len(parts), [], [], [], 0, 0, [], [], [], [], n_seeds)
        seen: set[str] = set()
        for n, item in enumerate(items):
            where = f'items[{n}]'
            if not isinstance(item, dict) or not isinstance(item.get('id'), str):
                raise ScoresError(f'{where}: expected an object with a string id')
            if item['id'] in seen:
                raise ScoresError(f'{where}: duplicate id {item["id"]!r}')
            seen.add(item['id'])
            if not isinstance(item.get('part'), str) or not item['part']:
                raise ScoresError(f'{where}: part must be a non-empty string')
            source = item.get('source')
            targets = item.get('targets')
            if source is not None and not isinstance(source, str):
                raise ScoresError(f'{where}: source must be a record id or null')
            if not isinstance(targets, list) or not all(isinstance(t, str) for t in targets):
                raise ScoresError(f'{where}: targets must be a list of record ids')
            a = _finite(item.get('a'), f'{where}.a')
            b = _finite(item.get('b'), f'{where}.b')
            for name, column in (('a', a), ('b', b)):
                if len(column) not in (1, n_seeds):
                    raise ScoresError(f'{where}.{name}: {len(column)} values for {n_seeds} seeds')
            if ratio:
                # Record-clustered: the clusters are the target records (or the item's source, or
                # the item itself, when it names none).
                clusters = targets or [source if source is not None else f'item:{item["id"]}']
                src_id = -1
                tgt_ids = tuple(tgt_index.setdefault(t, len(tgt_index)) for t in clusters)
            else:
                if source is None and not targets:
                    source = f'item:{item["id"]}'  # its own cluster
                src_id = -1 if source is None else src_index.setdefault(source, len(src_index))
                tgt_ids = tuple(tgt_index.setdefault(t, len(tgt_index)) for t in targets)
            design.part.append(part_index[item['part']])
            design.src.append(src_id)
            design.tgts.append(tgt_ids)
            design.a.append(_mean(a))
            design.b.append(_mean(b))
            design.a_seeds.append(a * n_seeds if len(a) == 1 else a)
            design.b_seeds.append(b * n_seeds if len(b) == 1 else b)
        design.n_src = len(src_index)
        design.n_tgt = len(tgt_index)
        return design

    @property
    def n_clusters(self) -> int:
        return self.n_src + self.n_tgt

    def unit_weights(self) -> list[float]:
        return [1.0] * self.n

    def weights(self, rng: random.Random) -> list[float]:
        ms = _draw(self.n_src, rng)
        mt = _draw(self.n_tgt, rng)
        out = []
        for src, tgts in zip(self.src, self.tgts, strict=True):
            w = float(ms[src]) if src >= 0 else 1.0
            if tgts:
                w *= sum(mt[t] for t in tgts) / len(tgts)
            out.append(w)
        return out

    def macro(self, values: Sequence[float], weights: Sequence[float]) -> float | None:
        num = [0.0] * self.n_parts
        den = [0.0] * self.n_parts
        for p, v, w in zip(self.part, values, weights, strict=True):
            if w:
                num[p] += w * v
                den[p] += w
        if any(d == 0.0 for d in den):
            return None  # a part drew no weight: redraw
        return sum(n / d for n, d in zip(num, den, strict=True)) / self.n_parts

    def part_coefficients(self) -> list[float]:
        """c_i such that the unit-weight macro-average equals sum(c_i * v_i)."""
        sizes = [0] * self.n_parts
        for p in self.part:
            sizes[p] += 1
        return [1.0 / (self.n_parts * sizes[p]) for p in self.part]


def _draw(n: int, rng: random.Random) -> list[int]:
    counts = [0] * n
    for _ in range(n):
        counts[int(rng.random() * n)] += 1
    return counts


def _bootstrap(
    stat: Callable[[list[float]], float | None], draw: Callable[[], list[float]], resamples: int
) -> list[float]:
    out: list[float] = []
    attempts = 0
    while len(out) < resamples:
        attempts += 1
        if attempts > 10 * resamples + 100:
            raise ScoresError('the design is degenerate: most resamples leave a part empty')
        value = stat(draw())
        if value is not None:
            out.append(value)
    out.sort()
    return out


def _signflip_p(contributions: Sequence[float], permutations: int, rng: random.Random) -> float:
    """Two-sided paired randomization: flip the sign of each contribution at random."""
    observed = abs(math.fsum(contributions))
    if observed == 0.0:
        return 1.0
    tolerance = 1e-12 * max(1.0, observed)
    n = len(contributions)
    hits = 0
    for _ in range(permutations):
        bits = rng.getrandbits(n)
        total = 0.0
        for c in contributions:
            total += c if bits & 1 else -c
            bits >>= 1
        if abs(total) >= observed - tolerance:
            hits += 1
    return (hits + 1) / (permutations + 1)


def _seed_sd(values: Sequence[float]) -> float:
    return statistics.stdev(values) if len(values) > 1 else 0.0


# ---- estimators -------------------------------------------------------------------------------


def _pigeonhole(
    design: _Design, cid: str, alpha: float, resamples: int, permutations: int
) -> RowStats:
    diff = [a - b for a, b in zip(design.a, design.b, strict=True)]
    point = design.macro(diff, design.unit_weights())
    assert point is not None
    boot = rng_for(cid, 'boot')
    replicates = _bootstrap(
        lambda w: design.macro(diff, w), lambda: design.weights(boot), resamples
    )
    coefficients = design.part_coefficients()
    p_raw = _signflip_p(
        [d * c for d, c in zip(diff, coefficients, strict=True)], permutations, rng_for(cid, 'perm')
    )
    per_seed = []
    for s in range(design.n_seeds):
        d_s = [a[s] - b[s] for a, b in zip(design.a_seeds, design.b_seeds, strict=True)]
        value = design.macro(d_s, design.unit_weights())
        assert value is not None
        per_seed.append(value)
    lo, hi = quantile(replicates, alpha / 2), quantile(replicates, 1 - alpha / 2)
    return RowStats(
        point=point,
        ci_lo_raw=lo,
        ci_hi_raw=hi,
        p_raw=p_raw,
        seed_sd=_seed_sd(per_seed),
        n_seeds=design.n_seeds,
        n_queries=design.n,
        n_clusters=design.n_clusters,
        replicates=tuple(replicates),
    )


def _ratio(
    design: _Design, a: Sequence[float], b: Sequence[float], w: Sequence[float]
) -> float | None:
    num = design.macro(a, w)
    den = design.macro(b, w)
    if num is None or den is None or den <= 0.0:
        return None
    return num / den


def _cluster_ratio(
    design: _Design, cid: str, alpha: float, resamples: int, permutations: int
) -> RowStats:
    point = _ratio(design, design.a, design.b, design.unit_weights())
    if point is None or point <= 0.0:
        raise ScoresError('a ratio row needs positive mean scores in both arms')
    boot = rng_for(cid, 'boot')
    replicates = _bootstrap(
        lambda w: _ratio(design, design.a, design.b, w), lambda: design.weights(boot), resamples
    )
    # Randomization: swap a and b per query. With c_i the macro coefficients, A' = sum(c a' ) and
    # B' = sum(c (a + b)) - A', and the statistic is |log(A' / B')|.
    c = design.part_coefficients()
    ca = [ci * ai for ci, ai in zip(c, design.a, strict=True)]
    cb = [ci * bi for ci, bi in zip(c, design.b, strict=True)]
    total = math.fsum(ca) + math.fsum(cb)
    observed = abs(math.log(point))
    tolerance = 1e-12 * max(1.0, observed)
    perm = rng_for(cid, 'perm')
    hits = 0
    if observed > 0.0:
        for _ in range(permutations):
            bits = perm.getrandbits(design.n)
            num = 0.0
            for x, y in zip(ca, cb, strict=True):
                num += x if bits & 1 else y
                bits >>= 1
            den = total - num
            if num <= 0.0 or den <= 0.0 or abs(math.log(num / den)) >= observed - tolerance:
                hits += 1
        p_raw = (hits + 1) / (permutations + 1)
    else:
        p_raw = 1.0
    per_seed = []
    for s in range(design.n_seeds):
        value = _ratio(
            design,
            [a[s] for a in design.a_seeds],
            [b[s] for b in design.b_seeds],
            design.unit_weights(),
        )
        if value is None:
            raise ScoresError(f'seed column {s}: the ratio is undefined')
        per_seed.append(value)
    lo, hi = quantile(replicates, alpha / 2), quantile(replicates, 1 - alpha / 2)
    return RowStats(
        point=point,
        ci_lo_raw=lo,
        ci_hi_raw=hi,
        p_raw=p_raw,
        seed_sd=_seed_sd(per_seed),
        n_seeds=design.n_seeds,
        n_queries=design.n,
        n_clusters=design.n_tgt,
        replicates=tuple(replicates),
    )


def _refit_pooled(
    scores: Mapping[str, Any], cid: str, alpha: float, refit_resamples: int, permutations: int
) -> RowStats:
    k = scores.get('k')
    labels = scores.get('labels')
    fits = scores.get('fits')
    if not isinstance(k, int) or isinstance(k, bool) or k < 1:
        raise ScoresError('k must be a positive integer')
    if not isinstance(labels, dict) or not labels:
        raise ScoresError('labels: expected a non-empty mapping of item -> 0/1')
    if any(v not in (0, 1) or isinstance(v, bool) for v in labels.values()):
        raise ScoresError('labels: every label is 0 or 1')
    if not isinstance(fits, list) or not fits:
        raise ScoresError('fits: expected a non-empty list')
    ids = [f.get('id') if isinstance(f, dict) else None for f in fits]
    if ids.count('point') != 1 or len(set(ids)) != len(ids):
        raise ScoresError("fits: ids must be unique, with exactly one 'point' fit")
    remeant = sum(labels.values())
    if remeant == 0:
        raise ScoresError('labels: no item is labelled re-meant, so P@k is undefined')
    denominator = min(remeant, k)
    pool = sorted(labels)
    index = {item: i for i, item in enumerate(pool)}

    def top(fit: Mapping[str, Any], arm: str) -> list[str]:
        ranking = fit.get(arm)
        if not isinstance(ranking, list) or not all(isinstance(i, str) for i in ranking):
            raise ScoresError(f'fits[{fit.get("id")}].{arm}: expected a list of item ids')
        if len(set(ranking)) != len(ranking):
            raise ScoresError(f'fits[{fit.get("id")}].{arm}: duplicate items')
        if len(ranking) < k:
            raise ScoresError(
                f'fits[{fit.get("id")}].{arm}: {len(ranking)} items, fewer than k={k}'
            )
        return ranking[:k]

    def hits(items: Sequence[str]) -> list[int]:
        """Pool indices of the re-meant items (unlabelled ones count as not re-meant)."""
        return [index[i] for i in items if labels.get(i) == 1]

    ordered = sorted(fits, key=lambda f: (f['id'] != 'point', f['id']))
    point_fit = ordered[0]
    boot = rng_for(cid, 'boot')
    replicates: list[float] = []
    differences: dict[str, float] = {}
    point_tops: tuple[list[str], list[str]] = ([], [])
    for fit in ordered:
        top_a, top_b = top(fit, 'a'), top(fit, 'b')
        if fit is point_fit:
            point_tops = (top_a, top_b)
        hits_a, hits_b = hits(top_a), hits(top_b)
        differences[fit['id']] = (len(hits_a) - len(hits_b)) / denominator
        for _ in range(refit_resamples):
            m = _draw(len(pool), boot)
            replicates.append((sum(m[i] for i in hits_a) - sum(m[i] for i in hits_b)) / denominator)
    replicates.sort()
    point = differences['point']
    refits = [v for fid, v in differences.items() if fid != 'point']
    in_a, in_b = set(point_tops[0]), set(point_tops[1])
    contributions = [
        (int(i in in_a) - int(i in in_b)) / denominator
        for i in sorted(in_a | in_b)
        if labels.get(i) == 1 and (i in in_a) != (i in in_b)
    ]
    p_raw = _signflip_p(contributions, permutations, rng_for(cid, 'perm')) if contributions else 1.0
    lo, hi = quantile(replicates, alpha / 2), quantile(replicates, 1 - alpha / 2)
    return RowStats(
        point=point,
        ci_lo_raw=lo,
        ci_hi_raw=hi,
        p_raw=p_raw,
        seed_sd=_seed_sd(refits),
        n_seeds=max(1, len(refits)),
        n_queries=len(pool),
        n_clusters=len(pool),
        replicates=tuple(replicates),
    )
