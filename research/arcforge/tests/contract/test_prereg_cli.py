"""`arcforge prereg lint|freeze|hash` through the CLI."""

from __future__ import annotations

import json

from arcforge import cli
from arcforge.contract.rules import TEMPLATE_PATH, load_rules, sha256_bytes

MDE = 'AB=0.045,D=0.03,CE=0.05,G=0.045,vault=0.09,frontier=0.1'


def test_lint_the_template(capsys):
    assert cli.main(['prereg', 'lint']) == 0
    out = capsys.readouterr().out
    assert 'lint ok: 0 errors, 2 warnings' in out and '145 in-scope' in out
    assert 'reader-isolation-incomplete' in out


def test_lint_frozen_fails_on_the_template(capsys):
    assert cli.main(['prereg', 'lint', '--frozen']) == 1
    assert 'not-frozen' in capsys.readouterr().out


def test_freeze_then_lint_frozen_requires_reader_runtime(tmp_path, capsys, s0_commitment):
    out = tmp_path / 'rules.yaml'
    args = ['prereg', 'freeze', '--mde', MDE, '--s0-hashes', str(s0_commitment), '--out', str(out)]
    assert cli.main(args) == 0
    assert load_rules(out).mde_r00['AB'] == 0.045
    lint_json = tmp_path / 'lint.json'
    assert (
        cli.main(['prereg', 'lint', '--frozen', '--rules', str(out), '--out', str(lint_json)]) == 1
    )
    report = json.loads(lint_json.read_text())
    assert (
        not report['ok']
        and report['frozen']
        and report['rules']['sha256'] == sha256_bytes(out.read_bytes())
    )
    assert [f['code'] for f in report['errors']] == ['reader-isolation-incomplete']
    capsys.readouterr()
    assert cli.main(args) == 2  # no silent overwrite
    assert 'exists' in capsys.readouterr().err
    assert cli.main([*args, '--force']) == 0


def test_freeze_from_json_and_bad_input(tmp_path, capsys, s0_commitment):
    mde = tmp_path / 'mde.json'
    mde.write_text(
        json.dumps({'AB': 0.05, 'D': 0.03, 'CE': 0.05, 'G': 0.045, 'vault': 0.09, 'frontier': 0.1})
    )
    assert (
        cli.main(
            [
                'prereg',
                'freeze',
                '--s0-hashes',
                str(s0_commitment),
                '--mde-json',
                str(mde),
                '--out',
                str(tmp_path / 'a.yaml'),
            ]
        )
        == 0
    )
    assert (
        cli.main(['prereg', 'freeze', '--s0-hashes', str(s0_commitment),
                  '--mde', 'AB=0.05', '--out', str(tmp_path / 'b.yaml')]) == 2
    )
    assert cli.main(['prereg', 'freeze', '--mde', 'AB', '--out', str(tmp_path / 'c.yaml')]) == 2
    assert not (tmp_path / 'b.yaml').exists()


def test_hash(tmp_path, capsys):
    prereg = tmp_path / 'PREREG.md'
    prereg.write_text('# PREREG\n')
    assert cli.main(['prereg', 'hash', '--prereg', str(prereg), '--json']) == 0
    hashes = json.loads(capsys.readouterr().out)
    assert hashes['rules_sha256']['sha256'] == sha256_bytes(TEMPLATE_PATH.read_bytes())
    assert hashes['prereg_sha256']['sha256'] == sha256_bytes(b'# PREREG\n')
    assert set(hashes) == {
        'rules_sha256',
        'schema_sha256',
        'plan_sha256',
        'prereg_pre_sha256',
        'prereg_sha256',
    }


def test_lint_json_and_bad_rules(tmp_path, capsys):
    assert cli.main(['prereg', 'lint', '--json']) == 0
    assert json.loads(capsys.readouterr().out)['schema'] == 'arc-lint/1'
    bad = tmp_path / 'rules.yaml'
    bad.write_text('schema: arc-rules/1\n')
    assert cli.main(['prereg', 'lint', '--rules', str(bad)]) == 1
    assert cli.main(['prereg', 'lint', '--rules', str(tmp_path / 'missing.yaml')]) == 2


def test_prereg_without_a_subcommand_prints_help(capsys):
    assert cli.main(['prereg']) == 2
    assert 'lint' in capsys.readouterr().out


def test_help_texts_are_present(capsys):
    for argv in (
        ['verdict', '--help'],
        ['prereg', 'lint', '--help'],
        ['prereg', 'freeze', '--help'],
    ):
        try:
            cli.main(argv)
        except SystemExit as stop:
            assert stop.code == 0
    out = capsys.readouterr().out
    assert 'recomputed' in out and '--frozen' in out and '--mde' in out
