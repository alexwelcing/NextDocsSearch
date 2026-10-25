"""The verdict function on numeric verdicts documents: every rule's logic and its boundaries."""

from __future__ import annotations

from typing import Any

import pytest

from arcforge.contract.ids import NOT_APPLICABLE, RULE_IDS, STRIPPED_FIELDS
from arcforge.contract.rules import Rules
from arcforge.contract.verdicts import (
    diff,
    evaluate,
    strip,
    stripped_field_names,
    stripped_keys_present,
)

PASSING = (0.12, 0.10, 0.14)
CLEAR = (0.0, -0.01, 0.01)
DEFAULTS = {
    'guard': CLEAR,
    'bound': CLEAR,
    'ratio': (0.97, 0.95, 0.99),
    'report': (0.02, 0.0, 0.04),
}
SPECIAL = {'H3b.b1': (-0.05, -0.06, -0.04)}


def scope_rows(rules: Rules, run_id: str, branch: str, **overrides: Any) -> dict[str, Any]:
    """Default (passing / clear) numbers for every row an in-scope rule reads; override by alias
    of the owning rule, e.g. c1=(0.0, -0.01, 0.01) on H1, or by full id with dots as '__'."""
    rows: dict[str, Any] = {}
    for rule in rules.rules:
        if not rules.in_scope(rule.id, run_id, branch):
            continue
        for cid in rule.rows.values():
            spec = rules.rows[cid]
            rows[cid] = SPECIAL.get(cid, DEFAULTS.get(spec.kind, PASSING))
    for key, value in overrides.items():
        cid = key.replace('__', '.')
        assert cid in rows, f'{cid} is not read at {run_id}/{branch}'
        rows[cid] = value
    return rows


def statuses(outcome) -> dict[str, str]:
    return {h['id']: h['status'] for h in outcome.doc['hypotheses']}


def components(outcome) -> dict[str, str]:
    return {r['comparison_id']: r['verdict_component'] for r in outcome.doc['rows']}


def run(make_doc, rules, run_id, branch, rows=None, **kwargs):
    doc = make_doc(run_id, branch, scope_rows(rules, run_id, branch, **(rows or {})), **kwargs)
    return evaluate(rules, doc)


# ---- scope ------------------------------------------------------------------------------------


def test_every_rule_is_listed_once_in_rules_order(make_doc, rules):
    outcome = run(make_doc, rules, 'r02', 'N')
    assert outcome.ok, outcome.problems()
    assert [h['id'] for h in outcome.doc['hypotheses']] == list(RULE_IDS)


def test_out_of_scope_rules_are_not_applicable_and_read_nothing(make_doc, rules):
    # r02/N: no vault read, no I1, no I2/I5, no rows but H2's. Every out-of-scope rule's fields
    # are null or absent, and none of that matters.
    outcome = run(make_doc, rules, 'r02', 'N')
    assert outcome.ok, outcome.problems()
    for entry in outcome.doc['hypotheses']:
        in_scope = rules.in_scope(entry['id'], 'r02', 'N')
        assert entry['in_scope'] is in_scope
        if not in_scope:
            assert entry['status'] == NOT_APPLICABLE
            assert entry['row_ids'] == [] and entry['provisional'] is False
    assert statuses(outcome)['H2'] == 'SUPPORTED'
    assert outcome.doc['gates_summary'] == {
        'I1_pass': None,
        'I1_pass_effective': True,
        'I4_pass': True,
        'futility_fired': None,
    }


def test_every_h_rule_is_not_applicable_at_r00(make_doc, rules):
    signoff = {
        'lint_ok': True,
        'report_valid': True,
        'vault_sealed': True,
        'i1_fallback_scheduled': False,
        'i2_scheduled': True,
        'i4_scheduled': True,
    }
    outcome = run(make_doc, rules, 'r00', 'N', signoff_inputs=signoff)
    assert outcome.ok, outcome.problems()
    in_scope = {k for k, v in statuses(outcome).items() if v != NOT_APPLICABLE}
    assert in_scope == {'I1', 'I3', 'I5', 'signoff'}
    assert statuses(outcome)['signoff'] == 'PASS'


