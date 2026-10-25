"""The same flows against the real `age` CLI (skipped where it is not installed, e.g. CI)."""

import json

from arcforge.vault import age
from arcforge.vault.read import Paths, read_vault
from arcforge.vault.seal import seal
from arcforge.vault.split import run_split


def test_real_age_round_trip(real_age, tmp_path):
    identity, recipient = age.generate_identity()
    assert age.recipient_of(identity) == recipient
    sealed = tmp_path / 'v.age'
    sealed.write_bytes(age.encrypt(b'{"q": 1}', recipient))
    assert age.decrypt(sealed, identity) == b'{"q": 1}'
    other, _ = age.generate_identity()
    try:
        age.decrypt(sealed, other)
    except age.AgeError as error:
        assert other not in str(error)
    else:
        raise AssertionError('a foreign key decrypted the vault')


def test_real_age_seal_then_read(real_age, home, write_queries, tmp_path, laptop):
    identity, recipient = age.generate_identity()
    recipient_file = tmp_path / 'vault.recipient'
    recipient_file.write_text(recipient + '\n')
    write_queries()
    split = run_split()
    paths = Paths.default()
    sealed = seal(
        split.out_dir / 'vault-queries.json',
        recipient_file,
        paths.sealed,
        commitments_out=paths.commitments,
    )
    assert sealed.commitments['age_version']  # e.g. v1.3.2 (Homebrew) or 1.1.1 (Ubuntu)
    release = read_vault(
        'r04',
        'S-F',
        key_source=lambda: identity,
        scorer=lambda payload, run, branch: {q['id']: (0.4, 0.42) for q in payload['queries']},
        paths=paths,
    )
    assert release['hybrid_minus_b2_ndcg10'] == -0.02 and release['sign'] == -1
    assert json.loads((paths.releases / 'release-r04.json').read_text())['read_index'] == 1
