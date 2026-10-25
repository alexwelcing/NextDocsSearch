"""The committed parity fixtures (research/arcforge/fixtures/tokenizer/).

- toy/: a small bundle in the planned format (archive-flavoured lexicon with multiwords,
  entities and shared names, general words that share rows, 257 n-gram buckets, 16 dims).
- parity.jsonl.gz: 10,000 deterministic strings with the Python token stream of each, in
  query and document mode (see parity_lines for the encoding).
  lib/archive/lexemeEmbed.test.ts must reproduce every stream.
- golden.json: the Python embedding of the first 120 strings in both modes; the TS side must
  match it to the bit (the same float64 operations in the same order).

`python -m arcforge.models parity-fixtures` rewrites them; tests/models/test_fixtures.py
checks that the committed files are exactly what this module produces.

The strings mix toy lexemes (with casing, diacritic, decomposed, fullwidth and ligature
variants), stop words, digits and Unicode stress pieces (symbols, emoji and ZWJ sequences,
other scripts, combining marks, compatibility characters, odd spaces). Every character was
assigned by Unicode 8.0, so Python 3.11-3.14 (Unicode 14-16) and Node (ICU) see the same
character properties.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import random
import struct
from pathlib import Path

from arcforge.models.bundle import META_NAME, Bundle, quantize_rows, write_bundle
from arcforge.models.lexicon import Kind, LexiconEntry, TokenizerSpec, build_lexicon, canonical_json

SEED = 1729
N_STRINGS = 10_000
N_GOLDEN = 120
N_FULL = 300
TOY_DIMS = 16
TOY_BUCKETS = 257
PARITY_SCHEMA = 'arc-lexeme-parity/1'
GOLDEN_SCHEMA = 'arc-lexeme-golden/1'

FIXTURE_DIR = Path(__file__).resolve().parents[2] / 'fixtures' / 'tokenizer'

CORPUS_WORDS = (
    'territory pause threshold commons hands calibration sickness zuri fossil archive chronicle '
    'chronicles record records signal lexeme lexemes model embedding tomas tuhoe solene ship find '
    'search agent agents agentic quantum key distribution photon polarization weight hammer '
    'blacksmith choice inheritance gesture echo chamber residue frontier vault ledger drift glyph '
    'atlas continent unnamed ghost ghosts register registers gloss glossary resonance trace '
    'radiologist daughter captain dr byline bylines editor note notes series footer stamp bio '
    'interface emergent intelligence speculative futures 2067 2026 49 r00 l4 bm25 rrf mrl'
).split()
GENERAL_WORDS = (
    'house home water river light lamp time clock people person world earth night evening '
    'city town road street door window table chair book page hand foot head heart mind word'
).split()
MULTIWORDS = (
    'the pause',
    'calibration sickness',
    'the fossil',
    'the commons',
    'hands of the commons',
    'unwritten chronicles',
    'the long quiet',
    'threshold of the territory',
    'plan b',
    'the 49 chronicles',
    'echo chamber',
    'the weight of the hammer',
    'a to z',
)
ENTITIES = (
    'adaeze nwosu',
    'adaeze okonkwo',
    'amara okonkwo',
    'priya raman',
    'priya shah',
    'marcus chen',
    'tomas novak',
    'dr yuki tanaka',
    'captain yuki tanaka',
)
ALIASES = {
    'adaeze': ('adaeze nwosu', 'adaeze okonkwo'),
    'okonkwo': ('adaeze okonkwo', 'amara okonkwo'),
    'priya': ('priya raman', 'priya shah'),
    'yuki tanaka': ('dr yuki tanaka', 'captain yuki tanaka'),
}

STOP_SAMPLE = 'the and of to in is it a i at by for with from this that we or'.split()
FILLER_WORDS = 'said aim again open closed quiet loud first last other'.split()
DIACRITICS = {
    'a': 'áàâäåāă',
    'e': 'éèêëēė',
    'i': 'íìîïī',
    'o': 'óòôöøōő',
    'u': 'úùûüūů',
    'c': 'çčć',
    'n': 'ñń',
    's': 'šśş',
    'z': 'žźż',
    'y': 'ýÿ',
    'l': 'ł',
    'd': 'đð',
}
LIGATURES = {'fi': 'ﬁ', 'fl': 'ﬂ', 'ff': 'ﬀ', 'ffi': 'ﬃ'}
SEPARATORS = (
    ' ', ' ', ' ', '  ', '-', '—', '–', '_', '/', '.', ', ', '\n', '\t', ' ', '　',
    '​', '’', "'", '"', '(', ')', '#', '&', '+', '™', '©', '€', '$', '…', '|', '·',
)
STRESS_PIECES = (
    'Σοφία', 'ΑΣ', 'Москва', 'Ёлка', '東京', '한국어', 'سلام', 'שלום', 'नमस्ते', 'ไทย',
    '😀', '❤️', '👩‍💻', '👍🏽', '🇺🇸', '½', '¼', '²', '³', '①', 'Ⅻ', 'ⅷ', '℃', '№',
    'Kelvin K', 'İstanbul', 'straße', 'STRASSE', 'Æther', 'Œuvre', 'Øresund', 'Łódź',
    'Þórr', 'Đorđe', 'ıi', 'é', 'ñ', 'ǟ', '́lead', 'ＦＵＬＬ',
    'ｗｉｄｔｈ', 'ｦ', '㎏', '㈱', 'ǅ', 'ǈ', 'ŉ', 'ſ', 'ﬆ', '‐', '‑', '⁄', ' ', '﻿',
    'x­x', 'co­op', 'O’Brien', 'rock’n’roll', 'C++', 'A/B', '3.14', '10,000', 'R00',
    'L4', '#49', 'e-mail', 'mid-2067',
)
# Code point ranges fully assigned by Unicode 8.0 (see the module docstring).
RANDOM_RANGES = (
    (0x00A0, 0x00FF), (0x0100, 0x017F), (0x0180, 0x024F), (0x0300, 0x036F), (0x0391, 0x03A1),
    (0x03B1, 0x03C9), (0x0400, 0x045F), (0x2010, 0x2027), (0x2100, 0x214F), (0x2150, 0x2182),
    (0x2190, 0x21FF), (0x2460, 0x24FF), (0x4E00, 0x4FFF), (0xAC00, 0xACFF), (0xFB00, 0xFB06),
    (0xFF01, 0xFF5E), (0x1F600, 0x1F64F),
)


def toy_entries() -> tuple[list[LexiconEntry], int]:
    """The toy lexicon and its bucket_base (= number of lexeme rows)."""
    entries: list[LexiconEntry] = []
    row = 0
    for word in CORPUS_WORDS:
        entries.append(LexiconEntry(word, Kind.WORD, row))
        row += 1
    # General words share rows in pairs, like k-means vocabulary quantization does.
    for i, word in enumerate(GENERAL_WORDS):
        entries.append(LexiconEntry(word, Kind.GENERAL, row + i // 2))
    row += (len(GENERAL_WORDS) + 1) // 2
    for key in MULTIWORDS:
        entries.append(LexiconEntry(key, Kind.MULTIWORD, row))
        row += 1
    entity_row: dict[str, int] = {}
    for key in ENTITIES:
        entries.append(LexiconEntry(key, Kind.ENTITY, row))
        entity_row[key] = row
        row += 1
    for key, people in ALIASES.items():
        entries.append(LexiconEntry(key, Kind.ALIAS, row, tuple(entity_row[p] for p in people)))
        row += 1
    return entries, row


TOY_SPEC = TokenizerSpec(buckets=TOY_BUCKETS)


def toy_lexicon_bytes() -> bytes:
    entries, bucket_base = toy_entries()
    return build_lexicon(entries, bucket_base=bucket_base, spec=TOY_SPEC, block_size=8)


def write_toy_bundle(out_dir: Path) -> dict:
    lexicon = toy_lexicon_bytes()
    _, bucket_base = toy_entries()
    rows = bucket_base + TOY_BUCKETS
    rng = random.Random(SEED)
    table = [[rng.gauss(0, 1) * rng.uniform(0.2, 3.0) for _ in range(TOY_DIMS)] for _ in range(rows)]
    table[3] = [0.0] * TOY_DIMS  # one empty row (scale 0), as an unseen bucket would be
    int8_rows, scales = quantize_rows(table)
    weights = [rng.uniform(0.25, 2.0) for _ in range(rows)]
    b_query = [rng.gauss(0, 0.5) for _ in range(TOY_DIMS)]
    b_doc = [rng.gauss(0, 0.5) for _ in range(TOY_DIMS)]
    return write_bundle(
        out_dir,
        lexicon=lexicon,
        dims=TOY_DIMS,
        int8_rows=int8_rows,
        scales=scales,
        weights=weights,
        b_query=b_query,
        b_doc=b_doc,
        run_id='toy',
        corpus_id='fixture',
        verdict_status='FIXTURE',
    )


def _surface(rng: random.Random, key: str) -> str:
    """One way a writer might type a lexeme that folds back to `key`."""
    text = key
    roll = rng.random()
    if roll < 0.15:
        text = text.title()
    elif roll < 0.22:
        text = text.upper()
    if rng.random() < 0.3:
        chars = list(text)
        for i, c in enumerate(chars):
            options = DIACRITICS.get(c.lower())
            if options and rng.random() < 0.35:
                accented = rng.choice(options)
                chars[i] = accented.upper() if c.isupper() and accented.upper() != accented else accented
        text = ''.join(chars)
    if rng.random() < 0.08:
        # Decomposed: base letter + combining acute.
        text = ''.join(c + '́' if c in 'aeiou' and rng.random() < 0.5 else c for c in text)
    if rng.random() < 0.05:
        text = ''.join(chr(ord(c) + 0xFEE0) if 'a' <= c <= 'z' else c for c in text)
    if rng.random() < 0.1:
        for plain, ligature in LIGATURES.items():
            text = text.replace(plain, ligature)
    if ' ' in text and rng.random() < 0.3:
        text = text.replace(' ', rng.choice(SEPARATORS[:12]))
    return text


def _piece(rng: random.Random, keys: list[str]) -> str:
    roll = rng.random()
    if roll < 0.42:
        return _surface(rng, rng.choice(keys))
    if roll < 0.55:
        return rng.choice(STOP_SAMPLE)
    if roll < 0.63:
        return rng.choice(FILLER_WORDS)
    if roll < 0.70:
        # An unknown word: n-gram buckets.
        return ''.join(rng.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(rng.randint(2, 9)))
    if roll < 0.75:
        return str(rng.randint(0, 99999))
    if roll < 0.88:
        return rng.choice(STRESS_PIECES)
    lo, hi = rng.choice(RANDOM_RANGES)
    return ''.join(chr(rng.randint(lo, hi)) for _ in range(rng.randint(1, 3)))


def parity_strings(n: int = N_STRINGS, seed: int = SEED) -> list[str]:
    rng = random.Random(seed)
    keys = sorted(e.key for e in toy_entries()[0])
    # People strings exercise entity matching and document-local alias rewriting.
    people = sorted([*ENTITIES, *ALIASES])
    out = ['', ' ', 'the', 'The Pause', 'adaeze nwosu met adaeze', 'Tomáš Novák', 'ﬁnd', 'ＡＢ']
    while len(out) < n:
        k = rng.choice((1, 1, 2, 2, 3, 3, 4, 6)) if rng.random() > 0.01 else rng.randint(20, 40)
        pool = people if rng.random() < 0.05 else keys
        parts = []
        for _ in range(k):
            parts.append(_piece(rng, pool))
            parts.append(rng.choice(SEPARATORS))
        out.append(''.join(parts[:-1]))
    return out[:n]


def _gzip(text: str) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', compresslevel=9, mtime=0) as handle:
        handle.write(text.encode())
    return buffer.getvalue()


def stream_digest(stream: list[list[int]]) -> str:
    """First 8 hex chars of sha256 over 'row,kind,w0,w1;...' (lexemeEmbed.test.ts does the same)."""
    text = ';'.join(','.join(map(str, token)) for token in stream)
    return hashlib.sha256(text.encode()).hexdigest()[:8]


def parity_lines(bundle: Bundle, strings: list[str]) -> list[str]:
    """Header, then one record per string: {s, h, [q], [d]}.

    h is the digest of the query-mode stream; q (the full stream) is stored for the first
    N_FULL strings so a mismatch is readable, and d only when document mode differs from query
    mode (alias rewriting). Full streams for all 10k strings would be ~5 MB of bucket ids.
    """
    header = {
        'schema': PARITY_SCHEMA,
        'strings': len(strings),
        'seed': SEED,
        'full_streams': N_FULL,
        'lexicon_sha256': bundle.lexicon.sha256,
        'spec_sha256': bundle.lexicon.spec.sha256(),
        'token': ['row', 'kind', 'w0', 'w1'],
        'digest': 'sha256(row,kind,w0,w1;...)[:8]',
        'strings_sha256': hashlib.sha256('\x00'.join(strings).encode()).hexdigest(),
    }
    lines = [canonical_json(header)]
    tok = bundle.tokenizer
    for i, s in enumerate(strings):
        q = [t.parity() for t in tok.tokenize(s, 'query')]
        d = [t.parity() for t in tok.tokenize(s, 'document')]
        record: dict = {'s': s, 'h': stream_digest(q)}
        if i < N_FULL:
            record['q'] = q
        if d != q:
            record['d'] = d
        lines.append(json.dumps(record, ensure_ascii=False, separators=(',', ':')))
    return lines


def _f32_text(value: float) -> str:
    # float32 values round-trip through 9 significant digits.
    return format(struct.unpack('<f', struct.pack('<f', value))[0], '.9g')


def golden(bundle: Bundle, strings: list[str]) -> dict:
    cases = []
    for i, s in enumerate(strings[:N_GOLDEN]):
        q = bundle.embed(s, 'query')
        d = bundle.embed(s, 'document')
        cases.append(
            {
                'i': i,
                'q': [float(_f32_text(v)) for v in q.vector],
                'd': [float(_f32_text(v)) for v in d.vector],
                'alias_prompt': q.alias_prompt,
            }
        )
    return {
        'schema': GOLDEN_SCHEMA,
        'meta': META_NAME,
        'dims': bundle.dims,
        'bundle_sha256': {k: v['sha256'] for k, v in sorted(bundle.meta['files'].items())},
        'cases': cases,
    }


def build_fixtures(out_dir: Path = FIXTURE_DIR) -> dict[str, Path]:
    """Write toy/, parity.jsonl.gz and golden.json under out_dir; returns the paths written."""
    toy_dir = out_dir / 'toy'
    write_toy_bundle(toy_dir)
    bundle = Bundle(toy_dir / META_NAME)
    strings = parity_strings()
    parity = out_dir / 'parity.jsonl.gz'
    parity.write_bytes(_gzip('\n'.join(parity_lines(bundle, strings)) + '\n'))
    golden_path = out_dir / 'golden.json'
    golden_path.write_text(json.dumps(golden(bundle, strings), separators=(',', ':')) + '\n')
    return {'toy': toy_dir, 'parity': parity, 'golden': golden_path}


def read_parity(path: Path = FIXTURE_DIR / 'parity.jsonl.gz') -> tuple[dict, list[dict]]:
    # split('\n'), not splitlines(): strings may hold U+2028 and friends, which JSON leaves raw.
    lines = gzip.decompress(path.read_bytes()).decode().split('\n')
    return json.loads(lines[0]), [json.loads(line) for line in lines[1:] if line]


def stale_files(committed: Path, fresh: Path) -> list[str]:
    """Fixture files under `committed` that differ from a fresh build in `fresh`.

    parity.jsonl.gz is compared decompressed: gzip bytes vary with the zlib build.
    """
    stale = []
    for path in sorted(p for p in fresh.rglob('*') if p.is_file()):
        rel = path.relative_to(fresh)
        old = committed / rel
        if not old.is_file():
            stale.append(str(rel))
        elif path.suffix == '.gz':
            if gzip.decompress(old.read_bytes()) != gzip.decompress(path.read_bytes()):
                stale.append(str(rel))
        elif old.read_bytes() != path.read_bytes():
            stale.append(str(rel))
    return stale