# ---- NOT_COMPUTABLE ---------------------------------------------------------------------------


def test_a_planted_null_vault_sign_makes_h1_not_computable(make_doc, rules):
    outcome = run(make_doc, rules, 'r06', 'N', vault={'sign': None})
    assert not outcome.ok
    failed = {n.rule: n.fields for n in outcome.not_computable}
    assert set(failed) == {'H1', 'vault.read'}
    assert 'vault.sign' in failed['H1']
    assert statuses(outcome)['H1'] == 'NOT_COMPUTABLE'


def test_a_null_row_field_makes_its_rule_not_computable(make_doc, rules):
    rows = scope_rows(rules, 'r06', 'N')
    doc = make_doc('r06', 'N', rows)
    next(r for r in doc['rows'] if r['comparison_id'] == 'H1.c3')['ci_lo_adj'] = None
    outcome = evaluate(rules, doc)
    assert [(n.rule, n.fields) for n in outcome.not_computable] == [('H1', ('H1.c3.ci_lo_adj',))]


def test_a_missing_row_makes_its_rule_not_computable(make_doc, rules):
    rows = scope_rows(rules, 'r06', 'N')
    del rows['H1.c4']
    outcome = evaluate(rules, make_doc('r06', 'N', rows))
    failed = {n.rule: n.fields for n in outcome.not_computable}
    assert 'H1.c4.point' in failed['H1']
    assert 'H5' not in failed  # the other in-scope hypothesis still decides


def test_a_null_carried_i1_pass_makes_h1_not_computable(make_doc, rules):
    outcome = run(make_doc, rules, 'r06', 'N', gates_inputs={'I1_prior_pass': None})
    assert 'gates_summary.I1_pass_effective' in {
        f for n in outcome.not_computable for f in n.fields
    }


def test_vault_read_in_scope_without_a_read_is_not_computable(make_doc, rules):
    outcome = run(
        make_doc,
        rules,
        'r04',
        'N',
        vault={'read_this_run': False, 'read_index': None, 'sign': None},
    )
    assert {n.rule for n in outcome.not_computable} == {'vault.read', 'FUT'}


def test_a_lost_key_is_a_read_with_sign_unavailable(make_doc, rules):
    outcome = run(
        make_doc, rules, 'r04', 'N', vault={'sign': 'unavailable', 'hybrid_minus_b2_ndcg10': None}
    )
    assert outcome.ok, outcome.problems()
    assert statuses(outcome)['vault.read'] == 'DONE'


def test_a_vault_read_outside_the_read_points_fails(make_doc, rules):
    outcome = run(
        make_doc, rules, 'r05', 'N', vault={'read_this_run': True, 'read_index': 2, 'sign': 1}
    )
    assert any('not a registered read point' in e for e in outcome.errors)


# ---- H1 and its kill-only checkpoint ----------------------------------------------------------


