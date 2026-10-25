"""The final qrels by Amendment A0's precedence, and the quarantine stratum.

Precedence (A0 replacements[10]):
1. the corpus-intrinsic A/B targets and the reader-intent labels are fixed by construction
   (S6b's qrels_fixed: rationale, link, intent, glossary, ghost_rename), and never overwritten;
2. then Fable gold > gemini-3-flash adjudication > the primary judge;
3. reference grades (the three REF families, the drift references) and the Qwen audit never
   enter the qrels.

A and B are judge-free: their qrels are the fixed links only, whatever was judged. Quarantined
queries (A0 rule 6) keep their qrels but are scored in the QUARANTINE stratum, never in a
registered one.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

FIXED_SOURCES = ('rationale', 'link', 'intent', 'glossary', 'ghost_rename')
JUDGE_FREE_STRATA = frozenset({'A', 'B'})
# Higher wins. Fixed sources are never overwritten at all.
PRECEDENCE = {'primary': 1, 'adjudicate': 2, 'fable_gold': 3}
QREL_SOURCES = (*FIXED_SOURCES, 'fable_gold', 'adjudicate', 'primary')


def final_qrels(
    bench: Mapping[str, Mapping[str, Any]],
    fixed: Iterable[Mapping[str, Any]],
    judgments: Iterable[Mapping[str, Any]],
    fable_gold: Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """arc-qrels/1 rows {query_id, slug, grade, source}, sorted by (query_id, slug)."""
    out: dict[tuple[str, str], dict[str, Any]] = {}
    for row in fixed:
        if row['source'] not in FIXED_SOURCES:
            raise ValueError(f'qrels_fixed has source {row["source"]!r}; fixed sources are {FIXED_SOURCES}')
        key = (row['query_id'], row['slug'])
        out[key] = {'query_id': key[0], 'slug': key[1], 'grade': int(row['grade']), 'source': row['source']}

    def offer(query_id: str, slug: str, grade: int, source: str) -> None:
        query = bench.get(query_id)
        if query is None or query.get('stratum') in JUDGE_FREE_STRATA:
            return  # A and B stay judge-free; an unknown query is not the bench's
        key = (query_id, slug)
        current = out.get(key)
        if current is not None and current['source'] in FIXED_SOURCES:
            return
        if current is None or PRECEDENCE[source] > PRECEDENCE[current['source']]:
            out[key] = {'query_id': query_id, 'slug': slug, 'grade': int(grade), 'source': source}

    for row in judgments:
        role = row.get('role')
        if role in ('primary', 'adjudicate'):
            offer(row['query_id'], row['slug'], row['grade'], role)
    for row in fable_gold:
        offer(row['query_id'], row['slug'], row['grade'], 'fable_gold')
    return [out[k] for k in sorted(out)]


def by_query(rows: Iterable[Mapping[str, Any]]) -> dict[str, dict[str, int]]:
    grouped: dict[str, dict[str, int]] = {}
    for row in rows:
        grouped.setdefault(row['query_id'], {})[row['slug']] = int(row['grade'])
    return grouped


def stratum_of(query: Mapping[str, Any]) -> str:
    """The stratum a bench query is scored in (quarantine and frontier first)."""
    stratum = str(query['stratum'])
    if query.get('quarantined'):
        return 'QUARANTINE'
    if query.get('frontier'):
        return f'FRONTIER.{stratum}'
    if stratum == 'C':
        family = str(query.get('family') or 'open')
        return 'C_frontier' if family == 'frontier' else 'C_open' if family == 'open' else 'C_vault'
    return stratum
