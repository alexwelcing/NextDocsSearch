"""Build verdicts.json from a run's inputs and per-query score files.

The producer (S13) supplies, per row, only what rules.yaml cannot know:

    {comparison_id, scores_file, nested, vault_read}

and, for the whole run, `run`, `vault`, `gates_inputs`, `adoption` and `signoff_inputs`. Every
other row field follows from rules.yaml (kind, arms, stratum, metric, unit, tau, tau_floor,
mde_r00, prediction), from the score file (n_queries, n_clusters, point, raw CI, p_raw, seed_sd,
n_seeds, scores_sha256) or from the Holm family (holm_m, holm_rank, alpha_adj, adjusted CI,
p_holm). `arcforge verdict` calls the same function on a stored verdicts.json and diffs the
result, so a verdict that does not follow from the score files fails the run.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from pathlib import Path, PurePosixPath
from typing import Any

from arcforge.contract import stats
from arcforge.contract.ids import SCORES_SCHEMA
from arcforge.contract.rules import Rules
from arcforge.contract.verdicts import Context, Outcome, evaluate

ROW_INPUT_KEYS: tuple[str, ...] = ('comparison_id', 'scores_file', 'nested', 'vault_read')


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scores_path(run_dir: Path, scores_file: str) -> Path:
    """A row's score file, which must lie inside the run directory."""
    rel = PurePosixPath(scores_file)
    if rel.is_absolute() or '..' in rel.parts or not rel.parts:
        raise stats.ScoresError(f'{scores_file!r}: score files are paths inside the run directory')
    return run_dir.joinpath(*rel.parts)


def load_scores(run_dir: Path, scores_file: str) -> tuple[dict[str, Any], str]:
    path = scores_path(run_dir, scores_file)
    try:
        data = path.read_bytes()
    except OSError as error:
        raise stats.ScoresError(f'{scores_file}: {error.strerror or error}') from None
    try:
        scores = json.loads(data)
    except json.JSONDecodeError as error:
        raise stats.ScoresError(f'{scores_file}: not JSON ({error})') from None
    if not isinstance(scores, dict):
        raise stats.ScoresError(f'{scores_file}: expected an object')
    return scores, hashlib.sha256(data).hexdigest()


def _check_identity(rules: Rules, cid: str, scores: Mapping[str, Any]) -> None:
    spec = rules.rows[cid]
    expected = {
        'schema': SCORES_SCHEMA,
        'comparison_id': cid,
        'arm_a': spec.arm_a,
        'arm_b': spec.arm_b,
        'stratum': spec.stratum,
        'metric': spec.metric,
        'estimator': spec.estimator,
    }
    for key, value in expected.items():
        if scores.get(key) != value:
            raise stats.ScoresError(f'{key} is {scores.get(key)!r}; row {cid} needs {value!r}')
    if spec.estimator == 'refit_pooled':
        cut = spec.metric.partition('@')[2]
        if not cut.isdigit() or scores.get('k') != int(cut):
            raise stats.ScoresError(f'k is {scores.get("k")!r}; metric {spec.metric} needs k = {cut}')


