"""Synthetic runs: complete, schema-valid run directories with chosen verdicts.

`write_path(root, scenario)` writes every run of one PREREG branch path: per-query score files
shaped so that each in-scope rule comes out with the status the scenario asks for, the
verdicts.json that contract/build.py computes from them, and a report.json around it. The tests
drive `arcforge verdict` over these for every branch and every run id, the Fable fixtures pack
them, and other streams can use them as realistic inputs before the pipeline produces any.

The data are deterministic (seeded from the comparison and run ids) and small: 48 queries per
difference row, a 300-item pool for P@100 rows, and the reduced resample counts of
`synth_rules_text()` so a whole path verifies in seconds. Nothing here is a real measurement.
"""

from __future__ import annotations

import hashlib
import json
import random
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.contract import schema as report_schema
from arcforge.contract.branches import Step, follow
from arcforge.contract.build import build_verdicts, sha256_file
from arcforge.contract.ids import NOT_APPLICABLE, PROBE_EXPECT, SCHEMA_VERSION, SCORES_SCHEMA
from arcforge.contract.rules import TEMPLATE_PATH, Rules, freeze_text, loads_rules
from arcforge.contract.verdicts import Outcome, dumps_doc

DEFAULT_MDE: dict[str, float] = {
    'AB': 0.045,
    'D': 0.03,
    'CE': 0.05,
    'G': 0.045,
    'vault': 0.09,
    'frontier': 0.1,
}
FAST_STATS: dict[str, int] = {'resamples': 400, 'permutations': 400, 'refit_resamples': 100}

# Per-row effects that produce each status (difference rows: the mean a - b; ratio rows: a / b;
# P@100 rows: the P@100 difference). Margins are wide against the synthetic noise.
PASSING = 0.12
NULL = 0.0
SHORT = 0.03  # below every tau, CI clear of the falsifiers' bounds
FALLING = -0.05  # CI entirely below 0 (falsifies every 'ci_hi_raw < bound' clause)
FIRING = -0.06  # a guard fires

_EFFECTS: dict[str, dict[str, dict[str, float]]] = {
    'FUT': {'FIRED': {'c1': FIRING}, 'NOT_FIRED': {'c1': NULL}},
    'H1.F': {'FALSIFIED': {'c1': FALLING, 'g1': NULL}, 'NOT_FALSIFIED': {'c1': SHORT, 'g1': NULL}},
    'H1': {
        'SUPPORTED': {'c1': PASSING, 'c2': PASSING, 'c3': PASSING, 'c4': PASSING, 'g1': NULL},
        'FUSION_ONLY': {'c1': PASSING, 'c2': PASSING, 'c3': NULL, 'c4': NULL, 'g1': NULL},
        'INCONCLUSIVE': {'c1': SHORT, 'c2': SHORT, 'c3': SHORT, 'c4': SHORT, 'g1': NULL},
        'FALSIFIED': {'c1': FALLING, 'c2': NULL, 'c3': NULL, 'c4': NULL, 'g1': NULL},
    },
    'H2': {
        'SUPPORTED': {'c1': PASSING, 'c2': PASSING, 'c3': PASSING},
        'INCONCLUSIVE': {'c1': SHORT, 'c2': 0.05, 'c3': SHORT},
        'FALSIFIED': {'c1': PASSING, 'c2': PASSING, 'c3': FALLING},
    },
    'H3': {
        'SUPPORTED': {'c1': 0.40, 'c2': 0.40},
        'INCONCLUSIVE': {'c1': 0.10, 'c2': 0.10},
        'FALSIFIED': {'c1': -0.30, 'c2': NULL},
    },
    'H3a': {
        'SUPPORTED': {'a1': PASSING},
        'INCONCLUSIVE': {'a1': SHORT},
        'FALSIFIED': {'a1': FALLING},
    },
    'H3b': {
        'SUPPORTED': {'b1': FALLING, 'b2': NULL},
        'INCONCLUSIVE': {'b1': NULL, 'b2': NULL},
        'FALSIFIED': {'b1': FALLING, 'b2': PASSING},
    },
    'H4': {
        'SUPPORTED': {'c1': PASSING, 'g1': NULL},
        'INCONCLUSIVE': {'c1': SHORT, 'g1': NULL},
        'FALSIFIED': {'c1': PASSING, 'g1': FIRING},
    },
    'H5': {
        'SUPPORTED': {'c1': PASSING, 'b1': NULL},
        'INCONCLUSIVE': {'c1': SHORT, 'b1': NULL},
        'FALSIFIED': {'c1': PASSING, 'b1': 0.10},
    },
    'H6': {
        'SUPPORTED': {'r1': 0.97, 'r2': 0.97, 'g1': NULL},
        'INCONCLUSIVE': {'r1': 0.97, 'r2': 0.97, 'g1': FALLING},
        'FALSIFIED': {'r1': 0.70, 'r2': 0.97, 'g1': NULL},
    },
    'H7': {
        'SUPPORTED': {'c1': PASSING},
        'INCONCLUSIVE': {'c1': 0.02},
        'FALSIFIED': {'c1': FALLING},
    },
    'H7.report': {'REPORTED': {'c1': 0.02}},
    'K1': {
        'SUPPORTED': {'k1': PASSING, 'k2': PASSING},
        'INCONCLUSIVE': {'k1': 0.02, 'k2': 0.02},
        'FALSIFIED': {'k1': FALLING, 'k2': NULL},
    },
}


