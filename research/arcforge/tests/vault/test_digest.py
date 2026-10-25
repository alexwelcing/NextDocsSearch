"""The commitment bytes are published years before anyone checks them: pin them exactly."""

import hashlib

from arcforge.vault.digest import canonical_json, queries_commitment, sha256_file, split_key

SALT = bytes(range(32))
QUERY = {'id': 'q-0001', 'text': 'the fossil', 'record': None, 'frontier': False}


def test_canonical_json_is_sorted_compact_utf8():
    assert canonical_json({'b': 1, 'a': 'é'}) == '{"a":"é","b":1}'.encode()


def test_queries_commitment_known_answer():
    expected = hashlib.sha256(
        b'arc-vault-queries/1\x00'
        + SALT
        + b'[{"frontier":false,"id":"q-0001","record":null,"text":"the fossil"}]'
    ).hexdigest()
    assert expected == '95f903d484735e22a26aab4da04f86bc4539afc6323c24fa3ef7b8c4b76613ef'
    assert queries_commitment(SALT, [QUERY]) == expected


def test_split_key_known_answer():
    assert split_key(SALT, 'q-0001', 'the fossil') == (
        'c939af9c68b18d1d3eb138ca8d7597ec12d3045167b37ab53bda7f9e1c840356'
    )


def test_commitment_depends_on_salt_and_every_field():
    base = queries_commitment(SALT, [QUERY])
    assert queries_commitment(bytes(32), [QUERY]) != base
    assert queries_commitment(SALT, [{**QUERY, 'text': 'the fossil '}]) != base
    assert queries_commitment(SALT, [{**QUERY, 'record': 'echo-chamber-02-the-fossil'}]) != base


def test_sha256_file(tmp_path):
    path = tmp_path / 'f'
    path.write_bytes(b'x' * 200_000)
    assert sha256_file(path) == hashlib.sha256(b'x' * 200_000).hexdigest()
