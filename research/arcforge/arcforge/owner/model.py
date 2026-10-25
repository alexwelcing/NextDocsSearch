"""The desk's documents: their empty forms, validation, and the fields derived from them.

Each document is one JSON file in ~/arc-owner/. A save is validated here before it is written:
- hard errors (a query over 60 characters, a 101st query, a grade outside 0-3, a malformed
  shape) are refused, and the page prevents all of them before they are sent;
- soft issues (a record that has since left the manifest, a duplicate, a voice example that
  copies a query) never block a save: they come back as derived flags for the page to show.
  An autosave must never fail over something the owner is still in the middle of fixing.

The derived fields are computed only here, in Python, and sent to the page with every response,
so the copy check, the FRONTIER re-tag and the counts have exactly one implementation.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, field

from arcforge.owner.records import FRONTIER_SERIES, SLUG_RE, Record, frontier_series_of

MAX_CHARS = 60  # FIND's box (SearchTab MAX_QUERY), counted in UTF-16 units like the browser
MAIN_TARGET = 100
FRONTIER_PER_SERIES = 4
FRONTIER_TARGET = FRONTIER_PER_SERIES * len(FRONTIER_SERIES)
VOICE_SLOTS = 5
COPY_JACCARD = 0.5  # leakage control 3's character-5-gram threshold
GRADES = (0, 1, 2, 3)
NEW_PEOPLE = ('new-1', 'new-2', 'new-3')  # extra people a split may create for one name

# (id, label, one-line brief shown on the Voices tab)
VOICES: tuple[tuple[str, str, str], ...] = (
    ('literalist', 'Literalist', 'Types the exact words, names or title fragments they remember.'),
    ('mood-seeker', 'Mood-seeker', 'Asks for a feeling, an atmosphere or a kind of story.'),
    ('lost-visitor', 'Lost visitor', 'Half-remembers something and gropes for it, vaguely.'),
    ('practitioner', 'Practitioner', 'Brings a professional problem in their own working jargon.'),
    ('thread-follower', 'Thread-follower', 'Follows a character, a series or an idea to the next record.'),
)
VOICE_IDS = tuple(voice for voice, _, _ in VOICES)

QUERY_ID_RE = re.compile(r'^q-(\d{4,})$')
_UTC_RE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
_PUNCT_RE = re.compile(r'[^\w\s]')
_CONTROL_RE = re.compile(r'[\x00-\x1f\x7f]+')


class ValidationError(ValueError):
    """A save the desk refuses. The message is shown to the owner as is."""


@dataclass
class Context:
    """What validation and derivation may look at besides the document itself."""

    records: Mapping[str, Record] = field(default_factory=dict)
    prep: Mapping[str, dict] = field(default_factory=dict)  # name -> normalized prep data
    docs: Mapping[str, dict] = field(default_factory=dict)  # the other saved documents


# ---- text helpers ------------------------------------------------------------------------------


def utf16_len(text: str) -> int:
    """Length as a browser's maxLength counts it (an emoji is 2)."""
    return len(text.encode('utf-16-le')) // 2


def clean_text(value: object, where: str) -> str:
    if not isinstance(value, str):
        raise ValidationError(f'{where}: text must be a string')
    text = _CONTROL_RE.sub(' ', value).strip()
    if utf16_len(text) > MAX_CHARS:
        raise ValidationError(f'{where}: {utf16_len(text)} characters; the limit is {MAX_CHARS}')
    return text


def norm_text(text: str) -> str:
    """Comparison form: NFKC, case-folded, punctuation dropped, whitespace collapsed."""
    folded = unicodedata.normalize('NFKC', text).casefold()
    return ' '.join(_PUNCT_RE.sub(' ', folded).split())


def char_ngrams(text: str, n: int = 5) -> frozenset[str]:
    norm = norm_text(text)
    if len(norm) <= n:
        return frozenset({norm}) if norm else frozenset()
    return frozenset(norm[i : i + n] for i in range(len(norm) - n + 1))