def synth_rules_text(
    template: str | Path = TEMPLATE_PATH,
    mde: Mapping[str, float] = DEFAULT_MDE,
    stats: Mapping[str, int] = FAST_STATS,
) -> str:
    """The rules template, frozen with `mde` and with smaller resample counts (fast tests)."""
    text = Path(template).read_text(encoding='utf-8')
    for key, value in stats.items():
        marker = f'  {key}: '
        start = text.index(marker)
        end = text.index('\n', start)
        text = f'{text[:start]}{marker}{value}{text[end:]}'
    return freeze_text(text, mde)


def write_rules(directory: str | Path, **kwargs: Any) -> tuple[Path, Rules]:
    path = Path(directory) / 'rules.yaml'
    path.parent.mkdir(parents=True, exist_ok=True)
    text = synth_rules_text(**kwargs)
    path.write_text(text, encoding='utf-8')
    return path, loads_rules(text, path=str(path))


def fake_sha(*labels: object) -> str:
    return hashlib.sha256('|'.join(map(str, labels)).encode()).hexdigest()


@dataclass
class Scenario:
    """What a synthetic path should conclude.

    `path` is a PREREG branch path. `statuses` overrides the status of a rule at a run, keyed
    (run_id, rule_id); otherwise the decision rules follow the path (FUT fires on the S paths,
    H1.F falsifies on S-F, H1 falsifies where the path turns to its K branch) and every other
    hypothesis is SUPPORTED. `i1_pass` sets I1 at the runs where it is decided (default: pass);
    `i1_fail_component` picks which A0 component fails when it does (I1a, I1b, I1c or I1d).
    `i6_pass` sets I6 where H3 is decided (default: pass; a failing I6 leaves H3 INCONCLUSIVE).
    `compromised_from` marks the proxy vault compromised from that run on (sign 'unavailable').
    `effects` overrides single rows, keyed (run_id, comparison_id).
    """

    path: str
    statuses: dict[tuple[str, str], str] = field(default_factory=dict)
    i1_pass: dict[str, bool] = field(default_factory=dict)
    i1_fail_component: str = 'I1b'
    i6_pass: dict[str, bool] = field(default_factory=dict)
    vault_sign: dict[str, int | str] = field(default_factory=dict)
    compromised_from: str | None = None
    effects: dict[tuple[str, str], float] = field(default_factory=dict)

    def wanted(self, run_id: str, rule_id: str) -> str:
        if (run_id, rule_id) in self.statuses:
            return self.statuses[(run_id, rule_id)]
        if rule_id == 'FUT':
            return 'FIRED' if self.path.startswith('S') else 'NOT_FIRED'
        if rule_id == 'H1.F':
            return 'FALSIFIED' if self.path == 'S-F' else 'NOT_FALSIFIED'
        if rule_id == 'H1':
            falsified_at = {'N-F': 'r06', 'S-C-F': 'r07'}.get(self.path)
            if falsified_at == run_id or (run_id == 'r10K'):
                return 'FALSIFIED'
            return 'SUPPORTED'
        if rule_id == 'H7.report':
            return 'REPORTED'
        if rule_id == 'H3' and not self.i6_pass.get(run_id, True):
            return 'INCONCLUSIVE'  # A0: H3 waits on I6, whatever its rows say
        return 'SUPPORTED'

    def effect_status(self, run_id: str, rule_id: str) -> str:
        """The status whose row effects are written (H3 under a failing I6 keeps strong rows)."""
        if rule_id == 'H3' and (run_id, rule_id) not in self.statuses:
            if not self.i6_pass.get(run_id, True):
                return 'SUPPORTED'
        return self.wanted(run_id, rule_id)


# ---- score files ------------------------------------------------------------------------------


def _rng(*labels: object) -> random.Random:
    return random.Random(int(fake_sha(*labels)[:16], 16))


