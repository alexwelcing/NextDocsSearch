"""Judge agreement for I1, I5 and I6: kappa, alpha and Kendall tau, with seeded bootstraps.

Grades are integers on an ordinal scale (0-3 for relevance). Every function is pure Python and
deterministic; bootstraps draw from a random.Random seeded by sha256(label), so a recomputation
is bit-for-bit identical.

- weighted_kappa: Cohen's kappa with quadratic (default) or linear disagreement weights, with
  optional per-item weights (the IPW population kappa weighs each pair by the inverse of its
  sampling probability).
- krippendorff_alpha: Krippendorff's alpha for any number of raters with missing values, under
  the nominal, interval or ordinal metric (Krippendorff 2011, 'Computing Krippendorff's
  Alpha-Reliability').
- fleiss_kappa: Fleiss' kappa from a subjects x categories count table (Fleiss 1971).
- kendall_tau: tau-a and tau-b (ties corrected) between two score vectors.
"""

from __future__ import annotations

import hashlib
import math
import random
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from arcforge.contract.stats import quantile


def rng(label: str) -> random.Random:
    return random.Random(int.from_bytes(hashlib.sha256(label.encode()).digest()[:8], 'big'))


# ---- kappa ------------------------------------------------------------------------------------


def weighted_kappa(
    a: Sequence[int],
    b: Sequence[int],
    categories: Sequence[int] = (0, 1, 2, 3),
    *,
    weights: str = 'quadratic',
    item_weights: Sequence[float] | None = None,
) -> float | None:
    """Cohen's weighted kappa between raters a and b (None when undefined)."""
    if len(a) != len(b):
        raise ValueError('the two raters must grade the same items')
    if not a:
        return None
    k = len(categories)
    index = {c: i for i, c in enumerate(categories)}
    w_items = list(item_weights) if item_weights is not None else [1.0] * len(a)
    total = math.fsum(w_items)
    if total <= 0:
        return None
    observed = [[0.0] * k for _ in range(k)]
    for x, y, w in zip(a, b, w_items, strict=True):
        observed[index[x]][index[y]] += w / total
    rows = [math.fsum(r) for r in observed]
    cols = [math.fsum(observed[i][j] for i in range(k)) for j in range(k)]

    def disagreement(i: int, j: int) -> float:
        if k == 1:
            return 0.0
        d = abs(i - j) / (k - 1)
        return d * d if weights == 'quadratic' else d

    num = math.fsum(disagreement(i, j) * observed[i][j] for i in range(k) for j in range(k))
    den = math.fsum(disagreement(i, j) * rows[i] * cols[j] for i in range(k) for j in range(k))
    if den == 0.0:
        return 1.0 if num == 0.0 else None
    return 1.0 - num / den


# ---- Krippendorff's alpha ---------------------------------------------------------------------


def krippendorff_alpha(
    units: Sequence[Sequence[int | None]], level: str = 'ordinal'
) -> float | None:
    """Alpha over units (each a list of the raters' values, None where missing).

    Units with fewer than two values are not pairable and are dropped. The ordinal metric is
    delta^2(c, k) = (sum_{g=c..k} n_g - (n_c + n_k) / 2)^2 over the pairable values' marginals.
    """
    pairable = [[v for v in unit if v is not None] for unit in units]
    pairable = [u for u in pairable if len(u) >= 2]
    if not pairable:
        return None
    values = sorted({v for u in pairable for v in u})
    if len(values) == 1:
        return 1.0
    index = {v: i for i, v in enumerate(values)}
    n_v = len(values)
    coincidence = [[0.0] * n_v for _ in range(n_v)]
    for unit in pairable:
        m = len(unit)
        for i, x in enumerate(unit):
            for j, y in enumerate(unit):
                if i != j:
                    coincidence[index[x]][index[y]] += 1.0 / (m - 1)
    marginals = [math.fsum(row) for row in coincidence]
    n = math.fsum(marginals)

    def delta2(c: int, k: int) -> float:
        if level == 'nominal':
            return 0.0 if c == k else 1.0
        if level == 'interval':
            return float(values[c] - values[k]) ** 2
        if level == 'ordinal':
            lo, hi = min(c, k), max(c, k)
            return (math.fsum(marginals[lo : hi + 1]) - (marginals[c] + marginals[k]) / 2) ** 2
        raise ValueError(f'unknown level {level!r}')

    d_o = math.fsum(
        coincidence[c][k] * delta2(c, k) for c in range(n_v) for k in range(n_v)
    ) / n
    d_e = math.fsum(
        marginals[c] * marginals[k] * delta2(c, k) for c in range(n_v) for k in range(n_v)
    ) / (n * (n - 1))
    if d_e == 0.0:
        return None
    return 1.0 - d_o / d_e


