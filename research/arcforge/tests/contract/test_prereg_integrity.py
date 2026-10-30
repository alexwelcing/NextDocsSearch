"""Mutation tests for the bytes and values committed before S0."""

import json

import pytest

from arcforge import cli
from arcforge.contract import prereg_doc, synth
from arcforge.contract.rules import TEMPLATE_PATH, RulesError, freeze_diff, freeze_text, loads_rules
from arcforge.contract.schema import REPORT_SCHEMA_PATH

TEMPLATE = TEMPLATE_PATH.read_bytes().decode('utf-8')


@pytest.mark.parametrize(
    'line',
    [
        '  AB: 0.045  # new post-S0 comment\n',
        '    AB: 0.045\n',
        '  AB : 0.045\n',
        '  AB: 0.045\r\n',
        '  AB: [0.045]\n',
        '  AB: -0.045\n',
        '  AB: .nan\n',
        '  AB: .inf\n',
    ],
)
def test_freeze_diff_allows_only_finite_nonnegative_numeric_scalar_changes(line):
    frozen = freeze_text(TEMPLATE, synth.DEFAULT_MDE)
    assert freeze_diff(TEMPLATE, frozen.replace('  AB: 0.045\n', line, 1)) is None


def test_freeze_preserves_inline_comment_spacing_and_line_endings():
    template = TEMPLATE.replace('  AB: null\n', '  AB: null    # measured at R00\n').replace(
        '\n', '\r\n'
    )
    frozen = freeze_text(template, synth.DEFAULT_MDE)
    assert '  AB: 0.045    # measured at R00\r\n' in frozen
    assert freeze_diff(template, frozen) == list(synth.DEFAULT_MDE)


@pytest.mark.parametrize('value', [float('nan'), float('inf'), float('-inf'), True, -0.1])
def test_freeze_refuses_invalid_measurements(value):
    with pytest.raises(RulesError):
        freeze_text(TEMPLATE, {**synth.DEFAULT_MDE, 'AB': value})


@pytest.mark.parametrize('key', ['mde_r00.AB', 'tau.H1.c1', 'rules_sha256', 'schema_sha256'])
def test_r00_extra_values_cannot_override_contract_derived_values(key):
    rules = loads_rules(freeze_text(TEMPLATE, synth.DEFAULT_MDE))
    with pytest.raises(prereg_doc.PreregError, match='derived'):
        prereg_doc.values_for(rules, {key: '0.001'})


def test_hash_placeholders_are_derived_from_the_files_being_used():
    rules = loads_rules(freeze_text(TEMPLATE, synth.DEFAULT_MDE))
    values = prereg_doc.values_for(rules, {})
    assert values['rules_sha256'] == rules.sha256
    assert values['schema_sha256'] == prereg_doc.sha256_file(REPORT_SCHEMA_PATH)


@pytest.mark.parametrize('value', [0.000001, 0.0450345678912345, 0.0])
def test_registered_measurements_round_trip_without_render_rounding(value):
    rules = loads_rules(freeze_text(TEMPLATE, {**synth.DEFAULT_MDE, 'AB': value}))
    values = prereg_doc.values_for(rules, {})
    assert rules.mde_r00['AB'] == value
    assert float(values['mde_r00.AB']) == value
    assert float(values['tau.H1.c1']) == max(0.04, value)


def test_fill_rejects_placeholders_in_substituted_values():
    with pytest.raises(prereg_doc.PreregError, match='unfilled'):
        prereg_doc.fill('{{power_table}}', {'power_table': '{{tau.H1.c1}}'})


def write_commitment(tmp_path):
    path = tmp_path / 's0-hashes.json'
    path.write_text(json.dumps(prereg_doc.s0_hashes()), encoding='utf-8')
    return path


def test_freeze_requires_the_s0_commitment(tmp_path, capsys):
    out = tmp_path / 'rules.yaml'
    assert (
        cli.main(['prereg', 'freeze', '--mde-json', str(measurements(tmp_path)), '--out', str(out)])
        != 0
    )
    assert 's0' in capsys.readouterr().err.lower()
    assert not out.exists()


@pytest.mark.parametrize('expected', [{}, [], {'rules_sha256': '0' * 64}])
def test_missing_or_malformed_commitments_fail_closed(expected):
    with pytest.raises(prereg_doc.PreregError, match='s0'):
        prereg_doc.verify_s0_hashes(expected)


def test_cli_hash_json_is_accepted_as_the_commitment(tmp_path, capsys):
    assert cli.main(['prereg', 'hash', '--json']) == 0
    expected = json.loads(capsys.readouterr().out)
    prereg_doc.verify_s0_hashes(expected)


def measurements(tmp_path):
    path = tmp_path / 'mde.json'
    path.write_text(json.dumps(synth.DEFAULT_MDE), encoding='utf-8')
    return path


