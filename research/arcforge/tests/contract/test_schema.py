"""schemas/arc-report-1.json: well-formed, in step with ids.py, and as strict as the contract."""

from __future__ import annotations

import copy
import json

import pytest

from arcforge.contract import ids, schema, synth
from arcforge.contract.verdicts import strip

SCHEMA = schema.load()
DEFS = SCHEMA['$defs']


def test_the_schemas_are_valid_json_schema():
    import jsonschema

    for path in schema.SCHEMA_DIR.glob('*.json'):
        jsonschema.Draft202012Validator.check_schema(json.loads(path.read_text()))


@pytest.mark.parametrize(
    ('definition', 'values'),
    [
        ('runId', ids.RUN_IDS),
        ('branch', ids.BRANCHES),
        ('ruleId', ids.RULE_IDS),
        ('status', ids.STATUSES),
        ('arcStatus', ids.ARC_STATUSES),
        ('component', ids.COMPONENTS),
    ],
)
def test_ids_mirror_the_schema(definition, values):
    assert tuple(DEFS[definition]['enum']) == values


def test_the_closed_sets_mirror_the_schema():
    core = DEFS['VerdictRowCore']['properties']
    assert tuple(core['kind']['enum']) == ids.ROW_KINDS
    assert tuple(core['unit']['enum']) == ids.UNITS
    assert tuple(DEFS['GatesSummary']['required']) == ids.GATE_SUMMARY_KEYS
    assert tuple(e for e in DEFS['h1Provisional']['enum'] if e) == ids.H1_PROVISIONAL
    assert ids.NOT_COMPUTABLE not in DEFS['status']['enum']  # never a verdict
    scores = schema.load(schema.SCORES_SCHEMA_PATH)
    assert tuple(scores['properties']['estimator']['enum']) == ids.ESTIMATORS


@pytest.fixture(scope='module')
def run(tmp_path_factory, frozen):
    """One synthetic r06/N run (report.json, verdicts.json) of the N path."""
    root = tmp_path_factory.mktemp('schema')
    runs = synth.write_path(root, synth.Scenario('N'), frozen[1])
    r06 = next(r for r in runs if r.run_id == 'r06')
    return json.loads((r06.run_dir / 'report.json').read_text()), json.loads(
        (r06.run_dir / 'verdicts.json').read_text()
    )


def test_a_synthetic_report_validates(run):
    report, verdicts = run
    assert schema.errors(report) == []
    assert schema.errors(verdicts, definition='VerdictsDoc') == []


def test_the_blind_form_validates_only_as_blind(run):
    _, verdicts = run
    blind = strip(verdicts)
    assert schema.errors(blind, definition='VerdictsDocBlind') == []
    assert schema.errors(blind, definition='VerdictsDoc')
    assert schema.errors(verdicts, definition='VerdictsDocBlind')


def _mutate(doc, change):
    doc = copy.deepcopy(doc)
    change(doc)
    return doc


@pytest.mark.parametrize(
    ('change', 'where'),
    [
        (lambda d: d['run'].__setitem__('branch', 'N-S'), 'run/branch'),
        (lambda d: d['run'].__setitem__('id', 'r11'), 'run/id'),
        (
            lambda d: d['hypotheses'][0].__setitem__('status', 'NOT_COMPUTABLE'),
            'hypotheses/0/status',
        ),
        (lambda d: d['hypotheses'].pop(), 'hypotheses'),
        (lambda d: d['rows'][0].__setitem__('verdict_component', 'MAYBE'), 'rows/0'),
        (lambda d: d['rows'][0].__setitem__('arm_a', 'gpt-5'), 'rows/0'),
        (lambda d: d['rows'][0].__setitem__('scores_sha256', 'abc'), 'rows/0'),
        (lambda d: d['rows'][0].__setitem__('extra', 1), 'rows/0'),
        (lambda d: d['proxy_vault'].__setitem__('sign', 2), 'proxy_vault/sign'),
        (lambda d: d['proxy_vault'].__setitem__('basis', 'owner'), 'proxy_vault/basis'),
        (lambda d: d.__setitem__('schema_version', '1.0'), 'schema_version'),
        (lambda d: d.__setitem__('gates_summary', {'I1_pass': True}), 'gates_summary'),
        (
            lambda d: d['hypotheses'][0].__setitem__('in_scope', True),
            'hypotheses/0',
        ),  # NOT_APPLICABLE but in scope
    ],
)
def test_the_verdicts_schema_is_strict(run, change, where):
    _, verdicts = run
    problems = schema.errors(_mutate(verdicts, change), definition='VerdictsDoc')
    assert problems and any(p.startswith(where) for p in problems), problems


