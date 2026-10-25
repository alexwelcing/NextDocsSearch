"""What the pipeline hands the owner: the files in ~/arc-owner/prep/.

The desk only reads these; the owner's answers go to the desk's own documents. Each file is
checked against its schema and reduced to the fields the page may show. In particular the
audit files are reduced to the query, the record card and two passages, so even a pairs file
that wrongly carried judge grades or system names could not show them: the audit stays blind.

Files and the step that writes them:
- people.json            arc-people-proposal/1     R00 prep (S2's proposed person map, top 30)
- registers.json         arc-registers-proposal/1  R00 prep (S1's register proposals)
- audit-pairs.json       arc-audit-pairs/1         R00 owner gate (150 stratified pairs)
- adjudicate-pairs.json  arc-adjudicate-pairs/1    R00 owner gate (<= 30 disagreements)
- remeaning-pairs.json   arc-remeaning-pairs/1     R03 (the format is fixed in M3)
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from arcforge.owner.records import SLUG_RE, Record

MAX_BYTES = 20 * 1024 * 1024
MAX_PASSAGE_CHARS = 4000
MAX_ADJUDICATE = 30

PREP_FILES = {
    'people': ('people.json', 'arc-people-proposal/1'),
    'registers': ('registers.json', 'arc-registers-proposal/1'),
    'audit': ('audit-pairs.json', 'arc-audit-pairs/1'),
    'adjudicate': ('adjudicate-pairs.json', 'arc-adjudicate-pairs/1'),
    'remeaning': ('remeaning-pairs.json', 'arc-remeaning-pairs/1'),
}


class PrepInvalid(ValueError):
    pass


@dataclass(frozen=True)
class PrepFile:
    name: str
    status: str  # 'missing' | 'ok' | 'invalid'
    error: str | None
    data: dict | None
    signature: tuple[int, int] | None  # (mtime_ns, size), to notice a new file cheaply

    def to_json(self) -> dict:
        return {'status': self.status, 'error': self.error, 'data': self.data}


def _str(value: object, where: str, *, required: bool = True) -> str:
    if isinstance(value, str) and (value.strip() or not required):
        return ' '.join(value.split())
    if value is None and not required:
        return ''
    raise PrepInvalid(f'{where} must be a non-empty string')


def _id(value: object, where: str) -> str:
    if not isinstance(value, str) or not SLUG_RE.match(value):
        raise PrepInvalid(f'{where}: {value!r} is not an id')
    return value


def _items(value: object, where: str) -> list:
    if not isinstance(value, list):
        raise PrepInvalid(f'{where} must be a list')
    return value


def _unique(ids: list[str], where: str) -> None:
    seen: set[str] = set()
    for item in ids:
        if item in seen:
            raise PrepInvalid(f'{where}: {item} appears twice')
        seen.add(item)


def _title(slug: str, given: object, records: Mapping[str, Record]) -> str:
    if isinstance(given, str) and given.strip():
        return ' '.join(given.split())
    return records[slug].title if slug in records else slug


def _people(raw: dict, records: Mapping[str, Record]) -> dict:
    names = []
    for i, name in enumerate(_items(raw.get('names'), 'names')):
        where = f'names[{i}]'
        if not isinstance(name, dict):
            raise PrepInvalid(f'{where} must be an object')
        name_id = _id(name.get('name_id'), f'{where}.name_id')
        clusters = []
        for j, cluster in enumerate(_items(name.get('clusters'), f'{name_id}.clusters')):
            cwhere = f'{name_id}.clusters[{j}]'
            if not isinstance(cluster, dict):
                raise PrepInvalid(f'{cwhere} must be an object')
            mentions = []
            for k, rec in enumerate(_items(cluster.get('records'), f'{cwhere}.records')):
                if not isinstance(rec, dict):
                    raise PrepInvalid(f'{cwhere}.records[{k}] must be an object')
                slug = _id(rec.get('slug'), f'{cwhere}.records[{k}].slug')
                mention = {
                    'slug': slug,
                    'title': _title(slug, rec.get('title'), records),
                    'role': _str(rec.get('role'), f'{cwhere}.records[{k}].role', required=False),
                }
                if rec.get('mention_id') is not None:
                    mention['mention_id'] = _id(rec['mention_id'], f'{cwhere} mention_id')
                mentions.append(mention)
            if not mentions:
                raise PrepInvalid(f'{cwhere} has no records')
            clusters.append(
                {
                    'cluster_id': _id(cluster.get('cluster_id'), f'{cwhere}.cluster_id'),
                    'label': _str(cluster.get('label'), f'{cwhere}.label'),
                    'records': mentions,
                }
            )
        if not clusters:
            raise PrepInvalid(f'{name_id} has no clusters')
        _unique([c['cluster_id'] for c in clusters], f'{name_id} cluster ids')
        _unique(
            [m.get('mention_id') or m['slug'] for c in clusters for m in c['records']],
            f'{name_id} mentions (give repeated records a mention_id)',
        )
        variants = []
        for v in _items(name.get('variants', []), f'{name_id}.variants'):
            if not isinstance(v, dict):
                raise PrepInvalid(f'{name_id}.variants entries must be objects')
            variants.append(
                {
                    'name_id': _id(v.get('name_id'), f'{name_id}.variants.name_id'),
                    'reason': _str(v.get('reason'), f'{name_id}.variants.reason', required=False),
                }
            )
        mentions_count = name.get('mentions', 0)
        names.append(
            {
                'name_id': name_id,
                'name': _str(name.get('name'), f'{where}.name'),
                'mentions': mentions_count if isinstance(mentions_count, int) else 0,
                'clusters': clusters,
                'variants': variants,
                'note': _str(name.get('note'), f'{name_id}.note', required=False),
            }
        )
    _unique([n['name_id'] for n in names], 'name ids')
    return {'names': names}


def _registers(raw: dict, records: Mapping[str, Record]) -> dict:
    registers = []
    for i, reg in enumerate(_items(raw.get('registers'), 'registers')):
        if not isinstance(reg, dict):
            raise PrepInvalid(f'registers[{i}] must be an object')
        registers.append(
            {
                'id': _id(reg.get('id'), f'registers[{i}].id'),
                'label': _str(reg.get('label'), f'registers[{i}].label'),
            }
        )
    if not registers:
        raise PrepInvalid('registers is empty')
    _unique([r['id'] for r in registers], 'register ids')
    known = {r['id'] for r in registers}
    rows = []
    for i, rec in enumerate(_items(raw.get('records'), 'records')):
        if not isinstance(rec, dict):
            raise PrepInvalid(f'records[{i}] must be an object')
        slug = _id(rec.get('slug'), f'records[{i}].slug')
        register = _id(rec.get('register'), f'{slug}.register')
        if register not in known:
            raise PrepInvalid(f'{slug}: register {register} is not in registers')
        rows.append(
            {
                'slug': slug,
                'title': _title(slug, rec.get('title'), records),
                'register': register,
                'why': _str(rec.get('why'), f'{slug}.why', required=False),
            }
        )
    _unique([r['slug'] for r in rows], 'record slugs')
    return {'registers': registers, 'records': rows}


def _pairs(raw: dict, records: Mapping[str, Record], limit: int | None) -> dict:
    pairs = []
    for i, pair in enumerate(_items(raw.get('pairs'), 'pairs')):
        where = f'pairs[{i}]'
        if not isinstance(pair, dict):
            raise PrepInvalid(f'{where} must be an object')
        card = pair.get('record')
        if not isinstance(card, dict):
            raise PrepInvalid(f'{where}.record must be an object')
        slug = _id(card.get('slug'), f'{where}.record.slug')
        known = records.get(slug)
        passages = [
            _str(p, f'{where}.passages')[:MAX_PASSAGE_CHARS]
            for p in _items(pair.get('passages', []), f'{where}.passages')[:2]
        ]
        # Whitelist: nothing else from the pair (judge grades, systems, ranks) reaches the page.
        pairs.append(
            {
                'pair_id': _id(pair.get('pair_id'), f'{where}.pair_id'),
                'query': _str(pair.get('query'), f'{where}.query'),
                'record': {
                    'slug': slug,
                    'title': _title(slug, card.get('title'), records),
                    'date': _str(
                        card.get('date') or (known.date if known else ''), 'date', required=False
                    ),
                    'description': _str(
                        card.get('description') or (known.description if known else ''),
                        'description',
                        required=False,
                    ),
                },
                'passages': passages,
            }
        )
    _unique([p['pair_id'] for p in pairs], 'pair ids')
    if limit is not None and len(pairs) > limit:
        raise PrepInvalid(f'at most {limit} pairs (got {len(pairs)})')
    return {'pairs': pairs}


def _remeaning(raw: dict, records: Mapping[str, Record]) -> dict:
    items = _items(raw.get('items', []), 'items')
    return {'items': len(items)}  # the grader itself arrives with R03 (M3)


_PARSERS = {
    'people': lambda raw, recs: _people(raw, recs),
    'registers': lambda raw, recs: _registers(raw, recs),
    'audit': lambda raw, recs: _pairs(raw, recs, None),
    'adjudicate': lambda raw, recs: _pairs(raw, recs, MAX_ADJUDICATE),
    'remeaning': lambda raw, recs: _remeaning(raw, recs),
}


def load_prep(root: Path, name: str, records: Mapping[str, Record]) -> PrepFile:
    filename, schema = PREP_FILES[name]
    path = root / filename
    try:
        stat = path.stat()
    except FileNotFoundError:
        return PrepFile(name, 'missing', None, None, None)
    signature = (stat.st_mtime_ns, stat.st_size)
    try:
        if stat.st_size > MAX_BYTES:
            raise PrepInvalid(f'{filename} is larger than {MAX_BYTES // (1024 * 1024)} MB')
        raw = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(raw, dict):
            raise PrepInvalid(f'{filename} must hold a JSON object')
        if raw.get('schema') != schema:
            raise PrepInvalid(f'{filename}: schema must be {schema!r}, not {raw.get("schema")!r}')
        data = _PARSERS[name](raw, records)
    except (OSError, ValueError) as error:  # PrepInvalid and JSONDecodeError are ValueErrors
        message = (
            str(error) if isinstance(error, PrepInvalid) else f'{type(error).__name__}: {error}'
        )
        return PrepFile(name, 'invalid', message[:500], None, signature)
    return PrepFile(name, 'ok', None, data, signature)
