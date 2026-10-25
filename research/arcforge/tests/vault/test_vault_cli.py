import io
import json

import pytest

from arcforge import cli
from arcforge.vault import age


def test_vault_without_action_prints_help(capsys):
    assert cli.main(['vault']) == 2
    assert 'keygen' in capsys.readouterr().out


def test_keygen_refuses_without_a_terminal(fake_age, tmp_path, capsys, monkeypatch):
    monkeypatch.setattr('sys.stdin', io.StringIO(''))
    assert cli.main(['vault', 'keygen', '--recipient-file', str(tmp_path / 'r')]) == 1
    assert 'not through an agent' in capsys.readouterr().err
    assert not (tmp_path / 'r').exists()


def test_status_json(home, tmp_path, capsys):
    assert cli.main(['vault', 'status', '--json', '--recipient-file', str(tmp_path / 'none')]) == 0
    status = json.loads(capsys.readouterr().out)
    assert status['recipient'] is None and status['reads'] == [] and status['read_log_ok'] is True


def test_full_cli_path(home, fake_age, write_queries, tmp_path, capsys, monkeypatch, laptop):
    identity, recipient = age.generate_identity()
    recipient_file = tmp_path / 'vault.recipient'
    recipient_file.write_text(recipient + '\n')
    write_queries()
    assert cli.main(['vault', 'split']) == 0
    assert 'S0 split done: 70 vault, 30 open-dev, 8 frontier' in capsys.readouterr().out
    s0 = home / 'arc-owner' / 'vault' / 's0'
    assert (
        cli.main(
            [
                'vault',
                'seal',
                '--vault-queries',
                str(s0 / 'vault-queries.json'),
                '--recipient-file',
                str(recipient_file),
            ]
        )
        == 0
    )
    assert 'plaintext inputs shredded' in capsys.readouterr().out
    assert not (s0 / 'vault-queries.json').exists()

    scorer = tmp_path / 'fixture_scorer.py'
    scorer.write_text(
        'def score(payload, run, branch):\n'
        '    return {q["id"]: (0.61, 0.6) for q in payload["queries"]}\n'
    )
    monkeypatch.syspath_prepend(str(tmp_path))
    monkeypatch.setattr('sys.stdin', io.StringIO(identity + '\n'))
    assert (
        cli.main(['vault', 'read', 'R04', '--branch', 's-f', '--scorer', 'fixture_scorer:score'])
        == 0
    )
    out = capsys.readouterr().out
    assert 'Vault read 1 of 2 at r04 (branch S-F)' in out and '+0.01' in out
    assert identity not in out

    assert (
        cli.main(['vault', 'read', 'r06', '--branch', 'S-F', '--scorer', 'fixture_scorer:score'])
        == 4
    )
    assert 'refused: r06 is not a registered read point for branch S-F' in capsys.readouterr().err

    assert cli.main(['vault', 'status', '--recipient-file', str(recipient_file)]) == 0
    assert '#1 r04' in capsys.readouterr().out


@pytest.mark.parametrize(
    ('args', 'code'), [(['r4', '--branch', 'N'], 2), (['r04', '--branch', 'Q'], 2)]
)
def test_read_rejects_bad_ids(args, code, home):
    assert cli.main(['vault', 'read', *args]) == code


def test_read_refuses_off_the_laptop(home, monkeypatch, capsys):
    monkeypatch.setenv('ARCFORGE_RUNNER', '1')
    assert cli.main(['vault', 'read', 'r04', '--branch', 'N']) == 4
    assert 'laptop' in capsys.readouterr().err
