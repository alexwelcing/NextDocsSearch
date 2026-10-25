"""M1 exit criteria: a vault read outside the read points is refused; S-F's two-read path passes."""

import json

import pytest

from arcforge.vault import age, readlog
from arcforge.vault import read as vault_read
from arcforge.vault.read import (
    Paths,
    ReadError,
    aggregate,
    read_vault,
    record_lost_key,
    round_release,
)
from arcforge.vault.readpoints import ReadRefused
from arcforge.vault.seal import seal
from arcforge.vault.split import run_split

SALT = bytes(range(32))


@pytest.fixture
def vault(home, fake_age, write_queries, tmp_path, laptop):
    identity, recipient = age.generate_identity()
    recipient_file = tmp_path / 'vault.recipient'
    recipient_file.write_text(recipient + '\n')
    write_queries()
    result = run_split(salt=SALT)
    paths = Paths.default()
    seal(
        result.out_dir / 'vault-queries.json',
        recipient_file,
        paths.sealed,
        commitments_out=paths.commitments,
    )
    return identity, paths, [q['id'] for q in result.vault]


def scorer(payload, run_id, branch):
    # hyb beats B2 by 0.03 on every vault query
    return {q['id']: (0.53, 0.50) for q in payload['queries']}


def _read(vault, run, branch, score=scorer, key=None):
    identity, paths, _ = vault
    return read_vault(run, branch, key_source=lambda: key or identity, scorer=score, paths=paths)


def _events(paths):
    return [(e['event'], e['run_id']) for e in readlog.load(paths.log)]


def test_s_f_two_read_path(vault):
    _, paths, ids = vault
    first = _read(vault, 'r04', 'S-F')
    assert first['read_index'] == 1 and first['reads_budget_branch'] == 2
    assert first['hybrid_minus_b2_ndcg10'] == 0.03 and first['sign'] == 1
    assert 'per_query' not in first and 'salt_hex' not in first  # before R10: the aggregate only
    second = _read(vault, 'r10K', 'S-F')
    assert second['read_index'] == 2
    assert [row['id'] for row in second['per_query']] == ids  # R10K: the vault opens per query
    assert second['salt_hex'] == SALT.hex()
    with pytest.raises(ReadRefused, match='budget'):
        _read(vault, 'r10K', 'S-F')
    assert _events(paths) == [
        ('open', 'r04'),
        ('release', 'r04'),
        ('open', 'r10K'),
        ('release', 'r10K'),
        ('refused', 'r10K'),
    ]
    assert [r['run_id'] for r in readlog.public_log(readlog.load(paths.log))] == ['r04', 'r10K']
    assert json.loads((paths.releases / 'release-r04.json').read_text()) == first


def test_a_read_outside_the_read_points_is_refused_and_logged(vault):
    _, paths, _ = vault
    with pytest.raises(ReadRefused, match='not a registered read point'):
        _read(vault, 'r05', 'N')
    with pytest.raises(ReadRefused):
        _read(vault, 'r06', 'S-F')
    assert _events(paths) == [('refused', 'r05'), ('refused', 'r06')]
    assert not paths.releases.exists()


def test_a_fourth_read_is_refused(vault):
    for run in ('r04', 'r06', 'r10'):
        _read(vault, run, 'N')
    with pytest.raises(ReadRefused, match='used'):
        _read(vault, 'r10', 'N')


def test_refused_before_the_key_is_asked(vault):
    _, paths, _ = vault

    def no_key():
        raise AssertionError('the key must not be asked for')

    with pytest.raises(ReadRefused):
        read_vault('r05', 'N', key_source=no_key, scorer=scorer, paths=paths)


def test_on_a_runner_vm_nothing_happens(vault, monkeypatch):
    _, paths, _ = vault
    monkeypatch.setattr(vault_read, 'runner_reason', lambda: 'this is a CI job')
    with pytest.raises(ReadRefused, match='laptop'):
        _read(vault, 'r04', 'N')
    assert readlog.load(paths.log) == []


def test_a_missing_scorer_burns_nothing(vault):
    _, paths, _ = vault
    with pytest.raises(ReadError, match='not available'):
        _read(vault, 'r04', 'N', score='arcforge.no_such_module:score')
    assert readlog.load(paths.log) == []
    assert _read(vault, 'r04', 'N')['read_index'] == 1


def test_a_failed_scorer_can_retry(vault):
    _, paths, _ = vault
    with pytest.raises(ReadError, match='every vault query'):
        _read(vault, 'r04', 'N', score=lambda p, r, b: {})
    assert _events(paths) == [('open', 'r04')]  # the open is on record; nothing was released
    assert _read(vault, 'r04', 'N')['read_index'] == 1


@pytest.mark.parametrize(
    'bad', [lambda q: (float('nan'), 0.5), lambda q: (1.2, 0.5), lambda q: 'high', lambda q: (0.5,)]
)
def test_scores_must_be_ndcg_pairs(vault, bad):
    with pytest.raises(ReadError, match='nothing released'):
        _read(vault, 'r04', 'N', score=lambda p, r, b: {q['id']: bad(q) for q in p['queries']})


def test_the_wrong_key_opens_nothing(vault):
    _, paths, _ = vault
    other, _ = age.generate_identity()
    with pytest.raises(ReadError, match='does not belong'):
        _read(vault, 'r04', 'N', key=other)
    with pytest.raises(ReadError, match='AGE-SECRET-KEY-1'):
        _read(vault, 'r04', 'N', key='hunter2')
    assert readlog.load(paths.log) == []


def test_a_swapped_sealed_file_is_refused(vault):
    _, paths, _ = vault
    paths.sealed.write_bytes(paths.sealed.read_bytes() + b'\n')
    with pytest.raises(ReadError, match='not the sealed file that was committed'):
        _read(vault, 'r04', 'N')


def test_a_truncated_log_is_caught_by_the_release_files(vault):
    _, paths, _ = vault
    _read(vault, 'r04', 'N')
    lines = paths.log.read_text().splitlines()
    paths.log.write_text(lines[0] + '\n')  # drop the release line
    with pytest.raises(ReadRefused, match='missing releases'):
        _read(vault, 'r06', 'N')


def test_a_tampered_log_blocks_reads(vault):
    _, paths, _ = vault
    _read(vault, 'r04', 'N')
    paths.log.write_text(paths.log.read_text().replace('"r04"', '"r03"', 1))
    with pytest.raises(ReadRefused, match='does not verify'):
        _read(vault, 'r06', 'N')


def test_a_lost_key_records_unavailable(vault):
    _, paths, _ = vault
    release = record_lost_key('r04', 'N', paths=paths)
    assert release['sign'] == 'unavailable' and release['hybrid_minus_b2_ndcg10'] is None
    assert _read(vault, 'r06', 'N')['read_index'] == 2


def test_rounding_and_sign():
    assert round_release(0.034999) == 0.03
    assert round_release(-0.004) == 0.0 and str(round_release(-0.004)) == '0.0'
    assert round_release(0.125) == 0.12  # half to even, on the decimal value
    assert aggregate({'a': (0.6, 0.5), 'b': (0.5, 0.5)}) == (0.05, 1)
    assert aggregate({'a': (0.4, 0.5)}) == (-0.1, -1)
    assert aggregate({'a': (0.501, 0.5)}) == (0.0, 0)