def jaccard(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _utc(value: object, fallback: str) -> str:
    return value if isinstance(value, str) and _UTC_RE.match(value) else fallback


def _dict(value: object, where: str) -> dict:
    if not isinstance(value, dict):
        raise ValidationError(f'{where} must be an object')
    return value


def _list(value: object, where: str) -> list:
    if not isinstance(value, list):
        raise ValidationError(f'{where} must be a list')
    return value


def _ident(value: object, where: str) -> str:
    if not isinstance(value, str) or not SLUG_RE.match(value):
        raise ValidationError(f'{where}: {value!r} is not an id')
    return value


# ---- empty documents ---------------------------------------------------------------------------


def empty_queries() -> dict:
    return {'schema': 'arc-owner-queries/1', 'next_seq': 1, 'queries': []}


def empty_voices() -> dict:
    return {'schema': 'arc-owner-voices/1', 'voices': {v: [''] * VOICE_SLOTS for v in VOICE_IDS}}


def empty_settings() -> dict:
    return {'schema': 'arc-owner-settings/1', 'inheritance03_renamed': False, 'confirmed_utc': None}


def empty_people() -> dict:
    return {'schema': 'arc-owner-people/1', 'decisions': {}}


def empty_registers() -> dict:
    return {'schema': 'arc-owner-registers/1', 'overrides': {}, 'reviewed_groups': []}


def empty_audit() -> dict:
    return {'schema': 'arc-owner-audit/1', 'labels': {}}


def empty_adjudicate() -> dict:
    return {'schema': 'arc-owner-adjudicate/1', 'labels': {}}


def empty_launch() -> dict:
    return {'schema': 'arc-owner-launch/1', 'run': 'r00', 'requested_utc': None}


# name -> (file in ~/arc-owner/, empty payload). The only documents the desk can write.
DOCS = {
    'queries': ('queries.json', empty_queries),
    'voices': ('voices.json', empty_voices),
    'settings': ('settings.json', empty_settings),
    'people': ('people-review.json', empty_people),
    'registers': ('registers-review.json', empty_registers),
    'audit': ('audit-labels.json', empty_audit),
    'adjudicate': ('adjudicate-labels.json', empty_adjudicate),
    'launch': ('launch.json', empty_launch),
}
# Frozen at S0, when `arcforge vault split` writes ~/arc-owner/s0-lock.json.
LOCKED_AT_S0 = frozenset({'queries', 'settings'})


# ---- queries -----------------------------------------------------------------------------------


def normalize_queries(payload: dict, ctx: Context, now: str) -> dict:
    items = _list(payload.get('queries', []), 'queries')
    next_seq = payload.get('next_seq', 1)
    if not isinstance(next_seq, int) or next_seq < 1:
        next_seq = 1
    out: list[dict] = []
    seen: set[str] = set()
    per_series: Counter[str] = Counter()
    main = 0
    for raw in items:
        raw = _dict(raw, 'each query')
        qid = raw.get('id')
        match = QUERY_ID_RE.match(qid) if isinstance(qid, str) else None
        if not match or qid in seen:
            raise ValidationError(f'query id {qid!r} is malformed or repeated')
        seen.add(qid)
        next_seq = max(next_seq, int(match.group(1)) + 1)
        text = clean_text(raw.get('text', ''), qid)
        section = raw.get('section', 'main')
        if section not in ('main', 'frontier'):
            raise ValidationError(f'{qid}: section must be main or frontier')
        series = raw.get('series') if section == 'frontier' else None
        if section == 'frontier':
            if series not in FRONTIER_SERIES:
                raise ValidationError(f'{qid}: a frontier query names its series')
            per_series[series] += 1
            if per_series[series] > FRONTIER_PER_SERIES:
                raise ValidationError(f'{FRONTIER_SERIES[series]} has {FRONTIER_PER_SERIES} slots')
        else:
            main += 1
        record = raw.get('record') or None
        if record is not None:
            record = _ident(record, f'{qid} record')
        if section == 'frontier':
            frontier, reason = True, 'section'
        elif record and frontier_series_of(record):
            frontier, reason = True, 'record'
        else:
            frontier, reason = False, None
        out.append(
            {
                'id': qid,
                'text': text,
                'record': record,
                'section': section,
                'series': series,
                'frontier': frontier,
                'frontier_reason': reason,
                'created_utc': _utc(raw.get('created_utc'), now),
            }
        )
    if main > MAIN_TARGET:
        raise ValidationError(f'the main list holds {MAIN_TARGET} queries; this save has {main}')
    return {'schema': 'arc-owner-queries/1', 'next_seq': next_seq, 'queries': out}


def all_query_texts(queries_doc: dict) -> list[tuple[str, str]]:
    """(id, text) of every non-empty query, main and frontier: 'your 108 queries'."""
    return [(q['id'], q['text']) for q in queries_doc.get('queries', []) if q.get('text')]


def derive_queries(doc: dict, ctx: Context) -> dict:
    queries = doc.get('queries', [])
    main = [q for q in queries if q['section'] == 'main']
    by_norm: dict[str, list[str]] = {}
    for q in queries:
        if q['text']:
            by_norm.setdefault(norm_text(q['text']), []).append(q['id'])
    duplicates = {
        qid: [other for other in ids if other != qid]
        for ids in by_norm.values()
        if len(ids) > 1
        for qid in ids
    }
    unknown = [q['id'] for q in queries if q['record'] and ctx.records and q['record'] not in ctx.records]
    mismatch = [
        q['id']
        for q in queries
        if q['section'] == 'frontier' and q['record'] and frontier_series_of(q['record']) != q['series']
    ]
    frontier_filled = {
        series: sum(1 for q in queries if q['series'] == series and q['text'])
        for series in FRONTIER_SERIES
    }
    return {
        'main_filled': sum(1 for q in main if q['text']),
        'main_rows': len(main),
        'main_target': MAIN_TARGET,
        'main_frontier_tagged': sum(1 for q in main if q['frontier']),
        'with_record': sum(1 for q in queries if q['record']),
        'frontier_filled': frontier_filled,
        'frontier_target': FRONTIER_TARGET,
        'empty': [q['id'] for q in queries if not q['text']],
        'duplicates': duplicates,
        'unknown_records': unknown,
        'series_mismatch': mismatch,
    }


# ---- voices ------------------------------------------------------------------------------------


def normalize_voices(payload: dict, ctx: Context, now: str) -> dict:
    voices = _dict(payload.get('voices', {}), 'voices')
    out: dict[str, list[str]] = {}
    for voice in VOICE_IDS:
        slots = _list(voices.get(voice, []), voice)
        if len(slots) > VOICE_SLOTS:
            raise ValidationError(f'{voice} has {VOICE_SLOTS} examples')
        texts = [clean_text(slot, f'{voice} #{i + 1}') for i, slot in enumerate(slots)]
        out[voice] = texts + [''] * (VOICE_SLOTS - len(texts))
    return {'schema': 'arc-owner-voices/1', 'voices': out}


def voice_flag(text: str, queries: list[tuple[str, str]], earlier: list[str]) -> dict | None:
    """'copy' (same as one of the owner's queries), 'close' (5-gram Jaccard >= 0.5) or
    'repeat' (same as an earlier voice example); None when the example is fresh."""
    if not text:
        return None
    norm = norm_text(text)
    for qid, query in queries:
        if norm_text(query) == norm:
            return {'kind': 'copy', 'query_id': qid, 'query': query}
    grams = char_ngrams(text)
    best = max(((jaccard(grams, char_ngrams(q)), qid, q) for qid, q in queries), default=None)
    if best and best[0] >= COPY_JACCARD:
        return {'kind': 'close', 'query_id': best[1], 'query': best[2], 'jaccard': round(best[0], 2)}
    if norm in earlier:
        return {'kind': 'repeat'}
    return None


def derive_voices(doc: dict, ctx: Context) -> dict:
    queries = all_query_texts(ctx.docs.get('queries', {}))
    flags: dict[str, list[dict | None]] = {}
    earlier: list[str] = []
    for voice in VOICE_IDS:
        row = []
        for text in doc['voices'][voice]:
            row.append(voice_flag(text, queries, earlier))
            if text:
                earlier.append(norm_text(text))
        flags[voice] = row
    every = [flag for row in flags.values() for flag in row]
    return {
        'filled': sum(1 for voice in VOICE_IDS for text in doc['voices'][voice] if text),
        'target': VOICE_SLOTS * len(VOICE_IDS),
        'flags': flags,
        'copies': sum(1 for flag in every if flag and flag['kind'] == 'copy'),
        'close': sum(1 for flag in every if flag and flag['kind'] == 'close'),
    }


# ---- settings ----------------------------------------------------------------------------------


def normalize_settings(payload: dict, ctx: Context, now: str) -> dict:
    renamed = payload.get('inheritance03_renamed', False)
    if not isinstance(renamed, bool):
        raise ValidationError('inheritance03_renamed must be true or false')
    confirmed = payload.get('confirmed_utc')
    return {
        'schema': 'arc-owner-settings/1',
        'inheritance03_renamed': renamed,
        'confirmed_utc': _utc(confirmed, now) if confirmed else None,
    }


# ---- people ------------------------------------------------------------------------------------


def mention_key(record: dict) -> str:
    return record.get('mention_id') or record['slug']


def normalize_people(payload: dict, ctx: Context, now: str) -> dict:
    """Keep only what differs from the proposal: reviewed flags, moved mentions, merges."""
    decisions = _dict(payload.get('decisions', {}), 'decisions')
    proposal = {n['name_id']: n for n in ctx.prep.get('people', {}).get('names', [])}
    out: dict[str, dict] = {}
    for name_id, raw in decisions.items():
        _ident(name_id, 'person name id')
        raw = _dict(raw, name_id)
        assignment = _dict(raw.get('assignment', {}), f'{name_id} assignment')
        proposed = {
            mention_key(record): cluster['cluster_id']
            for cluster in proposal.get(name_id, {}).get('clusters', [])
            for record in cluster['records']
        }
        clean: dict[str, str] = {}
        for key, cluster_id in assignment.items():
            if not isinstance(key, str) or not isinstance(cluster_id, str):
                raise ValidationError(f'{name_id}: an assignment maps a mention to a person id')
            if proposed.get(key) != cluster_id:
                clean[key] = cluster_id
        merge = _list(raw.get('merge_with', []), f'{name_id} merge_with')
        merge_with = sorted({_ident(other, f'{name_id} merge_with') for other in merge} - {name_id})
        reviewed = raw.get('reviewed', False)
        if not isinstance(reviewed, bool):
            raise ValidationError(f'{name_id}: reviewed must be true or false')
        out[name_id] = {
            'reviewed': reviewed,
            'reviewed_utc': _utc(raw.get('reviewed_utc'), now) if reviewed else None,
            'assignment': dict(sorted(clean.items())),
            'merge_with': merge_with,
        }
    return {'schema': 'arc-owner-people/1', 'decisions': dict(sorted(out.items()))}


def derive_people(doc: dict, ctx: Context) -> dict:
    names = ctx.prep.get('people', {}).get('names', [])
    decisions = doc.get('decisions', {})
    known = {n['name_id'] for n in names}
    stale = []
    for name_id, decision in decisions.items():
        if name_id not in known:
            stale.append(name_id)
            continue
        name = next(n for n in names if n['name_id'] == name_id)
        mentions = {mention_key(r) for c in name['clusters'] for r in c['records']}
        clusters = {c['cluster_id'] for c in name['clusters']} | set(NEW_PEOPLE)
        bad = [k for k, v in decision['assignment'].items() if k not in mentions or v not in clusters]
        if bad or any(other not in known for other in decision['merge_with']):
            stale.append(name_id)
    return {
        'reviewed': sum(1 for n in names if decisions.get(n['name_id'], {}).get('reviewed')),
        'total': len(names),
        'edited': sum(
            1
            for n in names
            if decisions.get(n['name_id'], {}).get('assignment')
            or decisions.get(n['name_id'], {}).get('merge_with')
        ),
        'stale': sorted(stale),
    }


# ---- registers ---------------------------------------------------------------------------------


def normalize_registers(payload: dict, ctx: Context, now: str) -> dict:
    overrides = _dict(payload.get('overrides', {}), 'overrides')
    proposal = {r['slug']: r['register'] for r in ctx.prep.get('registers', {}).get('records', [])}
    clean: dict[str, str] = {}
    for slug, register in overrides.items():
        _ident(slug, 'record slug')
        _ident(register, f'{slug} register')
        if proposal.get(slug) != register:
            clean[slug] = register
    groups = _list(payload.get('reviewed_groups', []), 'reviewed_groups')
    reviewed = sorted({_ident(group, 'register id') for group in groups})
    return {
        'schema': 'arc-owner-registers/1',
        'overrides': dict(sorted(clean.items())),
        'reviewed_groups': reviewed,
    }


def derive_registers(doc: dict, ctx: Context) -> dict:
    proposal = ctx.prep.get('registers', {})
    registers = {r['id'] for r in proposal.get('registers', [])}
    slugs = {r['slug'] for r in proposal.get('records', [])}
    groups = sorted({r['register'] for r in proposal.get('records', [])})
    stale = sorted(
        slug for slug, reg in doc.get('overrides', {}).items() if slug not in slugs or reg not in registers
    )
    return {
        'groups': groups,
        'reviewed': sum(1 for group in groups if group in doc.get('reviewed_groups', [])),
        'total': len(groups),
        'overrides': len(doc.get('overrides', {})),
        'stale': stale,
    }


# ---- graded pairs (audit, adjudicate) ----------------------------------------------------------


def normalize_labels(kind: str):
    def normalize(payload: dict, ctx: Context, now: str) -> dict:
        labels = _dict(payload.get('labels', {}), 'labels')
        out: dict[str, dict] = {}
        for pair_id, raw in labels.items():
            _ident(pair_id, 'pair id')
            raw = _dict(raw, pair_id)
            grade = raw.get('grade')
            if isinstance(grade, bool) or grade not in GRADES:
                raise ValidationError(f'{pair_id}: grades are 0, 1, 2 or 3')
            out[pair_id] = {'grade': grade, 'utc': _utc(raw.get('utc'), now)}
        return {'schema': f'arc-owner-{kind}/1', 'labels': dict(sorted(out.items()))}

    return normalize


def derive_labels(kind: str):
    def derive(doc: dict, ctx: Context) -> dict:
        pairs = ctx.prep.get(kind, {}).get('pairs', [])
        ids = [pair['pair_id'] for pair in pairs]
        labels = doc.get('labels', {})
        first_open = next((i for i, pid in enumerate(ids) if pid not in labels), None)
        return {
            'graded': sum(1 for pid in ids if pid in labels),
            'total': len(ids),
            'next_index': first_open,
            'stale': sorted(set(labels) - set(ids)),
        }

    return derive


# ---- launch ------------------------------------------------------------------------------------


def normalize_launch(payload: dict, ctx: Context, now: str) -> dict:
    requested = payload.get('requested_utc')
    return {
        'schema': 'arc-owner-launch/1',
        'run': 'r00',
        'requested_utc': _utc(requested, now) if requested else None,
    }


NORMALIZE = {
    'queries': normalize_queries,
    'voices': normalize_voices,
    'settings': normalize_settings,
    'people': normalize_people,
    'registers': normalize_registers,
    'audit': normalize_labels('audit'),
    'adjudicate': normalize_labels('adjudicate'),
    'launch': normalize_launch,
}
DERIVE = {
    'queries': derive_queries,
    'voices': derive_voices,
    'people': derive_people,
    'registers': derive_registers,
    'audit': derive_labels('audit'),
    'adjudicate': derive_labels('adjudicate'),
}


def normalize(name: str, payload: object, ctx: Context, now: str) -> dict:
    return NORMALIZE[name](_dict(payload, name), ctx, now)


def derive(name: str, doc: dict, ctx: Context) -> dict:
    fn = DERIVE.get(name)
    return fn(doc, ctx) if fn else {}