@pytest.mark.parametrize(
    ('rows', 'vault', 'expected'),
    [
        ({}, {}, 'SUPPORTED'),
        ({}, {'sign': 0}, 'INCONCLUSIVE'),
        ({}, {'sign': 'unavailable', 'hybrid_minus_b2_ndcg10': None}, 'INCONCLUSIVE'),
        ({'H1__c1': (0.0, -0.01, 0.0199)}, {}, 'FALSIFIED'),
        ({'H1__c1': (0.0, -0.01, 0.02)}, {}, 'INCONCLUSIVE'),
        ({'H1__g1': (-0.03, -0.05, -0.001)}, {}, 'FALSIFIED'),
        ({'H1__g1': (-0.03, -0.05, 0.001)}, {}, 'SUPPORTED'),
        ({'H1__g1': (-0.02, -0.05, -0.001)}, {}, 'SUPPORTED'),
        ({'H1__c3': (0.01, -0.01, 0.03)}, {}, 'FUSION_ONLY'),
        ({'H1__c4': (0.01, -0.01, 0.03)}, {}, 'FUSION_ONLY'),
        ({'H1__c3': (0.01, -0.01, 0.03)}, {'sign': -1}, 'INCONCLUSIVE'),
        ({'H1__c2': (0.01, -0.01, 0.03)}, {}, 'INCONCLUSIVE'),
        ({'H1__c1': (0.044, 0.03, 0.06)}, {}, 'INCONCLUSIVE'),
        ({'H1__c1': (0.045, 0.03, 0.06)}, {}, 'SUPPORTED'),
    ],
)
def test_h1_outcomes(make_doc, rules, rows, vault, expected):
    outcome = run(make_doc, rules, 'r06', 'N', rows, vault=vault)
    assert outcome.ok, outcome.problems()
    assert statuses(outcome)['H1'] == expected


def test_h1_pass_needs_the_point_above_the_seed_sd(make_doc, rules):
    rows = scope_rows(rules, 'r06', 'N')
    doc = make_doc('r06', 'N', rows)
    next(r for r in doc['rows'] if r['comparison_id'] == 'H1.c1')['seed_sd'] = 0.2
    outcome = evaluate(rules, doc)
    assert components(outcome)['H1.c1'] == 'FAIL'
    assert statuses(outcome)['H1'] == 'INCONCLUSIVE'


def test_h1_pass_needs_the_adjusted_ci_above_zero(make_doc, rules):
    rows = scope_rows(rules, 'r06', 'N')
    doc = make_doc('r06', 'N', rows)
    next(r for r in doc['rows'] if r['comparison_id'] == 'H1.c3')['ci_lo_adj'] = 0.0
    assert statuses(evaluate(rules, doc))['H1'] == 'FUSION_ONLY'


def test_h1_is_provisional_until_r10(make_doc, rules):
    r06 = run(make_doc, rules, 'r06', 'N')
    r10 = run(make_doc, rules, 'r10', 'N')
    assert next(h for h in r06.doc['hypotheses'] if h['id'] == 'H1')['provisional'] is True
    assert next(h for h in r10.doc['hypotheses'] if h['id'] == 'H1')['provisional'] is False
    assert all(r['provisional'] for r in r06.doc['rows'] if r['hypothesis'] == 'H1')


def test_the_i1_fallback_family_is_c1_and_c3(make_doc, rules):
    # I1 failed at R00 and was not passed at R01: c2 and c4 are exploratory, the family is
    # {c1, c3} with m = 2, and failing c2 / c4 no longer block SUPPORTED.
    weak = (0.01, -0.01, 0.03)
    outcome = run(
        make_doc,
        rules,
        'r06',
        'N',
        {'H1__c2': weak, 'H1__c4': weak},
        gates_inputs={'I1_prior_pass': False},
    )
    assert outcome.ok, outcome.problems()
    assert statuses(outcome)['H1'] == 'SUPPORTED'
    rows = {r['comparison_id']: r for r in outcome.doc['rows']}
    assert rows['H1.c2']['registered'] is False and rows['H1.c2']['verdict_component'] == 'REPORTED'
    assert rows['H1.c4']['verdict_component'] == 'REPORTED'
    assert [rows[c]['holm_m'] for c in ('H1.c1', 'H1.c3')] == [2, 2]
    assert rows['H1.c2']['holm_rank'] == 0
    assert outcome.doc['gates_summary']['I1_pass_effective'] is False


