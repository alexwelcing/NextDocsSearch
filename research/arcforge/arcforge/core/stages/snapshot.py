"""S0 Snapshot: the corpus identity of a run, for S0 and for the main line S0⁻.

    corpus_id       sha256 over sorted (slug, sha256(mdx)) for every record (the full snapshot)
    main_corpus_id  the same over the main line S0⁻ = S0 minus the withheld series
                    (corpus.frontier.withheld: the-echo-chamber and the-residue, by owner
                    ruling 3; they rejoin at corpus.frontier.rejoin)
    records_id      the same over (slug, sha256(public/arc/records/<slug>.json)), the rendered
                    text S1 reads

When the config pins corpus.corpus_id or corpus.main_corpus_id (after S0, so a later run
cannot silently snapshot a different archive), S0 refuses a snapshot whose id differs.

Outputs:
    snapshot.json   pointers and metadata for every record (no text)
    corpus.jsonl    one line per record, {slug, mdx, record}: the exact source text, so every
                    later stage reads the corpus from the cache and never from the worktree

Not yet here (each lands with the stream that owns its input):
    - the salted vault/C_open split of the owner's 100 queries and the published vault-query
      commitment: it needs the Owner Desk's query file (arcforge.owner) and the vault's sealing
      (arcforge.vault); the split itself must never put query text in the shared cache.
    - from R01, the diff against the parent's snapshot (added, changed, removed, renamed) as
      an S0 output; `diff_snapshots` below computes it, and `arcforge diff` already reports it
      between any two runs.
"""

from __future__ import annotations

import json
from typing import Any

from arcforge.core.corpus import (
    CorpusError,
    CorpusFiles,
    load_corpus,
    normalize_date,
    parse_frontmatter,
)
from arcforge.core.dag import RunEnv, StageContext, StageError
from arcforge.core.hashing import canonical_json, pairs_id, sha256_bytes

SCHEMA = 'arc-snapshot/1'


def load_external(ctx: StageContext, env: RunEnv) -> tuple[str, CorpusFiles]:
    corpus = load_corpus(
        env.repo_root,
        ctx.cfg('corpus.mdx_dir'),
        ctx.cfg('corpus.records_dir'),
        ctx.cfg('corpus.git_sha'),
    )
    return corpus.fingerprint, corpus


def _str(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _text(data: bytes, where: str) -> str:
    try:
        return data.decode('utf-8')
    except UnicodeDecodeError as error:
        raise StageError(f'S0: {where} is not UTF-8: {error}') from error


def run(ctx: StageContext) -> dict[str, bytes]:
    corpus: CorpusFiles = ctx.external['corpus']
    withheld_series = list(ctx.cfg('corpus.frontier.withheld'))
    mdx = corpus.mdx()
    records = corpus.records()
    if not mdx:
        raise StageError(f'S0: no .mdx files under {corpus.mdx_dir}')

    rows: list[dict[str, Any]] = []
    lines: list[bytes] = []
    for slug, data in mdx.items():
        text = _text(data, f'{corpus.mdx_dir}/{slug}.mdx')
        try:
            meta, _body = parse_frontmatter(text)
        except CorpusError as error:
            raise StageError(f'S0: {corpus.mdx_dir}/{slug}.mdx: {error}') from error
        record = records.get(slug)
        record_text = (
            _text(record, f'{corpus.records_dir}/{slug}.json') if record is not None else None
        )
        if record_text is not None:
            try:
                json.loads(record_text)
            except json.JSONDecodeError as error:
                raise StageError(f'S0: {corpus.records_dir}/{slug}.json: {error}') from error
        series = _str(meta.get('series'))
        rows.append(
            {
                'slug': slug,
                'title': _str(meta.get('title')),
                'date': normalize_date(meta.get('date')),
                'article_type': _str(meta.get('articleType')),
                'series': series,
                'series_order': _int(meta.get('seriesOrder')),
                'withheld': series in withheld_series,
                'mdx_sha256': sha256_bytes(data),
                'mdx_bytes': len(data),
                'record_sha256': sha256_bytes(record) if record is not None else None,
                'record_bytes': len(record) if record is not None else None,
            }
        )
        lines.append(canonical_json({'slug': slug, 'mdx': text, 'record': record_text}))

    main = [r for r in rows if not r['withheld']]
    present_series = {r['series'] for r in rows}
    ids = {
        'corpus_id': pairs_id([(r['slug'], r['mdx_sha256']) for r in rows]),
        'main_corpus_id': pairs_id([(r['slug'], r['mdx_sha256']) for r in main]),
    }
    for name, value in ids.items():
        pinned = ctx.cfg(f'corpus.{name}')
        if pinned is not None and pinned != value:
            raise StageError(
                f"S0: the snapshot's {name} is {value}, but the config pins {pinned} "
                f'(corpus.{name}); the corpus changed since it was pinned'
            )
    snapshot = {
        'schema': SCHEMA,
        'source': {
            'mode': corpus.mode,
            'git_sha': corpus.git_sha,
            'mdx_dir': corpus.mdx_dir,
            'records_dir': corpus.records_dir,
            'fingerprint': corpus.fingerprint,
        },
        **ids,
        'records_id': pairs_id(
            [(r['slug'], r['record_sha256']) for r in rows if r['record_sha256']]
        ),
        'frontier': {
            'kind': 'withheld',
            'series': withheld_series,
            'missing_series': [s for s in withheld_series if s not in present_series],
            'rejoin_run': ctx.cfg('corpus.frontier.rejoin'),
            'slugs': [r['slug'] for r in rows if r['withheld']],
        },
        'counts': {
            'records': len(rows),
            'main_line': len(main),
            'withheld': len(rows) - len(main),
            'missing_record_json': [r['slug'] for r in rows if r['record_sha256'] is None],
            'orphan_record_json': sorted(set(records) - set(mdx)),
        },
        'vault_split': None,
        'records': rows,
    }
    return {'snapshot.json': canonical_json(snapshot), 'corpus.jsonl': b''.join(lines)}


def diff_snapshots(old: dict[str, Any], new: dict[str, Any]) -> dict[str, list[Any]]:
    """Record-level diff of two snapshot.json documents.

    A slug that disappears while a new slug appears with the same mdx sha256 is a rename;
    anything else is added, removed or changed (same slug, different mdx).
    """
    before = {r['slug']: r['mdx_sha256'] for r in old['records']}
    after = {r['slug']: r['mdx_sha256'] for r in new['records']}
    gone = sorted(set(before) - set(after))
    came = sorted(set(after) - set(before))
    renamed = []
    by_hash = {}
    for slug in came:
        by_hash.setdefault(after[slug], []).append(slug)
    for slug in gone:
        candidates = by_hash.get(before[slug])
        if candidates:
            renamed.append({'from': slug, 'to': candidates.pop(0)})
    moved_from = {r['from'] for r in renamed}
    moved_to = {r['to'] for r in renamed}
    return {
        'added': [s for s in came if s not in moved_to],
        'removed': [s for s in gone if s not in moved_from],
        'changed': sorted(s for s in set(before) & set(after) if before[s] != after[s]),
        'renamed': renamed,
    }
