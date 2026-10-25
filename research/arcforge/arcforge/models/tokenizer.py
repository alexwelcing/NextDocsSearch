"""The arc-lexeme tokenizer: greedy longest match over a lexicon (Python twin of lexemeEmbed.ts).

Over fold.words(text), left to right:

1. the longest multiword key (2..max_words words) starting at this word, if any;
2. otherwise the word itself, if it passes the site filter (2+ characters, not a stop word):
   its lexicon row when it has one, else the hashed code-point 3-5-grams of '<word>', each
   weighted 1/k so an unknown word counts once;
3. otherwise (a stop word or a single character) nothing.

Entity keys are ordinary keys of kind ENTITY. A bare name shared by several people is an ALIAS
key: in 'query' mode it yields its alias row (the exposure-weighted mean of those people, which
raises the ALIAS PROMPT); in 'document' mode it is rewritten to whichever of its people was
mentioned most recently in the same text (document-local alias rewriting), if any. A caller
that knows who a document's bare names mean (the person map) passes them as `aliases`
{alias row: entity row}, which wins over the recency rule.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from arcforge.models.fold import utf16_len, words_with_offsets
from arcforge.models.lexicon import Kind, Lexicon, TokenizerSpec

Mode = Literal['query', 'document']

FNV_OFFSET = 0x811C9DC5
FNV_PRIME = 0x01000193


@dataclass(frozen=True)
class Token:
    row: int
    kind: Kind
    # [w0, w1): the words of fold.words(text) this token covers.
    w0: int
    w1: int
    # 1.0, or 1/k for each of an unknown word's k n-gram buckets.
    weight: float
    # [start, end): the span in the original text, in code points (Python only).
    start: int
    end: int

    def parity(self) -> list[int]:
        """The fields the TS side must reproduce exactly."""
        return [self.row, int(self.kind), self.w0, self.w1]


def fnv1a32(data: bytes) -> int:
    h = FNV_OFFSET
    for byte in data:
        h = ((h ^ byte) * FNV_PRIME) & 0xFFFFFFFF
    return h


def ngram_buckets(word: str, spec: TokenizerSpec) -> list[int]:
    """Bucket indexes of the code-point n-grams of '<word>' (each hashed as UTF-8), by n then
    position."""
    if spec.buckets <= 0:
        return []
    padded = f'<{word}>'
    out: list[int] = []
    for n in range(spec.ngram_min, spec.ngram_max + 1):
        for i in range(len(padded) - n + 1):
            out.append(fnv1a32(padded[i : i + n].encode()) % spec.buckets)
    return out


class LexemeTokenizer:
    def __init__(self, lexicon: Lexicon):
        self.lexicon = lexicon
        self.spec = lexicon.spec
        self._stop = frozenset(self.spec.stop_words)

    def keep(self, word: str) -> bool:
        return utf16_len(word) >= self.spec.min_word and word not in self._stop

    def tokenize(
        self, text: str, mode: Mode = 'query', aliases: Mapping[int, int] | None = None
    ) -> list[Token]:
        if mode not in ('query', 'document'):
            raise ValueError(f'tokenize: mode must be query or document, not {mode!r}')
        spans = words_with_offsets(text)
        ws = [w for w, _, _ in spans]
        n = len(ws)
        lexicon = self.lexicon
        out: list[Token] = []
        last_seen: dict[int, int] = {}  # entity row -> order of its latest mention (document)
        mentions = 0
        i = 0
        while i < n:
            entry = None
            length = 1
            for length in range(min(lexicon.max_words, n - i), 1, -1):
                entry = lexicon.get(' '.join(ws[i : i + length]))
                if entry is not None:
                    break
            else:
                length = 1
                entry = lexicon.get(ws[i]) if self.keep(ws[i]) else None
            start, end = spans[i][1], spans[i + length - 1][2]
            if entry is not None:
                row, kind = entry.row, entry.kind
                if mode == 'document':
                    if kind == Kind.ALIAS:
                        seen = [r for r in entry.candidates if r in last_seen]
                        if aliases and row in aliases:
                            row, kind = aliases[row], Kind.ENTITY
                        elif seen:
                            row, kind = max(seen, key=last_seen.__getitem__), Kind.ENTITY
                    if kind == Kind.ENTITY:
                        mentions += 1
                        last_seen[row] = mentions
                out.append(Token(row, kind, i, i + length, 1.0, start, end))
            elif self.keep(ws[i]):
                buckets = ngram_buckets(ws[i], self.spec)
                weight = 1.0 / len(buckets) if buckets else 0.0
                base = lexicon.bucket_base
                out.extend(
                    Token(base + b, Kind.BUCKET, i, i + 1, weight, start, end) for b in buckets
                )
            i += length
        return out