def _difference_scores(cid: str, spec: Any, effect: float, run_id: str) -> dict[str, Any]:
    rng = _rng(cid, run_id)
    parts = ['A', 'B'] if spec.stratum in ('AB', 'V1_CORE') else [spec.stratum]
    items = []
    for i in range(48):
        part = parts[i % len(parts)]
        base = 0.35 + 0.3 * rng.random()
        targets = [f'tgt{i % 12:02d}']
        if part == 'B' and i % 3 == 0:
            targets.append(f'tgt{(i + 5) % 12:02d}')  # a B query with two positives
        a = base + effect + rng.uniform(-0.01, 0.01)
        items.append(
            {
                'id': f'{part}:{i:03d}',
                'part': part,
                'source': f'src{i % 16:02d}',
                'targets': targets,
                'a': [round(a + rng.uniform(-0.001, 0.001), 6) for _ in range(5)],
                'b': [round(base, 6)],
            }
        )
    return {'seeds': [1729, 1730, 1731, 1732, 1733], 'items': items}


def _ratio_scores(cid: str, spec: Any, ratio: float, run_id: str) -> dict[str, Any]:
    rng = _rng(cid, run_id)
    items = []
    for i in range(48):
        b = 0.5 + 0.2 * rng.random()
        a = b * ratio * (1 + rng.uniform(-0.005, 0.005))
        items.append(
            {
                'id': f'F:{i:03d}',
                'part': spec.stratum,
                'source': None,
                'targets': [f'withheld{i % 10:02d}'],
                'a': [round(a + rng.uniform(-0.001, 0.001), 6) for _ in range(5)],
                'b': [round(b + rng.uniform(-0.001, 0.001), 6) for _ in range(5)],
            }
        )
    return {'seeds': [1729, 1730, 1731, 1732, 1733], 'items': items}


def _p_at_k_scores(effect: float) -> dict[str, Any]:
    remeant = [f'w{i:03d}' for i in range(150)]
    plain = [f'n{i:03d}' for i in range(150)]
    labels = {item: 1 for item in remeant} | {item: 0 for item in plain}
    hits_b = 40
    hits_a = hits_b + round(effect * 100)

    def ranking(hits: int) -> list[str]:
        return remeant[:hits] + plain[: 100 - hits] + plain[100 - hits : 120 - hits]

    fits = [
        {'id': fid, 'a': ranking(hits_a), 'b': ranking(hits_b)}
        for fid in ('point', *(f'refit-{n}' for n in range(1, 6)))
    ]
    return {'k': 100, 'labels': labels, 'fits': fits}


def write_scores(run_dir: Path, rules: Rules, cid: str, effect: float, run_id: str) -> str:
    spec = rules.rows[cid]
    body = {
        'schema': SCORES_SCHEMA,
        'comparison_id': cid,
        'arm_a': spec.arm_a,
        'arm_b': spec.arm_b,
        'stratum': spec.stratum,
        'metric': spec.metric,
        'estimator': spec.estimator,
    }
    if spec.estimator == 'refit_pooled':
        body |= _p_at_k_scores(effect)
    elif spec.estimator == 'cluster_ratio':
        body |= _ratio_scores(cid, spec, effect, run_id)
    else:
        body |= _difference_scores(cid, spec, effect, run_id)
    rel = f'scores/{cid}.json'
    path = run_dir / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(body, indent=1) + '\n', encoding='utf-8')
    return rel


# ---- one run ----------------------------------------------------------------------------------


@dataclass
class SynthRun:
    run_id: str
    branch: str
    run_dir: Path
    outcome: Outcome


def _effects_for(rules: Rules, scenario: Scenario, run_id: str, branch: str) -> dict[str, float]:
    effects: dict[str, float] = {}
    for rule in rules.rules:
        if rule.id not in _EFFECTS or not rules.in_scope(rule.id, run_id, branch):
            continue
        status = scenario.effect_status(run_id, rule.id)
        table = _EFFECTS[rule.id].get(status)
        if table is None:
            raise ValueError(f'synth cannot produce {rule.id} = {status}')
        for alias, cid in rule.rows.items():
            effects.setdefault(cid, scenario.effects.get((run_id, cid), table[alias]))
    return effects


