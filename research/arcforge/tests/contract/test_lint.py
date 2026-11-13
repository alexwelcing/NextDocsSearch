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
    assert sum(len(v) for v in report.scope.values()) == 145


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
         '    N: {fields: [*after_r00, adoption, proxy_vault.read_index], rows: [*h5_rows, H1.c1, H1.c2, H1.c4, H1.g1]}'),
    )  # fmt: skip
    report = lint(plan_path=write(tmp_path, 'plan.yaml', plan))
    found = {
        (f.rule, f.run, f.branch, f.message) for f in report.errors if f.code == 'not-computable'
    }
    assert any(
        r == 'H1' and (run, b) == ('r06', 'N') and 'row H1.c3' in m for r, run, b, m in found
    )
    assert any(
        r == 'H1' and (run, b) == ('r06', 'N') and 'proxy_vault.sign' in m for r, run, b, m in found
    )
    assert any(r == 'proxy_vault.read' and run == 'r06' for r, run, _, _ in found)
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
        (
            "      - [FALSIFIED, 'c1.ci_hi_raw < 0.05 and gates_summary.I6_pass']",
            "      - [FALSIFIED, 'c1.ci_hi_raw < 0 and gates_summary.I6_pass']",
        ),
        (
            'proxy_vault_read_budget: {N: 3, N-F: 3, S-F: 2, S-C: 3, S-C-F: 3}',
            'proxy_vault_read_budget: {N: 3, N-F: 3, S-F: 3, S-C: 3, S-C-F: 3}',
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert {'review3-h3-falsifier', 'review3-sf-reads', 'vault-budget'} <= codes(report)


def test_lint_caps_vault_reads(tmp_path):
    rules = replaced(
        RULES,
        ('      - {runs: [r10K], branches: [K]}\n    reads: [proxy_vault.sign, proxy_vault.read_index, proxy_vault.basis]',
         '      - {runs: [r10K], branches: [K]}\n      - {runs: [r09], branches: [N]}\n    reads: [proxy_vault.sign, proxy_vault.read_index, proxy_vault.basis]'),
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
    assert data['rules']['sha256'] == report.rules_sha256 and len(data['scope']) == 23


def test_the_lint_report_validates_against_arc_lint_1(tmp_path):
    from arcforge.contract import schema

    lint_schema = schema.load(schema.SCHEMA_DIR / 'arc-lint-1.json')
    failing = lint(write(tmp_path, 'rules.yaml', RULES.replace('schema: arc-rules/1', 'schema: x')))
    for report in (lint(), lint(frozen=True), failing):
        assert schema.errors(report.to_json(), lint_schema) == []


# ---- Amendment A0 lint additions ------------------------------------------------------------


def test_lint_catches_an_owner_field_read(tmp_path):
    rules = replaced(
        RULES,
        (
            "      I1c: 'gates_inputs.I1.min_kendall_ci_lo >= 0.6'",
            "      I1c: 'gates_inputs.I1.min_kendall_ci_lo >= 0.6 and gates_inputs.I1.kappa_qw_owner >= 0.6'",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(f.code == 'owner-field' and f.rule == 'I1' for f in report.errors)


def test_lint_catches_an_owner_sourced_row(tmp_path):
    rules = replaced(
        RULES,
        (
            "      k2: {kind: superiority, arm_a: B2, arm_b: B2w, stratum: D.coinage+entity,",
            "      k2: {kind: superiority, arm_a: B2, arm_b: B2w, stratum: B.owner_authored,",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(f.code == 'owner-field' and 'K1.k2' in f.message for f in report.errors)


def test_lint_catches_an_owner_field_left_in_the_schema(tmp_path):
    import json

    from arcforge.contract import schema as report_schema

    data = json.loads(report_schema.REPORT_SCHEMA_PATH.read_text(encoding='utf-8'))
    collisions = data['$defs']['Collisions']['properties']
    collisions['owner_checked'] = {'$ref': '#/$defs/count'}
    data['$defs']['FableCall']['properties']['status']['enum'].append('owner_signed')
    path = write(tmp_path, 'schema.json', json.dumps(data))
    report = lint(schema_path=path)
    messages = [f.message for f in report.errors if f.code == 'owner-field']
    assert any("'owner_checked'" in m for m in messages)
    assert any("'owner_signed'" in m for m in messages)


def test_lint_catches_a_per_query_proxy_vault_read_before_r10(tmp_path):
    rules = replaced(
        RULES,
        (
            "      - [FIRED, 'FIRES(c1) and proxy_vault.sign in (-1, 0)']",
            "      - [FIRED, 'FIRES(c1) and proxy_vault.sign in (-1, 0) and proxy_vault.per_query']",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(
        f.code == 'proxy-vault-per-query' and f.rule == 'FUT' and 'r04/N' in f.message
        for f in report.errors
    )


def test_lint_catches_a_row_on_the_vault_set_before_r10(tmp_path):
    rules = replaced(
        RULES,
        (
            "      c1: {kind: guard, arm_a: hyb(champ), arm_b: B2, stratum: AB, metric: mrr@10, unit: fraction,\n           fires: 'x.point < -0.02 and x.ci_hi_raw < 0'}\n    outcomes:\n      # 'unavailable'",
            "      c1: {kind: guard, arm_a: hyb(champ), arm_b: B2, stratum: C_vault, metric: mrr@10, unit: fraction,\n           fires: 'x.point < -0.02 and x.ci_hi_raw < 0'}\n    outcomes:\n      # 'unavailable'",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(f.code == 'proxy-vault-per-query' and 'FUT.c1' in f.message for f in report.errors)


def test_lint_catches_production_traffic_in_a_registered_row(tmp_path):
    rules = replaced(
        RULES,
        (
            "      k1: {kind: superiority, arm_a: B2, arm_b: B2w, stratum: AB, metric: mrr@10, unit: fraction,",
            "      k1: {kind: superiority, arm_a: B2, arm_b: B2w, stratum: AB, metric: shadow_ctr, unit: fraction,",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(f.code == 'production-traffic' and 'K1.k1' in f.message for f in report.errors)


def test_lint_catches_a_row_on_post_s0_alone(tmp_path):
    rules = replaced(
        RULES,
        (
            "      k1: {kind: superiority, arm_a: B2, arm_b: B2w, stratum: AB, metric: mrr@10, unit: fraction,",
            "      k1: {kind: superiority, arm_a: B2, arm_b: B2w, stratum: POST_S0, metric: mrr@10, unit: fraction,",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert any(f.code == 'post-s0-alone' and 'K1.k1' in f.message for f in report.errors)


def test_lint_requires_i6_in_h3(tmp_path):
    rules = replaced(
        RULES,
        (
            "      - [SUPPORTED, 'PASS(c1) and PASS(c2) and gates_summary.I6_pass']",
            "      - [SUPPORTED, 'PASS(c1) and PASS(c2)']",
        ),
    )
    report = lint(write(tmp_path, 'rules.yaml', rules))
    assert 'a0-h3-i6' in codes(report)


class FakeStage:
    def __init__(self, name, inputs=(), outputs=(), **extra):
        self.name, self.inputs, self.outputs = name, tuple(inputs), tuple(outputs)
        for key, value in extra.items():
            setattr(self, key, value)


def m2_stages(**overrides):
    """The R00 DAG's reader-relevant edges (INTERFACES-M2 B), as a fake registry."""
    stages = {
        'S1': FakeStage('S1', ['S0'], ['graph.json', 'chunks.jsonl.gz']),
        'S2p': FakeStage('S2p', ['S1'], ['person_map.json']),
        'P1': FakeStage('P1', ['S1'], ['c_open.jsonl', 'c_frontier.jsonl', 'panel_diagnostics.json']),
        'S5': FakeStage('S5', ['S1', 'S2p'], ['train_queries.raw.jsonl.gz']),
        'S6b': FakeStage('S6b', ['S1', 'P1'], ['bench_queries.jsonl', 'qrels_fixed.jsonl', 'fewshot.json']),
        'S7': FakeStage('S7', ['S5', 'S6b'], ['train_queries.jsonl.gz', 'bench_query_emb.safetensors'],
                        reader_outputs=('bench_query_emb.safetensors',)),
        'S8': FakeStage('S8', ['S7'], ['init_rows.safetensors'],
                        consumes={'S7': ('train_queries.jsonl.gz',)}),
        'S9': FakeStage('S9', ['S2p', 'S7', 'S8'], ['students.tar'],
                        consumes={'S7': ('train_queries.jsonl.gz',)}),
        'S12a': FakeStage('S12a', ['S6b', 'S7'], ['rankings.jsonl.gz']),
    }  # fmt: skip
    for name, stage in overrides.items():
        stages[name] = stage
    return stages


def test_reader_isolation_passes_the_registered_m2_edges():
    report = lint(stages=m2_stages())
    assert report.ok, [str(f) for f in report.errors]


def test_lint_catches_a_reader_output_in_a_training_input():
    # S5 reads the bench (which carries C_open) directly: a training input.
    report = lint(stages=m2_stages(S5=FakeStage('S5', ['S1', 'S2p', 'S6b'], ['train_queries.raw.jsonl.gz'])))
    assert any(f.code == 'reader-in-training' and 'S5' in f.message for f in report.errors)
    # S8 reads every S7 output, the bench-query embeddings included.
    report = lint(stages=m2_stages(S8=FakeStage('S8', ['S7'], ['init_rows.safetensors'])))
    assert any(f.code == 'reader-in-training' and 'S8' in f.message and 'bench_query_emb' in f.message
               for f in report.errors)  # fmt: skip
    # S9 reads P1 itself.
    report = lint(stages=m2_stages(S9=FakeStage('S9', ['S2p', 'S8', 'P1'], ['students.tar'])))
    assert any(f.code == 'reader-in-training' and 'reads P1/' in f.message and 'c_open.jsonl' in f.message
               for f in report.errors)  # fmt: skip


def test_lint_catches_bad_isolation_declarations():
    report = lint(stages=m2_stages(S7=FakeStage(
        'S7', ['S5', 'S6b'], ['train_queries.jsonl.gz'], reader_outputs=('nope.json',),
        consumes={'S4': ('x',)},
    )))  # fmt: skip
    assert {'reader-outputs-unknown', 'consumes-unknown'} <= codes(report)


def test_the_live_registry_passes_reader_isolation():
    from arcforge.contract import isolation

    registry = isolation.live_registry()
    assert registry is not None
    assert isolation.check(registry) == []
