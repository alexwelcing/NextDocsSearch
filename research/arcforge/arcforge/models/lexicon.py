"""lexicon.bin: the arc-lexeme lexicon, a front-coded sorted key table read in place.

A key is a lexeme in canonical form: its fold.words() joined by single spaces, stored as
UTF-8 and sorted bytewise (the archive's keys are almost all ASCII; the TS side compares the
same bytes). Sorted keys are an implicit trie (every trie node is a contiguous key range), so
the table is the program's "flat trie read in place": the TS side binary-searches the block
heads and decodes one block, with no load-time index.

Layout (little-endian):

    b'ARCLEX01'                       magic, 8 bytes
    u32 header_len                    then header_len bytes of UTF-8 JSON, space-padded to 4
    u32 block_offsets[blocks + 1]     byte offsets of each block into the entry data
    entry data

Each block holds `block_size` entries. An entry is

    u8 shared, u8 suffix_len, suffix bytes    key = previous key[:shared] + suffix (shared = 0
                                              for a block's first entry, its head)
    u8 kind                                   Kind below
    varint row                                LEB128
    [varint n, varint × n entity rows]        alias entries only: the person rows a bare name
                                              can mean, for document-local alias rewriting

The header carries the tokenizer spec (stop words, n-gram buckets: everything the matcher
needs besides the code), so both runtimes read the rules from the file and the spec hash names
them. Rows [0, bucket_base) are lexeme rows; [bucket_base, rows) are the hashed n-gram buckets.
"""

from __future__ import annotations

import hashlib
import json
import struct
from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import IntEnum

from arcforge.models.fold import (
    MIN_WORD,
    SITE_TOKENIZER,
    SPLIT_PATTERN,
    STOP_WORDS,
    utf16_len,
    words,
)

MAGIC = b'ARCLEX01'
FORMAT = 'arc-lexicon/1'
TOKENIZER_VERSION = 'arc-lexeme-tok/1'
MAX_KEY_BYTES = 255


class Kind(IntEnum):
    """What a lexicon row is. BUCKET rows are hashed n-grams and have no lexicon entry."""

    WORD = 0  # a corpus word
    GENERAL = 1  # a general-English word (rows may be shared after vocabulary quantization)
    MULTIWORD = 2  # a mined multiword lexeme ('calibration sickness', 'the pause')
    ENTITY = 3  # one person from the person map ('adaeze nwosu')
    ALIAS = 4  # a bare name shared by several people ('adaeze'): raises the ALIAS PROMPT
    BUCKET = 5  # a hashed character n-gram of an out-of-lexicon word


KIND_NAMES = {kind: kind.name.lower() for kind in Kind}


@dataclass(frozen=True)
class TokenizerSpec:
    """The matching rules a lexicon was built for; spec_sha256() names them."""

    stop_words: tuple[str, ...] = tuple(sorted(STOP_WORDS))
    min_word: int = MIN_WORD
    ngram_min: int = 3
    ngram_max: int = 5
    buckets: int = 4096

    def to_json(self) -> dict:
        return {
            'version': TOKENIZER_VERSION,
            'fold': SITE_TOKENIZER,
            'split': SPLIT_PATTERN,
            'min_word': self.min_word,
            'stop_words': list(self.stop_words),
            'ngrams': {
                'min': self.ngram_min,
                'max': self.ngram_max,
                'buckets': self.buckets,
                'hash': 'fnv1a32',
                'pad': ['<', '>'],
            },
        }

    @classmethod
    def from_json(cls, value: dict) -> TokenizerSpec:
        if value.get('version') != TOKENIZER_VERSION or value.get('fold') != SITE_TOKENIZER:
            raise ValueError(
                f'lexicon: unsupported tokenizer {value.get("version")}/{value.get("fold")}'
            )
        if value.get('split') != SPLIT_PATTERN:
            raise ValueError(f'lexicon: unsupported split {value.get("split")!r}')
        ngrams = value['ngrams']
        if ngrams.get('hash') != 'fnv1a32' or ngrams.get('pad') != ['<', '>']:
            raise ValueError('lexicon: unsupported n-gram hashing')
        return cls(
            stop_words=tuple(value['stop_words']),
            min_word=int(value['min_word']),
            ngram_min=int(ngrams['min']),
            ngram_max=int(ngrams['max']),
            buckets=int(ngrams['buckets']),
        )

    def sha256(self) -> str:
        return hashlib.sha256(canonical_json(self.to_json()).encode()).hexdigest()


DEFAULT_SPEC = TokenizerSpec()


@dataclass(frozen=True)
class LexiconEntry:
    key: str
    kind: Kind
    row: int
    candidates: tuple[int, ...] = field(default=())


def canonical_json(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True)


def canonical_key(text: str) -> str:
    """The lexicon key of a surface form: its folded words joined by single spaces."""
    return ' '.join(words(text))


def _varint(value: int) -> bytes:
    if value < 0:
        raise ValueError('varint: negative value')
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def _read_varint(data: bytes | memoryview, pos: int) -> tuple[int, int]:
    value = shift = 0
    while True:
        byte = data[pos]
        pos += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, pos
        shift += 7
        if shift > 35:
            raise ValueError('lexicon: varint too long')


