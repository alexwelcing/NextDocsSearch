import json
import os

import pytest

from arcforge.owner.desk import Desk, Locked
from arcforge.vault.digest import queries_commitment
from arcforge.vault.split import N_VAULT, SplitError, run_split, split

SALT = bytes(range(32))


def test_split_is_70_30_disjoint_and_deterministic(make_queries):
    main = [q for q in make_queries()['queries'] if q['section'] == 'main']
    vault, open_dev = split(main, SALT)
    assert (len(vault), len(open_dev)) == (70, 30)
    assert {q['id'] for q in vault}.isdisjoint({q['id'] for q in open_dev})
    assert {q['id'] for q in vault} | {q['id'] for q in open_dev} == {q['id'] for q in main}
    assert split(main, SALT) == (vault, open_dev)
    assert [q['id'] for q in vault] == sorted(q['id'] for q in vault)
    assert split(main, bytes(32))[0] != vault  # another salt, another split


def test_split_does_not_depend_on_input_order(make_queries):
    main = [q for q in make_queries()['queries'] if q['section'] == 'main']
    assert split(list(reversed(main)), SALT) == split(main, SALT)


def test_run_split_writes_s0_and_locks_the_desk(home, write_queries):
    write_queries()
    result = run_split(salt=SALT)
    out = result.out_dir
    vault_file = json.loads((out / 'vault-queries.json').read_text())
    public = json.loads((out / 's0-commitment.json').read_text())
    opened = json.loads((out / 'owner-open.json').read_text())
    assert len(vault_file['queries']) == N_VAULT and vault_file['salt_hex'] == SALT.hex()
    assert queries_commitment(SALT, vault_file['queries']) == public['queries_commitment_sha256']
    assert public['n_vault'] == 70 and public['n_open_dev'] == 30 and public['n_frontier'] == 8
    assert 'salt_hex' not in public and 'queries' not in public
    assert len(opened['open_dev']) == 30 and len(opened['frontier']) == 8
    assert os.stat(out / 'vault-queries.json').st_mode & 0o777 == 0o600
    # The record in a withheld series carried its FRONTIER tag through.
    q7 = next(q for q in vault_file['queries'] + opened['open_dev'] if q['id'] == 'q-0007')
    assert q7['frontier'] is True
    lock = json.loads((home / 'arc-owner' / 's0-lock.json').read_text())
    assert lock['queries_commitment_sha256'] == result.commitment
    desk = Desk(None, recipient_file=home / 'none')
    with pytest.raises(Locked):
        desk.save('queries', 0, {'queries': []})
    with pytest.raises(SplitError, match='re-roll'):
        run_split()


@pytest.mark.parametrize(
    ('mutate', 'message'),
    [
        (lambda d: d['queries'].pop(0), '99 of 100'),
        (lambda d: d['queries'][3].update(text=''), 'empty queries: q-0004'),
        (lambda d: d['queries'][4].update(text=d['queries'][5]['text']), 'duplicate'),
        (lambda d: d['queries'].pop(), '3 of 4 frontier queries for residue'),
        (lambda d: d['queries'][0].update(text='x' * 61), 'limit is 60'),
    ],
)
def test_incomplete_queries_are_refused(home, write_queries, make_queries, mutate, message):
    doc = make_queries()
    mutate(doc)
    write_queries(doc)
    with pytest.raises(SplitError, match=message):
        run_split(salt=SALT)
    assert not (home / 'arc-owner' / 's0-lock.json').exists()


def test_no_queries_yet(home):
    with pytest.raises(SplitError, match='Owner Desk'):
        run_split()
