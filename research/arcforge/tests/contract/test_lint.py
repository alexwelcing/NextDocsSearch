"""`arcforge prereg lint`: applies_to expanded over the branch table, computability, invariants."""

from __future__ import annotations

from pathlib import Path

from arcforge.contract.lint import PRODUCES_PATH, lint
from arcforge.contract.rules import TEMPLATE_PATH

RULES = TEMPLATE_PATH.read_text(encoding='utf-8')
PLAN = PRODUCES_PATH.read_text(encoding='utf-8')


def replaced(text: str, *pairs: tuple[str, str]) -> str:
    for old, new in pairs:
        assert text.count(old) == 1, old
        text = text.replace(old, new)
    return text


def write(tmp_path: Path, name: str, text: str) -> Path:
    path = tmp_path / name
    path.write_text(text, encoding='utf-8')
    return path


def codes(report) -> set[str]:
    return {f.code for f in report.errors}


def test_the_template_lints_clean():
    report = lint()
    assert report.ok, [str(f) for f in report.errors]
    assert [f.code for f in report.warnings] == ['template']
    assert report.scope['H1'] == [
        'r06/N',
        'r07/S-C',
        'r10/N',
        'r10/S-C',
        'r10K/N-F',
        'r10K/S-F',
        'r10K/S-C-F',
    ]
    assert sum(len(v) for v in report.scope.values()) == 139


def test_frozen_requires_every_mde():
    report = lint(frozen=True)
    assert [f.code for f in report.errors] == ['not-frozen']


def test_the_frozen_copy_lints_clean(frozen):
    report = lint(frozen[0], frozen=True)
    assert report.ok and not report.warnings, [str(f) for f in report.findings]


def test_lint_catches_a_field_the_plan_leaves_null_in_an_in_scope_run(tmp_path):
    plan = replaced(
        PLAN,
        ('    N: {fields: [*after_r00, adoption, *vault_read], rows: [*h5_rows, *h1_rows]}',
         '    N: {fields: [*after_r00, adoption, vault.read_index], rows: [*h5_rows, H1.c1, H1.c2, H1.c4, H1.g1]}'),
    )  # fmt: skip
    report = lint(plan_path=write(tmp_path, 'plan.yaml', plan))
    found = {
        (f.rule, f.run, f.branch, f.message) for f in report.errors if f.code == 'not-computable'
    }
    assert any(
        r == 'H1' and (run, b) == ('r06', 'N') and 'row H1.c3' in m for r, run, b, m in found
    )
    assert any(
        r == 'H1' and (run, b) == ('r06', 'N') and 'vault.sign' in m for r, run, b, m in found
    )
    assert any(r == 'vault.read' and run == 'r06' for r, run, _, _ in found)
    # Every other (rule, run, branch) is still computable.
    assert {(f.run, f.branch) for f in report.errors} == {('r06', 'N')}


def test_lint_catches_a_carried_gate_the_plan_drops(tmp_path):
    plan = replaced(
        PLAN,
        ('    N: {fields: [*after_r00, adoption, *vault_read], rows: [*h5_rows, *h1_rows]}',
         '    N: {fields: [gates_inputs.I3, gates_inputs.I4, adoption, *vault_read], rows: [*h5_rows, *h1_rows]}'),
    )  # fmt: skip
    report = lint(plan_path=write(tmp_path, 'plan.yaml', plan))
    messages = [f.message for f in report.errors if f.rule == 'H1']
    assert any('gates_summary.I1_pass_effective' in m and 'I1_prior_pass' in m for m in messages)