def _adoption_inputs(rules: Rules, run_id: str, branch: str) -> list[dict[str, Any]] | None:
    out = []
    for rule_id, method in (('adoption.default', 'default'), ('adoption.squeeze', 'squeeze')):
        if not rules.in_scope(rule_id, run_id, branch):
            continue
        for fold in (1, 2, 3):
            arms = [
                {
                    'arm_id': f'arm:{run_id}.best',
                    'gain_lfo': 0.03,
                    'guard_ok': True,
                    'control': False,
                    'bundle_raw': 3_900_000,
                },
                {
                    'arm_id': f'arm:{run_id}.small',
                    'gain_lfo': 0.025,
                    'guard_ok': True,
                    'control': False,
                    'bundle_raw': 3_100_000,
                },
                {
                    'arm_id': f'arm:{run_id}.control',
                    'gain_lfo': 0.08,
                    'guard_ok': True,
                    'control': True,
                    'bundle_raw': 3_000_000,
                },
            ]
            if method == 'default':
                for arm in arms:
                    arm['bundle_raw'] = None
            out.append({'fold': fold, 'rule': method, 'arms': arms})
    return out or None


I1_PASSING: dict[str, float] = {
    'probe_min_acc': 0.95,
    'kappa_qw_median': 0.72,
    'alpha_families': 0.63,
    'min_kendall_ci_lo': 0.68,
    'delta_ci_hi': 0.21,
}
# One failing value per A0 component (the others stay passing).
I1_FAILING: dict[str, dict[str, float]] = {
    'I1a': {'probe_min_acc': 0.85},
    'I1b': {'kappa_qw_median': 0.52},
    'I1c': {'min_kendall_ci_lo': 0.55},
    'I1d': {'delta_ci_hi': 0.34},
}


def _i1_inputs(passed: bool, component: str = 'I1b') -> dict[str, float]:
    return dict(I1_PASSING) if passed else {**I1_PASSING, **I1_FAILING[component]}


def _i6_inputs(passed: bool) -> dict[str, float]:
    if passed:
        return {'fleiss_kappa': 0.71, 'placebo_rerate': 0.12, 'random_rerate': 0.06}
    return {'fleiss_kappa': 0.48, 'placebo_rerate': 0.12, 'random_rerate': 0.06}


def write_run(
    root: Path,
    rules: Rules,
    scenario: Scenario,
    run_id: str,
    branch: str,
    history: list[dict[str, Any]],
    *,
    reads_so_far: int = 0,
) -> SynthRun:
    """Write one synthetic run directory under root/<run_id> and return its outcome."""
    run_dir = root / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    rows = [
        {
            'comparison_id': cid,
            'scores_file': write_scores(run_dir, rules, cid, effect, run_id),
            'nested': True,
            'proxy_vault_read': False,
        }
        for cid, effect in _effects_for(rules, scenario, run_id, branch).items()
    ]
    prior_pass = None
    for doc in history:
        if doc['gates_summary'].get('I1_pass') is not None:
            prior_pass = doc['gates_summary']['I1_pass']
    i1_in_scope = rules.in_scope('I1', run_id, branch)
    i1_passes = scenario.i1_pass.get(run_id, True)
    effective = i1_passes if i1_in_scope else prior_pass
    reading = rules.in_scope('proxy_vault.read', run_id, branch)
    compromised = scenario.compromised_from is not None and any(
        r == scenario.compromised_from
        for r in [*(d['run']['id'] for d in history), run_id]
    )
    sign = scenario.vault_sign.get(
        run_id, -1 if scenario.wanted(run_id, 'FUT') == 'FIRED' and run_id == 'r04' else 1
    )
    if compromised:
        sign = 'unavailable'
    h1_provisional = None
    for doc in history:
        for entry in doc['hypotheses']:
            if entry['id'] in ('H1', 'H1.F') and entry['in_scope']:
                h1_provisional = entry['status']
    inputs = {
        'schema': 'arc-verdicts/1',
        'run': {
            'id': run_id,
            'branch': branch,
            'h1_provisional': h1_provisional,
            'prereg_sha256': None if run_id == 'r00' else fake_sha('prereg'),
            'rules_sha256': rules.sha256,
        },
        'proxy_vault': {
            'read_this_run': reading,
            'read_index': reads_so_far + 1 if reading else None,
            'hybrid_minus_b2_ndcg10': (0.03 if sign == 1 else -0.02 if sign in (-1, 0) else None)
            if reading
            else None,
            'sign': sign if reading else None,
            'basis': ('judged' if effective else 'intent_only') if reading else None,
            'compromised': compromised,
        },
        'gates_inputs': {
            'I1': _i1_inputs(i1_passes, scenario.i1_fail_component) if i1_in_scope else None,
            'I1_prior_pass': None if run_id == 'r00' else prior_pass,
            'I2': {'inflation_ratio': 2.4} if rules.in_scope('I2', run_id, branch) else None,
            'I3': {
                'student_chrome_in': 0.21,
                'student_chrome_out': 0.04,
                'teacher_chrome_in': 0.17,
                'teacher_chrome_out': 0.05,
            },
            'I4': {'flip_rate': 0.021} if rules.in_scope('I4', run_id, branch) else None,
            'I5': {'kappa_drop': 0.07} if rules.in_scope('I5', run_id, branch) else None,
            'I6': _i6_inputs(scenario.i6_pass.get(run_id, True))
            if rules.in_scope('I6', run_id, branch)
            else None,
        },
        'rows': rows,
        'adoption': _adoption_inputs(rules, run_id, branch),
        'signoff_inputs': None,
    }
    if rules.in_scope('signoff', run_id, branch):
        inputs['signoff_inputs'] = signoff_inputs(fallback=not i1_passes)
    outcome = build_verdicts(rules, inputs, run_dir, history if run_id in ('r10', 'r10K') else None)
    if not outcome.ok:
        raise ValueError(f'synthetic {run_id}/{branch} does not verify: {outcome.problems()}')
    text = dumps_doc(outcome.doc)
    (run_dir / 'verdicts.json').write_text(text, encoding='utf-8')
    report = build_report(rules, scenario, outcome, run_dir, reads_so_far + int(reading), history)
    (run_dir / 'report.json').write_text(
        json.dumps(report, indent=1, ensure_ascii=False) + '\n', encoding='utf-8'
    )
    for entry in outcome.doc['hypotheses']:
        wanted = scenario.wanted(run_id, entry['id']) if entry['id'] in _EFFECTS else None
        if entry['in_scope'] and wanted is not None and entry['status'] != wanted:
            raise ValueError(
                f'synthetic {run_id}/{branch}: {entry["id"]} came out {entry["status"]}, wanted {wanted}'
            )
    return SynthRun(run_id, branch, run_dir, outcome)


