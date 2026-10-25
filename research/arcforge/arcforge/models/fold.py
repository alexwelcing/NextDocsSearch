"""The lexeme tokenizer's pre-tokenization: fold, then split into words.

This is the site's pre-tokenization (lib/retrieval/tokenize.ts) plus M0's NFKD fold:

1. fold: an ASCII string is only lowercased. Otherwise every symbol (Unicode category S*)
   becomes a space, the text is NFKD-decomposed, combining marks (M*) are dropped, it is
   lowercased, and the Latin letters with no decomposition are spelled the way they are typed
   (ß→ss, æ→ae, ...), so 'Tomáš', 'Tūhoe' and 'Solène' read 'tomas', 'tuhoe', 'solene'.
2. split on [^a-z0-9]+, exactly as normalizedTokens on main does.

Unlike normalizedTokens, words() keeps stop words and one-character words: multiword lexemes
('the pause') span them. The tokenizer applies the site's filter (2+ characters, not a stop
word) only to single-word candidates, so its single-word stream equals normalizedTokens on
folded text. lib/archive/lexemeEmbed.ts implements the same rules; the parity fixture holds
them together.

Folding is defined per code point (fold_char) so that character offsets into the original text
survive; for every input whose words are ASCII it equals the TS whole-string fold. The two can
only differ on letters that stay non-ASCII after folding (Greek final sigma, say), and those
never reach a word because the split is ASCII-only.
"""

from __future__ import annotations

import re
import unicodedata
from functools import lru_cache

FOLD_VERSION = 'nfkd-strip-marks/1'
SPLIT_PATTERN = '[^a-z0-9]+'
MIN_WORD = 2

# lib/archive/search.ts stopWords on main, verbatim (the TS parity test checks the folded word
# stream against the site's normalizedTokens).
STOP_WORDS: frozenset[str] = frozenset(
    'am an as at be by do he if in is it me my no of on or so to up we the and for with that '
    'this from into your have what about would there their them then when where which while '
    'were been will just like than they'.split()
)

# Latin letters with no Unicode decomposition (M0's LETTER_FOLDS in lib/retrieval/tokenize.ts).
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

_WORD = re.compile('[a-z0-9]+')


@lru_cache(maxsize=65536)
def fold_char(char: str) -> str:
    """The folded form of one code point (possibly empty, possibly several characters)."""
    if char < '\x80':
        return char.lower()
    if unicodedata.category(char)[0] == 'S':
        return ' '
    decomposed = unicodedata.normalize('NFKD', char)
    stripped = ''.join(c for c in decomposed if unicodedata.category(c)[0] != 'M')
    return ''.join(LETTER_FOLDS.get(c, c) for c in stripped.lower())


def fold(text: str) -> str:
    """The search form of a text (see the module docstring)."""
    if text.isascii():
        return text.lower()
    return ''.join(fold_char(c) for c in text)


def words(text: str) -> list[str]:
    """Every [a-z0-9]+ run of the folded text, stop words and single characters included."""
    return _WORD.findall(fold(text))


def words_with_offsets(text: str) -> list[tuple[str, int, int]]:
    """words() with each word's [start, end) span in `text`, in code points.

    A span covers every source character that contributed to the word, so a folded expansion
    ('ﬁ' → 'fi') or a dropped mark ('é' typed as 'e' + U+0301) stays inside it.
    """
    if text.isascii():
        return [(m.group(), m.start(), m.end()) for m in _WORD.finditer(text.lower())]
    folded: list[str] = []
    source: list[int] = []
    for index, char in enumerate(text):
        piece = fold_char(char)
        folded.append(piece)
        source.extend([index] * len(piece))
    out: list[tuple[str, int, int]] = []
    for m in _WORD.finditer(''.join(folded)):
        start, last = source[m.start()], source[m.end() - 1]
        # Marks that fold to nothing belong to the letter before them.
        end = last + 1
        while end < len(text) and fold_char(text[end]) == '':
            end += 1
        out.append((m.group(), start, end))
    return out


def keep_word(word: str) -> bool:
    """The site's single-word filter: 2+ characters and not a stop word."""
    return len(word) >= MIN_WORD and word not in STOP_WORDS


def normalized_tokens(text: str) -> list[str]:
    """lib/retrieval normalizedTokens on folded text: the tokenizer's single-word stream."""
    return [w for w in words(text) if keep_word(w)]
