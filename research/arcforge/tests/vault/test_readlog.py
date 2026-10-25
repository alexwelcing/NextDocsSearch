import json

import pytest

from arcforge.vault import readlog


def _entry(event, run='r04', **extra):
    return {
        'event': event,
        'run_id': run,
        'branch': 'N',
        'utc': '2026-10-24T00:00:00Z',
        'host': 'owner-laptop',
        **extra,
    }


def test_missing_log_is_empty(tmp_path):
    assert readlog.load(tmp_path / 'none.jsonl') == []


def test_append_chains_and_verifies(tmp_path):
    log = tmp_path / 'log.jsonl'
    first = readlog.append(log, _entry('open', sealed_sha256='a' * 64))
    second = readlog.append(log, _entry('release', read_index=1, sealed_sha256='a' * 64))
    assert first['seq'] == 1 and first['prev_sha256'] == readlog.GENESIS
    assert second['prev_sha256'] == first['entry_sha256']
    assert readlog.load(log) == [first, second]
    assert readlog.released_runs(readlog.load(log)) == ['r04']
    assert log.stat().st_mode & 0o777 == 0o600


def test_public_log_lists_releases_only(tmp_path):
    log = tmp_path / 'log.jsonl'
    readlog.append(log, _entry('refused', reason='nope'))
    readlog.append(log, _entry('open', sealed_sha256='b' * 64))
    readlog.append(
        log, _entry('release', read_index=1, sealed_sha256='b' * 64, hybrid_minus_b2_ndcg10=0.03)
    )
    assert readlog.public_log(readlog.load(log)) == [
        {
            'read_index': 1,
            'run_id': 'r04',
            'utc': '2026-10-24T00:00:00Z',
            'sealed_sha256': 'b' * 64,
            'host': 'owner-laptop',
        }
    ]


@pytest.fixture
def three(tmp_path):
    log = tmp_path / 'log.jsonl'
    readlog.append(log, _entry('release', run='r04', read_index=1, sealed_sha256='c' * 64))
    readlog.append(log, _entry('release', run='r06', read_index=2, sealed_sha256='c' * 64))
    readlog.append(log, _entry('release', run='r10', read_index=3, sealed_sha256='c' * 64))
    return log


def test_an_edited_entry_breaks_the_chain(three):
    lines = three.read_text().splitlines()
    entry = json.loads(lines[1])
    entry['run_id'] = 'r05'
    lines[1] = json.dumps(entry, sort_keys=True)
    three.write_text('\n'.join(lines) + '\n')
    with pytest.raises(readlog.LogCorrupt, match='edited'):
        readlog.load(three)


def test_a_deleted_entry_breaks_the_chain(three):
    lines = three.read_text().splitlines()
    three.write_text('\n'.join([lines[0], lines[2]]) + '\n')
    with pytest.raises(readlog.LogCorrupt, match='chain'):
        readlog.load(three)


def test_reordered_entries_break_the_chain(three):
    lines = three.read_text().splitlines()
    three.write_text('\n'.join([lines[1], lines[0], lines[2]]) + '\n')
    with pytest.raises(readlog.LogCorrupt):
        readlog.load(three)


def test_garbage_is_corrupt(tmp_path):
    log = tmp_path / 'log.jsonl'
    log.write_text('not json\n')
    with pytest.raises(readlog.LogCorrupt):
        readlog.load(log)


def test_unknown_events_are_refused(tmp_path):
    with pytest.raises(ValueError):
        readlog.append(tmp_path / 'log.jsonl', _entry('peek'))
