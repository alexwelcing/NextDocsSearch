"""S1 Clean, chunk, graph: the author's link graph, the rationale sentences and the count stats.

Reads only S0's outputs (corpus.jsonl and snapshot.json), never the worktree.

    graph.json       every author link as an edge: markdown links to /articles/<slug> in the
                     body plus frontmatter relatedArticles, self-links dropped. Each edge is
                     'real' (the target exists), 'renamed' (corpus.rename_map sends it to a
                     surviving record), 'ghost' (corpus.ghosts_by_default) or 'dangling'.
                     Links to /docs/articles/<slug> are phantom titles (stratum F), not edges.
    rationales.json  the sentences 'For <rationale>, see [Title](/articles/slug)': stratum A's
                     candidates (six or more words; ghosts leave A for F), with their breakdown.
                     An A item is FRONTIER when its (renamed) target is withheld; an edge is
                     frontier when either end is, since S0⁻ keeps no edge that touches them.
    counts.json      lexicon count stats for the bench card: words and word types for the full
                     snapshot, the main line S0⁻ and the withheld series, the share withheld,
                     decade and series counts. Words come from public/arc/records (the rendered
                     text) under the folded [a-z0-9]+ tokenizer in core.corpus.words; the lexeme
                     tokenizer is S3's.

Pending (not produced yet):
    - chunks.jsonl: chunker v2 via `scripts/generate-search-index.ts --embed-input`, which
      lands with lib/retrieval's chunker v2 (M0). Chrome stripping (link sentences, series
      footers, Related Chronicles, Editor's Notes, bylines) belongs to that chunker.
    - the twin and collision graph, collisions.md and register proposals: they need S2's
      entity cards.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from typing import Any

from arcforge.core.corpus import TOKENIZER_ID, parse_frontmatter, words, year_of
from arcforge.core.dag import StageContext
from arcforge.core.hashing import canonical_json

LINK = re.compile(r'\]\((/(?:docs/)?articles/[^)\s#?]+)')
RATIONALE = re.compile(r'For ([^.\n]*?), see \[([^\]]+)\]\(/articles/([^)\s#?]+)\)')
A_MIN_WORDS = 6


def _slug_of(path: str, prefix: str) -> str:
    return path[len(prefix) :].strip('/').split('/')[0]


def _status(
    target: str, slugs: set[str], rename_map: dict[str, str], ghosts: set[str]
) -> tuple[str, str | None]:
    if target in slugs:
        return 'real', target
    if rename_map.get(target) in slugs:
        return 'renamed', rename_map[target]
    if target in ghosts:
        return 'ghost', None
    return 'dangling', None


def _record_text(record_json: str | None) -> str:
    if not record_json:
        return ''
    record = json.loads(record_json)
    parts = [record.get('title') or '', record.get('description') or '']
    parts += [block['x'] for block in record.get('blocks', []) if isinstance(block.get('x'), str)]
    return '\n'.join(parts)


def _scope_stats(counter: Counter[str], records: int, total: int, min_count: int) -> dict[str, int]:
    return {
        'records': records,
        'words': total,
        'word_types': len(counter),
        'types_at_min_count': sum(1 for c in counter.values() if c >= min_count),
        'hapax': sum(1 for c in counter.values() if c == 1),
    }


def run(ctx: StageContext) -> dict[str, bytes]:
    snapshot = ctx.input_json('S0', 'snapshot.json')
    corpus = ctx.input_jsonl('S0', 'corpus.jsonl')
    rename_map: dict[str, str] = dict(ctx.cfg('corpus.rename_map'))
    ghosts = set(ctx.cfg('corpus.ghosts_by_default'))
    min_count = int(ctx.cfg('lexicon.min_count'))

    meta_by_slug = {r['slug']: r for r in snapshot['records']}
    slugs = set(meta_by_slug)
    withheld = {s for s, r in meta_by_slug.items() if r['withheld']}

    edges: dict[tuple[str, str], set[str]] = {}
    phantoms: dict[str, set[str]] = {}
    sentences: list[dict[str, Any]] = []
    for row in corpus:
        source = row['slug']
        meta, body = parse_frontmatter(row['mdx'])
        for target in meta.get('relatedArticles') or []:
            if isinstance(target, str) and target and target != source:
                edges.setdefault((source, target), set()).add('related')
        for match in LINK.finditer(body):
            path = match.group(1)
            if path.startswith('/docs/articles/'):
                phantoms.setdefault(_slug_of(path, '/docs/articles/'), set()).add(source)
                continue
            target = _slug_of(path, '/articles/')
            if target and target != source:
                edges.setdefault((source, target), set()).add('body')
        for match in RATIONALE.finditer(body):
            clause, _title, target = match.groups()
            status, resolved = _status(target, slugs, rename_map, ghosts)
            n_words = len(clause.split())
            sentences.append(
                {
                    'source': source,
                    'clause': clause,
                    'words': n_words,
                    'target': target,
                    'status': status,
                    'resolved': resolved,
                    # A's FRONTIER rule reads the target: the record to retrieve is withheld.
                    'frontier': resolved in withheld,
                    'source_withheld': source in withheld,
                    'in_a': n_words >= A_MIN_WORDS and status in ('real', 'renamed'),
                }
            )

    edge_rows = []
    for (source, target), via in sorted(edges.items()):
        status, resolved = _status(target, slugs, rename_map, ghosts)
        edge_rows.append(
            {
                'source': source,
                'target': target,
                'resolved': resolved,
                'status': status,
                'via': sorted(via),
                'frontier': source in withheld or resolved in withheld,
            }
        )
    real = [e for e in edge_rows if e['status'] == 'real']
    by_status = Counter(e['status'] for e in edge_rows)
    graph = {
        'schema': 'arc-graph/1',
        'corpus_id': snapshot['corpus_id'],
        'rename_map': rename_map,
        'ghosts': sorted(ghosts),
        'counts': {
            'unique_edges': len(edge_rows),
            'real_edges': len(real),
            'renamed_edges': by_status['renamed'],
            'ghost_edges': by_status['ghost'],
            'dangling_edges': by_status['dangling'],
            'sources': len({e['source'] for e in real}),
            'targets': len({e['target'] for e in real}),
            'dangling_targets': len({e['target'] for e in edge_rows if e['status'] != 'real'}),
            'main_line_real_edges': sum(1 for e in real if not e['frontier']),
            'frontier_real_edges': {
                'from_withheld': sum(1 for e in real if e['source'] in withheld),
                'into_withheld': sum(
                    1 for e in real if e['source'] not in withheld and e['target'] in withheld
                ),
            },
            'phantom_targets': len(phantoms),
            'phantom_targets_with_file': sum(1 for p in phantoms if p in slugs),
        },
        'edges': edge_rows,
        'phantoms': [
            {
                'target': target,
                'title': target.replace('-', ' '),
                'has_file': target in slugs,
                'sources': sorted(sources),
            }
            for target, sources in sorted(phantoms.items())
        ],
    }

    long = [s for s in sentences if s['words'] >= A_MIN_WORDS]
    a_items = [s for s in sentences if s['in_a']]
    rationales = {
        'schema': 'arc-rationales/1',
        'corpus_id': snapshot['corpus_id'],
        'min_words': A_MIN_WORDS,
        'counts': {
            'sentences': len(sentences),
            'six_plus': len(long),
            'short': len(sentences) - len(long),
            'six_plus_distinct': len({s['clause'] for s in long}),
            'six_plus_dangling': sum(1 for s in long if s['status'] != 'real'),
            'a_items': len(a_items),
            'a_renamed': sum(1 for s in a_items if s['status'] == 'renamed'),
            'a_core': sum(1 for s in a_items if not s['frontier']),
            'a_frontier': sum(1 for s in a_items if s['frontier']),
            'ghosted': sum(1 for s in long if s['status'] == 'ghost'),
        },
        'sentences': sentences,
    }

    full: Counter[str] = Counter()
    main: Counter[str] = Counter()
    held: Counter[str] = Counter()
    per_record = []
    for row in corpus:
        tokens = words(_record_text(row['record']))
        counter = Counter(tokens)
        full.update(counter)
        (held if row['slug'] in withheld else main).update(counter)
        per_record.append({'slug': row['slug'], 'words': len(tokens), 'word_types': len(counter)})
    total_full = sum(full.values())
    total_held = sum(held.values())
    decades: Counter[str] = Counter()
    series: Counter[str] = Counter()
    for record in snapshot['records']:
        year = year_of(record['date'])
        decades[f'{year // 10 * 10}s' if year else 'unknown'] += 1
        series[record['series'] or '(none)'] += 1
    counts = {
        'schema': 'arc-counts/1',
        'corpus_id': snapshot['corpus_id'],
        'main_corpus_id': snapshot['main_corpus_id'],
        'tokenizer': TOKENIZER_ID,
        'min_count': min_count,
        'full': _scope_stats(full, len(corpus), total_full, min_count),
        'main_line': _scope_stats(main, len(corpus) - len(withheld), sum(main.values()), min_count),
        'withheld': _scope_stats(held, len(withheld), total_held, min_count),
        'withheld_word_share': round(total_held / total_full, 6) if total_full else None,
        'decades': dict(sorted(decades.items())),
        'series': dict(sorted(series.items())),
        'records': per_record,
    }
    return {
        'graph.json': canonical_json(graph),
        'rationales.json': canonical_json(rationales),
        'counts.json': canonical_json(counts),
    }
