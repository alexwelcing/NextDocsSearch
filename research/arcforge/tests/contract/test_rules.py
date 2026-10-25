"""rules.yaml: the template's content against the program, and the loader's strictness."""

from __future__ import annotations

import re

import pytest

from arcforge.contract.ids import RULE_IDS
from arcforge.contract.rules import (
    TEMPLATE_PATH,
    RulesError,
    freeze_text,
    load_yaml,
    loads_rules,
    parse_rules,
)

TEMPLATE = TEMPLATE_PATH.read_text(encoding='utf-8')


def pairs(rules, rule_id):
    return [f'{r}/{b}' for r, b in rules.scope_pairs(rule_id)]


def test_the_template_defines_every_rule_with_applies_to(template):
    assert [r.id for r in template.rules] == list(RULE_IDS)
    assert all(rule.applies_to for rule in template.rules)
    assert not template.frozen and set(template.mde_r00) == {
        'AB',
        'D',
        'CE',
        'G',
        'vault',
        'frontier',
    }


@pytest.mark.parametrize(
    ('rule_id', 'expected'),
    [
        ('FUT', ['r04/N']),
        ('H1.F', ['r05K/S']),
        ('H1', ['r06/N', 'r07/S-C', 'r10/N', 'r10/S-C', 'r10K/N-F', 'r10K/S-F', 'r10K/S-C-F']),
        ('H2', ['r02/N', 'r10/N', 'r10/S-C', 'r10K/N-F', 'r10K/S-F', 'r10K/S-C-F']),
        ('H3', ['r03/N', 'r10/N', 'r10/S-C', 'r10K/N-F', 'r10K/S-F', 'r10K/S-C-F']),
        ('H3a', ['r03/N']),
        ('H3b', ['r08/N', 'r08/N-F', 'r08/S-F', 'r08/S-C', 'r08K/S-C-F']),
        ('H4', ['r05/N', 'r06/S-C']),
        ('H5', ['r06/N', 'r06/S-F', 'r07/S-C']),
        ('H6', ['r09/N', 'r09/S-C', 'r09K/N-F', 'r09K/S-F', 'r09K/S-C-F']),
        ('H7', ['r07K/N-F', 'r07K/S-F', 'r08K/S-C-F']),
        ('H7.report', ['r07/N', 'r08/S-C']),
        ('K1', ['r07K/N-F', 'r07K/S-F', 'r08K/S-C-F', 'r10K/N-F', 'r10K/S-F', 'r10K/S-C-F']),
        ('I1', ['r00/N', 'r01/N', 'r10/N', 'r10/S-C', 'r10K/N-F', 'r10K/S-F', 'r10K/S-C-F']),
        ('I2', ['r04/N']),
        ('I5', ['r00/N', 'r10/N', 'r10/S-C', 'r10K/N-F', 'r10K/S-F', 'r10K/S-C-F']),
        (
            'vault.read',
            ['r04/N', 'r06/N', 'r07/S-C', 'r10/N', 'r10/S-C', 'r10K/N-F', 'r10K/S-F', 'r10K/S-C-F'],
        ),
        (
            'adoption.default',
            ['r01/N', 'r02/N', 'r03/N', 'r04/N', 'r05/N', 'r06/N', 'r06/S-F', 'r06/S-C', 'r07/S-C'],
        ),
        ('adoption.squeeze', ['r07/N', 'r08/S-C']),
        ('signoff', ['r00/N']),
    ],
)
def test_scopes_match_the_program(template, rule_id, expected):
    """applies_to as report_schema.RULES writes it, expanded over the branch table."""
    assert pairs(template, rule_id) == expected


def test_i3_applies_to_every_run_and_i4_to_every_run_but_r00(template):
    realizable = sorted(template.realizable())
    assert len(pairs(template, 'I3')) == len(realizable) == 29  # 11 + 4 + 6 + 5 + 3 pairs
    assert pairs(template, 'I4') == [p for p in pairs(template, 'I3') if not p.startswith('r00/')]


