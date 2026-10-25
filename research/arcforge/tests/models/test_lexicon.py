import struct

import pytest

from arcforge.models.lexicon import (
    MAGIC,
    Kind,
    Lexicon,
    LexiconEntry,
    TokenizerSpec,
    _read_varint,
    _varint,
    build_lexicon,
    canonical_key,
)

ENTRIES = [
    LexiconEntry('pause', Kind.WORD, 0),
    LexiconEntry('the pause', Kind.MULTIWORD, 1),
    LexiconEntry('adaeze nwosu', Kind.ENTITY, 2),
    LexiconEntry('adaeze okonkwo', Kind.ENTITY, 3),
    LexiconEntry('adaeze', Kind.ALIAS, 4, (2, 3)),
    LexiconEntry('house', Kind.GENERAL, 5),
    LexiconEntry('home', Kind.GENERAL, 5),
    LexiconEntry('a to z', Kind.MULTIWORD, 6),
    LexiconEntry('zuri', Kind.WORD, 70_000),
]


def build(entries=ENTRIES, **kw):
    return build_lexicon(entries, bucket_base=kw.pop('bucket_base', 100_000), **kw)


@pytest.mark.parametrize('block_size', [1, 2, 3, 16, 255])
def test_round_trip(block_size):
    lexicon = Lexicon(build(block_size=block_size))
    assert len(lexicon) == len(ENTRIES)
    for entry in ENTRIES:
        assert lexicon.get(entry.key) == entry
    assert lexicon.get('missing') is None
    assert lexicon.max_words == 3
    assert lexicon.rows == 100_000 + 4096
    assert lexicon.header['blocks'] == -(-len(ENTRIES) // block_size)


def test_bytes_are_deterministic_and_order_independent():
    assert build() == build(list(reversed(ENTRIES)))
    assert build().startswith(MAGIC)


def test_header_is_aligned():
    data = build()
    (header_len,) = struct.unpack_from('<I', data, 8)
    assert (12 + header_len) % 4 == 0


def test_spec_hash_names_the_rules():
    assert TokenizerSpec().sha256() == TokenizerSpec().sha256()
    assert TokenizerSpec(buckets=257).sha256() != TokenizerSpec().sha256()
    assert Lexicon(build(spec=TokenizerSpec(buckets=257))).spec.buckets == 257


@pytest.mark.parametrize(
    ('entry', 'error'),
    [
        (LexiconEntry('Pause', Kind.WORD, 9), 'canonical'),
        (LexiconEntry('the  pause', Kind.MULTIWORD, 9), 'canonical'),
        (LexiconEntry('the', Kind.WORD, 9), 'filtered'),
        (LexiconEntry('x', Kind.WORD, 9), 'filtered'),
        (LexiconEntry('solo', Kind.MULTIWORD, 9), 'one word'),
        (LexiconEntry('far', Kind.WORD, 100_000), 'outside'),
        (LexiconEntry('priya', Kind.ALIAS, 9), 'entity rows'),
        (LexiconEntry('priya', Kind.ALIAS, 9, (0,)), 'entity rows'),
        (LexiconEntry('priya', Kind.WORD, 9, (2,)), 'only alias'),
        (LexiconEntry('pause', Kind.WORD, 9), 'duplicate'),
        (LexiconEntry('gram', Kind.BUCKET, 9), 'bucket'),
        (LexiconEntry('a' * 256, Kind.WORD, 9), 'bytes'),
    ],
)
def test_validation(entry, error):
    with pytest.raises(ValueError, match=error):
        build([*ENTRIES, entry])


def test_canonical_key():
    assert canonical_key('The  Pause!') == 'the pause'
    assert canonical_key('Tomáš Novák') == 'tomas novak'


@pytest.mark.parametrize('value', [0, 1, 127, 128, 16_383, 16_384, 2**31])
def test_varint(value):
    encoded = _varint(value)
    assert _read_varint(encoded, 0) == (value, len(encoded))


def test_rejects_corrupt_files():
    data = build()
    with pytest.raises(ValueError, match='magic'):
        Lexicon(b'XXXXXXXX' + data[8:])
    with pytest.raises(ValueError, match='truncated'):
        Lexicon(data[:-1])
    with pytest.raises(ValueError, match='truncated'):
        Lexicon(data + b'\x00')