def _shared_prefix(a: bytes, b: bytes) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def validate_entries(entries: list[LexiconEntry], spec: TokenizerSpec, bucket_base: int) -> None:
    """Reject anything the matcher could not reach or the TS side could not decode."""
    stop = set(spec.stop_words)
    seen: set[str] = set()
    entity_rows = {e.row for e in entries if e.kind == Kind.ENTITY}
    for entry in entries:
        key = entry.key
        if key in seen:
            raise ValueError(f'lexicon: duplicate key {key!r}')
        seen.add(key)
        if canonical_key(key) != key or not key:
            raise ValueError(
                f'lexicon: key {key!r} is not canonical (fold + split + single spaces)'
            )
        if len(key.encode()) > MAX_KEY_BYTES:
            raise ValueError(f'lexicon: key {key[:40]!r}... is over {MAX_KEY_BYTES} bytes')
        n_words = key.count(' ') + 1
        if entry.kind == Kind.BUCKET:
            raise ValueError(f'lexicon: {key!r}: bucket rows have no lexicon entry')
        if entry.kind == Kind.MULTIWORD and n_words < 2:
            raise ValueError(f'lexicon: multiword {key!r} has one word')
        if n_words == 1 and not (utf16_len(key) >= spec.min_word and key not in stop):
            raise ValueError(f'lexicon: single word {key!r} is filtered by the site tokenizer')
        if not 0 <= entry.row < bucket_base:
            raise ValueError(f'lexicon: {key!r}: row {entry.row} outside [0, {bucket_base})')
        if entry.kind == Kind.ALIAS:
            if not entry.candidates or any(r not in entity_rows for r in entry.candidates):
                raise ValueError(f'lexicon: alias {key!r} must list entity rows')
        elif entry.candidates:
            raise ValueError(f'lexicon: only alias entries carry candidates ({key!r})')


def build_lexicon(
    entries: Iterable[LexiconEntry],
    *,
    bucket_base: int,
    spec: TokenizerSpec = DEFAULT_SPEC,
    block_size: int = 16,
) -> bytes:
    """Serialize entries (any order) into lexicon.bin bytes; deterministic for a given input."""
    ordered = sorted(entries, key=lambda e: e.key.encode())
    validate_entries(ordered, spec, bucket_base)
    if not 1 <= block_size <= 255:
        raise ValueError('lexicon: block_size must be 1..255')
    data = bytearray()
    offsets: list[int] = []
    previous = b''
    for index, entry in enumerate(ordered):
        key = entry.key.encode()
        if index % block_size == 0:
            offsets.append(len(data))
            shared = 0
        else:
            shared = _shared_prefix(previous, key)
        suffix = key[shared:]
        data += (
            bytes([shared, len(suffix)]) + suffix + bytes([int(entry.kind)]) + _varint(entry.row)
        )
        if entry.kind == Kind.ALIAS:
            data += _varint(len(entry.candidates))
            for row in entry.candidates:
                data += _varint(row)
        previous = key
    offsets.append(len(data))
    header = {
        'format': FORMAT,
        'spec': spec.to_json(),
        'spec_sha256': spec.sha256(),
        'entries': len(ordered),
        'blocks': len(offsets) - 1,
        'block_size': block_size,
        'bucket_base': bucket_base,
        'rows': bucket_base + spec.buckets,
        'max_words': max((e.key.count(' ') + 1 for e in ordered), default=1),
    }
    header_bytes = canonical_json(header).encode()
    header_bytes += b' ' * (-(len(header_bytes)) % 4)
    return (
        MAGIC
        + struct.pack('<I', len(header_bytes))
        + header_bytes
        + struct.pack(f'<{len(offsets)}I', *offsets)
        + bytes(data)
    )


class Lexicon:
    """A parsed lexicon.bin. Python decodes it once into a dict; the TS side reads it in place."""

    def __init__(self, data: bytes):
        if data[:8] != MAGIC:
            raise ValueError('lexicon: bad magic')
        (header_len,) = struct.unpack_from('<I', data, 8)
        header = json.loads(data[12 : 12 + header_len].decode())
        if header.get('format') != FORMAT:
            raise ValueError(f'lexicon: unsupported format {header.get("format")!r}')
        self.header = header
        self.spec = TokenizerSpec.from_json(header['spec'])
        if self.spec.sha256() != header['spec_sha256']:
            raise ValueError('lexicon: spec hash does not match its spec')
        self.bucket_base: int = header['bucket_base']
        self.rows: int = header['rows']
        self.max_words: int = header['max_words']
        self.sha256 = hashlib.sha256(data).hexdigest()
        blocks = header['blocks']
        start = 12 + header_len
        offsets = struct.unpack_from(f'<{blocks + 1}I', data, start)
        base = start + 4 * (blocks + 1)
        if base + offsets[-1] != len(data):
            raise ValueError('lexicon: truncated or padded entry data')
        self.entries: dict[str, LexiconEntry] = {}
        view = memoryview(data)
        for block in range(blocks):
            pos, end = base + offsets[block], base + offsets[block + 1]
            key = b''
            while pos < end:
                shared, suffix_len = view[pos], view[pos + 1]
                pos += 2
                key = key[:shared] + bytes(view[pos : pos + suffix_len])
                pos += suffix_len
                kind = Kind(view[pos])
                row, pos = _read_varint(view, pos + 1)
                candidates: tuple[int, ...] = ()
                if kind == Kind.ALIAS:
                    n, pos = _read_varint(view, pos)
                    rows = []
                    for _ in range(n):
                        r, pos = _read_varint(view, pos)
                        rows.append(r)
                    candidates = tuple(rows)
                text = key.decode('utf-8')
                self.entries[text] = LexiconEntry(text, kind, row, candidates)
        if len(self.entries) != header['entries']:
            raise ValueError('lexicon: entry count does not match the header')

    def get(self, key: str) -> LexiconEntry | None:
        return self.entries.get(key)

    def __len__(self) -> int:
        return len(self.entries)

    @classmethod
    def from_file(cls, path) -> Lexicon:
        with open(path, 'rb') as handle:
            return cls(handle.read())