@pytest.mark.parametrize(
    ('change', 'where'),
    [
        (
            lambda d: (
                d['vm']
                or d.__setitem__(
                    'vm',
                    {
                        'project': 'other',
                        'region': 'us-central1',
                        'shape': 'g2-standard-8',
                        'gpu': 'nvidia-l4',
                        'preemptions': 0,
                        'instances': [],
                    },
                )
            ),
            'vm',
        ),
        (lambda d: d['cost'].__setitem__('cap_usd', 25), 'cost/cap_usd'),
        (lambda d: d['sizes'].__setitem__('model_bundle_max', 5_000_000), 'sizes/model_bundle_max'),
        (lambda d: d['adoption'][0]['arms'][0].pop('control'), 'adoption/0/arms/0'),
        (lambda d: d['fable'].append({'role': 'signoff'}), 'fable/0'),
        (lambda d: d.pop('weirdness'), '(root)'),
        # Schema 1.1 (A0): no owner sign, no production branch, no owner kappa.
        (lambda d: d['fable'].append({**FABLE_CALL, 'status': 'owner_signed'}), 'fable/0/status'),
        (lambda d: d['ship'].__setitem__('production_branch_touched', True), 'ship/production_branch_touched'),
        (lambda d: d['gates'].__setitem__('I1', {**(d['gates']['I1'] or {}), 'kappa_qw_owner': 0.7}), 'gates/I1'),
        (lambda d: d.__setitem__('vault', {}), '(root)'),
    ],
)  # fmt: skip
def test_the_report_schema_is_strict(run, change, where):
    report, _ = run
    problems = schema.errors(_mutate(report, change))
    assert problems and any(p.startswith(where) for p in problems), problems


@pytest.mark.parametrize(
    ('path', 'exists', 'nullable'),
    [
        ('verdicts_doc.rows[].ci_hi_raw', True, ()),
        ('verdicts_doc.rows[].tau', True, ('verdicts_doc.rows[].tau',)),
        ('verdicts_doc.proxy_vault.sign', True, ('verdicts_doc.proxy_vault.sign',)),
        ('verdicts_doc.gates_inputs.I1.delta_ci_hi', True, ('verdicts_doc.gates_inputs.I1',)),
        ('verdicts_doc.gates_inputs.I6.fleiss_kappa', True, ('verdicts_doc.gates_inputs.I6',)),
        ('verdicts_doc.vault.sign', False, ()),
        ('verdicts_doc.gates_inputs.I1.kappa_qw_owner', False, ()),
        (
            'verdicts_doc.gates_summary.I1_pass_effective',
            True,
            ('verdicts_doc.gates_summary.I1_pass_effective',),
        ),
        ('verdicts_doc.rows[].ci_hi_rawx', False, ()),
        ('remeaning.label', True, ('remeaning',)),
        ('gates.I1.pass', True, ('gates.I1',)),
    ],
)
def test_lookup(path, exists, nullable):
    found = schema.lookup(SCHEMA, path)
    assert found.exists is exists
    if exists:
        assert found.nullable_prefixes == nullable
    else:
        assert path.startswith(found.missing_at)


FABLE_CALL = {
    'role': 'signoff', 'kind': 'prereg_signoff', 'via': 'orchestrator', 'packet_sha256': '0' * 64,
    'output_sha256': None, 'agent_session': None, 'model_reported': None, 'attempts': 2,
    'repair_cycle': 0, 'refusals': [], 'status': 'halted', 'lint_ok': True,
}  # fmt: skip


def test_a_halted_signoff_validates(run):
    report, _ = run
    assert schema.errors(_mutate(report, lambda d: d['fable'].append(dict(FABLE_CALL)))) == []


def test_the_schema_is_version_1_1():
    assert SCHEMA['properties']['schema_version'] == {
        'description': '1.1 = Amendment A0.',
        'const': '1.1',
    }
    text = schema.REPORT_SCHEMA_PATH.read_text(encoding='utf-8')
    for removed in ('kappa_qw_owner', 'n_owner_pairs', 'owner_overrides_fable', 'owner_checked',
                    'owner_signed', 'sealed_sha256', 'vault_sealed', 'owner-laptop'):  # fmt: skip
        assert removed not in text, removed


def test_subschema_needs_a_known_definition():
    with pytest.raises(KeyError):
        schema.subschema(SCHEMA, 'Nope')