def test_fusion_only_under_the_i1_fallback_needs_only_c1(make_doc, rules):
    weak = (0.01, -0.01, 0.03)
    outcome = run(
        make_doc,
        rules,
        'r06',
        'N',
        {'H1__c2': weak, 'H1__c3': weak},
        gates_inputs={'I1_prior_pass': False},
    )
    assert statuses(outcome)['H1'] == 'FUSION_ONLY'


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'NOT_FALSIFIED'),
        ({'H1__c1': (0.0, -0.01, 0.019)}, 'FALSIFIED'),
        ({'H1__g1': (-0.05, -0.07, -0.01)}, 'FALSIFIED'),
    ],
)
def test_h1_kill_only_checkpoint(make_doc, rules, rows, expected):
    outcome = run(make_doc, rules, 'r05K', 'S', rows)
    assert outcome.ok, outcome.problems()
    assert statuses(outcome)['H1.F'] == expected
    assert statuses(outcome)['H1'] == NOT_APPLICABLE
    assert [r['comparison_id'] for r in outcome.doc['rows']] == ['H1.c1', 'H1.g1']


# ---- the futility look ------------------------------------------------------------------------


@pytest.mark.parametrize(
    ('c1', 'sign', 'expected'),
    [
        ((-0.03, -0.05, -0.001), -1, 'FIRED'),
        ((-0.03, -0.05, -0.001), 0, 'FIRED'),
        ((-0.03, -0.05, -0.001), 1, 'NOT_FIRED'),
        ((-0.03, -0.05, -0.001), 'unavailable', 'NOT_FIRED'),
        ((-0.03, -0.05, 0.001), -1, 'NOT_FIRED'),
        ((-0.02, -0.05, -0.001), -1, 'NOT_FIRED'),
    ],
)
def test_futility(make_doc, rules, c1, sign, expected):
    outcome = run(make_doc, rules, 'r04', 'N', {'FUT__c1': c1}, vault={'sign': sign})
    assert outcome.ok, outcome.problems()
    assert statuses(outcome)['FUT'] == expected
    assert outcome.doc['gates_summary']['futility_fired'] is (expected == 'FIRED')