def signoff_inputs(fallback: bool = False, **overrides: bool) -> dict[str, bool]:
    """The A0 sign-off preconditions, all met (override any to plant a failure)."""
    out = {
        'lint_ok': True,
        'report_valid': True,
        'a0_witness_first': True,
        's0_witnessed': True,
        'r00_sets_witnessed': True,
        'model_choice_present': True,
        'contamination_present': True,
        'precutoff_lookups_resolved': True,
        'provenance_present': True,
        'i1_fallback_scheduled': fallback,
        'i2_scheduled': True,
        'i4_scheduled': True,
    }
    out.update(overrides)
    return out


def write_path(root: str | Path, scenario: Scenario, rules: Rules | None = None) -> list[SynthRun]:
    """Every run of scenario.path under root/, rules.yaml at root/rules.yaml."""
    root = Path(root)
    if rules is None:
        _, rules = write_rules(root)
    runs: list[SynthRun] = []
    history: list[dict[str, Any]] = []
    reads = 0
    for run_id, branch in rules.branch_table[scenario.path]:
        synth = write_run(root, rules, scenario, run_id, branch, history, reads_so_far=reads)
        reads += int(synth.outcome.doc['proxy_vault']['read_this_run'])
        history.append(synth.outcome.doc)
        runs.append(synth)
    follow(rules, [Step.from_doc(r.outcome.doc) for r in runs])  # the statuses route this path
    return runs


# ---- report.json ------------------------------------------------------------------------------


