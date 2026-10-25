"""The R00 power analysis: MDEs from the baseline paired difference, and the verdict table.

MDE (program STATISTICS, 'power is computed, not assumed'): per stratum (AB, D, CE, G), the
minimum effect detectable at 80% power with a two-sided 0.05 test,

    MDE = (z_0.975 + z_0.80) x SE,

where SE is the SD of the two-way pigeonhole bootstrap replicates (contract/stats.py, 10,000
resamples) of the paired difference B8(W1) - B2 = hyb(B5) - B2 on the stratum's seed-averaged
per-query scores. Only that baseline difference enters: never a treatment effect. Report-only:
- vault: C_open's SE scaled to n = 70, SE_vault = SE_C_open x sqrt(n_C_open / 70);
- frontier: analytic, from AB's design-effect-inflated per-query SD scaled to n = 22,
  SE_frontier = SE_AB x sqrt(n_AB / 22) (no withheld record is indexed at R00).

The verdict-probability table: for every registered superiority row whose stratum has an SE,
under X ~ N(true_gain, SE^2) at true gains 0, 0.02, tau and 2 tau (tau = max(tau_floor, MDE)):
  p_supported  = P(X >= tau and X - z SE > 0)           (PASS for this row alone: an upper
                                                          bound, as Holm and the other rows of
                                                          the hypothesis only make it harder)
  p_falsified  = P(X + z SE < b) for the row's own falsifier clause `ci_hi_raw < b`, else 0
  p_inconclusive = the rest.
"""

from __future__ import annotations

import math
import re
import statistics
from collections.abc import Mapping, Sequence
from typing import Any

from arcforge.contract import stats
from arcforge.contract.rules import Rules
from arcforge.eval.agreement import round6

POWER_SCHEMA = 'arc-power/1'
NORMAL = statistics.NormalDist()
Z_ALPHA = NORMAL.inv_cdf(0.975)
Z_POWER = NORMAL.inv_cdf(0.80)
MULTIPLIER = Z_ALPHA + Z_POWER  # about 2.8016
PAIR = ('hyb(B5)', 'B2')
STRATUM_METRIC = {'AB': 'mrr@10', 'D': 'ndcg@10', 'CE': 'ndcg@10', 'G': 'mrr', 'C_open': 'ndcg@10'}
VAULT_N = 70
FRONTIER_N = 22


def se_of(doc: Mapping[str, Any], *, resamples: int = 10000) -> tuple[float, int, int]:
    """(SE, n_queries, n_clusters) of a paired-difference score document."""
    row = stats.compute(
        doc, comparison_id=doc['comparison_id'], alpha=0.05, resamples=resamples, permutations=1,
        refit_resamples=1,
    )  # fmt: skip
    return statistics.stdev(row.replicates), row.n_queries, row.n_clusters


def mde_table(
    docs: Mapping[str, Mapping[str, Any]], *, resamples: int = 10000
) -> dict[str, Any]:
    """docs: {stratum: arc-scores/1 of hyb(B5) - B2} for AB, D, CE, G, C_open (more allowed)."""
    se: dict[str, float] = {}
    n: dict[str, int] = {}
    clusters: dict[str, int] = {}
    for stratum, doc in sorted(docs.items()):
        value, n_q, n_c = se_of(doc, resamples=resamples)
        se[stratum], n[stratum], clusters[stratum] = value, n_q, n_c
    missing = [s for s in ('AB', 'D', 'CE', 'G', 'C_open') if s not in se]
    if missing:
        raise ValueError(f'the power analysis needs hyb(B5) - B2 scores for {missing}')
    mde = {k: MULTIPLIER * se[k] for k in ('AB', 'D', 'CE', 'G')}
    se_vault = se['C_open'] * math.sqrt(n['C_open'] / VAULT_N)
    se_frontier = se['AB'] * math.sqrt(n['AB'] / FRONTIER_N)
    mde['vault'] = MULTIPLIER * se_vault
    mde['frontier'] = MULTIPLIER * se_frontier
    return {
        'se': {k: round6(v) for k, v in se.items()},
        'se_report_only': {'vault': round6(se_vault), 'frontier': round6(se_frontier)},
        'n_queries': n,
        'n_clusters': clusters,
        'mde': {k: round6(v) for k, v in mde.items()},
    }


