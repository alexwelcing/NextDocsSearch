import os
import subprocess
import sys
from pathlib import Path

import pytest

from arcforge.core import dag
from arcforge.core.cache import (
    CacheConflict,
    CacheCorrupt,
    CacheError,
    GCSBackend,
    LocalBackend,
    Store,
    open_backend,
)
from arcforge.core.config import ARCFORGE_ROOT, load_config
from arcforge.core.dag import (
    Stage,
    StageContext,
    StageError,
    StageNotImplemented,
    key_material,
    stage_key,
)
from arcforge.core.hashing import sha256_bytes
from arcforge.core.pipeline import compute
from arcforge.core.stages import REGISTRY

PROGRAM_STAGES = [
    'S0',
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
    'S7',
    'S8',
    'S9',
    'S10',
    'S11',
    'S12',
    'S13',
    'S13b',
    'S14',
]


def test_registry_names_every_program_stage_in_dependency_order():
    assert [n for n in REGISTRY if n.startswith('S')] == PROGRAM_STAGES
    assert set(REGISTRY) - set(PROGRAM_STAGES) == {'gate', 'tail'}
    order = dag.toposort(REGISTRY)
    for name, stage in REGISTRY.items():
        assert all(order.index(i) < order.index(name) for i in stage.inputs)


def test_only_s0_and_s1_are_real_and_every_stub_says_what_it_reads_and_writes():
    assert [n for n, s in REGISTRY.items() if s.implemented] == ['S0', 'S1']
    config = load_config('r00')
    for name, stage in REGISTRY.items():
        if stage.implemented:
            continue
        assert stage.outputs, name
        with pytest.raises(StageNotImplemented) as raised:
            compute(stage, StageContext(stage, config, None))
        message = str(raised.value)
        assert 'not implemented' in message and stage.outputs[0] in message
        assert ('inputs:  ' + ', '.join(stage.inputs)) in message


def test_toposort_and_closure_reject_cycles_and_unknown_stages():
    a = Stage('A', 'a', 'prep', 'laptop', inputs=('B',))
    b = Stage('B', 'b', 'prep', 'laptop', inputs=('A',))
    with pytest.raises(ValueError, match='cycle'):
        dag.toposort({'A': a, 'B': b})
    with pytest.raises(ValueError, match='unknown stage'):
        dag.toposort({'A': a})
    assert dag.closure(REGISTRY, ['S1']) == ['S0', 'S1']
    assert dag.closure(REGISTRY, ['S7']) == ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S7']
    with pytest.raises(ValueError, match='unknown stage'):
        dag.closure(REGISTRY, ['S99'])


def _key(stage, config, inputs=None, external=None, code='c' * 64):
    digests = inputs if inputs is not None else {i: '0' * 64 for i in stage.inputs}
    return stage_key(key_material(stage, config, digests, external or {}, code=code))


def test_every_key_ingredient_moves_the_key():
    config = load_config('r00')
    s0, s4, s5 = REGISTRY['S0'], REGISTRY['S4'], REGISTRY['S5']
    base4 = _key(s4, config)
    assert _key(s4, config, code='d' * 64) != base4  # code hash
    assert _key(s4, config, inputs={'S1': '1' * 64, 'S3': '0' * 64}) != base4  # input digest
    assert _key(s4, load_config('r00', {'teacher.revision': 'a' * 40})) != base4  # model revision
    assert _key(s4, load_config('r00', {'teacher.prompts.query': 'q: '})) != base4  # prompt sha
    assert _key(s4, load_config('r00', {'lexicon.npmi': 0.6})) == base4  # outside its subtree
    base5 = _key(s5, config)
    assert _key(s5, load_config('r00', {'run.seed': 7})) != base5  # seed, seeded stage
    assert _key(s5, load_config('r00', {'queries.per_chunk': 7})) != base5  # config subtree
    base0 = _key(s0, config, external={'corpus': 'e' * 64})
    assert _key(s0, config, external={'corpus': 'f' * 64}) != base0  # external fingerprint
    # A seed-free stage, and config outside its subtree, leave the key alone.
    assert _key(s0, load_config('r00', {'run.seed': 7}), external={'corpus': 'e' * 64}) == base0
    assert (
        _key(s0, load_config('r00', {'budget.contingency': 0.2}), external={'corpus': 'e' * 64})
        == base0
    )


