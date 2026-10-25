import json
import os

import pytest

from arcforge.owner import store
from arcforge.owner.store import Conflict, DocStore, read_json, write_json_atomic

DEFAULTS = {'notes': ('notes.json', lambda: {'schema': 'arc-owner-notes/1', 'items': []})}


def test_atomic_write_leaves_no_temp_files_and_is_private(tmp_path):
    path = tmp_path / 'a' / 'doc.json'
    write_json_atomic(path, {'b': 1, 'a': 'é'})
    assert json.loads(path.read_text()) == {'b': 1, 'a': 'é'}
    assert path.read_text().endswith('\n') and '"é"' in path.read_text()
    assert os.stat(path).st_mode & 0o777 == 0o600
    assert [p.name for p in path.parent.iterdir()] == ['doc.json']


def test_a_failed_write_keeps_the_old_file(tmp_path, monkeypatch):
    path = tmp_path / 'doc.json'
    write_json_atomic(path, {'v': 1})

    def boom(*_args):
        raise OSError('disk full')

    monkeypatch.setattr(store.os, 'replace', boom)
    with pytest.raises(OSError):
        write_json_atomic(path, {'v': 2})
    assert read_json(path) == {'v': 1}
    assert [p.name for p in tmp_path.iterdir()] == ['doc.json']


def test_new_parent_folders_are_private(tmp_path):
    (tmp_path / 'shared').mkdir(mode=0o755)
    write_json_atomic(tmp_path / 'shared' / 'a' / 'b' / 'doc.json', {})
    assert os.stat(tmp_path / 'shared' / 'a').st_mode & 0o777 == 0o700
    assert os.stat(tmp_path / 'shared' / 'a' / 'b').st_mode & 0o777 == 0o700
    assert os.stat(tmp_path / 'shared').st_mode & 0o777 == 0o755  # existing folders untouched


def test_read_json(tmp_path):
    assert read_json(tmp_path / 'missing.json') is None
    (tmp_path / 'bad.json').write_text('{')
    with pytest.raises(ValueError):
        read_json(tmp_path / 'bad.json')


def test_docstore_revs_conflicts_and_history(tmp_path, monkeypatch):
    monkeypatch.setattr(store, 'HISTORY_KEEP', 3)
    docs = DocStore(tmp_path / 'owner', DEFAULTS)
    empty = docs.load('notes')
    assert empty == {'schema': 'arc-owner-notes/1', 'rev': 0, 'updated_utc': None, 'items': []}
    saved = docs.save('notes', {'schema': 'arc-owner-notes/1', 'items': [1]}, base_rev=0)
    assert list(saved)[:3] == ['schema', 'rev', 'updated_utc'] and saved['rev'] == 1
    assert docs.load('notes') == saved
    with pytest.raises(Conflict) as conflict:
        docs.save('notes', {'schema': 'arc-owner-notes/1', 'items': [2]}, base_rev=0)
    assert conflict.value.current == saved
    for rev in range(1, 6):
        docs.save('notes', {'schema': 'arc-owner-notes/1', 'items': [rev]}, base_rev=rev)
    history = sorted(p.name for p in (tmp_path / 'owner' / 'history' / 'notes').iterdir())
    assert history == ['rev-000003.json', 'rev-000004.json', 'rev-000005.json']
    assert json.loads((tmp_path / 'owner' / 'history' / 'notes' / 'rev-000005.json').read_text())[
        'items'
    ] == [4]
    assert os.stat(tmp_path / 'owner').st_mode & 0o777 == 0o700


def test_docstore_only_knows_its_documents(tmp_path):
    with pytest.raises(KeyError):
        DocStore(tmp_path, DEFAULTS).load('../../etc/passwd')