def test_the_branch_table_matches_prereg(template):
    table = {
        name: ' '.join(f'{r}:{b}' for r, b in seq) for name, seq in template.branch_table.items()
    }
    assert table['N'] == ' '.join(
        f'{r}:N'
        for r in ('r00', 'r01', 'r02', 'r03', 'r04', 'r05', 'r06', 'r07', 'r08', 'r09', 'r10')
    )
    assert table['N-F'].endswith('r06:N r07K:N-F r08:N-F r09K:N-F r10K:N-F')
    assert table['S-F'].endswith('r04:N r05K:S r06:S-F r07K:S-F r08:S-F r09K:S-F r10K:S-F')
    assert table['S-C'].endswith('r05K:S r06:S-C r07:S-C r08:S-C r09:S-C r10:S-C')
    assert table['S-C-F'].endswith('r05K:S r06:S-C r07:S-C r08K:S-C-F r09K:S-C-F r10K:S-C-F')


def test_taus_follow_max_floor_mde(rules, template):
    assert template.tau(template.rows['H1.c1']) is None  # not frozen yet
    assert rules.tau(rules.rows['H1.c1']) == 0.045  # max(0.04, MDE_AB 0.045)
    assert rules.tau(rules.rows['H1.c2']) == 0.04  # max(0.04, MDE_D 0.03)
    assert rules.tau(rules.rows['H2.c2']) == 0.08  # max(0.08, MDE_G 0.045)
    assert rules.tau(rules.rows['H3.c1']) == 0.15  # no MDE: the floor
    assert rules.tau(rules.rows['H1.g1']) is None  # guards have no tau
    assert rules.mde_value(rules.rows['H3b.b2']) == 0.045


def test_row_defaults(template):
    c2, g1, report = template.rows['H1.c2'], template.rows['H1.g1'], template.rows['H7.report.c1']
    assert c2.holm and c2.passes is not None and c2.passes.source == 'PASS(x)'
    assert not g1.holm and g1.fires is not None and g1.passes is None
    assert (
        report.registered is False
        and not report.holm
        and report.prediction.source == 'x.point >= 0'
    )
    assert template.rows['H3b.b2'].holm and template.rows['H3b.b2'].kind == 'bound'
    assert (
        template.rows['H6.r1'].estimator == 'cluster_ratio'
        and template.rows['H3.c1'].estimator == 'refit_pooled'
    )


def test_freeze_keeps_comments_and_changes_only_the_mdes():
    mde = {'AB': 0.045, 'D': 0.03, 'CE': 0.05, 'G': 0.045, 'vault': 0.09, 'frontier': 0.1}
    frozen = freeze_text(TEMPLATE, mde)
    changed = [
        (a, b) for a, b in zip(TEMPLATE.splitlines(), frozen.splitlines(), strict=True) if a != b
    ]
    assert [b.strip() for _, b in changed] == [
        'AB: 0.045',
        'D: 0.03',
        'CE: 0.05',
        'G: 0.045',
        'vault: 0.09',
        'frontier: 0.1',
    ]
    assert loads_rules(frozen).frozen
    with pytest.raises(RulesError, match='freeze needs exactly'):
        freeze_text(TEMPLATE, {'AB': 0.1})
    with pytest.raises(RulesError, match='must be a number'):
        freeze_text(TEMPLATE, {**mde, 'AB': -1})


def edited(old: str, new: str) -> str:
    assert TEMPLATE.count(old) == 1, old
    return TEMPLATE.replace(old, new)