def test_key_material_names_its_fields():
    material = key_material(REGISTRY['S1'], load_config('r00'), {'S0': '0' * 64}, {}, code='c' * 64)
    assert set(material) == {
        'schema',
        'stage',
        'code',
        'config',
        'inputs',
        'model',
        'prompts',
        'seed',
    }
    assert material['config'] == {
        'corpus.rename_map': {
            'threshold-03-the-blacksmiths-choice': 'threshold-03-the-weight-of-the-hammer'
        },
        'corpus.ghosts_by_default': ['inheritance-03-the-gesture-archive'],
        'lexicon.min_count': 3,
    }
    assert material['seed'] is None and material['prompts'] is None


def test_code_hash_follows_the_source_files():
    stage = REGISTRY['S1']
    assert dag.stage_code_hash(stage) == dag.stage_code_hash(stage)
    assert dag.code_hash(['arcforge.core.hashing']) != dag.code_hash(['arcforge.core.corpus'])
    with pytest.raises(StageError):
        dag.code_hash(['arcforge.no_such_module'])


def test_a_stage_reads_only_the_config_in_its_key():
    ctx = StageContext(REGISTRY['S1'], load_config('r00'), None)
    assert ctx.cfg('lexicon.min_count') == 3
    assert ctx.cfg('corpus.rename_map.threshold-03-the-blacksmiths-choice')
    with pytest.raises(StageError, match='not in its key'):
        ctx.cfg('lexicon.npmi')
    with pytest.raises(StageError, match='not an input'):
        ctx.input_bytes('S2', 'cards.jsonl')


def test_compute_checks_declared_outputs():
    bad = Stage('X', 'x', 'prep', 'laptop', outputs=('a.json',), run=lambda ctx: {'b.json': b''})
    with pytest.raises(StageError, match='declares'):
        compute(bad, StageContext(bad, load_config('r00'), None))
    text = Stage('Y', 'y', 'prep', 'laptop', outputs=('a.json',), run=lambda ctx: {'a.json': 'str'})
    with pytest.raises(StageError, match='not bytes'):
        compute(text, StageContext(text, load_config('r00'), None))


# --- cache -----------------------------------------------------------------------------------


def test_local_store_objects_records_and_manifests(tmp_path):
    store = Store(LocalBackend(tmp_path))
    digest = store.put_object(b'hello')
    assert digest == sha256_bytes(b'hello') and store.get_object(digest) == b'hello'
    assert store.put_object(b'hello') == digest  # idempotent
    record = {'stage': 'S0', 'key': 'k' * 64, 'outputs': {}, 'digest': 'd' * 64}
    store.put_record(record)
    store.put_record(dict(record))  # same bytes: fine
    with pytest.raises(CacheConflict, match='not deterministic'):
        store.put_record(dict(record, digest='e' * 64))
    assert store.get_record('S0', 'k' * 64) == record
    assert store.get_record('S0', 'x' * 64) is None
    first = store.put_manifest('r00', b'{"a":1}\n')
    second = store.put_manifest('r00', b'{"a":2}\n')
    assert store.get_manifest('r00') == b'{"a":2}\n'
    assert store.get_manifest('r00', first) == b'{"a":1}\n' and first != second
    with pytest.raises(CacheError, match='no run manifest'):
        store.get_manifest('r01')


def test_local_store_detects_corruption_and_bad_paths(tmp_path):
    store = Store(LocalBackend(tmp_path))
    digest = store.put_object(b'payload')
    (tmp_path / store.object_path(digest)).write_bytes(b'tampered')
    with pytest.raises(CacheCorrupt):
        store.get_object(digest)
    with pytest.raises(CacheError, match='missing'):
        store.get_object('0' * 64)
    with pytest.raises(CacheError, match='bad cache path'):
        LocalBackend(tmp_path).read('../escape')
    assert LocalBackend(tmp_path).list('objects') == [store.object_path(digest)]


class _HTTPError(Exception):
    def __init__(self, code):
        super().__init__(f'HTTP {code}')
        self.code = code


class FakeBlob:
    def __init__(self, bucket, name):
        self.bucket, self.name = bucket, name

    def download_as_bytes(self):
        if self.name not in self.bucket.objects:
            raise _HTTPError(404)
        return self.bucket.objects[self.name]

    def upload_from_string(self, data, content_type=None, if_generation_match=None):
        if if_generation_match == 0 and self.name in self.bucket.objects:
            raise _HTTPError(412)
        self.bucket.objects[self.name] = bytes(data)
        self.bucket.content_types[self.name] = content_type


