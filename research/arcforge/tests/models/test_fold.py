import re
from pathlib import Path

import pytest

from arcforge.models import fixtures
from arcforge.models.fold import (
    STOP_WORDS,
    fold,
    keep_word,
    normalized_tokens,
    utf16_len,
    words,
    words_with_offsets,
)

REPO = Path(__file__).resolve().parents[4]


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
        ('İstanbul Kelvin\u212a', ['istanbul', 'kelvink']),
        ('The pause, a B-plan', ['the', 'pause', 'a', 'b', 'plan']),
        # Letters and digits of any script, as in the site tokenizer.
        ('Σοφία 東京 😀', ['σοφια', '東京']),
        # Lowercased as a whole, like JavaScript: a final capital sigma becomes 'ς'.
        ('ΟΔΟΣ ΣΑΣ.', ['οδος', 'σας']),
        ('\U0001d400\U0001d401 ꟹ', ['ab', 'oe']),
        ('', []),
    ],
)
def test_words(text, expected):
    assert words(text) == expected


def test_ascii_fold_only_lowercases():
    assert fold('Plain ASCII, Only') == 'plain ascii, only'


def test_offset_words_equal_words_on_parity_strings():
    for text in fixtures.parity_strings():
        assert [w for w, _, _ in words_with_offsets(text)] == words(text), text


def test_offsets_cover_each_word():
    for text in fixtures.parity_strings()[:3000]:
        spans = words_with_offsets(text)
        assert [w for w, _, _ in spans] == words(text)
        previous_end = 0
        for word, start, end in spans:
            assert previous_end <= start < end <= len(text)
            # Out of context a final sigma may lowercase differently ('ΣΑΣ' alone ends in ς).
            assert word.replace('ς', 'σ') in [w.replace('ς', 'σ') for w in words(text[start:end])]
            previous_end = start


def test_offsets_include_trailing_marks():
    text = 'cafe\u0301 ok'
    assert words_with_offsets(text) == [('cafe', 0, 5), ('ok', 6, 8)]


def test_keep_word_is_the_site_filter():
    assert not keep_word('a') and not keep_word('the') and not keep_word('they')
    assert keep_word('ai') and keep_word('pause')
    assert normalized_tokens('The pause is a threshold') == ['pause', 'threshold']
    # JavaScript counts UTF-16 units: one astral letter is two, a BMP letter one.
    assert utf16_len('\U00020000') == 2 and keep_word('\U00020000')
    assert not keep_word('東')


def test_stop_words_match_the_site():
    """The stop list is lib/retrieval/tokenize.ts's (before M0 it lived in lib/archive/search.ts)."""
    for rel in ('lib/retrieval/tokenize.ts', 'lib/archive/search.ts'):
        path = REPO / rel
        if path.is_file():
            match = re.search(r'stopWords = new Set\(\[(.*?)\]\)', path.read_text(), re.S)
            if match:
                site = set(re.findall(r"'([a-z]+)'", match.group(1)))
                assert site == set(STOP_WORDS)
                return
    pytest.skip('site tokenizer not in this checkout')
