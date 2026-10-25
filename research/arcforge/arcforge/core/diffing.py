"""`arcforge diff rA rB`: what changed between two runs.

Compares two run manifests: the config (dotted leaves), each stage's key and output digest, and
each artifact's sha256. When both runs carry S0's snapshot and it is in the cache, it also
diffs the corpus record by record (added, changed, removed, renamed), which is the S0 diff
against the parent that every run from R01 reports.
"""

from __future__ import annotations

import json
from typing import Any

from arcforge.core.cache import CacheError, Store
from arcforge.core.config import flatten
from arcforge.core.stages.snapshot import diff_snapshots

_ABSENT = object()


def _snapshot(doc: dict[str, Any], store: Store | None) -> dict[str, Any] | None:
    digest = doc.get('artifact_hashes', {}).get('S0/snapshot.json')
    if digest is None or store is None:
        return None
    try:
        return json.loads(store.get_object(digest))
    except CacheError:
        return None


def diff_runs(a: dict[str, Any], b: dict[str, Any], store: Store | None = None) -> dict[str, Any]:
    fa, fb = flatten(a['config']), flatten(b['config'])
    config = [
        {'path': path, 'a': fa.get(path), 'b': fb.get(path)}
        for path in sorted(set(fa) | set(fb))
        if fa.get(path, _ABSENT) != fb.get(path, _ABSENT)
    ]
    sa = {s['stage']: s for s in a['stages']}
    sb = {s['stage']: s for s in b['stages']}
    stages = []
    for name in [*sa, *(n for n in sb if n not in sa)]:
        left, right = sa.get(name), sb.get(name)
        if left is None or right is None:
            stages.append({'stage': name, 'change': 'only in a' if right is None else 'only in b'})
        elif left['key'] != right['key'] or left['digest'] != right['digest']:
            stages.append(
                {
                    'stage': name,
                    'change': 'outputs changed'
                    if left['digest'] != right['digest']
                    else 'key changed, same outputs',
                }
            )
    ha, hb = a.get('artifact_hashes', {}), b.get('artifact_hashes', {})
    artifacts = [
        {'artifact': name, 'a': ha.get(name), 'b': hb.get(name)}
        for name in sorted(set(ha) | set(hb))
        if ha.get(name) != hb.get(name)
    ]
    old, new = _snapshot(a, store), _snapshot(b, store)
    corpus = None
    if old is not None and new is not None:
        corpus = {
            'corpus_id': {'a': old['corpus_id'], 'b': new['corpus_id']},
            'main_corpus_id': {'a': old['main_corpus_id'], 'b': new['main_corpus_id']},
            **diff_snapshots(old, new),
        }
    return {
        'schema': 'arc-diff/1',
        'a': a['run'],
        'b': b['run'],
        'identical': not config and not stages and not artifacts,
        'config': config,
        'stages': stages,
        'artifacts': artifacts,
        'corpus': corpus,
    }


def render(report: dict[str, Any]) -> str:
    a, b = report['a'], report['b']
    lines = [
        f'arcforge diff {a["id"]} (config {a["config_sha256"][:12]}) .. '
        f'{b["id"]} (config {b["config_sha256"][:12]})'
    ]
    if report['identical']:
        lines.append('identical: same config, stage keys and artifacts')
        return '\n'.join(lines)
    if report['config']:
        lines.append(f'config ({len(report["config"])} changed):')
        lines += [
            f'  {c["path"]}: {json.dumps(c["a"])} -> {json.dumps(c["b"])}' for c in report['config']
        ]
    if report['stages']:
        lines.append('stages:')
        lines += [f'  {s["stage"]:5} {s["change"]}' for s in report['stages']]
    if report['artifacts']:
        lines.append(f'artifacts ({len(report["artifacts"])} changed):')
        lines += [
            f'  {x["artifact"]}: {(x["a"] or "-")[:12]} -> {(x["b"] or "-")[:12]}'
            for x in report['artifacts']
        ]
    corpus = report['corpus']
    if corpus:
        lines.append(
            f'corpus: {len(corpus["added"])} added, {len(corpus["changed"])} changed, '
            f'{len(corpus["removed"])} removed, {len(corpus["renamed"])} renamed'
        )
        for kind in ('added', 'changed', 'removed'):
            lines += [f'  {kind:8} {slug}' for slug in corpus[kind]]
        lines += [f'  renamed  {r["from"]} -> {r["to"]}' for r in corpus['renamed']]
    return '\n'.join(lines)
