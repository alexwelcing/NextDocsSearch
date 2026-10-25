"""PREREG.pre.md (committed before S0, hashed into s0) and the freeze guard."""

from __future__ import annotations

import json

import pytest

from arcforge import cli
from arcforge.contract import prereg_doc, synth
from arcforge.contract.ids import JUDGE_FREE_GLOSS
from arcforge.contract.rules import TEMPLATE_PATH, freeze_diff, freeze_text, load_rules

TEMPLATE = TEMPLATE_PATH.read_text(encoding='utf-8')
EXTRA = {
    'a0_sha256': 'a' * 64,
    'rules_sha256': 'b' * 64,
    'schema_sha256': 'c' * 64,
    'code_sha': 'd' * 40,
    'witness_a0': '1001',
    'witness_s0': '1002',
    'witness_r00_sets': '1003',
    'power_table': '| row | p |\n| --- | --- |',
    'i1_r00': 'PASS (I1a, I1b, I1c and I1d all hold).',
    'contamination_r00': 'The 18 lookups landed; no record was hit.',
    'quarantine_r00': 'Two clusters were quarantined (Q1, Q3).',
    'panel_r00': 'OLMo-2-1124-13B base, fp8; C_open 30, frontier 8.',
}


def test_the_committed_template_is_the_render_of_the_rules_template():
    rendered = prereg_doc.render_pre(load_rules())
    committed = prereg_doc.PRE_PATH.read_text(encoding='utf-8')
    assert committed == rendered, 'run `arcforge prereg render --pre --out prereg/PREREG.pre.md`'


def test_the_template_carries_the_a0_text():
    text = prereg_doc.PRE_PATH.read_text(encoding='utf-8')
    assert JUDGE_FREE_GLOSS in text
    for needle in (
        'amendments[0]',
        'Amendment procedure',
        'Kill ladder',
        'Exclusions',
        'OpenAI (no pipeline role',
        'There is no manual sign',
        'intent-only qrels',
        'QUARANTINE',
        'ref150+fable150',
    ):
        assert needle in text, needle
    for removed in ('owner_signed', 'kappa_qw_owner', 'LLM-free', "author's own relevance"):
        assert removed not in text, removed


def test_every_rule_and_tau_placeholder_is_in_the_template():
    rules = load_rules()
    text = prereg_doc.PRE_PATH.read_text(encoding='utf-8')
    for rule in rules.rules:
        assert f'### {rule.id}: ' in text
    assert set(prereg_doc.placeholders(text)) == set(prereg_doc.expected_placeholders(rules))


def test_fill_writes_every_number_and_refuses_gaps(frozen):
    _, rules = frozen
    text = prereg_doc.PRE_PATH.read_text(encoding='utf-8')
    values = prereg_doc.values_for(rules, EXTRA)
    final = prereg_doc.fill(text, values)
    assert prereg_doc.placeholders(final) == []
    assert '| MDE_AB | 0.045 |' in final
    assert 'max(0.04, MDE_AB) = 0.045' in final  # H1.c1's tau
    assert 'max(0.08, MDE_G) = 0.08' in final  # H2.c2's floor wins
    with pytest.raises(prereg_doc.PreregError, match='left unfilled'):
        prereg_doc.fill(text, {k: v for k, v in values.items() if k != 'i1_r00'})
    with pytest.raises(prereg_doc.PreregError, match='does not have'):
        prereg_doc.fill(text, {**values, 'surprise': 'x'})
    with pytest.raises(prereg_doc.PreregError, match='frozen rules'):
        prereg_doc.values_for(load_rules(), EXTRA)


def test_the_freeze_diff_touches_only_mde_r00():
    mde = dict(synth.DEFAULT_MDE)
    frozen = freeze_text(TEMPLATE, mde)
    assert freeze_diff(TEMPLATE, frozen) == ['AB', 'D', 'CE', 'G', 'vault', 'frontier']
    # Anything else that changes, a tau floor, a falsifier or a comment, is refused.
    for old, new in (
        ('tau_floor: 0.15', 'tau_floor: 0.14'),
        ("'c1.ci_hi_raw < 0.05 and gates_summary.I6_pass'", "'c1.ci_hi_raw < 0.06 and gates_summary.I6_pass'"),
        ('# rules.yaml', '# Rules.yaml'),
    ):  # fmt: skip
        assert freeze_diff(TEMPLATE, frozen.replace(old, new, 1)) is None, old
    assert freeze_diff(TEMPLATE, frozen + 'extra: 1\n') is None


def test_the_freeze_command_reports_what_it_changed(tmp_path, capsys):
    out = tmp_path / 'rules.yaml'
    code = cli.main(
        ['prereg', 'freeze', '--mde', 'AB=0.045,D=0.03,CE=0.05,G=0.045,vault=0.09,frontier=0.1',
         '--out', str(out)]
    )  # fmt: skip
    assert code == 0 and 'changed: AB, D, CE, G, vault, frontier' in capsys.readouterr().out
    assert freeze_diff(TEMPLATE, out.read_text()) is not None


def test_s0_hashes_name_the_rules_template_and_the_template():
    hashes = prereg_doc.s0_hashes()
    assert set(hashes) == {'rules_sha256', 'prereg_pre_sha256', 'schema_sha256'}
    assert hashes['rules_sha256'] == load_rules().sha256
    assert hashes['prereg_pre_sha256'] == prereg_doc.sha256_file(prereg_doc.PRE_PATH)


def test_render_and_hash_commands(tmp_path, frozen, capsys):
    out = tmp_path / 'pre.md'
    assert cli.main(['prereg', 'render', '--pre', '--out', str(out)]) == 0
    assert out.read_text() == prereg_doc.PRE_PATH.read_text()
    values = tmp_path / 'values.json'
    values.write_text(json.dumps(EXTRA))
    final = tmp_path / 'PREREG.md'
    code = cli.main(
        ['prereg', 'render', '--rules', str(frozen[0]), '--values', str(values), '--out', str(final)]
    )
    assert code == 0 and '{{' not in final.read_text()
    capsys.readouterr()
    assert cli.main(['prereg', 'hash', '--json']) == 0
    hashed = json.loads(capsys.readouterr().out)
    assert hashed['prereg_pre_sha256']['sha256'] == prereg_doc.s0_hashes()['prereg_pre_sha256']