# ---- the other hypotheses ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ('rows', 'expected', 'label'),
    [
        ({}, 'SUPPORTED', 're-meaning lexicon'),
        ({'H3__c1': (0.0, -0.1, 0.0499)}, 'FALSIFIED', 'frequency lexicon'),
        ({'H3__c1': (0.0, -0.1, 0.05)}, 'INCONCLUSIVE', 'frequency lexicon'),
        ({'H3__c2': (0.05, -0.05, 0.15)}, 'INCONCLUSIVE', 'frequency lexicon'),
        ({'H3__c1': (0.14, 0.01, 0.27)}, 'INCONCLUSIVE', 'frequency lexicon'),
    ],
)
def test_h3_falsifies_only_on_ci_hi_raw_below_005(make_doc, rules, rows, expected, label):
    defaults = {'H3__c1': (0.4, 0.2, 0.6), 'H3__c2': (0.4, 0.2, 0.6)}
    outcome = run(make_doc, rules, 'r03', 'N', {**defaults, **rows})
    assert statuses(outcome)['H3'] == expected
    assert outcome.derived['remeaning.label'] == label


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'H2__c3': (0.0, -0.01, 0.019)}, 'FALSIFIED'),
        ({'H2__c2': (0.0, -0.01, 0.029)}, 'FALSIFIED'),
        ({'H2__c2': (0.0, -0.01, 0.03)}, 'INCONCLUSIVE'),
        ({'H2__c2': (0.07, 0.05, 0.09)}, 'INCONCLUSIVE'),  # below tau_G = max(0.08, 0.045)
    ],
)
def test_h2(make_doc, rules, rows, expected):
    assert statuses(run(make_doc, rules, 'r02', 'N', rows))['H2'] == expected


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'H3a__a1': (0.0, -0.01, 0.019)}, 'FALSIFIED'),
        ({'H3a__a1': (0.03, 0.01, 0.05)}, 'INCONCLUSIVE'),
    ],
)
def test_h3a(make_doc, rules, rows, expected):
    defaults = {'H3__c1': (0.4, 0.2, 0.6), 'H3__c2': (0.4, 0.2, 0.6)}
    assert statuses(run(make_doc, rules, 'r03', 'N', {**defaults, **rows}))['H3a'] == expected


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'H3b__b2': (0.045, 0.01, 0.08)}, 'FALSIFIED'),  # BETTER: point >= MDE_AB, adjusted CI > 0
        ({'H3b__b2': (0.044, 0.01, 0.08)}, 'SUPPORTED'),
        ({'H3b__b1': (0.02, 0.001, 0.04)}, 'FALSIFIED'),  # Qwen's displacement is higher
        ({'H3b__b1': (-0.01, -0.02, 0.001)}, 'INCONCLUSIVE'),
    ],
)
def test_h3b(make_doc, rules, rows, expected):
    for branch in ('N', 'N-F', 'S-F', 'S-C'):
        assert statuses(run(make_doc, rules, 'r08', branch, rows))['H3b'] == expected
    assert statuses(run(make_doc, rules, 'r08K', 'S-C-F', rows))['H3b'] == expected


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'H4__c1': (0.0, -0.01, 0.019)}, 'FALSIFIED'),
        ({'H4__g1': (-0.03, -0.05, -0.001)}, 'FALSIFIED'),
        ({'H4__g1': (-0.029, -0.05, -0.001)}, 'SUPPORTED'),
        ({'H4__c1': (0.03, 0.01, 0.05)}, 'INCONCLUSIVE'),
    ],
)
def test_h4(make_doc, rules, rows, expected):
    assert statuses(run(make_doc, rules, 'r05', 'N', rows))['H4'] == expected
    s_c = {k: v for k, v in rows.items()}
    assert statuses(run(make_doc, rules, 'r06', 'S-C', s_c))['H4'] == expected


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'H5__b1': (0.05, 0.001, 0.1)}, 'FALSIFIED'),
        ({'H5__b1': (0.05, 0.0, 0.1)}, 'SUPPORTED'),
        ({'H5__c1': (0.0, -0.01, 0.019)}, 'FALSIFIED'),
        ({'H5__c1': (0.04, 0.02, 0.06)}, 'INCONCLUSIVE'),
    ],
)
def test_h5(make_doc, rules, rows, expected):
    assert statuses(run(make_doc, rules, 'r06', 'S-F', rows))['H5'] == expected


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'H6__r1': (0.79, 0.7, 0.95)}, 'FALSIFIED'),
        ({'H6__r2': (0.92, 0.85, 0.899)}, 'FALSIFIED'),
        ({'H6__r1': (0.89, 0.81, 0.95)}, 'INCONCLUSIVE'),
        ({'H6__r1': (0.95, 0.79, 0.99)}, 'INCONCLUSIVE'),
        ({'H6__g1': (-0.011, -0.02, 0.0)}, 'INCONCLUSIVE'),
        ({'H6__g1': (-0.01, -0.02, 0.0)}, 'SUPPORTED'),
    ],
)
def test_h6(make_doc, rules, rows, expected):
    assert statuses(run(make_doc, rules, 'r09', 'N', rows))['H6'] == expected
    assert statuses(run(make_doc, rules, 'r09K', 'S-C-F', rows))['H6'] == expected


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'H7__c1': (-0.01, -0.03, -0.001)}, 'FALSIFIED'),
        ({'H7__c1': (0.03, -0.01, 0.07)}, 'INCONCLUSIVE'),
    ],
)
def test_h7_is_registered_on_the_kill_path(make_doc, rules, rows, expected):
    outcome = run(make_doc, rules, 'r07K', 'N-F', rows)
    assert statuses(outcome)['H7'] == expected
    assert statuses(outcome)['H7.report'] == NOT_APPLICABLE


