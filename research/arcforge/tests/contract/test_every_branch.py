"""`arcforge verdict` on synthetic runs of every branch path and every run id.

Each scenario writes a whole PREREG path (score files, verdicts.json, report.json) with chosen
outcomes; `arcforge verdict` must reproduce every run, every in-scope rule must come out as
planned, every out-of-scope rule NOT_APPLICABLE, and tampering anywhere must fail the run.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from arcforge import cli
from arcforge.contract import synth
from arcforge.contract.branches import Step, next_step
from arcforge.contract.ids import NOT_APPLICABLE, RUN_IDS
from arcforge.contract.rules import Rules

RUNG_FALSIFIED = {
    ('r02', 'H2'): 'FALSIFIED', ('r03', 'H3'): 'FALSIFIED', ('r03', 'H3a'): 'FALSIFIED',
    ('r05', 'H4'): 'FALSIFIED', ('r06', 'H5'): 'FALSIFIED', ('r08', 'H3b'): 'FALSIFIED',
    ('r09', 'H6'): 'FALSIFIED',
}  # fmt: skip
RUNG_INCONCLUSIVE = {key: 'INCONCLUSIVE' for key in RUNG_FALSIFIED} | {
    ('r06', 'H1'): 'INCONCLUSIVE',
    ('r10', 'H1'): 'INCONCLUSIVE',
    ('r10', 'H2'): 'INCONCLUSIVE',
    ('r10', 'H3'): 'INCONCLUSIVE',
}
SCENARIOS: dict[str, synth.Scenario] = {
    'N': synth.Scenario('N'),
    'N-F': synth.Scenario('N-F'),
    'S-F': synth.Scenario('S-F'),
    'S-C': synth.Scenario('S-C'),
    'S-C-F': synth.Scenario('S-C-F'),
    'N/fusion-only': synth.Scenario('N', statuses={('r06', 'H1'): 'FUSION_ONLY', ('r10', 'H1'): 'FUSION_ONLY'}),
    # I1 fails at R00 and is not passed at R01: H1's family is {c1, c3} at the R06 checkpoint, so
    # c2 and c4 failing does not stop SUPPORTED. R10 passes I1 again.
    'N/i1-fallback': synth.Scenario(
        'N', i1_pass={'r00': False, 'r01': False}, effects={('r06', 'H1.c2'): 0.0, ('r06', 'H1.c4'): 0.0}
    ),
    'N/rungs-falsified': synth.Scenario('N', statuses=RUNG_FALSIFIED),
    'N/inconclusive': synth.Scenario('N', statuses=RUNG_INCONCLUSIVE),
    'S-F/kill-inconclusive': synth.Scenario(
        'S-F', statuses={('r07K', 'K1'): 'INCONCLUSIVE', ('r07K', 'H7'): 'FALSIFIED', ('r10K', 'K1'): 'FALSIFIED'}
    ),
    'S-C-F/k-supported': synth.Scenario('S-C-F', statuses={('r08K', 'H7'): 'INCONCLUSIVE', ('r09K', 'H6'): 'INCONCLUSIVE'}),
}
GATES = {'I2': 'REPORTED', 'I3': 'REPORTED', 'I5': 'REPORTED', 'I4': 'PASS', 'vault.read': 'DONE',
         'adoption.default': 'DONE', 'adoption.squeeze': 'DONE', 'signoff': 'PASS'}  # fmt: skip


@pytest.fixture(scope='module')
def written(tmp_path_factory: pytest.TempPathFactory, frozen: tuple[Path, Rules]):
    rules_path, rules = frozen
    out = {}
    for name, scenario in SCENARIOS.items():
        root = tmp_path_factory.mktemp(name.replace('/', '_'))
        out[name] = (root, synth.write_path(root, scenario, rules))
    return out


def expected_status(rules: Rules, scenario: synth.Scenario, run_id: str, branch: str, rule_id: str) -> str:
    if not rules.in_scope(rule_id, run_id, branch):
        return NOT_APPLICABLE
    if rule_id == 'I1':
        return 'PASS' if scenario.i1_pass.get(run_id, True) else 'FAIL'
    if rule_id in GATES:
        return GATES[rule_id]
    return scenario.wanted(run_id, rule_id)


def test_the_scenarios_cover_every_run_id_and_every_branch(written, rules):
    pairs = {(r.run_id, r.branch) for name in ('N', 'N-F', 'S-F', 'S-C', 'S-C-F') for r in written[name][1]}
    assert pairs == rules.realizable()
    assert {run_id for run_id, _ in pairs} == set(RUN_IDS)
    assert {branch for _, branch in pairs} == {'N', 'N-F', 'S', 'S-F', 'S-C', 'S-C-F'}


@pytest.mark.parametrize('name', list(SCENARIOS))
def test_arcforge_verdict_reproduces_every_run(name, written, frozen, capsys):
    rules_path, rules = frozen
    root, runs = written[name]
    for synth_run in runs:
        code = cli.main(['verdict', synth_run.run_id, '--runs-dir', str(root), '--rules', str(rules_path)])
        out = capsys.readouterr().out
        assert code == 0, f'{name} {synth_run.run_id}:\n{out}'
        assert 'verdict reproduced' in out


@pytest.mark.parametrize('name', list(SCENARIOS))
def test_every_status_is_the_planned_one(name, written, rules):
    scenario = SCENARIOS[name]
    for synth_run in written[name][1]:
        got = {h['id']: h['status'] for h in synth_run.outcome.doc['hypotheses']}
        want = {rule.id: expected_status(rules, scenario, synth_run.run_id, synth_run.branch, rule.id) for rule in rules.rules}
        assert got == want, f'{name} {synth_run.run_id}/{synth_run.branch}'
        for entry in synth_run.outcome.doc['hypotheses']:
            assert (entry['status'] == NOT_APPLICABLE) is (not entry['in_scope'])


@pytest.mark.parametrize('name', ['N', 'N-F', 'S-F', 'S-C', 'S-C-F'])
def test_the_history_routes_each_path(name, written, rules):
    runs = written[name][1]
    steps = [Step.from_doc(r.outcome.doc) for r in runs]
    for index, synth_run in enumerate(runs):
        assert next_step(rules, steps[:index]) == (synth_run.run_id, synth_run.branch)
    assert next_step(rules, steps) is None


def arc(written, name):
    final = written[name][1][-1].outcome.doc
    return {a['id']: (a['final_status'], a['governing_run']) for a in final['arc_summary']}


def test_arc_summary_on_the_normal_path(written):
    summary = arc(written, 'N')
    assert summary['H1'] == ('SUPPORTED', 'r10')  # R10 governs
    assert summary['H2'] == ('SUPPORTED', 'r10') and summary['H3'] == ('SUPPORTED', 'r10')
    assert summary['H4'] == ('SUPPORTED', 'r05') and summary['H3b'] == ('SUPPORTED', 'r08')
    assert summary['H7'] == ('REPORTED', 'r07')  # the slot never freed
    assert summary['H1.F'] == ('NOT_TESTED', None) and summary['K1'] == ('NOT_TESTED', None)
    assert summary['FUT'] == ('NOT_FIRED', 'r04') and summary['signoff'] == ('PASS', 'r00')


def test_arc_summary_on_s_f_marks_h4_not_tested(written):
    summary = arc(written, 'S-F')
    assert summary['H4'] == ('NOT_TESTED', None)
    assert summary['H1.F'] == ('FALSIFIED', 'r05K') and summary['H1'] == ('FALSIFIED', 'r10K')
    assert summary['H7'] == ('SUPPORTED', 'r07K') and summary['K1'] == ('SUPPORTED', 'r10K')
    assert summary['H5'] == ('SUPPORTED', 'r06') and summary['FUT'] == ('FIRED', 'r04')
    reads = [r.run_id for r in written['S-F'][1] if r.outcome.doc['vault']['read_this_run']]
    assert reads == ['r04', 'r10K']  # S-F takes two reads


def test_vault_reads_follow_the_budget(written, rules):
    for name in ('N', 'N-F', 'S-F', 'S-C', 'S-C-F'):
        reads = [r.run_id for r in written[name][1] if r.outcome.doc['vault']['read_this_run']]
        assert len(reads) == rules.vault_read_budget[name] <= 3


def test_fusion_only_sets_h1_provisional(written):
    runs = {r.run_id: r for r in written['N/fusion-only'][1]}
    assert {h['id']: h['status'] for h in runs['r06'].outcome.doc['hypotheses']}['H1'] == 'FUSION_ONLY'
    assert runs['r07'].outcome.doc['run']['h1_provisional'] == 'FUSION_ONLY'
    assert arc(written, 'N/fusion-only')['H1'] == ('FUSION_ONLY', 'r10')


def test_the_i1_fallback_family_end_to_end(written):
    runs = {r.run_id: r for r in written['N/i1-fallback'][1]}
    r00 = runs['r00'].outcome.doc
    assert r00['gates_summary']['I1_pass'] is False
    assert {h['id']: h['status'] for h in r00['hypotheses']}['signoff'] == 'PASS'  # fallback scheduled
    assert r00['signoff_inputs']['i1_fallback_scheduled'] is True
    r06 = runs['r06'].outcome.doc
    assert r06['gates_inputs']['I1_prior_pass'] is False
    assert {h['id']: h['status'] for h in r06['hypotheses']}['H1'] == 'SUPPORTED'
    rows = {r['comparison_id']: r for r in r06['rows']}
    assert [rows[c]['registered'] for c in ('H1.c1', 'H1.c2', 'H1.c3', 'H1.c4')] == [True, False, True, False]
    assert rows['H1.c2']['verdict_component'] == rows['H1.c4']['verdict_component'] == 'REPORTED'
    assert rows['H1.c1']['holm_m'] == rows['H1.c3']['holm_m'] == 2
    r10 = runs['r10'].outcome.doc
    assert r10['gates_summary']['I1_pass'] is True
    assert all(r['registered'] for r in r10['rows'] if r['hypothesis'] == 'H1' and r['kind'] == 'superiority')


# ---- tampering --------------------------------------------------------------------------------


@pytest.fixture
def run_copy(written, tmp_path):
    """A writable copy of the S-C path; returns (root, run_dir of r07)."""
    root = tmp_path / 'runs'
    shutil.copytree(written['S-C'][0], root)
    return root, root / 'r07'


def verdict(root: Path, run_id: str, rules_path: Path, *extra: str) -> tuple[int, str]:
    from contextlib import redirect_stdout
    from io import StringIO

    buffer = StringIO()
    with redirect_stdout(buffer):
        code = cli.main(['verdict', run_id, '--runs-dir', str(root), '--rules', str(rules_path), *extra])
    return code, buffer.getvalue()


def edit_json(path: Path, change) -> None:
    doc = json.loads(path.read_text())
    change(doc)
    path.write_text(json.dumps(doc, indent=1))


def test_a_changed_status_fails(run_copy, frozen):
    root, run_dir = run_copy

    def flip(doc):
        target = doc.get('verdicts_doc', doc)
        next(h for h in target['hypotheses'] if h['id'] == 'H1')['status'] = 'SUPPORTED'
        next(h for h in target['hypotheses'] if h['id'] == 'H5')['status'] = 'FALSIFIED'

    edit_json(run_dir / 'verdicts.json', flip)
    edit_json(run_dir / 'report.json', flip)
    code, out = verdict(root, 'r07', frozen[0])
    assert code == 1
    assert "hypotheses[H5].status: 'FALSIFIED', recomputed 'SUPPORTED'" in out


def test_a_changed_score_file_fails(run_copy, frozen):
    root, run_dir = run_copy
    edit_json(run_dir / 'scores' / 'H1.c1.json', lambda d: d['items'][0]['a'].__setitem__(0, 0.99))
    code, out = verdict(root, 'r07', frozen[0])
    assert code == 1
    assert 'rows[H1.c1].scores_sha256' in out and 'rows[H1.c1].point' in out


def test_a_score_file_for_another_row_fails(run_copy, frozen):
    root, run_dir = run_copy
    shutil.copy(run_dir / 'scores' / 'H1.c3.json', run_dir / 'scores' / 'H1.c1.json')
    code, out = verdict(root, 'r07', frozen[0])
    assert code == 1 and "comparison_id is 'H1.c3'; row H1.c1 needs 'H1.c1'" in out


def test_a_changed_number_fails(run_copy, frozen):
    root, run_dir = run_copy

    def nudge(doc):
        target = doc.get('verdicts_doc', doc)
        next(r for r in target['rows'] if r['comparison_id'] == 'H5.c1')['ci_lo_adj'] += 0.01

    edit_json(run_dir / 'verdicts.json', nudge)
    edit_json(run_dir / 'report.json', nudge)
    code, out = verdict(root, 'r07', frozen[0])
    assert code == 1 and 'rows[H5.c1].ci_lo_adj' in out


def test_report_and_verdicts_must_agree(run_copy, frozen):
    root, run_dir = run_copy
    edit_json(run_dir / 'report.json', lambda d: d['vault'].__setitem__('sign', -1))
    code, out = verdict(root, 'r07', frozen[0])
    assert code == 1 and 'report.vault.sign' in out


def test_every_rule_must_be_listed(run_copy, frozen):
    root, run_dir = run_copy

    def drop(doc):
        target = doc.get('verdicts_doc', doc)
        target['hypotheses'] = [h for h in target['hypotheses'] if h['id'] != 'I3']

    edit_json(run_dir / 'verdicts.json', drop)
    code, out = verdict(root, 'r07', frozen[0])
    assert code == 1 and 'lists I3 0 times' in out


def test_other_rules_are_refused(run_copy, tmp_path):
    root, _ = run_copy
    other, _ = synth.write_rules(tmp_path / 'other', stats={'resamples': 401, 'permutations': 400, 'refit_resamples': 100})
    code, out = verdict(root, 'r07', other)
    assert code == 1 and 'run.rules_sha256' in out


def test_the_final_run_needs_every_earlier_run(run_copy, frozen):
    root, _ = run_copy
    shutil.rmtree(root / 'r05K')
    code, out = verdict(root, 'r10', frozen[0])
    assert code == 1 and 'arc_summary' in out


def test_emit_is_byte_identical(written, frozen, tmp_path):
    root, runs = written['S-C-F']
    for synth_run in runs:
        target = tmp_path / f'{synth_run.run_id}.json'
        code, _ = verdict(root, synth_run.run_id, frozen[0], '--emit', str(target))
        assert code == 0
        assert target.read_bytes() == (synth_run.run_dir / 'verdicts.json').read_bytes()


def test_inputs_with_a_planted_null_fail_not_computable(written, frozen, tmp_path):
    root, runs = written['N']
    r06 = next(r for r in runs if r.run_id == 'r06')
    inputs = json.loads((r06.run_dir / 'verdicts.json').read_text())
    inputs['vault']['sign'] = None
    path = tmp_path / 'inputs.json'
    path.write_text(json.dumps(inputs))
    code, out = verdict(root, 'r06', frozen[0], '--inputs', str(path), '--emit', str(tmp_path / 'out.json'))
    assert code == 1
    assert 'H1: NOT_COMPUTABLE (reads null' in out and 'vault.sign' in out
    assert not (tmp_path / 'out.json').exists()


def test_verdict_json_output(written, frozen):
    root, _ = written['N']
    code, out = verdict(root, 'r04', frozen[0], '--json')
    result = json.loads(out)
    assert code == 0 and result['ok'] is True
    assert result['statuses']['FUT'] == 'NOT_FIRED' and result['statuses']['H1'] == NOT_APPLICABLE


def test_a_missing_run_is_a_usage_error(tmp_path, frozen, capsys):
    assert cli.main(['verdict', 'r03', '--runs-dir', str(tmp_path), '--rules', str(frozen[0])]) == 2
    assert 'no run directory' in capsys.readouterr().err