# ---- Fleiss' kappa ----------------------------------------------------------------------------


def fleiss_kappa(counts: Sequence[Sequence[int]]) -> float | None:
    """Fleiss' kappa from a table: one row per subject, one column per category, every row
    summing to the same number of raters."""
    if not counts:
        return None
    raters = {sum(row) for row in counts}
    if len(raters) != 1 or raters == {0}:
        raise ValueError('every subject needs the same, positive number of ratings')
    n = raters.pop()
    if n < 2:
        return None
    subjects = len(counts)
    k = len(counts[0])
    p_j = [sum(row[j] for row in counts) / (subjects * n) for j in range(k)]
    p_i = [(sum(c * c for c in row) - n) / (n * (n - 1)) for row in counts]
    p_bar = math.fsum(p_i) / subjects
    p_e = math.fsum(p * p for p in p_j)
    if p_e == 1.0:
        return 1.0 if p_bar == 1.0 else None
    return (p_bar - p_e) / (1.0 - p_e)


def fleiss_from_labels(labels: Sequence[Sequence[Any]]) -> float | None:
    """Fleiss' kappa from per-subject label lists (each the same length)."""
    categories = sorted({x for row in labels for x in row}, key=str)
    return fleiss_kappa([[row.count(c) for c in categories] for row in labels])


# ---- Kendall tau ------------------------------------------------------------------------------


def kendall_tau(x: Sequence[float], y: Sequence[float]) -> tuple[float | None, float | None]:
    """(tau-a, tau-b) between two paired score vectors (O(n^2); n is the 8 systems here)."""
    n = len(x)
    if n != len(y):
        raise ValueError('x and y must be paired')
    if n < 2:
        return None, None
    concordant = discordant = ties_x = ties_y = 0
    for i in range(n):
        for j in range(i + 1, n):
            dx = (x[i] > x[j]) - (x[i] < x[j])
            dy = (y[i] > y[j]) - (y[i] < y[j])
            if dx == 0 and dy == 0:
                ties_x += 1
                ties_y += 1
            elif dx == 0:
                ties_x += 1
            elif dy == 0:
                ties_y += 1
            elif dx == dy:
                concordant += 1
            else:
                discordant += 1
    pairs = n * (n - 1) // 2
    tau_a = (concordant - discordant) / pairs
    denom = math.sqrt((pairs - ties_x) * (pairs - ties_y))
    tau_b = None if denom == 0 else (concordant - discordant) / denom
    return tau_a, tau_b


# ---- bootstrap --------------------------------------------------------------------------------


def bootstrap(
    n: int,
    stat: Callable[[Sequence[int]], float | None],
    *,
    label: str,
    resamples: int = 2000,
    alpha: float = 0.05,
) -> tuple[float | None, float | None, list[float]]:
    """A percentile CI of stat over index resamples of range(n) (None-valued draws are redrawn)."""
    draw = rng(label)
    values: list[float] = []
    attempts = 0
    while len(values) < resamples and attempts < 10 * resamples + 100:
        attempts += 1
        idx = [int(draw.random() * n) for _ in range(n)]
        value = stat(idx)
        if value is not None and math.isfinite(value):
            values.append(value)
    if not values:
        return None, None, []
    values.sort()
    return quantile(values, alpha / 2), quantile(values, 1 - alpha / 2), values


def grouped_bootstrap(
    groups: Mapping[str, Sequence[Any]],
    stat: Callable[[Mapping[str, Sequence[Any]]], float | None],
    *,
    label: str,
    resamples: int = 2000,
    alpha: float = 0.05,
) -> tuple[float | None, float | None]:
    """A percentile CI resampling each group's items independently (stratified bootstrap)."""
    draw = rng(label)
    keys = sorted(groups)
    values: list[float] = []
    attempts = 0
    while len(values) < resamples and attempts < 10 * resamples + 100:
        attempts += 1
        sample = {
            key: [groups[key][int(draw.random() * len(groups[key]))] for _ in groups[key]]
            for key in keys
        }
        value = stat(sample)
        if value is not None and math.isfinite(value):
            values.append(value)
    if not values:
        return None, None
    values.sort()
    return quantile(values, alpha / 2), quantile(values, 1 - alpha / 2)


def round6(value: float | None) -> float | None:
    """Every GPU- or LLM-derived float is rounded to 6 dp before JSON (INTERFACES-M2 C)."""
    return None if value is None else round(value, 6)