def test_lint_catches_a_rule_without_applies_to(tmp_path):
    rules = replaced(
        RULES,
        (
            '    applies_to: [{runs: [r03], branches: [N]}]\n    rows:\n      a1:',
            '    rows:\n      a1:',
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert not report.ok and any('H3a: lacks applies_to' in f.message for f in report.errors)


def test_lint_catches_a_field_absent_from_the_schema(tmp_path):
    rules = replaced(
        RULES,
        (
            "      - [FALSIFIED, 'k1.ci_hi_raw < 0.01']",
            "      - [FALSIFIED, 'k1.ci_high_raw < 0.01']",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert 'field-not-in-schema' in codes(report)
    assert any(f.rule == 'K1' and 'ci_high_raw' in f.message for f in report.errors)


def test_lint_catches_unreachable_and_dead_clauses(tmp_path):
    rules = replaced(
        RULES,
        ('      - {runs: [r05], branches: [N]}\n      - {runs: [r06], branches: [S-C]}',
         '      - {runs: [r05], branches: [N, S-C]}\n      - {runs: [r06], branches: [S-C]}\n      - {runs: [r05K], branches: [N]}'),
    )  # fmt: skip
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert {'unreachable-pair', 'dead-clause'} <= codes(report)
    assert any('r05/S-C' in f.message for f in report.errors if f.code == 'unreachable-pair')


def test_lint_checks_the_review3_fixes(tmp_path):
    rules = replaced(
        RULES,
        ("      - [FALSIFIED, 'c1.ci_hi_raw < 0.05']", "      - [FALSIFIED, 'c1.ci_hi_raw < 0']"),
        (
            'vault_read_budget: {N: 3, N-F: 3, S-F: 2, S-C: 3, S-C-F: 3}',
            'vault_read_budget: {N: 3, N-F: 3, S-F: 3, S-C: 3, S-C-F: 3}',
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert {'review3-h3-falsifier', 'review3-sf-reads', 'vault-budget'} <= codes(report)


def test_lint_caps_vault_reads(tmp_path):
    rules = replaced(
        RULES,
        ('      - {runs: [r10K], branches: [K]}\n    reads: [vault.sign, vault.read_index]',
         '      - {runs: [r10K], branches: [K]}\n      - {runs: [r09], branches: [N]}\n    reads: [vault.sign, vault.read_index]'),
    )  # fmt: skip
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(f.code == 'vault-budget' and 'path N:' in f.message for f in report.errors)


def test_lint_keeps_every_hypothesis_out_of_r00(tmp_path):
    rules = replaced(
        RULES, ('      - {runs: [r02], branches: [N]}', '      - {runs: [r00, r02], branches: [N]}')
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(f.code == 'r00-hypothesis' and f.rule == 'H2' for f in report.errors)


def test_lint_checks_the_decisions(tmp_path):
    rules = replaced(
        RULES,
        (
            '  - {after: r07, branch: S-C, rule: H1, outcomes: {FALSIFIED: [S-C-F], SUPPORTED: [S-C], FUSION_ONLY: [S-C], INCONCLUSIVE: [S-C]}}\n',
            '',
        ),
        ('FUSION_ONLY: [N], INCONCLUSIVE: [N]}}', 'FUSION_ONLY: [N]}}'),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    messages = [f.message for f in report.errors if f.code == 'decision']
    assert any('S-C and S-C-F fork after r07/S-C' in m for m in messages)
    assert any(
        "H1 can be ['FALSIFIED', 'FUSION_ONLY', 'INCONCLUSIVE', 'SUPPORTED']" in m for m in messages
    )


def test_lint_checks_the_plan_itself(tmp_path):
    plan = replaced(
        PLAN,
        (
            '    N: {fields: *after_r00, rows: *h3b_rows}',
            '    N: {fields: [*after_r00, gates_inputs.I9], rows: [*h3b_rows, H9.c1, H2.c1]}',
        ),
        (
            '  r09:\n    N: {fields: *after_r00, rows: *h6_rows}\n',
            '  r09:\n    N: {fields: *after_r00, rows: *h6_rows}\n    S: {fields: [], rows: []}\n',
        ),
        ('    S-C-F: {fields: *after_r00, rows: [*h3b_rows, *k1_rows, H7.c1]}\n', ''),
    )
    report = lint(plan_path=write(tmp_path, 'plan.yaml', plan))
    assert {'plan-field', 'plan-row', 'plan-unreachable', 'plan-missing', 'row-unread'} <= codes(
        report
    )


def test_the_lint_report_is_json(tmp_path):
    report = lint()
    data = report.to_json()
    assert data['schema'] == 'arc-lint/1' and data['ok'] is True and data['frozen'] is False
    assert data['rules']['sha256'] == report.rules_sha256 and len(data['scope']) == 22
