import pytest

from arcforge.models.lexicon import Kind, Lexicon, LexiconEntry, TokenizerSpec, build_lexicon
from arcforge.models.tokenizer import LexemeTokenizer, fnv1a32, ngram_buckets

ENTRIES = [
    LexiconEntry('pause', Kind.WORD, 0),
    LexiconEntry('the pause', Kind.MULTIWORD, 1),
    LexiconEntry('hands of the commons', Kind.MULTIWORD, 2),
    LexiconEntry('commons', Kind.WORD, 3),
    LexiconEntry('adaeze nwosu', Kind.ENTITY, 4),
    LexiconEntry('adaeze okonkwo', Kind.ENTITY, 5),
    LexiconEntry('adaeze', Kind.ALIAS, 6, (4, 5)),
]
SPEC = TokenizerSpec(buckets=97)
TOK = LexemeTokenizer(Lexicon(build_lexicon(ENTRIES, bucket_base=10, spec=SPEC)))


def rows(text, mode='query', aliases=None):
    return [(t.row, t.kind) for t in TOK.tokenize(text, mode, aliases)]


def test_fnv1a32_reference_values():
    assert fnv1a32(b'') == 0x811C9DC5
    assert fnv1a32(b'a') == 0xE40C292C
    assert fnv1a32(b'foobar') == 0xBF9CF968


def test_ngram_buckets():
    # '<mail>': 4 trigrams, 3 four-grams, 2 five-grams.
    buckets = ngram_buckets('mail', SPEC)
    assert len(buckets) == 9 and all(0 <= b < 97 for b in buckets)
    assert buckets[0] == fnv1a32(b'<ma') % 97
    assert ngram_buckets('mail', TokenizerSpec(buckets=0)) == []


def test_longest_match_wins():
    assert rows('Hands of the Commons') == [(2, Kind.MULTIWORD)]
    assert rows('the commons') == [(3, Kind.WORD)]
    assert rows('The Pause') == [(1, Kind.MULTIWORD)]
    assert rows('a pause') == [(0, Kind.WORD)]


def test_stop_words_and_single_characters_are_dropped():
    assert rows('the of a b') == []


def test_unknown_words_hash_to_buckets_that_count_once():
    tokens = TOK.tokenize('pause xyzzy')
    buckets = [t for t in tokens if t.kind == Kind.BUCKET]
    assert all(10 <= t.row < 10 + 97 and (t.w0, t.w1) == (1, 2) for t in buckets)
    assert sum(t.weight for t in buckets) == pytest.approx(1.0)


def test_aliases_by_mode():
    text = 'Adaeze Nwosu met Adaeze Okonkwo. Later: Adaeze'
    assert rows(text, 'query')[-1] == (6, Kind.ALIAS)
    # The most recently mentioned candidate wins in a document ...
    assert rows(text, 'document')[-1] == (5, Kind.ENTITY)
    # ... unless the person map says who the bare name means here.
    assert rows(text, 'document', {6: 4})[-1] == (4, Kind.ENTITY)
    assert rows('Adaeze, by the', 'document') == [(6, Kind.ALIAS)]
    # A rewritten alias counts as a mention.
    assert rows('Adaeze Okonkwo, Adaeze Nwosu, Adaeze', 'document', {6: 5})[-1] == (5, Kind.ENTITY)


def test_offsets_point_into_the_original_text():
    text = 'Before THE PAUSÉ, after'
    token = next(t for t in TOK.tokenize(text) if t.kind == Kind.MULTIWORD)
    assert text[token.start : token.end] == 'THE PAUSÉ'
    assert (token.w0, token.w1) == (1, 3)


def test_mode_is_checked():
    with pytest.raises(ValueError, match='mode'):
        TOK.tokenize('pause', 'doc')  # type: ignore[arg-type]
