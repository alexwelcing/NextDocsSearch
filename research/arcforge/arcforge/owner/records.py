"""The record index behind the Queries tab's autocomplete and its FRONTIER re-tag.

Read once at desk start from the repo: lib/generated/article-manifest.json, or else the record
bodies in public/arc/records/*.json. Only slugs, titles, dates and a short description reach the
page. Without either source the desk still works; queries just carry no record.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path

# Withheld from S0 onward by owner ruling 3, rejoining at R09. Keyed by slug series prefix.
FRONTIER_SERIES: dict[str, str] = {'echo-chamber': 'The Echo Chamber', 'residue': 'The Residue'}
DESCRIPTION_CHARS = 160

# 'far-shore-06-the-last-handshake' -> series 'far-shore', order 6.
_SERIES_RE = re.compile(r'^(?P<series>[a-z0-9]+(?:-[a-z0-9]+)*?)-(?P<order>\d{2})-')
SLUG_RE = re.compile(r'^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$')  # one manifest slug has capitals


@dataclass(frozen=True)
class Record:
    slug: str
    title: str
    date: str
    series: str | None
    order: int | None
    frontier: str | None  # a FRONTIER_SERIES key, or None
    description: str

    def to_json(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class RecordIndex:
    source: str | None  # repo-relative path the index came from, or None
    records: tuple[Record, ...]

    def by_slug(self) -> dict[str, Record]:
        return {record.slug: record for record in self.records}


EMPTY = RecordIndex(source=None, records=())


def series_of(slug: str) -> tuple[str | None, int | None]:
    match = _SERIES_RE.match(slug)
    if not match:
        return None, None
    return match.group('series'), int(match.group('order'))


def frontier_series_of(slug: str) -> str | None:
    series, _ = series_of(slug)
    return series if series in FRONTIER_SERIES else None


def _short(text: str) -> str:
    text = ' '.join(str(text or '').split())
    return text if len(text) <= DESCRIPTION_CHARS else text[: DESCRIPTION_CHARS - 1].rstrip() + '…'


def _record(raw: dict) -> Record | None:
    slug = str(raw.get('slug') or '')
    if not SLUG_RE.match(slug):
        return None
    series, order = series_of(slug)
    return Record(
        slug=slug,
        title=' '.join(str(raw.get('title') or slug).split()),
        date=str(raw.get('date') or '')[:10],
        series=series,
        order=order,
        frontier=series if series in FRONTIER_SERIES else None,
        description=_short(raw.get('description') or ''),
    )


def _sorted(records: list[Record]) -> tuple[Record, ...]:
    unique = {record.slug: record for record in records}
    return tuple(sorted(unique.values(), key=lambda r: r.slug))


def load_records(repo_root: Path | None) -> RecordIndex:
    """The index from the manifest, else from the record bodies, else EMPTY."""
    if repo_root is None:
        return EMPTY
    manifest = repo_root / 'lib' / 'generated' / 'article-manifest.json'
    try:
        rows = json.loads(manifest.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        rows = None
    if isinstance(rows, list):
        records = [r for r in (_record(row) for row in rows if isinstance(row, dict)) if r]
        if records:
            return RecordIndex(source='lib/generated/article-manifest.json', records=_sorted(records))
    bodies = repo_root / 'public' / 'arc' / 'records'
    records = []
    for path in sorted(bodies.glob('*.json')) if bodies.is_dir() else []:
        try:
            row = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if isinstance(row, dict):
            row.setdefault('slug', path.stem)
            record = _record(row)
            if record:
                records.append(record)
    if records:
        return RecordIndex(source='public/arc/records', records=_sorted(records))
    return EMPTY