def build_report(
    rules: Rules,
    scenario: Scenario,
    outcome: Outcome,
    run_dir: Path,
    reads_used: int,
    history: list[dict[str, Any]],
) -> dict[str, Any]:
    doc = outcome.doc
    run = doc['run']
    summary = doc['gates_summary']
    inputs = doc['gates_inputs']
    path_runs = [p[0] for p in rules.branch_table[scenario.path]]
    read_points = [
        r for r, b in rules.branch_table[scenario.path] if rules.in_scope('proxy_vault.read', r, b)
    ]
    reads = []
    index = 0
    for prior in [*history, doc]:
        if prior['proxy_vault']['read_this_run']:
            index += 1
            value = prior['proxy_vault']['hybrid_minus_b2_ndcg10']
            reads.append(
                {
                    'read_index': index,
                    'run_id': prior['run']['id'],
                    'branch': prior['run']['branch'],
                    'freeze_rekor': 1000 + index,
                    'beacon_round': 9_000_000 + index,
                    'n': 70,
                    'value': value,
                    'value_intent_only': value,
                    'value_title_free': value,
                    'value_degree_weighted': value,
                    'identity_rate': 0.99,
                    'uri': f'research/arcforge/runs/{prior["run"]["id"]}/vault/read{index}',
                }
            )
    i1 = None
    if inputs['I1'] is not None:
        i1 = synth_i1_report(inputs['I1'], summary)
    derived = outcome.derived
    adoption = []
    for entry in doc['adoption'] or []:
        fold = entry['fold']
        adoption.append(
            {
                'fold': fold,
                'decided_from_folds': [f for f in (1, 2, 3) if f != fold],
                'rule': entry['rule'],
                'primary': {'stratum': 'AB', 'metric': 'mrr@10'},
                'parent_raw_by_fold': {'1': 0.41, '2': 0.4, '3': 0.42},
                'arms': [
                    dict(arm, raw_by_fold={'1': 0.43, '2': 0.42, '3': 0.44})
                    for arm in entry['arms']
                ],
                'chosen_arm': entry['chosen_arm'],
                'adopted': entry['adopted'],
                'champion_out_sha256': fake_sha(run['id'], 'champion', fold),
            }
        )
    h3_in_scope = any(h['id'] == 'H3' and h['in_scope'] for h in doc['hypotheses'])
    artifacts = [
        {
            'path': row['scores_file'],
            'sha256': row['scores_sha256'],
            'bytes': (run_dir / row['scores_file']).stat().st_size,
            'kind': 'scores',
        }
        for row in doc['rows']
    ]
    verdicts_sha = sha256_file(run_dir / 'verdicts.json')
    return {
        'schema': 'arc-report/1',
        'schema_version': SCHEMA_VERSION,
        'run': {
            'id': run['id'],
            'branch': run['branch'],
            'h1_provisional': run['h1_provisional'],
            'one_change': f'synthetic {run["id"]}',
            'prediction': 'synthetic',
            'config_sha256': fake_sha(run['id'], 'config'),
            'prereg_sha256': run['prereg_sha256'],
            'amendments': [],
            'rules_sha256': run['rules_sha256'],
            'schema_sha256': report_schema.sha256(),
            'parent_by_fold': {str(f): fake_sha(run['id'], 'parent', f) for f in (1, 2, 3)},
            'corpus_id': fake_sha('corpus'),
            'main_corpus_id': fake_sha('corpus' if run['id'] >= 'r09' else 'corpus-S0-'),
            'frontier': {
                'kind': 'withheld',
                'series': ['the-echo-chamber', 'the-residue'],
                'rejoin_run': 'r09K' if 'r09K' in path_runs else 'r09',
            },
            'bench': {'version': 'v1', 'sha256': fake_sha('bench')},
            'seeds': [1729, 1730, 1731, 1732, 1733],
            'code_sha': fake_sha('code')[:40],
            'container_digest': 'sha256:' + fake_sha('container'),
            'teacher_revision': 'synthetic',
            'train_device': 'cuda',
            'started_utc': '2026-11-01T10:00:00Z',
            'wall_clock_min': 95.0,
        },
        'vm': None,
        'cost': {
            'plan_usd': 11.8 if run['id'] == 'r00' else 14.0,
            'actual_usd': 9.5,
            'cap_usd': 20,
            'plan_ceiling_usd': 20 if run['id'] == 'r00' else 17,
            'lines': [],
        },
        'adoption': adoption,
        'production': {
            'config_sha256': fake_sha(run['id'], 'production'),
            'votes': '3-0',
            'split_decision': False,
            'trained_on': 'all_main_line_records',
            'used_for_verdicts': False,
            'flag': {'mode': 'shadow', 'model': None, 'verdicts_sha256': verdicts_sha},
        },
        'ship': {'flag_branch': 'arc/main', 'production_branch_touched': False},
        'mde': {k: v for k, v in rules.mde_r00.items()},
        'power': None,
        'strata': [],
        'gates': {
            'I1': i1,
            'I2': None
            if inputs['I2'] is None
            else {
                'gain_chunk_random': 0.12,
                'gain_record_disjoint': 0.05,
                'gain_c_open': 0.04,
                'inflation_ratio': inputs['I2']['inflation_ratio'],
                'prediction': 2.0,
                'prediction_met': derived.get('gates.I2.prediction_met'),
            },  # fmt: skip
            'I3': inputs['I3'],
            'I4': None
            if inputs['I4'] is None
            else {
                'flip_rate': inputs['I4']['flip_rate'],
                'n_pairs': 2000,
                'pass': summary['I4_pass'],
            },
            'I5': None
            if inputs['I5'] is None
            else {
                'n_ref_pairs': 300,
                'ref': 'ref150+fable150',
                'graders': ['gemini-3.1-flash-lite', 'qwen3.5-9b', 'ministral-3-8b'],
                'kappa_drop': inputs['I5']['kappa_drop'],
                'prediction': 0.05,
                'prediction_met': derived.get('gates.I5.prediction_met'),
                'self_pref_inflation': 0.01,
            },  # fmt: skip
            'I6': None
            if inputs['I6'] is None
            else {
                'families': ['olmo-2-13b-instruct', 'phi-4', 'qwen3.5-9b'],
                'n_items': 420,
                **inputs['I6'],
                'archive_only_flagged': 7,
                'pass': derived.get('gates.I6.pass'),
            },  # fmt: skip
        },
        'proxy_vault': {
            'reads_used': reads_used,
            'read_points': read_points,
            'reads_budget_branch': rules.proxy_vault_read_budget[scenario.path],
            **doc['proxy_vault'],
            'reads': reads,
        },
        'verdicts_doc': doc,
        'sizes': {
            'model_bundle_raw': 3_970_000,
            'model_bundle_gzip': 3_450_000,
            'vector_set_raw': 332_772,
            'lexical_assets_raw': 3_800_000,
            'lexical_assets_gzip': 1_210_000,
            'first_open_raw': 8_100_000,
            'first_open_gzip': 5_000_000,
            'world_payload_raw': 650_000,
            'world_payload_gzip': 240_000,
            'model_bundle_max': 4_000_000,
        },  # fmt: skip
        'latency': {'worker_p95_cpu_ms': 3.2, 'worker_cold_load_ms': 41.0, 'browser_p95_ms': 6.5},
        'remeaning': None
        if not h3_in_scope
        else {
            'pool_size': 420,
            'labelled': 420,
            'unlabelled_counted_negative': 0,
            'p100': {'residualized': 0.8, 'raw': 0.4, 'logodds': 0.4},
            'label': derived.get('remeaning.label'),
            'coined_ranking_file': 'remeaning/coined.json',
            'labelers': ['olmo-2-13b-instruct', 'phi-4', 'qwen3.5-9b'],
            'contexts': ['archive', 'fineweb-edu'],
            'placebo_rerate': 0.12,
        },  # fmt: skip
        'density': {
            'mean_5nn_gap_radius': 0.31,
            'top_gaps': [],
            'briefs': [],
            'proposals_md_sha256': None,
        },
        'weirdness': {
            'file': 'weirdness.json',
            'sha256': fake_sha(run['id'], 'weirdness'),
            'definition': '1 − cos(Procrustes(W0), W1) per record, plus 10-NN rewiring',
        },
        'constraint_audit': None,
        'collisions': None if run['id'] != 'r00' else synth_collisions(),
        'panel': None if run['id'] != 'r00' else synth_panel(),
        'provenance': None if run['id'] != 'r00' else synth_provenance(),
        'contamination': None if run['id'] != 'r00' else synth_contamination(),
        'witness': synth_witness(run['id']),
        'claude_plan_tokens': {
            'tokens': 450_000 if run['id'] == 'r00' else 0,
            'run_cap': 500_000 if run['id'] == 'r00' else None,
            'arc_to_date': 450_000,
            'arc_cap': 800_000,
        },
        'fable': [],
        'agreement': None,
        'determinism': {
            'rerun_identical': True,
            'resumed_after_preemption': False,
            'artifact_hashes': {},
        },
        'artifacts': artifacts,
    }


