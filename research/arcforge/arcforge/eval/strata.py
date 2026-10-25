"""Held-out-fold metrics per stratum and system, the per-query score files, and the pilot row.

Scoring rules (S13; program benchmark and the M2 spec):
- a query is scored by each system's ranking for the query's own test fold (trained systems
  rank per fold and per seed; an untrained system's single ranking serves every fold);
- per-query values are averaged over seeds, and seed_sd is the SD over seeds of the stratum's
  point estimate (0 for deterministic systems);
- CIs are the two-way pigeonhole bootstrap over source and target records (contract/stats.py).

Metrics by stratum:
  A           MRR@10 and R@10
  B           MRR@10 of the first relevant target, and R@10 over the positives
  AB          the macro of A and B (MRR@10)
  C_*, E, CE  MRR@10 of the true (intended) target, and nDCG@10
  D, D.<fam>  nDCG@10 and Success@3
  F           AUROC (top-1 score: renamed ghosts vs phantoms) and MRR@10 on renamed ghosts
  G           MRR of the coined lexeme among all lexemes
  T           nDCG@10
  QUARANTINE  nDCG@10 (reported separately, never registered)
judged@10 and the condensed nDCG@10 are reported for the judged strata (C, D, E, T, CE).
"""

from __future__ import annotations

import statistics
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from arcforge.contract import stats
from arcforge.contract.ids import SCORES_SCHEMA
from arcforge.eval import metrics
from arcforge.eval.agreement import round6
from arcforge.eval.qrels import stratum_of

JUDGED_STRATA = ('C_open', 'C_frontier', 'C_vault', 'CE', 'D', 'E', 'T', 'QUARANTINE')
EXPLORATORY_MAX = 40
# The fable-open pilot as Fable replicated it (program, why_this_corpus): BM25 ranks the
# author's link first 6.8% of the time, within the top 10 28.2%, median rank 33.
PILOT = {'system': 'B1', 'r_at_1': 0.068, 'r_at_10': 0.282, 'median_rank': 33}


@dataclass
class Bench:
    """The scored bench: queries, final qrels, judged pairs and every system's rankings."""

    queries: dict[str, dict[str, Any]]
    qrels: dict[str, dict[str, int]]
    judged: dict[str, dict[str, int]] = field(default_factory=dict)
    # (query_id, system_id) -> {(fold | None, seed | None): [ids, best first]}
    rankings: dict[tuple[str, str], dict[tuple[Any, Any], list[str]]] = field(default_factory=dict)
    scores_top1: dict[tuple[str, str], dict[tuple[Any, Any], float]] = field(default_factory=dict)

    @classmethod
    def build(
        cls,
        queries: Iterable[Mapping[str, Any]],
        qrels: Mapping[str, Mapping[str, int]],
        rankings: Iterable[Mapping[str, Any]],
        judged: Mapping[str, Mapping[str, int]] | None = None,
    ) -> Bench:
        bench = cls({q['query_id']: dict(q) for q in queries}, {k: dict(v) for k, v in qrels.items()})
        bench.judged = {k: dict(v) for k, v in (judged or {}).items()}
        for row in rankings:
            key = (row['query_id'], row['system_id'])
            slot = (row.get('fold'), row.get('seed'))
            ranked = row['ranked']
            bench.rankings.setdefault(key, {})[slot] = [str(item[0]) for item in ranked]
            bench.scores_top1.setdefault(key, {})[slot] = float(ranked[0][1]) if ranked else 0.0
        return bench

    def systems(self) -> list[str]:
        return sorted({system for _, system in self.rankings})

    def stratum_queries(self, stratum: str) -> list[str]:
        parts = PARTS.get(stratum)
        out = []
        for qid, q in self.queries.items():
            where = stratum_of(q)
            if parts is not None:
                if where in parts:
                    out.append(qid)
            elif stratum.startswith('D.') and where == 'D':
                families = stratum[2:].split('+')
                if q.get('family') in families:
                    out.append(qid)
            elif where == stratum:
                out.append(qid)
        return sorted(out)

    def part_of(self, stratum: str, qid: str) -> str:
        if stratum == 'AB':
            return stratum_of(self.queries[qid])
        return stratum

    def per_seed(
        self, qid: str, system: str, fn: Callable[[Sequence[str], Mapping[str, Any]], float]
    ) -> tuple[list[Any], list[float]] | None:
        """(seed labels, per-seed values) of fn on system's held-out-fold ranking for qid."""
        slots = self.rankings.get((qid, system))
        if not slots:
            return None
        fold = self.queries[qid].get('test_fold')
        chosen = {s: r for (f, s), r in slots.items() if f == fold}
        if not chosen:
            chosen = {s: r for (f, s), r in slots.items() if f is None}
        if not chosen:
            return None
        seeds = sorted(chosen, key=lambda s: (s is None, s))
        context = {'qid': qid, 'query': self.queries[qid], 'bench': self, 'system': system}
        return seeds, [fn(chosen[s], context) for s in seeds]


