"""I1 in its Amendment A0 form, and I3, I5, I6: from judge rows to gates.* and gates_inputs.*.

I1.pass := I1a and I1b and I1c and I1d (A0 rule 1; the thresholds live in rules.yaml):
- I1a, known-answer probes: per type P1-P5, the primary judge's accuracy on its probes (P1, P5
  must get grade >= 2; P2, P3, P4 grade <= 1). A type with fewer than 20 probes is reported, not
  gated. gates_inputs.I1.probe_min_acc is the lowest accuracy over the gated types.
- I1b, the three-family reference on the 150 frames.i1b pairs: the reference grade is the median
  of the families present (claude-opus-5-5, OLMo-2-1124-13B-Instruct, phi-4; the lower median
  when the Claude leg dropped and two remain). kappa_qw(primary, median) and the ordinal
  Krippendorff alpha across the families; the IPW population kappa weighs each pair by
  N(grade) / n(grade), the primary's grade frequency in the judged population over the sample.
- I1c, unchanged: Kendall tau between judge pairs over the 8 registered systems, each system
  scored by mean condensed nDCG@10 over the queries both judges graded (each query's list
  condensed to the pairs both graded), with a query-bootstrap 95% CI and tau-b beside it.
- I1d, the lineage differential: delta = mean(primary - ref | dense-only) - mean(primary - ref |
  BM25-only), ref = mean(Claude, phi-4) (phi-4 alone if the Claude leg dropped), 150 pairs each
  way, with a stratified bootstrap CI; gated on ci_hi <= 0.30 grade points.
- Report-only: Kendall of the systems' order under the primary qrels (D and E nDCG@10) against
  their order under the corpus links (AB MRR@10); author_disagrees_fable (Fable gold pairs that
  are corpus-link positives Fable grades <= 1); null_fp_rate (the primary's grade >= 2 rate on
  the probes that must get <= 1).

I5 (ref 'ref150+fable150'): the 300 reference pairs (the 150 I1b medians and 150 Fable gold
pairs, disjoint) re-graded with keywords shown by Flash-Lite, Qwen and Ministral. kappa_drop is
the mean, over the graders that also graded those pairs without keywords, of kappa_qw(plain, ref)
- kappa_qw(keywords, ref). self_pref_inflation is the Qwen-minus-Flash-Lite keyword-view grade gap
on pairs surfaced only by Qwen-bank-trained students minus that gap on every other pair.

I6 (R03, R10): Fleiss kappa across the three label families on the registered labels, and the
placebo and random words' re-meant rates.
"""

from __future__ import annotations

import hashlib
import statistics
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from arcforge.contract.ids import PROBE_EXPECT, PROBE_TYPES
from arcforge.eval import metrics
from arcforge.eval.agreement import (
    bootstrap,
    fleiss_from_labels,
    grouped_bootstrap,
    kendall_tau,
    krippendorff_alpha,
    round6,
    weighted_kappa,
)
from arcforge.eval.strata import Bench

PROBE_MIN_GATED = 20  # A0: a type with fewer probes is reported, not gated
PROBE_ACC = 0.90
REGISTERED_SYSTEMS = (
    'B0', 'B1', 'B2', 'B4', 'B3.potion8m', 'hyb(B4)', 'hyb(B3.potion8m)', 'B6.embeddinggemma-2-768',
)  # fmt: skip
FAMILIES = ('claude-opus-5-5', 'olmo-2-13b-instruct', 'phi-4')
FAMILY_OF = {'claude': 'claude-opus-5-5', 'olmo-instruct': 'olmo-2-13b-instruct', 'phi-4': 'phi-4'}
JUDGE_PAIRS = (('gemini', 'qwen'), ('gemini', 'fable'), ('qwen', 'fable'))
I5_GRADERS = (('flashlite', 'i5_flashlite', 'primary'), ('qwen', 'i5_qwen', 'audit'),
              ('ministral', 'i5_ministral', None))  # fmt: skip
STUDENT_PREFIXES = ('B5', 'hyb(B5)', 'champ', 'hyb(champ)', 'arm:')


def pair_id(query_id: str, slug: str) -> str:
    """INTERFACES-M2 D: sha256(query_id + '\\t' + slug)[:16]."""
    return hashlib.sha256(f'{query_id}\t{slug}'.encode()).hexdigest()[:16]