@pytest.mark.parametrize(('point', 'met'), [(0.02, True), (0.0, True), (-0.01, False)])
def test_h7_report_states_its_prediction(make_doc, rules, point, met):
    outcome = run(
        make_doc, rules, 'r07', 'N', {'H7.report__c1': (point, point - 0.02, point + 0.02)}
    )
    assert statuses(outcome)['H7.report'] == 'REPORTED'
    row = outcome.doc['rows'][0]
    assert (
        row['comparison_id'],
        row['registered'],
        row['verdict_component'],
        row['prediction'],
        row['prediction_met'],
    ) == ('H7.report.c1', False, 'REPORTED', 'x.point >= 0', met)


@pytest.mark.parametrize(
    ('rows', 'expected'),
    [
        ({}, 'SUPPORTED'),
        ({'K1__k1': (0.0, -0.01, 0.0099)}, 'FALSIFIED'),
        ({'K1__k2': (0.02, 0.0, 0.04)}, 'INCONCLUSIVE'),
    ],
)
def test_k1(make_doc, rules, rows, expected):
    for run_id, branch in (('r07K', 'S-F'), ('r08K', 'S-C-F'), ('r10K', 'N-F')):
        assert statuses(run(make_doc, rules, run_id, branch, rows))['K1'] == expected


# ---- gates ------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ('i1', 'expected'),
    [((0.6, 0.6), 'PASS'), ((0.59, 0.9), 'FAIL'), ((0.9, 0.599), 'FAIL')],
)
def test_i1(make_doc, rules, i1, expected):
    gates = {'I1': {'kappa_qw_owner': i1[0], 'min_kendall_ci_lo': i1[1]}}
    outcome = run(make_doc, rules, 'r10', 'N', gates_inputs=gates)
    assert statuses(outcome)['I1'] == expected
    assert outcome.doc['gates_summary']['I1_pass'] is (expected == 'PASS')
    # In scope, I1_pass_effective is this run's own pass, whatever was carried in.
    assert outcome.doc['gates_summary']['I1_pass_effective'] is (expected == 'PASS')
    assert outcome.derived['gates.I1.pass'] is (expected == 'PASS')


def test_i1_failing_at_r10_moves_h1_to_the_fallback_family(make_doc, rules):
    weak = (0.01, -0.01, 0.03)
    gates = {'I1': {'kappa_qw_owner': 0.5, 'min_kendall_ci_lo': 0.5}, 'I1_prior_pass': True}
    outcome = run(make_doc, rules, 'r10', 'N', {'H1__c2': weak}, gates_inputs=gates)
    assert statuses(outcome)['H1'] == 'SUPPORTED'


@pytest.mark.parametrize(('flip', 'expected'), [(0.049, 'PASS'), (0.05, 'FAIL')])
def test_i4(make_doc, rules, flip, expected):
    outcome = run(
        make_doc,
        rules,
        'r03',
        'N',
        {'H3__c1': (0.4, 0.2, 0.6), 'H3__c2': (0.4, 0.2, 0.6)},
        gates_inputs={'I4': {'flip_rate': flip}},
    )
    assert statuses(outcome)['I4'] == expected


def test_i2_and_i5_are_reported_with_their_predictions(make_doc, rules):
    r04 = run(make_doc, rules, 'r04', 'N', gates_inputs={'I2': {'inflation_ratio': 1.9}})
    assert statuses(r04)['I2'] == 'REPORTED' and r04.derived['gates.I2.prediction_met'] is False
    r00 = run(
        make_doc, rules, 'r00', 'N', gates_inputs={'I5': {'kappa_drop': 0.05}}, signoff_inputs=None
    )
    assert statuses(r00)['I5'] == 'REPORTED' and r00.derived['gates.I5.prediction_met'] is True


