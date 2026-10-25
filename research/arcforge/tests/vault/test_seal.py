import json

import pytest

from arcforge.vault import age
from arcforge.vault.digest import sha256_hex
from arcforge.vault.seal import SealError, seal, shred
from arcforge.vault.split import run_split

SALT = bytes(range(32))


@pytest.fixture
def s0(home, fake_age, write_queries, tmp_path):
    identity, recipient = age.generate_identity()
    recipient_file = tmp_path / 'vault.recipient'
    recipient_file.write_text(f'# test\n{recipient}\n')
    write_queries()
    result = run_split(salt=SALT)
    return identity, recipient_file, result


def _qrels(tmp_path, vault_ids, **extra):
    path = tmp_path / 'qrels.json'
    rows = {qid: {'far-shore-06-the-last-handshake': 3} for qid in vault_ids[:5]}
    path.write_text(json.dumps({'schema': 'arc-vault-qrels/1', 'qrels': {**rows, **extra}}))
    return path


def test_seal_encrypts_commits_and_shreds(s0, tmp_path):
    identity, recipient_file, result = s0
    queries_file = result.out_dir / 'vault-queries.json'
    qrels = _qrels(tmp_path, [q['id'] for q in result.vault])
    out = tmp_path / 'sealed' / 'vault.age'
    sealed = seal(queries_file, recipient_file, out, qrels=qrels)
    c = sealed.commitments
    assert c['sealed_sha256'] == sha256_hex(out.read_bytes())
    assert c['queries_commitment_sha256'] == result.commitment
    assert c['n_queries'] == 70 and c['has_qrels'] is True
    assert c['recipient'] == age.read_recipient_file(recipient_file)
    assert json.loads(sealed.commitments_path.read_text()) == c
    assert not queries_file.exists() and not qrels.exists()  # plaintext shredded
    assert b'query number' not in out.read_bytes()
    payload = json.loads(age.decrypt(out, identity))
    assert payload['schema'] == 'arc-vault/1' and payload['salt_hex'] == SALT.hex()
    assert [q['id'] for q in payload['queries']] == [q['id'] for q in result.vault]
    assert len(payload['qrels']) == 5


def test_seal_once(s0, tmp_path):
    _, recipient_file, result = s0
    out = tmp_path / 'vault.age'
    seal(result.out_dir / 'vault-queries.json', recipient_file, out, shred_inputs=False)
    with pytest.raises(SealError, match='sealed once'):
        seal(result.out_dir / 'vault-queries.json', recipient_file, out)


def test_edited_vault_queries_are_refused(s0, tmp_path):
    _, recipient_file, result = s0
    path = result.out_dir / 'vault-queries.json'
    doc = json.loads(path.read_text())
    doc['queries'][0]['text'] = 'swapped after the commitment'
    path.write_text(json.dumps(doc))
    with pytest.raises(SealError, match='S0 commitment'):
        seal(path, recipient_file, tmp_path / 'vault.age')


def test_qrels_must_be_for_vault_queries_with_grades_0_to_3(s0, tmp_path):
    _, recipient_file, result = s0
    ids = [q['id'] for q in result.vault]
    queries_file = result.out_dir / 'vault-queries.json'
    open_id = result.open_dev[0]['id']
    with pytest.raises(SealError, match='not a vault query'):
        seal(
            queries_file,
            recipient_file,
            tmp_path / 'a.age',
            qrels=_qrels(tmp_path, ids, **{open_id: {}}),
        )
    with pytest.raises(SealError, match='grades 0-3'):
        seal(
            queries_file,
            recipient_file,
            tmp_path / 'b.age',
            qrels=_qrels(tmp_path, ids, **{ids[0]: {'x': 4}}),
        )
    bad = tmp_path / 'bad.json'
    bad.write_text(json.dumps({'schema': 'nope', 'qrels': {}}))
    with pytest.raises(SealError, match='arc-vault-qrels/1'):
        seal(queries_file, recipient_file, tmp_path / 'c.age', qrels=bad)
    assert queries_file.exists()  # nothing shredded on failure


def test_seal_needs_a_recipient(s0, tmp_path):
    _, _, result = s0
    with pytest.raises(age.AgeError, match='vault keygen'):
        seal(result.out_dir / 'vault-queries.json', tmp_path / 'missing', tmp_path / 'v.age')


def test_shred(tmp_path):
    path = tmp_path / 'plain.json'
    path.write_text('secret')
    shred(path)
    assert not path.exists()
    shred(path)  # already gone: fine