def synth_i1_report(i1_inputs: Mapping[str, float], summary: Mapping[str, Any]) -> dict[str, Any]:
    """report.gates.I1 (A0 form) around the given verdict inputs; check.project_i1 inverts it."""
    lo = i1_inputs['min_kendall_ci_lo']
    acc = i1_inputs['probe_min_acc']
    probes = {}
    for n, (ptype, expect) in enumerate(PROBE_EXPECT.items()):
        gated = ptype != 'P3'  # one type below n = 20: reported, not gated
        value = acc if n == 0 else min(1.0, round(acc + 0.02, 6)) if gated else 0.5
        probes[ptype] = {
            'expect': expect,
            'n': 40 if gated else 12,
            'acc': value,
            'gated': gated,
            'pass': (value >= 0.90) if gated else None,
        }
    components = {
        'I1a': acc >= 0.90,
        'I1b': i1_inputs['kappa_qw_median'] >= 0.6 and i1_inputs['alpha_families'] >= 0.5,
        'I1c': lo >= 0.6,
        'I1d': i1_inputs['delta_ci_hi'] <= 0.30,
    }
    return {
        'probes': probes,
        'ref': {
            'n_pairs': 150,
            'families': ['claude-opus-5-5', 'olmo-2-13b-instruct', 'phi-4'],
            'kappa_qw_median': i1_inputs['kappa_qw_median'],
            'kappa_qw_ipw': round(i1_inputs['kappa_qw_median'] - 0.02, 6),
            'alpha_families': i1_inputs['alpha_families'],
            'claude_leg_status': 'accepted',
        },
        'check_pairs': 75,
        'kendall': [
            {'judges': 'gemini|qwen', 'tau': 0.81, 'ci_lo': lo, 'ci_hi': 0.9, 'tau_b': 0.8},
            {'judges': 'gemini|fable', 'tau': 0.84, 'ci_lo': round(lo + 0.05, 6), 'ci_hi': 0.92, 'tau_b': 0.83},
            {'judges': 'qwen|fable', 'tau': 0.8, 'ci_lo': round(lo + 0.03, 6), 'ci_hi': 0.9, 'tau_b': 0.79},
        ],  # fmt: skip
        'diff': {
            'n_dense_only': 150,
            'n_bm25_only': 150,
            'delta': round(i1_inputs['delta_ci_hi'] - 0.15, 6),
            'ci_lo': round(i1_inputs['delta_ci_hi'] - 0.3, 6),
            'ci_hi': i1_inputs['delta_ci_hi'],
            'ref': 'mean(claude,phi-4)',
        },
        'systems': [
            'B0', 'B1', 'B2', 'B4', 'B3.potion8m', 'hyb(B4)', 'hyb(B3.potion8m)',
            'B6.embeddinggemma-2-768',
        ],  # fmt: skip
        'author_kendall': {'tau': 0.71, 'ci_lo': 0.52, 'ci_hi': 0.86},
        'author_disagrees_fable': 6,
        'null_fp_rate': 0.03,
        'components': components,
        'rejudged': False,
        'pass': summary['I1_pass'],
        'pass_effective': summary['I1_pass_effective'],
    }