@pytest.mark.parametrize(
    ('changes', 'i1_pass', 'expected'),
    [
        ({}, True, 'PASS'),
        ({'lint_ok': False}, True, 'FAIL'),
        ({}, False, 'FAIL'),
        ({'i1_fallback_scheduled': True}, False, 'PASS'),
        ({'i4_scheduled': False}, True, 'FAIL'),
    ],
)
def test_signoff(make_doc, rules, changes, i1_pass, expected):
    signoff = {
        'lint_ok': True,
        'report_valid': True,
        'vault_sealed': True,
        'i1_fallback_scheduled': False,
        'i2_scheduled': True,
        'i4_scheduled': True,
    }
    signoff.update(changes)
    i1 = {'kappa_qw_owner': 0.7 if i1_pass else 0.5, 'min_kendall_ci_lo': 0.7}
    outcome = run(make_doc, rules, 'r00', 'N', gates_inputs={'I1': i1}, signoff_inputs=signoff)
    assert outcome.ok, outcome.problems()
    assert statuses(outcome)['signoff'] == expected


def test_signoff_without_its_inputs_is_not_computable(make_doc, rules):
    outcome = run(make_doc, rules, 'r00', 'N', signoff_inputs=None)
    assert {n.rule for n in outcome.not_computable} == {'signoff'}


# ---- adoption ---------------------------------------------------------------------------------


def _arms(*arms):
    return [
        {'arm_id': a, 'gain_lfo': g, 'guard_ok': ok, 'control': c, 'bundle_raw': b}
        for a, g, ok, c, b in arms
    ]


def test_adoption_default_picks_the_highest_qualifying_arm(make_doc, rules):
    adoption = [
        {
            'fold': 1,
            'rule': 'default',
            'arms': _arms(
                ('arm:a', 0.03, True, False, None),
                ('arm:b', 0.05, False, False, None),
                ('arm:ctl', 0.09, True, True, None),
            ),
        },
        {'fold': 2, 'rule': 'default', 'arms': _arms(('arm:a', 0.009, True, False, None))},
        {
            'fold': 3,
            'rule': 'default',
            'arms': _arms(('arm:b', 0.01, True, False, None), ('arm:a', 0.01, True, False, None)),
        },
    ]
    outcome = run(make_doc, rules, 'r05', 'N', adoption=adoption)
    assert outcome.ok, outcome.problems()
    chosen = {(a['fold'], a['chosen_arm'], a['adopted']) for a in outcome.doc['adoption']}
    assert chosen == {(1, 'arm:a', True), (2, 'parent', False), (3, 'arm:a', True)}


def test_adoption_squeeze_picks_the_smallest_bundle_within_001(make_doc, rules):
    arms = _arms(
        ('arm:big', 0.05, True, False, 3_990_000),
        ('arm:mid', 0.04, True, False, 3_000_000),
        ('arm:tiny', 0.039, True, False, 2_000_000),
        ('arm:over', 0.06, True, False, 4_000_001),
    )
    adoption = [{'fold': f, 'rule': 'squeeze', 'arms': arms} for f in (1, 2, 3)]
    outcome = run(make_doc, rules, 'r07', 'N', adoption=adoption)
    assert outcome.ok, outcome.problems()
    # The best leave-fold-out gain is 0.06 (over the size cap); 0.05 is within 0.01 and fits.
    assert {a['chosen_arm'] for a in outcome.doc['adoption']} == {'arm:big'}


def test_adoption_needs_every_fold(make_doc, rules):
    adoption = [{'fold': 1, 'rule': 'default', 'arms': []}]
    outcome = run(make_doc, rules, 'r05', 'N', adoption=adoption)
    assert {n.rule for n in outcome.not_computable} == {'adoption.default'}


def test_squeeze_needs_bundle_sizes(make_doc, rules):
    adoption = [
        {'fold': f, 'rule': 'squeeze', 'arms': _arms(('arm:x', 0.02, True, False, None))}
        for f in (1, 2, 3)
    ]
    outcome = run(make_doc, rules, 'r07', 'N', adoption=adoption)
    assert {n.rule for n in outcome.not_computable} == {'adoption.squeeze'}