_FALSIFIER = re.compile(r'\b([a-z][a-z0-9]*)\.ci_hi_raw\s*<\s*(-?[0-9.]+)')


def falsifier_bounds(rules: Rules) -> dict[str, float]:
    """{comparison id: b} for every 'row.ci_hi_raw < b' clause in a FALSIFIED outcome."""
    out: dict[str, float] = {}
    for rule in rules.rules:
        for status, expr in rule.outcomes:
            if status != 'FALSIFIED':
                continue
            for alias, bound in _FALSIFIER.findall(expr.source):
                cid = rule.rows.get(alias)
                if cid is not None:
                    out.setdefault(cid, float(bound))
    return out


def _se_for(stratum: str, se: Mapping[str, float]) -> float | None:
    if stratum in se:
        return se[stratum]
    if stratum.startswith('D.') and 'D' in se:
        return se['D']
    return None


def verdict_probs(rules: Rules, se: Mapping[str, float]) -> list[dict[str, Any]]:
    """The table for every registered superiority row whose stratum has an SE (rules frozen)."""
    bounds = falsifier_bounds(rules)
    out = []
    for cid, spec in rules.rows.items():
        if spec.kind != 'superiority' or spec.registered is False or spec.tau_floor is None:
            continue
        sigma = _se_for(spec.stratum, se)
        tau = rules.tau(spec)
        if sigma is None or tau is None or sigma <= 0:
            continue
        for gain in (0.0, 0.02, tau, 2 * tau):
            dist = statistics.NormalDist(gain, sigma)
            supported = 1.0 - dist.cdf(max(tau, Z_ALPHA * sigma))
            falsified = dist.cdf(bounds[cid] - Z_ALPHA * sigma) if cid in bounds else 0.0
            falsified = min(falsified, 1.0 - supported)
            out.append(
                {
                    'row': cid,
                    'true_gain': round6(gain),
                    'p_supported': round6(supported),
                    'p_inconclusive': round6(max(0.0, 1.0 - supported - falsified)),
                    'p_falsified': round6(falsified),
                }
            )
    return out


def power_doc(
    rules_frozen: Rules, table: Mapping[str, Any], pair: Sequence[str] = PAIR
) -> dict[str, Any]:
    se_reg = {k: table['se'][k] for k in ('AB', 'D', 'CE', 'G')}
    return {
        'schema': POWER_SCHEMA,
        'pair': list(pair),
        'z': {'alpha': round6(Z_ALPHA), 'power': round6(Z_POWER), 'multiplier': round6(MULTIPLIER)},
        **table,
        'verdict_probs': verdict_probs(rules_frozen, {**table['se'], **se_reg}),
        'report': {'se': se_reg},
    }


def markdown_table(power: Mapping[str, Any]) -> str:
    """The verdict-probability table as PREREG prints it."""
    lines = [
        'Verdict probabilities at R00 (each registered superiority row alone, normal '
        'approximation with the realized SE; SUPPORTED is an upper bound):',
        '',
        '| Row | True gain | SUPPORTED | INCONCLUSIVE | FALSIFIED |',
        '| --- | --- | --- | --- | --- |',
    ]
    for r in power['verdict_probs']:
        lines.append(
            f'| {r["row"]} | {r["true_gain"]:.4f} | {100 * r["p_supported"]:.1f}% | '
            f'{100 * r["p_inconclusive"]:.1f}% | {100 * r["p_falsified"]:.1f}% |'
        )
    se = power['se']
    lines += ['', 'Realized SEs of hyb(B5) − B2: ' + ', '.join(f'{k} {v:.4f}' for k, v in sorted(se.items())) + '.']
    return '\n'.join(lines)