PARTS: dict[str, tuple[str, ...]] = {
    'AB': ('A', 'B'),
    'CE': ('C_open', 'E'),
    'FRONTIER': ('FRONTIER.A', 'FRONTIER.B', 'FRONTIER.C', 'FRONTIER.D', 'FRONTIER.E', 'FRONTIER.F', 'FRONTIER.G', 'FRONTIER.T'),
}  # fmt: skip


def _qrels(ctx: Mapping[str, Any]) -> dict[str, int]:
    return ctx['bench'].qrels.get(ctx['qid'], {})


def _true_target(ctx: Mapping[str, Any]) -> dict[str, int]:
    target = ctx['query'].get('intent_slug') or ctx['query'].get('source_slug')
    return {target: 1} if target else {}


def mrr10(ranking: Sequence[str], ctx: Mapping[str, Any]) -> float:
    return metrics.mrr_at(ranking, _qrels(ctx), 10)


def mrr_all(ranking: Sequence[str], ctx: Mapping[str, Any]) -> float:
    return metrics.mrr_at(ranking, _qrels(ctx), None)


def r10(ranking: Sequence[str], ctx: Mapping[str, Any]) -> float:
    return metrics.recall_at(ranking, _qrels(ctx), 10)


def ndcg10(ranking: Sequence[str], ctx: Mapping[str, Any]) -> float:
    return metrics.ndcg_at(ranking, _qrels(ctx), 10)


def success3(ranking: Sequence[str], ctx: Mapping[str, Any]) -> float:
    return metrics.success_at(ranking, _qrels(ctx), 3)


def true_mrr10(ranking: Sequence[str], ctx: Mapping[str, Any]) -> float:
    return metrics.mrr_at(ranking, _true_target(ctx), 10)


METRICS: dict[str, tuple[tuple[str, Callable[..., float]], ...]] = {
    'A': (('mrr@10', mrr10), ('r@10', r10)),
    'B': (('mrr@10', mrr10), ('r@10', r10)),
    'AB': (('mrr@10', mrr10),),
    'C_open': (('mrr@10', true_mrr10), ('ndcg@10', ndcg10)),
    'C_frontier': (('mrr@10', true_mrr10), ('ndcg@10', ndcg10)),
    'C_vault': (('mrr@10', true_mrr10), ('ndcg@10', ndcg10)),
    'E': (('mrr@10', true_mrr10), ('ndcg@10', ndcg10)),
    'CE': (('mrr@10', true_mrr10), ('ndcg@10', ndcg10)),
    'D': (('ndcg@10', ndcg10), ('success@3', success3)),
    'F': (('mrr@10', mrr10),),
    'G': (('mrr', mrr_all),),
    'T': (('ndcg@10', ndcg10),),
    'QUARANTINE': (('ndcg@10', ndcg10),),
}


def metric_key(stratum: str) -> str:
    """The METRICS entry a stratum id scores under."""
    if stratum.startswith('D.'):
        return 'D'
    if stratum.startswith('FRONTIER.'):
        base = stratum.split('.', 1)[1]
        return {'C': 'C_frontier'}.get(base, base)
    if stratum.startswith('QUARANTINE'):
        return 'QUARANTINE'
    return stratum


def metric_fn(stratum: str, metric: str) -> Callable[..., float]:
    for name, fn in METRICS.get(metric_key(stratum), ()):
        if name == metric:
            return fn
    fallback = {'mrr@10': mrr10, 'ndcg@10': ndcg10, 'mrr': mrr_all, 'r@10': r10,
                'success@3': success3}  # fmt: skip
    if metric in fallback:
        return fallback[metric]
    raise KeyError(f'no metric {metric!r} for stratum {stratum!r}')


# ---- score documents --------------------------------------------------------------------------


def scores_doc(
    bench: Bench,
    *,
    comparison_id: str,
    stratum: str,
    metric: str,
    arm_a: str,
    arm_b: str | None,
    estimator: str = 'pigeonhole',
) -> dict[str, Any] | None:
    """An arc-scores/1 document for arm_a - arm_b (or arm_a alone) on a stratum's queries.

    Queries a system did not rank are left out (the row's n_queries says how many remain).
    """
    fn = metric_fn(stratum, metric)
    items = []
    seed_labels: list[Any] | None = None
    for qid in bench.stratum_queries(stratum):
        a = bench.per_seed(qid, arm_a, fn)
        b = bench.per_seed(qid, arm_b, fn) if arm_b else ([None], [0.0])
        if a is None or b is None:
            continue
        query = bench.queries[qid]
        targets = sorted(s for s, g in bench.qrels.get(qid, {}).items() if g >= 1)
        items.append(
            {
                'id': qid,
                'part': bench.part_of(stratum, qid),
                'source': query.get('source_slug'),
                'targets': targets,
                'a': [round6(v) for v in a[1]],
                'b': [round6(v) for v in b[1]],
            }
        )
        if len(a[1]) > 1:
            seed_labels = [s if s is not None else 0 for s in a[0]]
    if not items:
        return None
    n_seeds = max(len(it['a']) for it in items)
    for item in items:  # a system with one column is deterministic and broadcasts
        for key in ('a', 'b'):
            if len(item[key]) not in (1, n_seeds):
                item[key] = [round6(statistics.fmean(item[key]))]
    return {
        'schema': SCORES_SCHEMA,
        'comparison_id': comparison_id,
        'arm_a': arm_a,
        'arm_b': arm_b,
        'stratum': stratum,
        'metric': metric,
        'estimator': estimator,
        'seeds': seed_labels if seed_labels and len(seed_labels) == n_seeds else list(range(n_seeds)),
        'items': items,
    }


