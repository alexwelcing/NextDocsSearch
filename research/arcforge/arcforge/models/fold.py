"""The lexeme tokenizer's pre-tokenization: the site's (lib/retrieval/tokenize.ts, archive-v2).

1. fold, exactly foldText: an ASCII text is only lowercased. Otherwise every symbol (category
   S*) becomes a space, the text is NFKD-decomposed, combining marks (M*) are dropped, it is
   lowercased as a whole (so Greek final sigma follows the same rule as JavaScript's
   toLowerCase), and the Latin letters with no decomposition are spelled the way they are typed
   (ß→ss, æ→ae, ...): 'Tomáš', 'Tūhoe' and 'Solène' read 'tomas', 'tuhoe', 'solene'.
2. split, exactly normalizedTokens: words are runs of letters and digits of any script
   ([^\\p{L}\\p{N}]+ separates them).

Unlike normalizedTokens, words() keeps stop words and one-character words: multiword lexemes
('the pause') span them. The tokenizer applies the site's filter (2+ characters, not a stop
word) only to single-word candidates, so its single-word stream is normalizedTokens exactly.
'Characters' there are UTF-16 code units, as JavaScript counts them, so one astral letter
passes the filter; keep_word() counts the same way.

lib/archive/lexemeEmbed.ts calls the site's foldText itself; the parity fixture holds this
module to it. words_with_offsets() also folds one code point at a time (like the site's
foldWithOffsets) to map every word back to its span in the original text.
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

# The site tokenizer this mirrors (lib/retrieval/tokenize.ts TOKENIZER_VERSION).
SITE_TOKENIZER = 'archive-v2'
SPLIT_PATTERN = '[^\\p{L}\\p{N}]+'
MIN_WORD = 2

# lib/retrieval/tokenize.ts stopWords, verbatim (tests/models/test_fold.py compares them).
STOP_WORDS: frozenset[str] = frozenset(
    'am an as at be by do he if in is it me my no of on or so to up we the and for with that '
    'this from into your have what about would there their them then when where which while '
    'were been will just like than they'.split()
)

# Latin letters with no Unicode decomposition (LETTER_FOLDS in lib/retrieval/tokenize.ts).
LETTER_FOLDS: dict[str, str] = {
    'ß': 'ss',
    'æ': 'ae',
    'œ': 'oe',
    'ø': 'o',
    'ł': 'l',
    'đ': 'd',
    'ð': 'd',
    'þ': 'th',
    'ı': 'i',
}

_ASCII_WORD = re.compile('[a-z0-9]+')


@lru_cache(maxsize=65536)
def _category(char: str) -> str:
    return unicodedata.category(char)


def _is_word_char(char: str) -> bool:
    return _category(char)[0] in 'LN'


@lru_cache(maxsize=65536)
def fold_char(char: str) -> str:
    """One code point folded on its own (possibly empty, possibly several characters)."""
    if char < '\x80':
        return char.lower()
    if _category(char)[0] == 'S':
        return ' '
    decomposed = unicodedata.normalize('NFKD', char)
    stripped = ''.join(c for c in decomposed if _category(c)[0] != 'M')
    return ''.join(LETTER_FOLDS.get(c, c) for c in stripped.lower())


def fold(text: str) -> str:
    """The search form of a text: lib/retrieval/tokenize.ts foldText."""
    if text.isascii():
        return text.lower()
    no_symbols = ''.join(' ' if _category(c)[0] == 'S' else c for c in text)
    decomposed = unicodedata.normalize('NFKD', no_symbols)
    stripped = ''.join(c for c in decomposed if _category(c)[0] != 'M')
    return ''.join(LETTER_FOLDS.get(c, c) for c in stripped.lower())


def _runs(folded: str) -> list[tuple[int, int]]:
    """[start, end) of every run of letters and digits."""
    runs = []
    start = -1
    for i, char in enumerate(folded):
        if _is_word_char(char):
            if start < 0:
                start = i
        elif start >= 0:
            runs.append((start, i))
            start = -1
    if start >= 0:
        runs.append((start, len(folded)))
    return runs


def words(text: str) -> list[str]:
    """Every word of the folded text, stop words and single characters included."""
    if text.isascii():
        return _ASCII_WORD.findall(text.lower())
    folded = fold(text)
    return [folded[a:b] for a, b in _runs(folded)]


def words_with_offsets(text: str) -> list[tuple[str, int, int]]:
    """words() with each word's [start, end) span in `text`, in code points.

    A span covers every source character that contributed to the word, so a folded expansion
    ('ﬁ' → 'fi') or a dropped mark ('é' typed as 'e' + U+0301) stays inside it. The positions
    come from folding one code point at a time, the text from fold(): the two have the same
    length (NFKD only reorders the marks both drop; lowercasing keeps lengths once NFKD has
    split 'İ'), and differ at most in a final sigma.
    """
    if text.isascii():
        return [(m.group(), m.start(), m.end()) for m in _ASCII_WORD.finditer(text.lower())]
    pieces: list[str] = []
    source: list[int] = []
    for index, char in enumerate(text):
        piece = fold_char(char)
        pieces.append(piece)
        source.extend([index] * len(piece))
    per_char = ''.join(pieces)
    folded = fold(text)
    if len(folded) != len(per_char):  # not reachable for assigned characters; stay correct
        folded = per_char
    out: list[tuple[str, int, int]] = []
    for a, b in _runs(per_char):
        start, end = source[a], source[b - 1] + 1
        # Marks that fold to nothing belong to the letter before them.
        while end < len(text) and fold_char(text[end]) == '':
            end += 1
        out.append((folded[a:b], start, end))
    return out


def utf16_len(word: str) -> int:
    """Length as JavaScript counts it (UTF-16 code units)."""
    return len(word) if word.isascii() else len(word.encode('utf-16-le')) // 2


def keep_word(word: str) -> bool:
    """The site's single-word filter: 2+ characters (UTF-16 units) and not a stop word."""
    return utf16_len(word) >= MIN_WORD and word not in STOP_WORDS


def normalized_tokens(text: str) -> list[str]:
    """lib/retrieval normalizedTokens: the tokenizer's single-word stream."""
    return [w for w in words(text) if keep_word(w)]