def compute_rows(
    rules: Rules, inputs: Mapping[str, Any], run_dir: Path
) -> tuple[list[dict[str, Any]], list[str]]:
    """Every row of `inputs['rows']`, recomputed. Returns (rows, errors)."""
    errors: list[str] = []
    computed: dict[str, tuple[dict[str, Any], stats.RowStats]] = {}
    ctx = Context(rules, {**inputs, 'rows': []})  # registered/provisional need no rows
    for item in inputs.get('rows') or []:
        cid = item.get('comparison_id') if isinstance(item, Mapping) else None
        if cid not in rules.rows:
            errors.append(f'row {cid!r} is not defined in rules.yaml')
            continue
        if cid in computed:
            errors.append(f'row {cid} appears twice')
            continue
        scores_file = item.get('scores_file')
        if not isinstance(scores_file, str):
            errors.append(f'row {cid}: scores_file must be a path')
            continue
        try:
            scores, digest = load_scores(run_dir, scores_file)
            _check_identity(rules, cid, scores)
            row_stats = stats.compute(
                scores,
                comparison_id=cid,
                alpha=rules.stats.alpha,
                resamples=rules.stats.resamples,
                permutations=rules.stats.permutations,
                refit_resamples=rules.stats.refit_resamples,
            )
        except stats.ScoresError as error:
            errors.append(f'row {cid}: {error}')
            continue
        spec = rules.rows[cid]
        row = {
            'comparison_id': cid,
            'hypothesis': spec.hypothesis,
            'registered': ctx.registered(cid),
            'kind': spec.kind,
            'arm_a': spec.arm_a,
            'arm_b': spec.arm_b,
            'stratum': spec.stratum,
            'metric': spec.metric,
            'unit': spec.unit,
            'n_queries': row_stats.n_queries,
            'n_clusters': row_stats.n_clusters,
            'point': row_stats.point,
            'ci_lo_raw': row_stats.ci_lo_raw,
            'ci_hi_raw': row_stats.ci_hi_raw,
            'holm_family': spec.hypothesis,
            'holm_m': None,
            'holm_rank': None,
            'alpha_adj': None,
            'ci_lo_adj': None,
            'ci_hi_adj': None,
            'p_raw': row_stats.p_raw,
            'p_holm': None,
            'tau': rules.tau(spec),
            'tau_floor': spec.tau_floor,
            'mde_r00': rules.mde_value(spec),
            'seed_sd': row_stats.seed_sd,
            'n_seeds': row_stats.n_seeds,
            'nested': bool(item.get('nested', True)),
            'vault_read': bool(item.get('vault_read', False)),
            'provisional': ctx.row_provisional(cid),
            'prediction': spec.prediction.source if spec.prediction else None,
            'scores_file': scores_file,
            'scores_sha256': digest,
        }
        computed[cid] = (row, row_stats)

    # Holm within each hypothesis's registered family; everything else keeps the raw values.
    families: dict[str, dict[str, float]] = {}
    for cid, (row, row_stats) in computed.items():
        if ctx.in_holm(cid):
            families.setdefault(row['hypothesis'], {})[cid] = row_stats.p_raw
    holm: dict[str, tuple[int, int, float, float]] = {}
    for family in families.values():
        holm.update(stats.holm(family, rules.stats.alpha))
    for cid, (row, row_stats) in computed.items():
        if cid in holm:
            rank, m, alpha_adj, p_holm = holm[cid]
            row['ci_lo_adj'], row['ci_hi_adj'] = row_stats.ci(alpha_adj)
        else:
            rank, m, alpha_adj, p_holm = 0, len(families.get(row['hypothesis'], {})), rules.stats.alpha, row_stats.p_raw
            row['ci_lo_adj'], row['ci_hi_adj'] = row['ci_lo_raw'], row['ci_hi_raw']
        row.update(holm_rank=rank, holm_m=m, alpha_adj=alpha_adj, p_holm=p_holm)
    order = list(rules.rows)
    rows = sorted((row for row, _ in computed.values()), key=lambda r: order.index(r['comparison_id']))
    return rows, errors


def build_verdicts(
    rules: Rules,
    inputs: Mapping[str, Any],
    run_dir: str | Path,
    history: Sequence[Mapping[str, Any]] | None = None,
) -> Outcome:
    """The complete verdicts.json for a run, from its inputs and score files.

    `inputs` may be a stored verdicts.json (its numbers and statuses are ignored and recomputed;
    only each row's ROW_INPUT_KEYS are read) or the producer's own input document.
    """
    rows, errors = compute_rows(rules, inputs, Path(run_dir))
    outcome = evaluate(rules, {**inputs, 'rows': rows}, history)
    outcome.errors[:0] = errors
    return outcome