def synth_collisions() -> dict[str, Any]:
    return {
        'file': 'collisions.md',
        'sha256': fake_sha('collisions'),
        'names': 41,
        'clusters': 12,
        'byline_overlaps': 3,
        'spelling_variants': 2,
        'rule_checked': 12,
        'quarantined': [
            {'cluster_id': 'q1:priya', 'name': 'Priya Chakrabarti / Chakraborty', 'rule': 'Q1'},
            {'cluster_id': 'q3:adaeze', 'name': 'Adaeze', 'rule': 'Q3'},
        ],
    }


def synth_panel() -> dict[str, Any]:
    return {
        'model': 'allenai/OLMo-2-1124-13B',
        'revision': 'synthetic',
        'quant': 'fp8',
        'variant': '13b',
        'beacon_round': 9_000_000,
        'raw': 61,
        'kept': 38,
        'yield': 0.62,
        'identity_rate': 1.0,
        'sets': [
            {'set_id': 'r00:c_open', 'kind': 'c_open', 'n': 30, 'sha256': fake_sha('c_open'), 'published': True},
            {'set_id': 'r00:c_frontier', 'kind': 'c_frontier', 'n': 8, 'sha256': fake_sha('c_frontier'), 'published': False},
        ],
    }  # fmt: skip


def synth_provenance() -> dict[str, Any]:
    return {
        'file': 'provenance.json',
        'sha256': fake_sha('provenance'),
        'commit': fake_sha('code')[:40],
        'counts': {
            'A': {'claude': 185},
            'B_related': {'claude': 300, 'owner': 18, 'copilot': 15},
            'inline_link': {'claude': 177},
        },
    }


def synth_contamination() -> dict[str, Any]:
    return {
        'file': 'contamination.json',
        'sha256': fake_sha('contamination'),
        'indices': ['v4_olmo-2-1124-13b-instruct_llama', 'v4_olmo-mix-1124_llama'],
        'lookups': 981,
        'records_hit': [],
        'precutoff': {
            'slugs': [f'precutoff-{n}' for n in range(6)],
            'lookups': 18,
            'status': 'landed',
            'outage': False,
        },
        'continuation': {'records': 50, 'hit_rate': 0.0, 'pos_rate': 0.85, 'neg_rate': 0.0},
    }


def synth_witness(run_id: str) -> list[dict[str, Any]]:
    kinds = ['a0', 's0', 'r00-sets', 'ref-claude'] if run_id == 'r00' else []
    return [
        {'kind': kind, 'digest': fake_sha('witness', kind), 'mode': 'dry', 'log_index': n, 'integrated_time': 1_790_000_000 + n}
        for n, kind in enumerate(kinds)
    ]  # fmt: skip


def statuses(outcome: Outcome) -> dict[str, str]:
    """{rule id: status} of the in-scope rules (out-of-scope ones are NOT_APPLICABLE)."""
    return {
        h['id']: h['status'] for h in outcome.doc['hypotheses'] if h['status'] != NOT_APPLICABLE
    }
