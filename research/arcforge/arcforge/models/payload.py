"""Model-bundle payload measurement at the planned shape (M1: 'a payload size and gzip
measurement on real files'; the size condition shared by H1, M3 and M5: <= 4.0 MB raw).

The planned bundle (program.shipping, MODEL BUNDLE): 27,000 rows × 128 int8 with fp16 row
scales, lexicon.bin, weights.f16 and b_query/b_doc. Rows: 4,096 n-gram buckets, one row per
corpus word (about 16.9k), multiword lexeme (about 2.5k), person entity and shared-name alias,
and the remainder for 10k general-English words, which share rows after k-means vocabulary
quantization. This module builds a toy bundle of exactly that shape from the real corpus
vocabulary (public/arc/records) and a real general-word list, writes the real files with
bundle.write_bundle, and measures each one raw and gzipped (level 9). Vectors are random unit
rows quantized per row, as a trained table would be; int8 rows barely compress either way.

MB here is 10^6 bytes, the unit the program's figures use (27k × 128 = 3.456 MB).
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import random
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from arcforge.models.bundle import META_NAME, quantize_row, write_bundle
from arcforge.models.fold import STOP_WORDS, keep_word, words
from arcforge.models.lexicon import Kind, LexiconEntry, TokenizerSpec, build_lexicon

TARGET_RAW_MB = 4.0
MB = 1_000_000


@dataclass(frozen=True)
class PlannedShape:
    rows: int = 27_000
    dims: int = 128
    buckets: int = 4096
    corpus_words: int = 16_900
    multiwords: int = 2_500
    entities: int = 300
    aliases: int = 100
    general_words: int = 10_000
    vector_set_rows: int = 2_521  # chunks × (dims + 4 B scale): data/search/arc-lexeme.d128.bin


def corpus_texts(records_dir: Path) -> Iterable[str]:
    """Every block of every public/arc/records/<slug>.json, titles included, in slug order."""
    for path in sorted(Path(records_dir).glob('*.json')):
        record = json.loads(path.read_text())
        yield str(record.get('title', ''))
        for block in record.get('blocks', []):
            if isinstance(block, dict) and isinstance(block.get('x'), str):
                yield block['x']


def mine_vocabulary(texts: Iterable[str], shape: PlannedShape) -> dict[str, list[str]]:
    """Corpus words, multiword candidates and name-like bigrams by frequency (ties by text).

    A stand-in for S3's mining (NPMI-validated multiwords, the owner's person map): only the
    byte shape of the lexicon matters here.
    """
    word_counts: Counter[str] = Counter()
    gram_counts: Counter[str] = Counter()
    name_counts: Counter[str] = Counter()
    for text in texts:
        ws = words(text)
        word_counts.update(w for w in ws if keep_word(w))
        for n in (2, 3):
            for i in range(len(ws) - n + 1):
                gram = ws[i : i + n]
                if keep_word(gram[0]) and keep_word(gram[-1]):
                    gram_counts[' '.join(gram)] += 1
        raw = text.split()
        for a, b in zip(raw, raw[1:]):
            if a[:1].isupper() and b[:1].isupper() and a.isalpha() and b.isalpha():
                key = ' '.join(words(f'{a} {b}'))
                if key.count(' ') == 1 and all(keep_word(w) for w in key.split()):
                    name_counts[key] += 1

    def top(counter: Counter[str], n: int, exclude: set[str] = set()) -> list[str]:
        ranked = sorted((k for k in counter if k not in exclude), key=lambda k: (-counter[k], k))
        return ranked[:n]

    names = top(name_counts, shape.entities)
    multiwords = top(gram_counts, shape.multiwords, exclude=set(names))
    return {'words': top(word_counts, shape.corpus_words), 'multiwords': multiwords, 'names': names}


def general_words_from_bpe_vocab(vocab_json: Path, n: int, exclude: set[str]) -> list[str]:
    """General English from a byte-level BPE vocab (e.g. Qwen's vocab.json): space-prefixed
    lowercase alphabetic tokens in id order, which follows merge order and so frequency."""
    vocab: dict[str, int] = json.loads(Path(vocab_json).read_text())
    out: list[str] = []
    for token, _ in sorted(vocab.items(), key=lambda item: item[1]):
        if not token.startswith('Ġ'):
            continue
        word = token[1:]
        if word.isascii() and word.isalpha() and word.islower() and keep_word(word) and word not in exclude:
            out.append(word)
            exclude.add(word)
            if len(out) == n:
                break
    return out


def pseudo_words(n: int, lengths: list[int], rng: random.Random, exclude: set[str]) -> list[str]:
    """Deterministic pseudo-words with the corpus's word-length distribution (no word list)."""
    out: list[str] = []
    while len(out) < n:
        word = ''.join(rng.choice('etaoinshrdlcumwfgypbvk') for _ in range(rng.choice(lengths)))
        if keep_word(word) and word not in exclude:
            exclude.add(word)
            out.append(word)
    return out


def planned_entries(
    vocabulary: dict[str, list[str]], general: list[str], shape: PlannedShape
) -> tuple[list[LexiconEntry], int]:
    """Lexicon entries of the planned shape; returns (entries, bucket_base)."""
    bucket_base = shape.rows - shape.buckets
    entries: list[LexiconEntry] = []
    row = 0
    taken: set[str] = set()

    def add(key: str, kind: Kind, r: int, candidates: tuple[int, ...] = ()) -> bool:
        if key in taken:
            return False
        taken.add(key)
        entries.append(LexiconEntry(key, kind, r, candidates))
        return True

    for word in vocabulary['words']:
        if add(word, Kind.WORD, row):
            row += 1
    for key in vocabulary['multiwords']:
        if add(key, Kind.MULTIWORD, row):
            row += 1
    by_first: dict[str, list[int]] = {}
    for key in vocabulary['names']:
        if add(key, Kind.ENTITY, row):
            by_first.setdefault(key.split()[0], []).append(row)
            row += 1
    aliases = 0
    for first, rows in sorted(by_first.items()):
        if aliases == shape.aliases:
            break
        if first in taken:
            continue  # a corpus word already; S3 would decide which row the bare name gets
        if len(rows) >= 2 and add(first, Kind.ALIAS, row, tuple(rows)):
            row += 1
            aliases += 1
    remaining = bucket_base - row
    if remaining <= 0:
        raise ValueError(f'payload: {row} lexeme rows leave no room under bucket_base {bucket_base}')
    general = [w for w in general if w not in taken]
    for i, word in enumerate(general):
        # Vocabulary quantization: general words share the remaining rows round-robin.
        add(word, Kind.GENERAL, row + i % remaining)
    return entries, bucket_base


def random_unit_rows(rows: int, dims: int, rng: random.Random) -> tuple[bytes, list[float]]:
    data = bytearray()
    scales: list[float] = []
    for _ in range(rows):
        v = [rng.gauss(0.0, 1.0) for _ in range(dims)]
        norm = math.sqrt(sum(x * x for x in v))
        q, scale = quantize_row([x / norm for x in v])
        data.extend(x & 0xFF for x in q)
        scales.append(scale)
    return bytes(data), scales


def _gz(data: bytes) -> int:
    return len(gzip.compress(data, compresslevel=9, mtime=0))


def measure_files(paths: dict[str, Path]) -> dict[str, dict[str, int]]:
    out = {}
    for name, path in sorted(paths.items()):
        data = path.read_bytes()
        out[name] = {'raw': len(data), 'gzip': _gz(data)}
    return out


@dataclass
class PlannedLexicon:
    lexicon: bytes
    entries: list[LexiconEntry]
    bucket_base: int
    corpus_id: str
    sources: dict[str, str]


def planned_lexicon(
    *,
    records_dir: Path | None,
    general_vocab: Path | None,
    shape: PlannedShape,
    rng: random.Random,
) -> PlannedLexicon:
    """A lexicon of exactly the planned shape from the real corpus vocabulary, padded with
    pseudo-words where the corpus (or the general word list) runs short."""
    texts = list(corpus_texts(records_dir)) if records_dir else []
    vocabulary = mine_vocabulary(texts, shape) if texts else {'words': [], 'multiwords': [], 'names': []}
    taken = set(vocabulary['words']) | set(STOP_WORDS)
    lengths = [len(w) for w in vocabulary['words']] or [4, 5, 6, 7, 8, 9, 10]
    missing = shape.corpus_words - len(vocabulary['words'])
    if missing > 0:
        vocabulary['words'] += pseudo_words(missing, lengths, rng, taken)
    multiwords = set(vocabulary['multiwords'])
    while len(multiwords) < shape.multiwords:
        multiwords.add(f'{rng.choice(vocabulary["words"])} {rng.choice(vocabulary["words"])}')
    if len(multiwords) > len(vocabulary['multiwords']):
        vocabulary['multiwords'] = sorted(multiwords)
    taken |= set(vocabulary['words'])
    general = general_words_from_bpe_vocab(general_vocab, shape.general_words, set(taken)) if general_vocab else []
    if len(general) < shape.general_words:
        general += pseudo_words(shape.general_words - len(general), lengths, rng, taken | set(general))
    entries, bucket_base = planned_entries(vocabulary, general, shape)
    return PlannedLexicon(
        lexicon=build_lexicon(entries, bucket_base=bucket_base, spec=TokenizerSpec(buckets=shape.buckets)),
        entries=entries,
        bucket_base=bucket_base,
        corpus_id=hashlib.sha256('\x00'.join(texts).encode()).hexdigest() if texts else 'synthetic',
        sources={
            'corpus': f'{records_dir} ({len(texts)} blocks)' if texts else 'none (pseudo-words)',
            'general_words': f'{Path(general_vocab).name} (BPE id order)' if general_vocab else 'pseudo-words',
        },
    )


def build_and_measure(
    out_dir: Path,
    *,
    records_dir: Path | None = None,
    general_vocab: Path | None = None,
    shape: PlannedShape = PlannedShape(),
    seed: int = 1729,
) -> dict:
    """Write the planned-shape bundle to out_dir and measure every file raw and gzipped."""
    rng = random.Random(seed)
    planned = planned_lexicon(records_dir=records_dir, general_vocab=general_vocab, shape=shape, rng=rng)
    int8_rows, scales = random_unit_rows(shape.rows, shape.dims, rng)
    meta = write_bundle(
        out_dir,
        lexicon=planned.lexicon,
        dims=shape.dims,
        int8_rows=int8_rows,
        scales=scales,
        weights=[math.exp(rng.gauss(0.0, 0.3)) for _ in range(shape.rows)],
        b_query=[rng.gauss(0.0, 0.1) for _ in range(shape.dims)],
        b_doc=[rng.gauss(0.0, 0.1) for _ in range(shape.dims)],
        run_id='m1-payload',
        corpus_id=planned.corpus_id,
        verdict_status='MEASUREMENT',
    )
    files = {key: out_dir / entry['path'] for key, entry in meta['files'].items()}
    files['meta'] = out_dir / META_NAME
    sizes = measure_files(files)
    # The chunk vector set the run PR commits beside the bundle (int8 rows + f32 scales).
    vector_set, _ = random_unit_rows(shape.vector_set_rows, shape.dims, rng)
    vector_set += bytes(4 * shape.vector_set_rows)
    raw = sum(v['raw'] for v in sizes.values())
    gz = sum(v['gzip'] for v in sizes.values())
    entries = planned.entries
    kinds = Counter(Kind(e.kind).name.lower() for e in entries)
    return {
        'shape': {**shape.__dict__, 'bucket_base': planned.bucket_base},
        'sources': planned.sources,
        'lexicon': {
            'entries': len(entries),
            'by_kind': dict(sorted(kinds.items())),
            'mean_key_bytes': round(sum(len(e.key) for e in entries) / len(entries), 2),
            'bytes_per_entry': round(sizes['lexicon']['raw'] / len(entries), 2),
        },
        'files': sizes,
        'bundle': {
            'raw_bytes': raw,
            'gzip_bytes': gz,
            'raw_mb': round(raw / MB, 4),
            'gzip_mb': round(gz / MB, 4),
            'target_raw_mb': TARGET_RAW_MB,
            'pass': raw <= TARGET_RAW_MB * MB,
        },
        'vector_set': {'rows': shape.vector_set_rows, 'raw': len(vector_set), 'gzip': _gz(vector_set)},
    }
