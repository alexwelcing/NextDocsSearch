"""Per-query retrieval metrics on ranked id lists and graded qrels.

A ranking is a list of ids, best first (ties already broken by slug ascending upstream). Qrels
for one query are {id: grade} with grades 0-3; a grade >= 1 is relevant for binary metrics.
Unjudged ids count as grade 0, except in the condensed metrics, which drop them first.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence

RELEVANT = 1


def first_relevant_rank(ranking: Sequence[str], qrels: Mapping[str, int]) -> int | None:
    for rank, item in enumerate(ranking, start=1):
        if qrels.get(item, 0) >= RELEVANT:
            return rank
    return None


def mrr_at(ranking: Sequence[str], qrels: Mapping[str, int], k: int | None = 10) -> float:
    """Reciprocal rank of the first relevant id within the top k (k None: the whole list)."""
    rank = first_relevant_rank(ranking if k is None else ranking[:k], qrels)
    return 0.0 if rank is None else 1.0 / rank


def recall_at(ranking: Sequence[str], qrels: Mapping[str, int], k: int = 10) -> float:
    relevant = {i for i, g in qrels.items() if g >= RELEVANT}
    if not relevant:
        return 0.0
    return len(relevant & set(ranking[:k])) / len(relevant)


def success_at(ranking: Sequence[str], qrels: Mapping[str, int], k: int = 3) -> float:
    return 1.0 if first_relevant_rank(ranking[:k], qrels) is not None else 0.0


def dcg(grades: Sequence[int]) -> float:
    return math.fsum((2**g - 1) / math.log2(i + 2) for i, g in enumerate(grades))


def ndcg_at(ranking: Sequence[str], qrels: Mapping[str, int], k: int = 10) -> float:
    """Graded nDCG@k with gain 2^g - 1; 0 when the query has no relevant id."""
    ideal = dcg(sorted((g for g in qrels.values() if g > 0), reverse=True)[:k])
    if ideal == 0.0:
        return 0.0
    return dcg([qrels.get(i, 0) for i in ranking[:k]]) / ideal


def condensed(ranking: Sequence[str], judged: Mapping[str, int]) -> list[str]:
    """The ranking with every unjudged id removed (Sakai's condensed list)."""
    return [i for i in ranking if i in judged]


def judged_at(ranking: Sequence[str], judged: Mapping[str, int], k: int = 10) -> float:
    top = ranking[:k]
    if not top:
        return 0.0
    return sum(1 for i in top if i in judged) / len(top)


def auroc(positives: Sequence[float], negatives: Sequence[float]) -> float | None:
    """P(score of a positive > score of a negative), ties counting half (Mann-Whitney U)."""
    if not positives or not negatives:
        return None
    wins = 0.0
    for p in positives:
        for n in negatives:
            wins += 1.0 if p > n else 0.5 if p == n else 0.0
    return wins / (len(positives) * len(negatives))


def median(values: Sequence[float]) -> float | None:
    ordered = sorted(values)
    if not ordered:
        return None
    mid = len(ordered) // 2
    return ordered[mid] if len(ordered) % 2 else (ordered[mid - 1] + ordered[mid]) / 2