def _grades(judgments: Iterable[Mapping[str, Any]], role: str) -> dict[str, int]:
    return {j['pair_id']: int(j['grade']) for j in judgments if j.get('role') == role}


def _median_low(values: Sequence[int]) -> int:
    ordered = sorted(values)
    return ordered[(len(ordered) - 1) // 2]


# ---- I1a --------------------------------------------------------------------------------------


def probes_block(
    probes: Iterable[Mapping[str, Any]], primary: Mapping[str, int]
) -> tuple[dict[str, Any], list[float]]:
    by_type: dict[str, list[bool]] = {t: [] for t in PROBE_TYPES}
    for probe in probes:
        grade = primary.get(pair_id(probe['query_id'], probe['slug']))
        if grade is None:
            continue
        expect = probe.get('expect') or PROBE_EXPECT[probe['type']]
        ok = grade >= 2 if expect == 'ge2' else grade <= 1
        by_type[probe['type']].append(ok)
    block: dict[str, Any] = {}
    gated_acc: list[float] = []
    for ptype in PROBE_TYPES:
        results = by_type[ptype]
        n = len(results)
        acc = round6(sum(results) / n) if n else None
        gated = n >= PROBE_MIN_GATED
        block[ptype] = {
            'expect': PROBE_EXPECT[ptype],
            'n': n,
            'acc': acc,
            'gated': gated,
            'pass': (acc is not None and acc >= PROBE_ACC) if gated else None,
        }
        if gated and acc is not None:
            gated_acc.append(acc)
    return block, gated_acc


def null_fp_rate(probes: Iterable[Mapping[str, Any]], primary: Mapping[str, int]) -> float | None:
    graded = [
        primary[pid]
        for p in probes
        if (p.get('expect') or PROBE_EXPECT[p['type']]) == 'le1'
        and (pid := pair_id(p['query_id'], p['slug'])) in primary
    ]
    return round6(sum(1 for g in graded if g >= 2) / len(graded)) if graded else None


# ---- I1b --------------------------------------------------------------------------------------


def reference_grades(
    ref_rows: Iterable[Mapping[str, Any]], claude_accepted: bool
) -> dict[str, dict[str, int]]:
    """{pair_id: {family: grade}} (the Claude leg only when it was accepted)."""
    out: dict[str, dict[str, int]] = {}
    for row in ref_rows:
        family = FAMILY_OF.get(row['family'], row['family'])
        if family == 'claude-opus-5-5' and not claude_accepted:
            continue
        out.setdefault(row['pair_id'], {})[family] = int(row['grade'])
    return out


def ref_block(
    pairs: Sequence[str],
    primary: Mapping[str, int],
    ref: Mapping[str, Mapping[str, int]],
    population: Mapping[int, int],
    claude_leg_status: str,
) -> dict[str, Any]:
    families = [f for f in FAMILIES if any(f in ref.get(p, {}) for p in pairs)]
    usable = [p for p in pairs if p in primary and all(f in ref.get(p, {}) for f in families)]
    prim = [primary[p] for p in usable]
    median = [_median_low([ref[p][f] for f in families]) for p in usable]
    sample_counts: dict[int, int] = {}
    for g in prim:
        sample_counts[g] = sample_counts.get(g, 0) + 1
    weights = [population.get(g, 0) / sample_counts[g] for g in prim]
    alpha = krippendorff_alpha([[ref[p][f] for f in families] for p in usable], 'ordinal')
    return {
        'n_pairs': len(usable),
        'families': families,
        'kappa_qw_median': round6(weighted_kappa(prim, median)),
        'kappa_qw_ipw': round6(weighted_kappa(prim, median, item_weights=weights))
        if sum(weights) > 0
        else None,
        'alpha_families': round6(alpha),
        'claude_leg_status': claude_leg_status,
    }


# ---- I1c and the author Kendall ----------------------------------------------------------------


def judge_qrels(
    judgments: Iterable[Mapping[str, Any]], role: str
) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for j in judgments:
        if j.get('role') == role:
            out.setdefault(j['query_id'], {})[j['slug']] = int(j['grade'])
    return out


def _system_scores(
    bench: Bench, systems: Sequence[str], qids: Sequence[str],
    qrels_for: Mapping[str, Mapping[str, int]], judged_for: Mapping[str, Mapping[str, int]],
) -> dict[str, list[float]]:  # fmt: skip
    """{system: [per-query condensed nDCG@10]} in qids order (0 where a system did not rank)."""
    out: dict[str, list[float]] = {}
    for system in systems:
        values = []
        for qid in qids:
            judged = judged_for.get(qid, {})
            qrels = qrels_for.get(qid, {})
            got = bench.per_seed(
                qid, system, lambda r, c, j=judged, q=qrels: metrics.ndcg_at(metrics.condensed(r, j), q, 10)
            )  # fmt: skip
            values.append(statistics.fmean(got[1]) if got else 0.0)
        out[system] = values
    return out


def kendall_between(
    bench: Bench, a: Mapping[str, Mapping[str, int]], b: Mapping[str, Mapping[str, int]],
    label: str, systems: Sequence[str] = REGISTERED_SYSTEMS, resamples: int = 2000,
) -> dict[str, Any] | None:  # fmt: skip
    """Kendall tau between two judges' system orders over the queries both graded."""
    qids = sorted(q for q in set(a) & set(b) if set(a[q]) & set(b[q]))
    if not qids:
        return None
    shared = {q: {s: 1 for s in set(a[q]) & set(b[q])} for q in qids}
    score_a = _system_scores(bench, systems, qids, a, shared)
    score_b = _system_scores(bench, systems, qids, b, shared)

    def taus(idx: Sequence[int]) -> tuple[float | None, float | None]:
        xa = [statistics.fmean(score_a[s][i] for i in idx) for s in systems]
        xb = [statistics.fmean(score_b[s][i] for i in idx) for s in systems]
        return kendall_tau(xa, xb)

    tau_a, tau_b = taus(range(len(qids)))
    lo, hi, _ = bootstrap(len(qids), lambda idx: taus(idx)[0], label=f'I1c|{label}', resamples=resamples)
    return {'tau': round6(tau_a), 'ci_lo': round6(lo), 'ci_hi': round6(hi), 'tau_b': round6(tau_b)}


def author_kendall(
    bench: Bench, primary_qrels: Mapping[str, Mapping[str, int]], *,
    systems: Sequence[str] = REGISTERED_SYSTEMS, resamples: int = 2000,
) -> dict[str, Any] | None:  # fmt: skip
    """Report-only: the systems' order under the primary qrels (D, E) vs the corpus links (AB)."""
    judged_q = sorted(q for q in bench.stratum_queries('D') + bench.stratum_queries('E') if q in primary_qrels)
    author_q = bench.stratum_queries('AB')
    if not judged_q or not author_q:
        return None
    judge_scores = _system_scores(bench, systems, judged_q, primary_qrels, primary_qrels)
    link_scores = {
        s: [
            statistics.fmean(got[1]) if (got := bench.per_seed(q, s, lambda r, c: metrics.mrr_at(r, c['bench'].qrels.get(c['qid'], {}), 10))) else 0.0
            for q in author_q
        ]
        for s in systems
    }  # fmt: skip
    def tau(groups: Mapping[str, Sequence[int]]) -> float | None:
        xj = [statistics.fmean(judge_scores[s][i] for i in groups['judged']) for s in systems]
        xa = [statistics.fmean(link_scores[s][i] for i in groups['author']) for s in systems]
        return kendall_tau(xj, xa)[0]

    groups = {'judged': list(range(len(judged_q))), 'author': list(range(len(author_q)))}
    lo, hi = grouped_bootstrap(groups, tau, label='I1.author_kendall', resamples=resamples)
    return {'tau': round6(tau(groups)), 'ci_lo': round6(lo), 'ci_hi': round6(hi)}


# ---- I1d --------------------------------------------------------------------------------------


def lineage_diff(
    dense_only: Sequence[str], bm25_only: Sequence[str], primary: Mapping[str, int],
    ref: Mapping[str, Mapping[str, int]], claude_accepted: bool, resamples: int = 2000,
) -> dict[str, Any] | None:  # fmt: skip
    families = ('claude-opus-5-5', 'phi-4') if claude_accepted else ('phi-4',)

    def gaps(pairs: Sequence[str]) -> list[float]:
        out = []
        for p in pairs:
            grades = ref.get(p, {})
            if p in primary and all(f in grades for f in families):
                out.append(primary[p] - statistics.fmean(grades[f] for f in families))
        return out

    dense, bm25 = gaps(dense_only), gaps(bm25_only)
    if not dense or not bm25:
        return None

    def delta(groups: Mapping[str, Sequence[float]]) -> float:
        return statistics.fmean(groups['dense']) - statistics.fmean(groups['bm25'])

    lo, hi = grouped_bootstrap(
        {'dense': dense, 'bm25': bm25}, delta, label='I1d', resamples=resamples
    )
    return {
        'n_dense_only': len(dense),
        'n_bm25_only': len(bm25),
        'delta': round6(delta({'dense': dense, 'bm25': bm25})),
        'ci_lo': round6(lo),
        'ci_hi': round6(hi),
        'ref': 'mean(claude,phi-4)' if claude_accepted else 'phi-4',
    }


# ---- I1 as a whole ----------------------------------------------------------------------------


def compute_i1(
    *,
    bench: Bench,
    probes: Sequence[Mapping[str, Any]],
    judgments: Sequence[Mapping[str, Any]],
    ref_rows: Sequence[Mapping[str, Any]],
    frames: Mapping[str, Any],
    fable_gold: Sequence[Mapping[str, Any]],
    fixed_positives: Mapping[str, set[str]],
    claude_leg_status: str,
    check_pairs: int | None = None,
    rejudged: bool = False,
    resamples: int = 2000,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """(report gates.I1 without pass/pass_effective, gates_inputs.I1 or None if not computable)."""
    accepted = claude_leg_status == 'accepted'
    primary = _grades(judgments, 'primary')
    ref = reference_grades(ref_rows, accepted)
    probes_out, gated_acc = probes_block(probes, primary)
    population: dict[int, int] = {}
    for g in primary.values():
        population[g] = population.get(g, 0) + 1
    reference = ref_block(frames.get('i1b') or [], primary, ref, population, claude_leg_status)
    i1d = frames.get('i1d') or {}
    diff = lineage_diff(i1d.get('dense_only') or [], i1d.get('bm25_only') or [], primary, ref,
                        accepted, resamples)  # fmt: skip
    judges = {
        'gemini': judge_qrels(judgments, 'primary'),
        'qwen': judge_qrels(judgments, 'audit'),
        'fable': _fable_qrels(fable_gold),
    }
    kendall = []
    for x, y in JUDGE_PAIRS:
        found = kendall_between(bench, judges[x], judges[y], f'{x}|{y}', resamples=resamples)
        if found is not None:
            kendall.append({'judges': f'{x}|{y}', **found})
    disagrees = sum(
        1
        for g in fable_gold
        if g['slug'] in fixed_positives.get(g['query_id'], set()) and int(g['grade']) <= 1
    )
    components = None
    inputs = None
    min_lo = [k['ci_lo'] for k in kendall]
    values = {
        'probe_min_acc': min(gated_acc) if gated_acc else None,
        'kappa_qw_median': reference['kappa_qw_median'],
        'alpha_families': reference['alpha_families'],
        'min_kendall_ci_lo': min(min_lo) if len(kendall) == len(JUDGE_PAIRS) and None not in min_lo else None,
        'delta_ci_hi': None if diff is None else diff['ci_hi'],
    }  # fmt: skip
    if None not in values.values():
        inputs = dict(values)
        components = {
            'I1a': values['probe_min_acc'] >= PROBE_ACC,
            'I1b': values['kappa_qw_median'] >= 0.6 and values['alpha_families'] >= 0.5,
            'I1c': values['min_kendall_ci_lo'] >= 0.6,
            'I1d': values['delta_ci_hi'] <= 0.30,
        }
    block = {
        'probes': probes_out,
        'ref': reference,
        'check_pairs': check_pairs,
        'kendall': kendall,
        'diff': diff,
        'systems': list(REGISTERED_SYSTEMS),
        'author_kendall': author_kendall(bench, judges['gemini'], resamples=resamples),
        'author_disagrees_fable': disagrees,
        'null_fp_rate': null_fp_rate(probes, primary),
        'components': components,
        'rejudged': rejudged,
    }
    return block, inputs


def _fable_qrels(fable_gold: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    for g in fable_gold:
        out.setdefault(g['query_id'], {})[g['slug']] = int(g['grade'])
    return out


# ---- I5 ---------------------------------------------------------------------------------------


def compute_i5(
    *,
    frames: Mapping[str, Any],
    judgments: Sequence[Mapping[str, Any]],
    ref_rows: Sequence[Mapping[str, Any]],
    fable_gold: Sequence[Mapping[str, Any]],
    pools: Sequence[Mapping[str, Any]],
    claude_accepted: bool,
) -> dict[str, Any] | None:
    i5 = frames.get('i5') or {}
    ref = reference_grades(ref_rows, claude_accepted)
    reference: dict[str, int] = {}
    for p in i5.get('ref_i1b') or []:
        grades = ref.get(p, {})
        if grades:
            reference[p] = _median_low(list(grades.values()))
    gold = {pair_id(g['query_id'], g['slug']): int(g['grade']) for g in fable_gold}
    for p in i5.get('ref_fable') or []:
        if p in gold:
            reference[p] = gold[p]
    if not reference:
        return None
    drops = []
    for _, keyword_role, plain_role in I5_GRADERS:
        shown = _grades(judgments, keyword_role)
        if plain_role is None:
            continue
        plain = _grades(judgments, plain_role)
        common = [p for p in reference if p in shown and p in plain]
        if len(common) < 2:
            continue
        k_plain = weighted_kappa([plain[p] for p in common], [reference[p] for p in common])
        k_shown = weighted_kappa([shown[p] for p in common], [reference[p] for p in common])
        if k_plain is not None and k_shown is not None:
            drops.append(k_plain - k_shown)
    if not drops:
        return None
    qwen, lite = _grades(judgments, 'i5_qwen'), _grades(judgments, 'i5_flashlite')
    student_only = set()
    for pool in pools:
        for slug, by in _surfaced(pool).items():
            if by and all(s.startswith(STUDENT_PREFIXES) for s in by):
                student_only.add(pair_id(pool['query_id'], slug))
    inside = [qwen[p] - lite[p] for p in reference if p in qwen and p in lite and p in student_only]
    outside = [qwen[p] - lite[p] for p in reference if p in qwen and p in lite and p not in student_only]
    inflation = (
        statistics.fmean(inside) - statistics.fmean(outside) if inside and outside else 0.0
    )
    return {
        'n_ref_pairs': len(reference),
        'ref': 'ref150+fable150',
        'graders': ['gemini-3.1-flash-lite', 'qwen3.5-9b', 'ministral-3-8b'],
        'kappa_drop': round6(statistics.fmean(drops)),
        'prediction': 0.05,
        'self_pref_inflation': round6(inflation),
    }


def _surfaced(pool: Mapping[str, Any]) -> dict[str, list[str]]:
    """{slug: [systems that put it in the pool]} from an arc-pools/1 row."""
    out: dict[str, list[str]] = {}
    for system, slugs in (pool.get('by_system') or {}).items():
        for slug in slugs:
            out.setdefault(slug, []).append(system)
    return out


# ---- I6 and I3 --------------------------------------------------------------------------------


def compute_i6(items: Sequence[Mapping[str, Any]]) -> dict[str, Any] | None:
    """items: {kind: 'pool' | 'random' | 'placebo', labels: {family: label}, registered, flagged}."""
    families = ['olmo-2-13b-instruct', 'phi-4', 'qwen3.5-9b']
    rows = [[item['labels'][f] for f in families] for item in items if all(f in item['labels'] for f in families)]
    if not rows:
        return None
    kappa = fleiss_from_labels(rows)

    def rerate(kind: str) -> float | None:
        chosen = [i for i in items if i.get('kind') == kind]
        if not chosen:
            return None
        return sum(1 for i in chosen if i.get('registered') == 're-meant') / len(chosen)

    placebo, random_ = rerate('placebo'), rerate('random')
    if kappa is None or placebo is None or random_ is None:
        return None
    return {
        'families': families,
        'n_items': len(rows),
        'fleiss_kappa': round6(kappa),
        'placebo_rerate': round6(placebo),
        'random_rerate': round6(random_),
        'archive_only_flagged': sum(1 for i in items if i.get('flagged')),
    }


I3_KEYS = ('student_chrome_in', 'student_chrome_out', 'teacher_chrome_in', 'teacher_chrome_out')


def compute_i3(i3_rows: Mapping[str, Any]) -> dict[str, float] | None:
    """S12a's i3_rows.json carries the four shortcut masses; copy them (6 dp)."""
    source = i3_rows.get('masses', i3_rows)
    if not all(isinstance(source.get(k), (int, float)) for k in I3_KEYS):
        return None
    return {k: round6(float(source[k])) for k in I3_KEYS}
