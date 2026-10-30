"""Fixtures for the contract tests: rules files and numeric verdicts documents."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

import pytest

from arcforge.contract import stats, synth
from arcforge.contract.rules import Rules, load_rules
from arcforge.contract.verdicts import ROW_FIELDS, Context


@pytest.fixture(scope='session')
def template() -> Rules:
    return load_rules()


@pytest.fixture(scope='session')
def frozen(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Rules]:
    """A frozen copy of the template (synthetic MDEs, fast resample counts)."""
    return synth.write_rules(tmp_path_factory.mktemp('rules'))


@pytest.fixture(scope='session')
def rules(frozen: tuple[Path, Rules]) -> Rules:
    return frozen[1]


GOOD_I1 = {
    'probe_min_acc': 0.95,
    'kappa_qw_median': 0.72,
    'alpha_families': 0.63,
    'min_kendall_ci_lo': 0.68,
    'delta_ci_hi': 0.21,
}
GOOD_INPUTS = {
    'I1': GOOD_I1,
    'I1_prior_pass': True,
    'I2': {'inflation_ratio': 2.4},
    'I3': {
        'student_chrome_in': 0.2,
        'student_chrome_out': 0.05,
        'teacher_chrome_in': 0.15,
        'teacher_chrome_out': 0.04,
    },
    'I4': {'flip_rate': 0.02},
    'I5': {'kappa_drop': 0.07},
    'I6': {'fleiss_kappa': 0.71, 'placebo_rerate': 0.12, 'random_rerate': 0.06},
}


def numeric_row(
    rules: Rules, cid: str, point: float, lo: float, hi: float, **overrides: Any
) -> dict[str, Any]:
    """A VerdictRow with the given numbers; adjusted CI = raw CI unless overridden."""
    spec = rules.rows[cid]
    row = dict.fromkeys(ROW_FIELDS)
    row.update(
        comparison_id=cid, hypothesis=spec.hypothesis, kind=spec.kind, arm_a=spec.arm_a, arm_b=spec.arm_b,
        stratum=spec.stratum, metric=spec.metric, unit=spec.unit, n_queries=48, n_clusters=28,
        point=point, ci_lo_raw=lo, ci_hi_raw=hi, holm_family=spec.hypothesis, ci_lo_adj=lo, ci_hi_adj=hi,
        p_raw=0.001, tau=rules.tau(spec), tau_floor=spec.tau_floor, mde_r00=rules.mde_value(spec),
        seed_sd=0.001, n_seeds=5, nested=True, proxy_vault_read=False,
        prediction=spec.prediction.source if spec.prediction else None,
        scores_file=f'scores/{cid}.json', scores_sha256='0' * 64,
    )  # fmt: skip
    del row['verdict_component'], row['prediction_met']
    row.update(overrides)
    return row


def finish_rows(rules: Rules, doc: dict[str, Any]) -> dict[str, Any]:
    """Fill registered, provisional and the Holm fields of doc['rows'] the way build.py does."""
    ctx = Context(rules, {**doc, 'rows': []})
    families: dict[str, dict[str, float]] = {}
    for row in doc['rows']:
        cid = row['comparison_id']
        row['registered'] = ctx.registered(cid)
        row['provisional'] = ctx.row_provisional(cid)
        if ctx.in_holm(cid):
            families.setdefault(row['hypothesis'], {})[cid] = row['p_raw']
    holm: dict[str, tuple[int, int, float, float]] = {}
    for family in families.values():
        holm.update(stats.holm(family, rules.stats.alpha))
    for row in doc['rows']:
        cid = row['comparison_id']
        if cid in holm:
            rank, m, alpha_adj, p_holm = holm[cid]
        else:
            rank, m, alpha_adj, p_holm = (
                0,
                len(families.get(row['hypothesis'], {})),
                rules.stats.alpha,
                row['p_raw'],
            )
            row['ci_lo_adj'], row['ci_hi_adj'] = row['ci_lo_raw'], row['ci_hi_raw']
        row.update(holm_rank=rank, holm_m=m, alpha_adj=alpha_adj, p_holm=p_holm)
    return doc


MakeDoc = Callable[..., dict[str, Any]]


@pytest.fixture
def s0_commitment(tmp_path: Path) -> Path:
    import json

    from arcforge.contract.prereg_doc import s0_hashes

    path = tmp_path / 's0-hashes.json'
    path.write_text(json.dumps(s0_hashes()), encoding='utf-8')
    return path


@pytest.fixture
def make_doc(rules: Rules) -> MakeDoc:
    """make_doc(run_id, branch, rows={cid: (point, lo, hi) | row dict}, **top-level overrides)."""

    def make(
        run_id: str,
        branch: str,
        rows: Mapping[str, Any] | None = None,
        *,
        gates_inputs: Mapping[str, Any] | None = None,
        proxy_vault: Mapping[str, Any] | None = None,
        **overrides: Any,
    ) -> dict[str, Any]:
        built = []
        for cid, value in (rows or {}).items():
            built.append(value if isinstance(value, dict) else numeric_row(rules, cid, *value))
        reading = rules.in_scope('proxy_vault.read', run_id, branch)
        doc = {
            'schema': 'arc-verdicts/1',
            'schema_version': '1.1',
            'run': {
                'id': run_id,
                'branch': branch,
                'h1_provisional': None,
                'prereg_sha256': None,
                'rules_sha256': rules.sha256,
            },
            'proxy_vault': {
                'read_this_run': reading,
                'read_index': 1 if reading else None,
                'hybrid_minus_b2_ndcg10': 0.03 if reading else None,
                'sign': 1 if reading else None,
                'basis': 'judged' if reading else None,
                'compromised': False,
            },
            'gates_inputs': {
                key: (value if _gate_in_scope(rules, key, run_id, branch) else None)
                for key, value in GOOD_INPUTS.items()
            },
            'rows': built,
            'adoption': None,
            'signoff_inputs': None,
        }
        doc['gates_inputs'].update(gates_inputs or {})
        doc['proxy_vault'].update(proxy_vault or {})
        doc['adoption'] = default_adoption(rules, run_id, branch)
        doc.update(overrides)
        return finish_rows(rules, doc)

    return make


def default_adoption(rules: Rules, run_id: str, branch: str) -> list[dict[str, Any]] | None:
    """One qualifying arm per fold for every adoption rule in scope (None when none is)."""
    entries = []
    for rule_id, method in (('adoption.default', 'default'), ('adoption.squeeze', 'squeeze')):
        if rules.in_scope(rule_id, run_id, branch):
            bundle = 3_000_000 if method == 'squeeze' else None
            arm = {
                'arm_id': 'arm:x',
                'gain_lfo': 0.02,
                'guard_ok': True,
                'control': False,
                'bundle_raw': bundle,
            }
            entries += [{'fold': fold, 'rule': method, 'arms': [dict(arm)]} for fold in (1, 2, 3)]
    return entries or None


def _gate_in_scope(rules: Rules, key: str, run_id: str, branch: str) -> bool:
    if key == 'I1_prior_pass':
        return run_id != 'r00'
    return rules.in_scope(key, run_id, branch)
