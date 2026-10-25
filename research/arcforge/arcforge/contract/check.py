"""`arcforge verdict rNN`: recompute a run's verdicts.json and fail on any mismatch.

A run directory holds report.json, verdicts.json and the per-query score files its rows name.
Verification:
1. verdicts.json (and report.json, when present) validate against arc-report/1;
2. verdicts.json lists every rule exactly once, out-of-scope rules NOT_APPLICABLE with no rows;
3. every row is recomputed from its score file under rules.yaml (contract/build.py) and the whole
   document is re-derived (contract/verdicts.py); any difference, any NOT_COMPUTABLE and any
   contract error fails;
4. report.json agrees with verdicts.json: verdicts_doc is the same document; run, proxy_vault and
   gate inputs match (the A0 I1 inputs are projected from gates.I1's probes, ref, kendall and diff); derived values (remeaning.label, the gate passes) follow the statuses; adoption
   decisions match; every score file is a listed artifact with its sha256;
5. verdicts.json is under 25 KB.
At R10/R10K the verdicts.json of every earlier run of the realized path is loaded from the runs
directory, because arc_summary depends on them.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.contract import schema as report_schema
from arcforge.contract.branches import PathError, path_of_final
from arcforge.contract.build import build_verdicts
from arcforge.contract.ids import NOT_APPLICABLE, PROXY_VAULT_AGGREGATE, RULE_IDS
from arcforge.contract.rules import Rules
from arcforge.contract.verdicts import FINAL_RUNS, Outcome, close, diff

VERDICTS_MAX_BYTES = 25 * 1024


@dataclass
class VerifyResult:
    run_dir: Path
    outcome: Outcome | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def statuses(self) -> list[tuple[str, str, bool]]:
        if self.outcome is None:
            return []
        return [(h['id'], h['status'], h['in_scope']) for h in self.outcome.doc['hypotheses']]


def load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        raise FileNotFoundError(f'{path} does not exist') from None
    except json.JSONDecodeError as error:
        raise ValueError(f'{path}: not JSON ({error})') from None


def check_listing(rules: Rules, doc: Mapping[str, Any]) -> list[str]:
    """Every rule exactly once, in rules.yaml order; NOT_APPLICABLE exactly where out of scope."""
    errors = []
    entries = doc.get('hypotheses') or []
    ids = [e.get('id') for e in entries if isinstance(e, Mapping)]
    for rule_id in RULE_IDS:
        if ids.count(rule_id) != 1:
            errors.append(
                f'verdicts.json lists {rule_id} {ids.count(rule_id)} times (exactly once required)'
            )
    extra = sorted({str(i) for i in ids} - set(RULE_IDS))
    if extra:
        errors.append(f'verdicts.json lists unknown rules {extra}')
    run = doc.get('run') or {}
    for entry in entries:
        rule_id = entry.get('id')
        if rule_id not in RULE_IDS:
            continue
        in_scope = rules.in_scope(rule_id, run.get('id', ''), run.get('branch', ''))
        if not in_scope and (entry.get('status') != NOT_APPLICABLE or entry.get('row_ids')):
            errors.append(
                f'{rule_id} is out of scope at {run.get("id")}/{run.get("branch")}: it must be NOT_APPLICABLE with no rows'
            )
        if in_scope and entry.get('status') == NOT_APPLICABLE:
            errors.append(
                f'{rule_id} is in scope at {run.get("id")}/{run.get("branch")} but reported NOT_APPLICABLE'
            )
    return errors


def load_history(rules: Rules, runs_root: Path, run_id: str, branch: str) -> list[dict[str, Any]]:
    """The verdicts.json of every run before (run_id, branch) on its path, in order."""
    _, earlier = path_of_final(rules, run_id, branch)
    history = []
    for prior_run, prior_branch in earlier:
        doc = load_json(runs_root / prior_run / 'verdicts.json')
        found = (doc.get('run') or {}).get('branch')
        if found != prior_branch:
            raise PathError(
                f'{prior_run}/verdicts.json is on branch {found!r}, the path needs {prior_branch!r}'
            )
        used = (doc.get('run') or {}).get('rules_sha256')
        if rules.sha256 and used != rules.sha256:
            raise ValueError(
                f'{prior_run}/verdicts.json was decided under rules {used}, not {rules.sha256}'
            )
        history.append(doc)
    return history


def _walk(report: Mapping[str, Any], path: str) -> tuple[bool, Any]:
    node: Any = report
    for part in path.split('.'):
        if not isinstance(node, Mapping) or part not in node:
            return False, None
        node = node[part]
    return True, node


def project_i1(i1: Mapping[str, Any]) -> dict[str, Any]:
    """gates_inputs.I1 as report.gates.I1 (A0 form) determines it.

    probe_min_acc is the lowest accuracy over the gated probe types (n >= 20); kappa_qw_median and
    alpha_families come from the three-family reference; min_kendall_ci_lo is the lowest Kendall
    CI bound over the three judge pairs; delta_ci_hi is the lineage differential's upper bound.
    """
    gated = [p.get('acc') for p in (i1.get('probes') or {}).values() if p.get('gated')]
    kendall = [k.get('ci_lo') for k in i1.get('kendall') or []]
    ref = i1.get('ref') or {}
    lineage = i1.get('diff') or {}
    return {
        'probe_min_acc': min(gated) if gated and None not in gated else None,
        'kappa_qw_median': ref.get('kappa_qw_median'),
        'alpha_families': ref.get('alpha_families'),
        'min_kendall_ci_lo': min(kendall) if kendall and None not in kendall else None,
        'delta_ci_hi': lineage.get('ci_hi'),
    }


def cross_check(report: Mapping[str, Any], doc: Mapping[str, Any], outcome: Outcome) -> list[str]:
    """report.json against its verdicts.json and the recomputed outcome."""
    errors = [
        f'report.verdicts_doc differs from verdicts.json: {d}'
        for d in diff(doc, report.get('verdicts_doc'))
    ]
    run, d_run = report.get('run') or {}, doc.get('run') or {}
    for key in ('id', 'branch', 'h1_provisional', 'prereg_sha256', 'rules_sha256'):
        if run.get(key) != d_run.get(key):
            errors.append(
                f'report.run.{key} is {run.get(key)!r}, verdicts.json says {d_run.get(key)!r}'
            )
    schema_sha = report_schema.sha256()
    if run.get('schema_sha256') != schema_sha:
        errors.append(
            f'report.run.schema_sha256 is {run.get("schema_sha256")}, arc-report-1.json hashes to {schema_sha}'
        )
    vault, d_vault = report.get('proxy_vault') or {}, doc.get('proxy_vault') or {}
    for key in PROXY_VAULT_AGGREGATE:
        if not close(vault.get(key), d_vault.get(key)):
            errors.append(
                f'report.proxy_vault.{key} is {vault.get(key)!r}, verdicts.json says {d_vault.get(key)!r}'
            )

    gates, inputs = report.get('gates') or {}, doc.get('gates_inputs') or {}
    i1 = gates.get('I1')
    i6 = gates.get('I6')
    projections = {
        'I1': None if i1 is None else project_i1(i1),
        'I2': None
        if gates.get('I2') is None
        else {'inflation_ratio': gates['I2'].get('inflation_ratio')},
        'I3': gates.get('I3'),
        'I4': None if gates.get('I4') is None else {'flip_rate': gates['I4'].get('flip_rate')},
        'I5': None if gates.get('I5') is None else {'kappa_drop': gates['I5'].get('kappa_drop')},
        'I6': None
        if i6 is None
        else {k: i6.get(k) for k in ('fleiss_kappa', 'placebo_rerate', 'random_rerate')},
    }
    for key, value in projections.items():
        for problem in diff(value, inputs.get(key), f'gates_inputs.{key}'):
            errors.append(f'report.gates.{key} does not match verdicts.json: {problem}')
    summary = outcome.doc['gates_summary']
    if i1 is not None and i1.get('pass_effective') is not summary.get('I1_pass_effective'):
        errors.append(
            f'report.gates.I1.pass_effective is {i1.get("pass_effective")!r}, the rules give {summary.get("I1_pass_effective")!r}'
        )
    for path, value in outcome.derived.items():
        exists, found = _walk(report, path)
        if not exists or found is None:
            errors.append(f'report.{path} is missing; the rules derive {value!r}')
        elif found != value:
            errors.append(f'report.{path} is {found!r}; the rules derive {value!r}')
    if gates.get('I4') is not None and gates['I4'].get('pass') is not summary.get('I4_pass'):
        errors.append(
            f'report.gates.I4.pass is {gates["I4"].get("pass")!r}, the rules give {summary.get("I4_pass")!r}'
        )

    report_adoption = sorted(
        (
            {
                'fold': e.get('fold'),
                'rule': e.get('rule'),
                'arms': [
                    {
                        k: a.get(k)
                        for k in ('arm_id', 'gain_lfo', 'guard_ok', 'control', 'bundle_raw')
                    }
                    for a in e.get('arms') or []
                ],
                'chosen_arm': e.get('chosen_arm'),
                'adopted': e.get('adopted'),
            }
            for e in report.get('adoption') or []
        ),
        key=lambda e: (str(e['rule']), e['fold'] or 0),
    )
    doc_adoption = doc.get('adoption') or []
    for problem in diff(doc_adoption, report_adoption, 'adoption'):
        errors.append(f'report.adoption does not match verdicts.json: {problem}')

    artifacts = {a.get('path'): a for a in report.get('artifacts') or [] if isinstance(a, Mapping)}
    for row in doc.get('rows') or []:
        art = artifacts.get(row.get('scores_file'))
        if (
            art is None
            or art.get('kind') != 'scores'
            or art.get('sha256') != row.get('scores_sha256')
        ):
            errors.append(
                f'row {row.get("comparison_id")}: {row.get("scores_file")} is not a listed scores artifact with its sha256'
            )
    return errors


def verify_run(
    run_dir: str | Path,
    rules: Rules,
    runs_root: str | Path | None = None,
    validate: bool = True,
) -> VerifyResult:
    run_dir = Path(run_dir)
    runs_root = Path(runs_root) if runs_root is not None else run_dir.parent
    result = VerifyResult(run_dir)
    verdicts_path = run_dir / 'verdicts.json'
    report_path = run_dir / 'report.json'
    try:
        stored = load_json(verdicts_path)
    except (FileNotFoundError, ValueError) as error:
        result.errors.append(str(error))
        return result
    report = None
    if report_path.exists():
        try:
            report = load_json(report_path)
        except ValueError as error:
            result.errors.append(str(error))
    else:
        result.warnings.append(f'{report_path} is missing: verdicts.json is checked on its own')

    size = verdicts_path.stat().st_size
    if size >= VERDICTS_MAX_BYTES:
        result.errors.append(
            f'verdicts.json is {size} bytes; it must stay under {VERDICTS_MAX_BYTES}'
        )
    if validate:
        result.errors.extend(
            f'verdicts.json: {e}' for e in report_schema.errors(stored, definition='VerdictsDoc')
        )
        if report is not None:
            result.errors.extend(f'report.json: {e}' for e in report_schema.errors(report))
    if not isinstance(stored, Mapping):
        return result
    result.errors.extend(check_listing(rules, stored))

    run = stored.get('run') or {}
    history: Sequence[Mapping[str, Any]] | None = None
    if run.get('id') in FINAL_RUNS:
        try:
            history = load_history(rules, runs_root, run.get('id'), run.get('branch'))
        except (FileNotFoundError, ValueError, PathError) as error:
            result.errors.append(f'arc_summary: {error}')
    try:
        outcome = build_verdicts(rules, stored, run_dir, history)
    except (KeyError, TypeError, AttributeError, ValueError) as error:
        # Only a document the schema already rejected gets here; report it, do not crash.
        result.errors.append(f'verdicts.json cannot be recomputed: {type(error).__name__}: {error}')
        return result
    result.outcome = outcome
    result.errors.extend(outcome.problems())
    result.errors.extend(
        f'verdicts.json does not reproduce: {d}' for d in diff(outcome.doc, stored)
    )
    if report is not None:
        result.errors.extend(cross_check(report, stored, outcome))
    return result