def system_summary(
    bench: Bench, stratum: str, metric: str, system: str, *, resamples: int
) -> dict[str, Any] | None:
    doc = scores_doc(
        bench, comparison_id=f'summary.{stratum}.{metric}.{system}', stratum=stratum,
        metric=metric, arm_a=system, arm_b=None,
    )  # fmt: skip
    if doc is None:
        return None
    row = stats.compute(
        doc, comparison_id=doc['comparison_id'], alpha=0.05, resamples=resamples, permutations=1,
        refit_resamples=1,
    )  # fmt: skip
    return {
        'system_id': system,
        'metric': metric,
        'mean': round6(row.point),
        'seed_sd': round6(row.seed_sd),
        'ci_lo': round6(row.ci_lo_raw),
        'ci_hi': round6(row.ci_hi_raw),
    }


# ---- the strata table -------------------------------------------------------------------------


def stratum_entry(
    bench: Bench, stratum: str, systems: Sequence[str], *, resamples: int
) -> dict[str, Any]:
    qids = bench.stratum_queries(stratum)
    sources = {bench.queries[q].get('source_slug') for q in qids} - {None}
    targets = {s for q in qids for s, g in bench.qrels.get(q, {}).items() if g >= 1}
    key = metric_key(stratum)
    rows = []
    for metric, _ in METRICS.get(key, (('ndcg@10', ndcg10),)):
        for system in systems:
            summary = system_summary(bench, stratum, metric, system, resamples=resamples)
            if summary is not None:
                rows.append(summary)
    judged_at_10 = None
    condensed = None
    if key in JUDGED_STRATA and qids:
        fractions = []
        condensed = {}
        for system in systems:
            values = []
            for qid in qids:
                judged = bench.judged.get(qid, {})
                got = bench.per_seed(qid, system, lambda r, c: metrics.judged_at(r, c['bench'].judged.get(c['qid'], {}), 10))
                if got is None:
                    continue
                fractions.append(statistics.fmean(got[1]))
                cond = bench.per_seed(
                    qid, system,
                    lambda r, c, judged=judged: metrics.ndcg_at(metrics.condensed(r, judged), c['bench'].qrels.get(c['qid'], {}), 10),
                )  # fmt: skip
                values.append(statistics.fmean(cond[1]))
            if values:
                condensed[system] = round6(statistics.fmean(values))
        judged_at_10 = round6(statistics.fmean(fractions)) if fractions else None
        condensed = condensed or None
    return {
        'id': stratum,
        'n_queries': len(qids),
        'n_source_clusters': len(sources),
        'n_target_clusters': len(targets),
        'judged_at_10': judged_at_10,
        'condensed_ndcg10': condensed,
        'exploratory': len(qids) <= EXPLORATORY_MAX,
        'systems': rows,
    }


def f_auroc(bench: Bench, system: str) -> float | None:
    """F: AUROC of the top-1 score separating renamed ghosts (a target) from phantoms (none)."""
    positives, negatives = [], []
    for qid in bench.stratum_queries('F'):
        slots = bench.scores_top1.get((qid, system))
        if not slots:
            continue
        score = statistics.fmean(slots.values())
        (positives if bench.qrels.get(qid) else negatives).append(score)
    return metrics.auroc(positives, negatives)


def pilot_replication(bench: Bench, system: str = PILOT['system']) -> dict[str, Any] | None:
    """The BM25 author-link pilot on A+B: R@1, R@10 and the median rank of the author's link."""
    ranks = []
    for qid in bench.stratum_queries('AB'):
        got = bench.per_seed(
            qid, system, lambda r, c: float(metrics.first_relevant_rank(r, _qrels(c)) or 0)
        )
        if got is None:
            continue
        rank = got[1][0]
        ranks.append(rank if rank > 0 else None)
    if not ranks:
        return None
    found = [r for r in ranks if r is not None]
    n = len(ranks)
    return {
        'system': system,
        'n_queries': n,
        'r_at_1': round6(sum(1 for r in found if r == 1) / n),
        'r_at_10': round6(sum(1 for r in found if r <= 10) / n),
        'median_rank': metrics.median(found),
        'pilot': dict(PILOT),
    }