def test_adoption_outside_its_scope_fails(make_doc, rules):
    adoption = [{'fold': f, 'rule': 'default', 'arms': []} for f in (1, 2, 3)]
    outcome = run(make_doc, rules, 'r08', 'N', adoption=adoption)
    assert any('adoption.default' in e and 'not in scope' in e for e in outcome.errors)


# ---- document structure -----------------------------------------------------------------------


def test_a_stray_row_fails(make_doc, rules):
    rows = scope_rows(rules, 'r02', 'N')
    rows['H4.c1'] = PASSING
    outcome = evaluate(rules, make_doc('r02', 'N', rows))
    assert any('H4.c1 is present, but no rule in scope' in e for e in outcome.errors)


def test_an_unknown_or_duplicate_row_fails(make_doc, rules):
    doc = make_doc('r02', 'N', scope_rows(rules, 'r02', 'N'))
    doc['rows'].append(dict(doc['rows'][0]))
    doc['rows'].append({**doc['rows'][0], 'comparison_id': 'H2.c9'})
    errors = evaluate(rules, doc).errors
    assert any('appears twice' in e for e in errors) and any(
        "'H2.c9' is not defined" in e for e in errors
    )


@pytest.mark.parametrize(
    ('field', 'value', 'message'),
    [
        ('tau', 0.04, 'tau is 0.04'),
        ('arm_b', 'B2w', 'arm_b'),
        ('holm_rank', 3, 'holm_rank'),
        ('alpha_adj', 0.05, 'alpha_adj'),
        ('registered', False, 'registered'),
    ],
)
def test_row_metadata_follows_rules_yaml(make_doc, rules, field, value, message):
    doc = make_doc('r02', 'N', scope_rows(rules, 'r02', 'N'))
    doc['rows'][0][field] = value
    errors = evaluate(rules, doc).errors
    assert any('H2.c1' in e and message in e for e in errors), errors


def test_rules_hash_must_match(make_doc, rules):
    doc = make_doc('r02', 'N', scope_rows(rules, 'r02', 'N'))
    doc['run']['rules_sha256'] = 'f' * 64
    assert any('rules_sha256' in e for e in evaluate(rules, doc).errors)


def test_a_run_on_no_path_fails(make_doc, rules):
    doc = make_doc('r05K', 'N', {})
    assert any('on no PREREG branch path' in e for e in evaluate(rules, doc).errors)


def test_the_final_run_needs_its_history(make_doc, rules):
    outcome = run(make_doc, rules, 'r10', 'N')
    assert any('arc_summary needs' in e for e in outcome.errors)


# ---- the blind form ---------------------------------------------------------------------------


def test_strip_removes_exactly_the_registered_fields():
    assert sorted(stripped_field_names()) == sorted(STRIPPED_FIELDS)


def test_the_blind_form_holds_everything_the_rules_read(make_doc, rules):
    adoption = [
        {'fold': f, 'rule': 'default', 'arms': _arms(('arm:a', 0.03, True, False, None))}
        for f in (1, 2, 3)
    ]
    full = run(make_doc, rules, 'r06', 'N', adoption=adoption).doc
    blind = strip(full)
    assert stripped_keys_present(full) and not stripped_keys_present(blind)
    assert 'gates_summary' not in blind
    assert all('status' not in h for h in blind['hypotheses'])
    assert all('verdict_component' not in r and 'point' in r for r in blind['rows'])
    recomputed = evaluate(rules, blind)
    assert recomputed.ok, recomputed.problems()
    assert diff(full, recomputed.doc) == []


def test_diff_reports_paths():
    assert diff(
        {'a': [{'id': 'H1', 'status': 'PASS'}]}, {'a': [{'id': 'H1', 'status': 'FAIL'}]}
    ) == ["a[H1].status: 'FAIL', recomputed 'PASS'"]
    assert diff({'x': 0.1}, {'x': 0.1 + 1e-12}) == []
    assert diff({'x': True}, {'x': 1}) == ['x: 1, recomputed True']