@pytest.mark.parametrize('which', ['rules', 'pre', 'schema'])
def test_each_committed_file_is_hash_sensitive(tmp_path, which):
    rules, pre, schema = [tmp_path / name for name in ('rules.yaml', 'pre.md', 'schema.json')]
    rules.write_bytes(TEMPLATE_PATH.read_bytes())
    pre.write_bytes(prereg_doc.PRE_PATH.read_bytes())
    schema.write_bytes(REPORT_SCHEMA_PATH.read_bytes())
    paths = dict(rules_path=rules, pre_path=pre, schema_path=schema)
    expected = prereg_doc.s0_hashes(**paths)
    prereg_doc.verify_s0_hashes(expected, **paths)
    target = {'rules': rules, 'pre': pre, 'schema': schema}[which]
    target.write_bytes(target.read_bytes() + b'\n')
    assert prereg_doc.s0_hashes(**paths) != expected
    with pytest.raises(prereg_doc.PreregError, match='s0'):
        prereg_doc.verify_s0_hashes(expected, **paths)


def test_altered_rules_template_cannot_be_rebased_under_the_original_s0(tmp_path, capsys):
    commitment = write_commitment(tmp_path)
    template = tmp_path / 'registered.yaml'
    template.write_text(TEMPLATE.replace('tau_floor: 0.15', 'tau_floor: 0.14', 1))
    out = tmp_path / 'rules.yaml'
    assert (
        cli.main(
            [
                'prereg',
                'freeze',
                '--rules',
                str(template),
                '--s0-hashes',
                str(commitment),
                '--mde-json',
                str(measurements(tmp_path)),
                '--out',
                str(out),
            ]
        )
        != 0
    )
    assert 's0' in capsys.readouterr().err
    assert not out.exists()


@pytest.mark.parametrize('which', ['pre', 'schema'])
def test_freeze_cli_checks_the_other_s0_files(tmp_path, capsys, monkeypatch, which):
    from arcforge.contract import schema

    commitment = write_commitment(tmp_path)
    args = [
        'prereg',
        'freeze',
        '--s0-hashes',
        str(commitment),
        '--mde-json',
        str(measurements(tmp_path)),
        '--out',
        str(tmp_path / 'rules.yaml'),
    ]
    if which == 'pre':
        changed = tmp_path / 'pre.md'
        changed.write_bytes(prereg_doc.PRE_PATH.read_bytes() + b'\n')
        args += ['--prereg-pre', str(changed)]
    else:
        changed = tmp_path / 'schema.json'
        changed.write_bytes(REPORT_SCHEMA_PATH.read_bytes() + b'\n')
        monkeypatch.setattr(schema, 'REPORT_SCHEMA_PATH', changed)
    assert cli.main(args) != 0
    assert 's0' in capsys.readouterr().err
    assert not (tmp_path / 'rules.yaml').exists()


@pytest.mark.parametrize('mutation', ['tau', 'comment', 'line-ending'])
def test_valid_committed_freeze_and_final_render(tmp_path, capsys, mutation):
    commitment = write_commitment(tmp_path)
    rules = tmp_path / 'rules.yaml'
    assert (
        cli.main(
            [
                'prereg',
                'freeze',
                '--s0-hashes',
                str(commitment),
                '--mde-json',
                str(measurements(tmp_path)),
                '--out',
                str(rules),
            ]
        )
        == 0
    )
    extra = {
        k: k for k in prereg_doc.STATIC_PLACEHOLDERS if k not in {'rules_sha256', 'schema_sha256'}
    }
    values = tmp_path / 'values.json'
    values.write_text(json.dumps(extra))
    out = tmp_path / 'PREREG.md'
    args = [
        'prereg',
        'render',
        '--rules',
        str(rules),
        '--s0-hashes',
        str(commitment),
        '--values',
        str(values),
        '--out',
        str(out),
    ]
    assert cli.main(args) == 0
    assert prereg_doc.placeholders(out.read_text()) == []
    assert loads_rules(rules.read_text()).sha256 in out.read_text()
    capsys.readouterr()
    frozen = rules.read_bytes()
    if mutation == 'tau':
        frozen = frozen.replace(b'tau_floor: 0.15', b'tau_floor: 0.14', 1)
    elif mutation == 'comment':
        frozen = frozen.replace(b'  AB: 0.045\n', b'  AB: 0.045 # post-S0 edit\n', 1)
    else:
        frozen = frozen.replace(b'  AB: 0.045\n', b'  AB: 0.045\r\n', 1)
    rules.write_bytes(frozen)
    original = out.read_bytes()
    assert cli.main(args) != 0
    assert 'mde_r00' in capsys.readouterr().err
    assert out.read_bytes() == original
