import json
from collections import Counter
from pathlib import Path

from arcforge.models import payload
from arcforge.models.bundle import META_NAME, Bundle
from arcforge.models.lexicon import Kind

SMALL = payload.PlannedShape(
    rows=3000,
    dims=16,
    buckets=256,
    corpus_words=1500,
    multiwords=200,
    entities=20,
    aliases=5,
    general_words=2000,  # more than the leftover rows, so they share rows
    vector_set_rows=10,
)
RECORDS = Path(__file__).resolve().parents[4] / 'public' / 'arc' / 'records'


def test_planned_shape_without_a_corpus(tmp_path):
    report = payload.build_and_measure(tmp_path, shape=SMALL)
    bundle = Bundle(tmp_path / META_NAME)
    assert bundle.rows == SMALL.rows and bundle.dims == SMALL.dims
    assert report['shape']['bucket_base'] == SMALL.rows - SMALL.buckets
    kinds = report['lexicon']['by_kind']
    assert kinds['word'] == SMALL.corpus_words and kinds['multiword'] == SMALL.multiwords
    assert kinds['general'] == SMALL.general_words
    sizes = report['files']
    assert sizes['vectors']['raw'] == SMALL.rows * SMALL.dims
    assert sizes['scales']['raw'] == sizes['weights']['raw'] == 2 * SMALL.rows
    assert sizes['bias']['raw'] == 2 * 2 * SMALL.dims
    assert report['bundle']['raw_bytes'] == sum(f['raw'] for f in sizes.values())
    assert report['bundle']['pass'] is True
    assert report['vector_set']['raw'] == SMALL.vector_set_rows * (SMALL.dims + 4)


def test_general_words_share_the_leftover_rows(tmp_path):
    planned = payload.planned_lexicon(
        records_dir=None, general_vocab=None, shape=SMALL, rng=__import__('random').Random(1)
    )
    general_rows = Counter(e.row for e in planned.entries if e.kind == Kind.GENERAL)
    others = {e.row for e in planned.entries if e.kind != Kind.GENERAL}
    assert not others & set(general_rows)
    assert max(general_rows.values()) >= 2
    assert max(e.row for e in planned.entries) < planned.bucket_base


def test_deterministic(tmp_path):
    a = payload.build_and_measure(tmp_path / 'a', shape=SMALL)
    b = payload.build_and_measure(tmp_path / 'b', shape=SMALL)
    assert a == b
    assert (tmp_path / 'a' / 'lexicon.bin').read_bytes() == (
        tmp_path / 'b' / 'lexicon.bin'
    ).read_bytes()


def test_mine_vocabulary():
    texts = [
        'Marcus Chen saw the pause.',
        'Marcus Chen and the pause again',
        'the pause, the pause',
    ]
    vocab = payload.mine_vocabulary(texts, SMALL)
    assert vocab['words'][0] == 'pause'
    assert 'marcus chen' in vocab['names']
    assert 'marcus chen' not in vocab['multiwords']


def test_general_words_from_a_bpe_vocab(tmp_path):
    vocab = {
        'Ġthe': 0,
        'Ġhouse': 1,
        'ĠHouse': 2,
        'water': 3,
        'Ġriver': 4,
        'Ġx': 5,
        'Ġcafé': 6,
        'Ġlight': 7,
    }
    path = tmp_path / 'vocab.json'
    path.write_text(json.dumps(vocab))
    assert payload.general_words_from_bpe_vocab(path, 2, {'river'}) == ['house', 'light']


def test_corpus_texts_reads_records():
    if not RECORDS.is_dir():
        return
    texts = list(payload.corpus_texts(RECORDS))
    assert len(texts) > 1000 and all(isinstance(t, str) for t in texts)