@pytest.mark.parametrize(
    ('text', 'message'),
    [
        (
            edited(
                '    applies_to: [{runs: [r03], branches: [N]}]\n    rows:\n      a1:',
                '    rows:\n      a1:',
            ),
            'H3a: lacks applies_to',
        ),
        (
            edited(
                '{runs: [r04], branches: [N]}]\n    rows:\n      c1: {kind: guard',
                '{runs: [r04], branches: [Q]}]\n    rows:\n      c1: {kind: guard',
            ),
            "unknown id 'Q'",
        ),
        (
            edited(
                '{runs: [r04], branches: [N]}]\n    rows:\n      c1: {kind: guard',
                '{runs: [r4], branches: [N]}]\n    rows:\n      c1: {kind: guard',
            ),
            "unknown id 'r4'",
        ),
        (
            edited(
                "      - [FALSIFIED, 'c1.ci_hi_raw < 0.05']",
                "      - [FAILED, 'c1.ci_hi_raw < 0.05']",
            ),
            "unknown status 'FAILED'",
        ),
        (
            edited(
                "      - [FALSIFIED, 'c1.ci_hi_raw < 0.05']",
                "      - [FALSIFIED, 'c9.ci_hi_raw < 0.05']",
            ),
            "unknown name 'c9'",
        ),
        (
            edited(
                "      - [FALSIFIED, 'c1.ci_hi_raw < 0.05']",
                "      - [FALSIFIED, 'c1.verdict_component == 1']",
            ),
            'an outcome field no rule may read',
        ),
        (
            edited('    rows: {c1: H1.c1, g1: H1.g1}', '    rows: {c1: H1.c9, g1: H1.g1}'),
            "'H1.c9' is not defined",
        ),
        (edited('  - id: H3a\n', '  - id: H3\n'), 'H3: defined more than once'),
        (edited('  - id: K1\n', '  - id: K2\n'), 'unknown rule id'),
        (
            edited(
                '    status: REPORTED\n\n  - id: K1',
                '    status: REPORTED\n    else: FAIL\n\n  - id: K1',
            ),
            'either a constant status or outcomes',
        ),
        (
            edited(
                "unit: rho, prediction: 'x.point >= 0'}",
                "unit: rho, prediction: 'x.point >= 0', registered: true}",
            ),
            'registered must be false',
        ),
        (
            edited(
                "unit: ratio, estimator: cluster_ratio, passes: 'x.point >= 0.90 and x.ci_lo_raw >= 0.80'}\n      r2:",
                "unit: ratio, passes: 'x.point >= 0.90 and x.ci_lo_raw >= 0.80'}\n      r2:",
            ),
            'cluster_ratio estimator',
        ),
        (
            edited(
                '    adopt: {method: squeeze, within: 0.01, max_bundle_raw: 4000000}',
                '    adopt: {method: squeeze, within: 0.01}',
            ),
            'squeeze takes exactly',
        ),
        (
            edited(
                'vault_read_budget: {N: 3, N-F: 3, S-F: 2, S-C: 3, S-C-F: 3}',
                'vault_read_budget: {N: 3, N-F: 3, S-F: 4, S-C: 3, S-C-F: 3}',
            ),
            'must be 0..3',
        ),
        (
            edited('      futility_fired: "status == \'FIRED\'"\n', ''),
            'futility_fired must be produced by exactly one rule',
        ),
        (
            edited(
                "  PASS: 'x.point >= x.tau and x.ci_lo_adj > 0 and x.point > x.seed_sd'",
                "  PASS: 'c1.point > 0'",
            ),
            "unknown name 'c1'",
        ),
        (edited('schema: arc-rules/1', 'schema: arc-rules/2'), "must be 'arc-rules/1'"),
    ],
)
def test_the_loader_reports_problems(text, message):
    with pytest.raises(RulesError) as caught:
        loads_rules(text)
    assert any(message in problem for problem in caught.value.problems), caught.value.problems


def test_the_loader_collects_every_problem():
    text = edited(
        '    applies_to: [{runs: [r03], branches: [N]}]\n    rows:\n      a1:',
        '    rows:\n      a1:',
    )
    text = text.replace(
        "      - [FALSIFIED, 'c1.ci_hi_raw < 0.05']", "      - [FAILED, 'c1.ci_hi_raw < 0.05']"
    )
    with pytest.raises(RulesError) as caught:
        loads_rules(text)
    assert len(caught.value.problems) >= 2


def test_parse_rules_needs_a_mapping():
    with pytest.raises(RulesError, match='top level'):
        parse_rules(['not', 'a', 'mapping'])
    with pytest.raises(RulesError, match='not valid YAML'):
        load_yaml('a: [unclosed')


def test_yaml_never_coerces_ids(template):
    """Plain scalars such as N, S, r00 stay strings (no YAML 1.1 booleans)."""
    assert all(isinstance(b, str) for seq in template.branch_table.values() for _, b in seq)
    assert re.search(r'^\s+N:\s+\[\[r00, N\]', TEMPLATE, re.M)


def test_the_vault_read_points_agree_with_vault_read(template):
    """arcforge.vault refuses reads outside its table; it must be vault.read's scope, per path."""
    from arcforge.vault.readpoints import READ_POINTS

    assert set(READ_POINTS) == set(template.branch_table)
    for path, seq in template.branch_table.items():
        reads = tuple(run for run, branch in seq if template.in_scope('vault.read', run, branch))
        assert reads == READ_POINTS[path], path
        assert len(reads) == template.vault_read_budget[path]
