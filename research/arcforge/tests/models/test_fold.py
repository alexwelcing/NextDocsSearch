import re
import unicodedata
from pathlib import Path

import pytest

from arcforge.models import fixtures
from arcforge.models.fold import (
    LETTER_FOLDS,
    STOP_WORDS,
    fold,
    keep_word,
    normalized_tokens,
    words,
    words_with_offsets,
)

REPO = Path(__file__).resolve().parents[4]


def whole_string_words(text: str) -> list[str]:
    """The TS implementation, transcribed: whole-string fold (lexemeEmbed.ts foldLexemeText)."""
    if text.isascii():
        folded = text.lower()
    else:
        no_symbols = ''.join(' ' if unicodedata.category(c)[0] == 'S' else c for c in text)
        decomposed = unicodedata.normalize('NFKD', no_symbols)
        stripped = ''.join(c for c in decomposed if unicodedata.category(c)[0] != 'M')
        folded = ''.join(LETTER_FOLDS.get(c, c) for c in stripped.lower())
    return re.findall('[a-z0-9]+', folded)


@pytest.mark.parametrize(
    ('text', 'expected'),
    [
        ('Tomáš Tūhoe Solène', ['tomas', 'tuhoe', 'solene']),
        (
            'straße ÆTHER Øresund Łódź Þórr Đorđe',
            ['strasse', 'aether', 'oresund', 'lodz', 'thorr', 'dorde'],
        ),
        ('ﬁnd ＦＵＬＬ e\u0301te ½', ['find', 'full', 'ete', '1', '2']),
        ('Pro™max', ['pro', 'max']),
        ('İstanbul KelvinK', ['istanbul', 'kelvink']),
        ('The pause, a B-plan', ['the', 'pause', 'a', 'b', 'plan']),
        ('Σοφία 東京 😀', []),
        ('', []),
    ],
)
def test_words(text, expected):
    assert words(text) == expected


def test_ascii_fold_only_lowercases():
    assert fold('Plain ASCII, Only') == 'plain ascii, only'


def test_per_character_fold_equals_whole_string_fold_on_parity_strings():
    for text in fixtures.parity_strings():
        assert words(text) == whole_string_words(text), text


def test_offsets_cover_each_word():
    for text in fixtures.parity_strings()[:3000]:
        spans = words_with_offsets(text)
        assert [w for w, _, _ in spans] == words(text)
        previous_end = 0
        for word, start, end in spans:
            assert previous_end <= start < end <= len(text)
            assert word in words(text[start:end])
            previous_end = start


def test_offsets_include_trailing_marks():
    text = 'cafe\u0301 ok'
    assert words_with_offsets(text) == [('cafe', 0, 5), ('ok', 6, 8)]


def test_keep_word_is_the_site_filter():
    assert not keep_word('a') and not keep_word('the') and not keep_word('they')
    assert keep_word('ai') and keep_word('pause')
    assert normalized_tokens('The pause is a threshold') == ['pause', 'threshold']


def test_stop_words_match_the_site():
    """The stop list is lib/retrieval's (on main it lives in lib/archive/search.ts)."""
    for rel in ('lib/retrieval/tokenize.ts', 'lib/archive/search.ts'):
        path = REPO / rel
        if path.is_file():
            match = re.search(r'stopWords = new Set\(\[(.*?)\]\)', path.read_text(), re.S)
            if match:
                site = set(re.findall(r"'([a-z]+)'", match.group(1)))
                assert site == set(STOP_WORDS)
                return
    pytest.skip('site tokenizer not in this checkout')