class FakeBucket:
    def __init__(self, name):
        self.name, self.objects, self.content_types = name, {}, {}

    def blob(self, name):
        return FakeBlob(self, name)


class FakeClient:
    def __init__(self):
        self.buckets = {}

    def bucket(self, name):
        return self.buckets.setdefault(name, FakeBucket(name))

    def list_blobs(self, bucket_name, prefix=''):
        return [
            FakeBlob(self.buckets[bucket_name], n)
            for n in sorted(self.buckets[bucket_name].objects)
            if n.startswith(prefix)
        ]


def test_gcs_backend_semantics_with_a_fake_client():
    client = FakeClient()
    backend = open_backend('gs://witching-606c6-arcforge/cache', client=client)
    assert isinstance(backend, GCSBackend) and backend.url == 'gs://witching-606c6-arcforge/cache'
    assert backend.read('objects/aa/missing') is None
    assert backend.write('runs/r00/x.json', b'1', create_only=True) is True
    assert backend.write('runs/r00/x.json', b'2', create_only=True) is False
    assert backend.write('runs/r00/latest', b'3', create_only=False) is True
    bucket = client.buckets['witching-606c6-arcforge']
    assert bucket.objects['cache/runs/r00/x.json'] == b'1'
    assert bucket.content_types['cache/runs/r00/x.json'] == 'application/json'
    assert backend.list('runs/') == ['runs/r00/latest', 'runs/r00/x.json']
    store = Store(backend)
    digest = store.put_object(b'artifact')
    assert store.get_object(digest) == b'artifact'
    store.put_record({'stage': 'S1', 'key': 'k' * 64, 'outputs': {}, 'digest': 'd' * 64})
    with pytest.raises(CacheConflict):
        store.put_record({'stage': 'S1', 'key': 'k' * 64, 'outputs': {}, 'digest': 'e' * 64})


def test_gcs_backend_surfaces_other_errors():
    class Forbidden(FakeBlob):
        def download_as_bytes(self):
            raise _HTTPError(403)

    client = FakeClient()
    bucket = client.bucket('b')
    bucket.blob = lambda name: Forbidden(bucket, name)
    with pytest.raises(_HTTPError):
        GCSBackend('b', 'p', client=client).read('x')


def test_open_backend_defaults_to_a_local_directory(tmp_path, monkeypatch):
    monkeypatch.setenv('ARCFORGE_CACHE', str(tmp_path / 'c'))
    backend = open_backend()
    assert isinstance(backend, LocalBackend) and backend.root == tmp_path / 'c'
    with pytest.raises(CacheError, match='bad GCS url'):
        open_backend('gs:///nobucket')


CORE_MODULES = [
    'arcforge.core.hashing',
    'arcforge.core.config',
    'arcforge.core.prices',
    'arcforge.core.budget',
    'arcforge.core.dag',
    'arcforge.core.cache',
    'arcforge.core.corpus',
    'arcforge.core.pipeline',
    'arcforge.core.executor',
    'arcforge.core.verify',
    'arcforge.core.diffing',
    'arcforge.core.cliutil',
    'arcforge.core.stages',
]


def test_core_imports_only_the_standard_library_at_top_level():
    """Command modules import from core, so core must load under a bare python3 -S."""
    code = (
        'import sys\n'
        + ''.join(f'import {m}\n' for m in CORE_MODULES)
        + (
            "bad = [m for m in ('yaml', 'jsonschema', 'google') if m in sys.modules]\n"
            'assert not bad, bad\n'
        )
    )
    env = {**os.environ, 'PYTHONPATH': str(ARCFORGE_ROOT)}
    out = subprocess.run(
        [sys.executable, '-S', '-c', code], env=env, capture_output=True, text=True
    )
    assert out.returncode == 0, out.stderr


def test_cache_paths_are_stable():
    """The layout is shared with the runner VM and the GCS cache; changing it orphans the cache."""
    assert Store.object_path('ab' + '0' * 62) == f'objects/ab/ab{"0" * 62}'
    assert Store.record_path('S0', 'k') == 'stages/S0/k.json'
    assert Path(Store.record_path('S13b', 'k')).parent.name == 'S13b'
