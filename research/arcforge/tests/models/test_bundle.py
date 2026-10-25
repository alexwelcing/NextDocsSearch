import json
import math

import pytest

from arcforge.models.bundle import (
    META_NAME,
    Bundle,
    f16_round,
    pack_f16,
    quantize_row,
    quantize_rows,
    unpack_f16,
    write_bundle,
)
from arcforge.models.lexicon import Kind, LexiconEntry, TokenizerSpec, build_lexicon

DIMS = 4
ENTRIES = [
    LexiconEntry('pause', Kind.WORD, 0),
    LexiconEntry('commons', Kind.WORD, 1),
    LexiconEntry('empty', Kind.WORD, 2),
    LexiconEntry('adaeze nwosu', Kind.ENTITY, 3),
    LexiconEntry('adaeze okonkwo', Kind.ENTITY, 4),
    LexiconEntry('adaeze', Kind.ALIAS, 5, (3, 4)),
]
SPEC = TokenizerSpec(buckets=7)


def table(rows):
    return [[(r + 1) * (d + 1) * (-1) ** d * 0.1 for d in range(DIMS)] for r in range(rows)]


def make(tmp_path, pooling='sum', weights=True):
    lexicon = build_lexicon(ENTRIES, bucket_base=6, spec=SPEC)
    rows = 6 + 7
    t = table(rows)
    t[2] = [0.0] * DIMS
    int8_rows, scales = quantize_rows(t)
    write_bundle(
        tmp_path,
        lexicon=lexicon,
        dims=DIMS,
        int8_rows=int8_rows,
        scales=scales,
        weights=[1.0 + r / 10 for r in range(rows)] if weights else None,
        b_query=[0.5, 0, 0, 0],
        b_doc=[0, 0.5, 0, 0],
        run_id='t',
        corpus_id='c',
        verdict_status='TEST',
        pooling=pooling,
    )
    return Bundle(tmp_path / META_NAME)


def test_f16():
    assert f16_round(1.0) == 1.0
    assert f16_round(0.1) == pytest.approx(0.1, rel=1e-3)
    assert f16_round(1e6) == math.inf and f16_round(-1e6) == -math.inf
    assert unpack_f16(pack_f16([1.0, -2.0, 65504.0])) == [1.0, -2.0, 65504.0]


def test_quantize_row():
    q, scale = quantize_row([1.0, -0.5, 0.25])
    assert scale == f16_round(1 / 127) and q[0] == 127
    assert max(abs(a - b * scale) for a, b in zip([1.0, -0.5, 0.25], q)) <= scale / 2
    assert quantize_row([0.0, 0.0]) == ([0, 0], 0.0)
    with pytest.raises(ValueError, match='non-finite'):
        quantize_row([1.0, math.nan])
    with pytest.raises(ValueError, match='overflows'):
        quantize_row([1e10])


def test_round_trip_and_meta(tmp_path):
    bundle = make(tmp_path)
    meta = json.loads((tmp_path / META_NAME).read_text())
    assert meta['model'] == 'arc-lexeme@t' and meta['rows'] == 13 and meta['dims'] == DIMS
    assert set(meta['files']) == {'lexicon', 'vectors', 'scales', 'weights', 'bias'}
    assert bundle.scales[2] == 0
    assert bundle.b_doc == [0, 0.5, 0, 0]


def test_tampered_files_are_refused(tmp_path):
    make(tmp_path)
    path = tmp_path / 'scales.f16'
    data = bytearray(path.read_bytes())
    data[0] ^= 1
    path.write_bytes(bytes(data))
    with pytest.raises(ValueError, match='does not match'):
        Bundle(tmp_path / META_NAME)


def test_embed_is_unit_length_and_deterministic(tmp_path):
    bundle = make(tmp_path)
    a = bundle.embed('pause and commons')
    assert math.isclose(math.sqrt(sum(v * v for v in a.vector)), 1.0, rel_tol=1e-6)
    assert a.vector == bundle.embed('Pause and Commons!').vector
    assert a.vector != bundle.embed('pause and commons', 'document').vector


def test_embed_matches_the_formula(tmp_path):
    bundle = make(tmp_path)
    got = bundle.embed('pause commons').vector
    acc = list(bundle.b_query)
    for row in (0, 1):
        for d in range(DIMS):
            acc[d] += bundle.weights[row] * bundle.scales[row] * bundle.vectors[row * DIMS + d]
    norm = math.sqrt(sum(v * v for v in acc))
    assert got == pytest.approx([v / norm for v in acc], abs=1e-7)


def test_nothing_to_look_up_embeds_to_zeros(tmp_path):
    bundle = make(tmp_path)
    for text in ('', 'the and of', 'empty'):
        assert bundle.embed(text).vector == [0.0] * DIMS


def test_mean_pooling_and_no_weights(tmp_path):
    bundle = make(tmp_path, pooling='mean', weights=False)
    assert bundle.weights is None
    got = bundle.embed('pause commons').vector
    acc = [0.0] * DIMS
    for row in (0, 1):
        for d in range(DIMS):
            acc[d] += bundle.scales[row] * bundle.vectors[row * DIMS + d]
    acc = [a / 2 + b for a, b in zip(acc, bundle.b_query)]
    norm = math.sqrt(sum(v * v for v in acc))
    assert got == pytest.approx([v / norm for v in acc], abs=1e-7)


def test_alias_prompt(tmp_path):
    bundle = make(tmp_path)
    assert bundle.embed('who is adaeze').alias_prompt
    assert not bundle.embed('adaeze nwosu').alias_prompt
    assert not bundle.embed('adaeze nwosu and adaeze', 'document').alias_prompt


def test_write_bundle_checks_shapes(tmp_path):
    lexicon = build_lexicon(ENTRIES, bucket_base=6, spec=SPEC)
    with pytest.raises(ValueError, match='int8 values'):
        write_bundle(
            tmp_path,
            lexicon=lexicon,
            dims=DIMS,
            int8_rows=b'\x00',
            scales=[0.0] * 13,
            b_query=[0.0] * DIMS,
            b_doc=[0.0] * DIMS,
            run_id='t',
            corpus_id='c',
            verdict_status='T',
        )
    with pytest.raises(ValueError, match='pooling'):
        write_bundle(
            tmp_path,
            lexicon=lexicon,
            dims=DIMS,
            int8_rows=bytes(13 * DIMS),
            scales=[0.0] * 13,
            b_query=[0.0] * DIMS,
            b_doc=[0.0] * DIMS,
            run_id='t',
            corpus_id='c',
            verdict_status='T',
            pooling='max',
        )  # type: ignore[arg-type]
