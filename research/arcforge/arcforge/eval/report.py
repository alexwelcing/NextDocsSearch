"""report.pre.json (S13) and the final report.json / verdicts.json (the R00 tail).

S13 computes everything the run measured: the final qrels, the strata table, I1 (A0), I3, I5,
the per-query score files of every in-scope row and of the power pair, density, weirdness,
sizes and cost. It writes report.pre.json: the report as far as S13 knows it, with the verdict
inputs beside it ('verdict_inputs') and the power inputs ('power_inputs'). The tail adds what
only it knows (the MDEs and power table, the frozen rules' sha256, the sign-off preconditions,
the verdicts, Fable's calls) and writes report.json and verdicts.json, which `arcforge verdict`
must reproduce.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from arcforge.contract.ids import PROXY_VAULT_AGGREGATE, REPORT_SCHEMA, SCHEMA_VERSION, VERDICTS_SCHEMA
from arcforge.contract.rules import Rules
from arcforge.eval import geometry, i1, io, qrels, strata
from arcforge.eval.agreement import grouped_bootstrap, round6

PRE_SCHEMA = 'arc-report-pre/1'
STRATA_ORDER = (
    'A', 'B', 'AB', 'C_open', 'E', 'CE', 'D', 'D.entity', 'D.coinage', 'D.negation', 'D.era',
    'D.coinage+entity', 'F', 'G', 'T', 'QUARANTINE', 'FRONTIER', 'FRONTIER.A', 'FRONTIER.B',
    'FRONTIER.C', 'FRONTIER.D', 'FRONTIER.E', 'POST_S0',
)  # fmt: skip
POWER_STRATA = ('AB', 'D', 'CE', 'G', 'C_open')


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _get(inputs: Mapping[str, Mapping[str, bytes]], stage: str, name: str) -> bytes | None:
    return (inputs.get(stage) or {}).get(name)


def _json(inputs, stage, name, default=None):  # noqa: ANN001, ANN202
    data = _get(inputs, stage, name)
    return default if data is None else io.read_json(data)


def _jsonl(inputs, stage, name):  # noqa: ANN001, ANN202
    data = _get(inputs, stage, name)
    return [] if data is None else io.read_jsonl(data)


# ---- S13 --------------------------------------------------------------------------------------


def evaluate_run(
    inputs: Mapping[str, Mapping[str, bytes]],
    config: Mapping[str, Any],
    rules: Rules,
    *,
    resamples: int = 2000,
    power_resamples: int = 10000,
) -> dict[str, bytes]:
    """S13's outputs from its inputs ({stage: {output: bytes}}) and the run config."""
    run_cfg = config['run']
    queries = _jsonl(inputs, 'S6b', 'bench_queries.jsonl')
    fixed = _jsonl(inputs, 'S6b', 'qrels_fixed.jsonl')
    judgments = _jsonl(inputs, 'S12b', 'judgments.jsonl.gz')
    gold_doc = _json(inputs, 'gate', 'fable_gold.json', {}) or {}
    fable_gold = gold_doc.get('grades', gold_doc if isinstance(gold_doc, list) else [])
    bench_map = {q['query_id']: q for q in queries}
    final = qrels.final_qrels(bench_map, fixed, judgments, fable_gold)
    judged = qrels.by_query([j for j in judgments if j.get('role') in ('primary', 'adjudicate')])
    bench = strata.Bench.build(
        queries, qrels.by_query(final), _jsonl(inputs, 'S12a', 'rankings.jsonl.gz'), judged
    )
    systems = bench.systems()

    table = []
    for stratum in STRATA_ORDER:
        if stratum == 'POST_S0':
            table.append(_empty_stratum('POST_S0'))  # A0 rule 8: expected empty, n_queries 0
            continue
        if not bench.stratum_queries(stratum):
            continue
        entry = strata.stratum_entry(bench, stratum, systems, resamples=resamples)
        if stratum == 'F':
            entry['systems'] += _f_auroc_rows(bench, systems, resamples)
        table.append(entry)

    receipts = _json(inputs, 'gate', 'gate_receipts.json', {}) or {}
    claude_status = receipts.get('claude_leg_status', 'failed')
    ref_rows = [*_jsonl(inputs, 'S12r', 'ref_open.jsonl'), *_jsonl(inputs, 'gate', 'ref_claude.jsonl')]
    frames = _json(inputs, 'S12b', 'frames.json', {}) or {}
    probes = _jsonl(inputs, 'S12b', 'probes.jsonl')
    fixed_pos: dict[str, set[str]] = {}
    for row in fixed:
        if row['source'] in ('rationale', 'link') and int(row['grade']) >= 1:
            fixed_pos.setdefault(row['query_id'], set()).add(row['slug'])
    i1_block, i1_inputs = i1.compute_i1(
        bench=bench, probes=probes, judgments=judgments, ref_rows=ref_rows, frames=frames,
        fable_gold=fable_gold, fixed_positives=fixed_pos, claude_leg_status=claude_status,
        check_pairs=len((frames.get('tune_check') or {}).get('check') or []) or None,
        resamples=resamples,
    )  # fmt: skip
    i5 = i1.compute_i5(
        frames=frames, judgments=judgments, ref_rows=ref_rows, fable_gold=fable_gold,
        pools=_jsonl(inputs, 'S12b', 'pools.jsonl'), claude_accepted=claude_status == 'accepted',
    )  # fmt: skip
    i3 = i1.compute_i3(_json(inputs, 'S12a', 'i3_rows.json', {}) or {})

    run_id, branch = run_cfg['id'], run_cfg['branch']
    score_files: dict[str, bytes] = {}
    row_inputs = []
    problems = []
    for rule in rules.rules:
        if not rules.in_scope(rule.id, run_id, branch):
            continue
        for cid in rule.rows.values():
            if any(r['comparison_id'] == cid for r in row_inputs):
                continue
            spec = rules.rows[cid]
            if spec.estimator == 'refit_pooled' or spec.stratum.startswith('POOL.'):
                problems.append(f'{cid}: its {spec.stratum} pool is not an S13 input at {run_id}')
                continue
            doc = strata.scores_doc(
                bench, comparison_id=cid, stratum=spec.stratum, metric=spec.metric,
                arm_a=spec.arm_a, arm_b=spec.arm_b, estimator=spec.estimator,
            )  # fmt: skip
            if doc is None:
                problems.append(f'{cid}: no ranked queries for {spec.arm_a} / {spec.arm_b} on {spec.stratum}')
                continue
            path = f'scores/{cid}.json'
            score_files[path] = io.pretty(doc)
            row_inputs.append({'comparison_id': cid, 'scores_file': path, 'nested': True,
                               'proxy_vault_read': spec.stratum.startswith('C_vault')})  # fmt: skip
    power_inputs = {}
    for stratum in POWER_STRATA:
        doc = strata.scores_doc(
            bench, comparison_id=f'power.{stratum}', stratum=stratum,
            metric=_power_metric(stratum), arm_a='hyb(B5)', arm_b='B2',
        )  # fmt: skip
        if doc is not None:
            path = f'power/{stratum}.json'
            score_files[path] = io.pretty(doc)
            power_inputs[stratum] = path

    vectors_blob = _get(inputs, 'S11', 'record_vectors.safetensors')
    density = {'mean_5nn_gap_radius': None, 'top_gaps': [], 'briefs': [], 'proposals_md_sha256': None}
    weird_doc = None
    if vectors_blob:
        tensors, meta = geometry.read_safetensors(vectors_blob)
        slugs = json.loads(meta.get('slugs', '[]'))
        if 'W1' in tensors and len(slugs) == len(tensors['W1']):
            w1 = dict(zip(slugs, tensors['W1'], strict=True))
            density.update(geometry.density(w1))
            if 'W0' in tensors and len(tensors['W0']) == len(slugs):
                w0 = dict(zip(slugs, tensors['W0'], strict=True))
                weird_doc = {
                    'schema': 'arc-weirdness/1',
                    'definition': '1 − cos(Procrustes(W0), W1) per record, plus 10-NN rewiring',
                    'records': geometry.weirdness(w0, w1),
                }
    weird_bytes = io.pretty(weird_doc) if weird_doc else None

    pre = {
        'schema': PRE_SCHEMA,
        'schema_version': SCHEMA_VERSION,
        'run': _run_block(inputs, config),
        'cost': _cost(inputs, config),
        'strata': table,
        'gates': {'I1': i1_block if run_id in ('r00', 'r01', 'r10', 'r10K') else None,
                  'I2': None, 'I3': i3, 'I4': None, 'I5': i5, 'I6': None},  # fmt: skip
        'verdict_inputs': {
            'schema': VERDICTS_SCHEMA,
            'schema_version': SCHEMA_VERSION,
            'run': {'id': run_id, 'branch': branch, 'h1_provisional': run_cfg.get('h1_provisional'),
                    'prereg_sha256': None, 'rules_sha256': None},  # fmt: skip
            'proxy_vault': {k: None for k in PROXY_VAULT_AGGREGATE} | {'read_this_run': False, 'compromised': False},
            'gates_inputs': {'I1': i1_inputs, 'I1_prior_pass': None, 'I2': None, 'I3': i3, 'I4': None,
                             'I5': None if i5 is None else {'kappa_drop': i5['kappa_drop']}, 'I6': None},  # fmt: skip
            'rows': row_inputs,
            'adoption': None,
            'signoff_inputs': None,
        },
        'power_inputs': power_inputs,
        'pilot_replication': strata.pilot_replication(bench),
        'density': density,
        'weirdness': {'file': 'weirdness.json' if weird_bytes else None,
                      'sha256': sha256(weird_bytes) if weird_bytes else None,
                      'definition': '1 − cos(Procrustes(W0), W1) per record, plus 10-NN rewiring'},  # fmt: skip
        'sizes': _sizes(inputs),
        'latency': {'worker_p95_cpu_ms': None, 'worker_cold_load_ms': None, 'browser_p95_ms': None},
        'collisions': _collisions(inputs),
        'panel': _panel(inputs),
        'provenance': _provenance(inputs),
        'contamination': _contamination(inputs),
        'witness': _witness(inputs),
        'claude_plan_tokens': _claude_tokens(inputs, run_id),
        'determinism': _determinism(inputs),
        'problems': problems,
    }
    outputs = {
        'report.pre.json': io.pretty(pre),
        'scores.tar': io.tar(score_files),
        'qrels.final.jsonl.gz': io.gz(io.jsonl(final, ('query_id', 'slug'))),
        'i1.json': io.pretty({'schema': 'arc-i1/1', 'gates': i1_block, 'gates_inputs': i1_inputs,
                              'I5': i5, 'I3': i3, 'claude_leg_status': claude_status}),  # fmt: skip
        'strata.json': io.pretty({'schema': 'arc-strata/1', 'strata': table,
                                  'pilot_replication': pre['pilot_replication']}),  # fmt: skip
        'ledger.json': io.pretty({'schema': 'arc-ledger/1', 'lines': [], 'gpu_min': 0.0, 'claude_plan_tokens': 0}),
    }
    if weird_bytes:
        outputs['weirdness.json'] = weird_bytes
    return outputs


def _power_metric(stratum: str) -> str:
    from arcforge.eval.power import STRATUM_METRIC

    return STRATUM_METRIC[stratum]


def _empty_stratum(stratum: str) -> dict[str, Any]:
    return {'id': stratum, 'n_queries': 0, 'n_source_clusters': 0, 'n_target_clusters': 0,
            'judged_at_10': None, 'condensed_ndcg10': None, 'exploratory': True, 'systems': []}  # fmt: skip


def _f_auroc_rows(bench: strata.Bench, systems: Sequence[str], resamples: int) -> list[dict[str, Any]]:
    rows = []
    for system in systems:
        value = strata.f_auroc(bench, system)
        if value is None:
            continue
        pos, neg = [], []
        for qid in bench.stratum_queries('F'):
            slots = bench.scores_top1.get((qid, system))
            if slots:
                score = sum(slots.values()) / len(slots)
                (pos if bench.qrels.get(qid) else neg).append(score)
        lo, hi = grouped_bootstrap(
            {'pos': pos, 'neg': neg}, lambda g: strata.metrics.auroc(g['pos'], g['neg']),
            label=f'F.auroc.{system}', resamples=resamples,
        )  # fmt: skip
        rows.append({'system_id': system, 'metric': 'auroc', 'mean': round6(value), 'seed_sd': 0.0,
                     'ci_lo': round6(lo), 'ci_hi': round6(hi)})  # fmt: skip
    return rows


def _run_block(inputs: Mapping[str, Mapping[str, bytes]], config: Mapping[str, Any]) -> dict[str, Any]:
    run_cfg = config['run']
    snapshot = _json(inputs, 'S0', 'snapshot.json', {}) or {}
    s0 = _json(inputs, 'X2', 's0.json', {}) or {}
    corpus_id = snapshot.get('corpus_id') or sha256(b'arc-unpinned-corpus')
    bench_bytes = _get(inputs, 'S6b', 'bench_queries.jsonl') or b''
    parent = run_cfg.get('parent_by_fold') or {}
    return {
        'id': run_cfg['id'],
        'branch': run_cfg['branch'],
        'h1_provisional': run_cfg.get('h1_provisional'),
        'one_change': run_cfg.get('one_change', ''),
        'prediction': run_cfg.get('prediction', ''),
        'config_sha256': config.get('_sha256') or sha256(io.canonical(dict(config))),
        'prereg_sha256': None,
        'amendments': [],
        'rules_sha256': None,
        'schema_sha256': None,
        'parent_by_fold': {
            k: parent.get(k) or sha256(f'arc-parent|{run_cfg["id"]}|{k}|{corpus_id}'.encode())
            for k in ('1', '2', '3')
        },
        'corpus_id': corpus_id,
        'main_corpus_id': snapshot.get('main_corpus_id') or corpus_id,
        'frontier': {'kind': 'withheld', 'series': ['the-echo-chamber', 'the-residue'], 'rejoin_run': 'r09'},
        'bench': {'version': (config.get('eval') or {}).get('bench', 'v1'), 'sha256': sha256(bench_bytes)},
        'seeds': list((config.get('run') or {}).get('seeds') or [1729, 1730, 1731, 1732, 1733]),
        'code_sha': s0.get('code_sha') or snapshot.get('git_sha') or '0' * 40,
        'container_digest': (config.get('_runtime') or {}).get('container_digest', 'local'),
        'teacher_revision': ((config.get('teacher') or {}).get('revision')) or 'unpinned',
        'train_device': ((config.get('train') or {}).get('device')) or 'cuda',
        'started_utc': (config.get('_runtime') or {}).get('started_utc', '2026-10-25T00:00:00Z'),
        'wall_clock_min': float((config.get('_runtime') or {}).get('wall_clock_min', 0.0)),
    }


LEDGER_STAGES = ('S2', 'S2p', 'S6', 'S5', 'S12q', 'P1', 'S12a', 'S12b', 'S12r', 'gate', 'S6b', 'S9')


def _cost(inputs: Mapping[str, Mapping[str, bytes]], config: Mapping[str, Any]) -> dict[str, Any]:
    lines = []
    for stage in LEDGER_STAGES:
        ledger = _json(inputs, stage, 'ledger.json')
        if ledger:
            lines += [dict(line) for line in ledger.get('lines') or []]
    booking = (config.get('_runtime') or {}).get('runner_booking') or []
    lines += [dict(line) for line in booking]
    run_id = config['run']['id']
    plan = (config.get('plan') or {}).get('usd') if isinstance(config.get('plan'), Mapping) else None
    actual = round(sum(float(line.get('usd') or 0) for line in lines), 2)
    return {
        'plan_usd': round(float(plan), 2) if isinstance(plan, (int, float)) else 11.9 if run_id == 'r00' else 14.0,
        'actual_usd': actual,
        'cap_usd': 20,
        'plan_ceiling_usd': 20 if run_id == 'r00' else 17,
        'lines': lines,
    }


def _sizes(inputs: Mapping[str, Mapping[str, bytes]]) -> dict[str, Any]:
    raw = _json(inputs, 'S10', 'sizes.json', {}) or {}
    keys = ('model_bundle_raw', 'model_bundle_gzip', 'vector_set_raw', 'lexical_assets_raw',
            'lexical_assets_gzip', 'first_open_raw', 'first_open_gzip', 'world_payload_raw',
            'world_payload_gzip')  # fmt: skip
    return {**{k: raw.get(k) for k in keys}, 'model_bundle_max': 4_000_000}


def _collisions(inputs: Mapping[str, Mapping[str, bytes]]) -> dict[str, Any] | None:
    raw = _json(inputs, 'S2p', 'collisions.json')
    quarantine = _json(inputs, 'S12q', 'quarantine.json', {}) or {}
    if raw is None:
        return None
    data = _get(inputs, 'S2p', 'collisions.json') or b''
    clusters = quarantine.get('clusters') or []
    return {
        'file': 'collisions.json',
        'sha256': sha256(data),
        'names': int(raw.get('names') or 0),
        'clusters': int(raw.get('clusters') or len(clusters)),
        'byline_overlaps': int(raw.get('byline_overlaps') or 0),
        'spelling_variants': int(raw.get('spelling_variants') or 0),
        'rule_checked': int(raw.get('clusters') or len(clusters)),
        'quarantined': [
            {'cluster_id': c['cluster_id'], 'name': c['name'], 'rule': c['rule']}
            for c in clusters
            if c.get('quarantined')
        ],
    }


def _panel(inputs: Mapping[str, Mapping[str, bytes]]) -> dict[str, Any] | None:
    diag = _json(inputs, 'P1', 'panel_diagnostics.json')
    if diag is None:
        return None
    sets = []
    for name, kind, published in (('c_open.jsonl', 'c_open', True), ('c_frontier.jsonl', 'c_frontier', False)):
        data = _get(inputs, 'P1', name)
        if data is not None:
            sets.append({'set_id': f'r00:{kind}', 'kind': kind, 'n': len(io.read_jsonl(data)),
                         'sha256': sha256(data), 'published': published})  # fmt: skip
    raw, kept = int(diag.get('raw') or 0), int(diag.get('kept') or 0)
    return {
        'model': diag.get('model', 'allenai/OLMo-2-1124-13B'),
        'revision': str(diag.get('revision', 'unpinned')),
        'quant': str(diag.get('quant', 'fp8')),
        'variant': diag.get('variant', '13b'),
        'beacon_round': diag.get('beacon_round'),
        'raw': raw,
        'kept': kept,
        'yield': round6(kept / raw) if raw else 0.0,
        'identity_rate': diag.get('identity_rate'),
        'sets': sets,
    }


def _provenance(inputs: Mapping[str, Mapping[str, bytes]]) -> dict[str, Any] | None:
    data = _get(inputs, 'S1', 'provenance.json')
    if data is None:
        return None
    raw = io.read_json(data)
    return {'file': 'provenance.json', 'sha256': sha256(data),
            'commit': raw.get('commit') or '0' * 40, 'counts': raw.get('counts') or {}}  # fmt: skip


def _contamination(inputs: Mapping[str, Mapping[str, bytes]]) -> dict[str, Any] | None:
    data = _get(inputs, 'X1', 'contamination.json')
    if data is None:
        return None
    raw = io.read_json(data)
    pre = raw.get('precutoff') or {}
    cont = _json(inputs, 'P1', 'continuation.json')
    return {
        'file': 'contamination.json',
        'sha256': sha256(data),
        'indices': list(raw.get('indices') or ['unknown']),
        'lookups': int((raw.get('totals') or {}).get('lookups') or 0),
        'records_hit': sorted(r['slug'] for r in raw.get('records') or [] if r.get('hit')),
        'precutoff': {
            'slugs': list(pre.get('slugs') or []),
            'lookups': 3 * len(pre.get('slugs') or []),
            'status': pre.get('status', 'excluded'),
            'outage': bool(pre.get('outage', False)),
        },
        'continuation': None if cont is None else {
            k: cont.get(k) for k in ('records', 'hit_rate', 'pos_rate', 'neg_rate')
        },
    }


def _witness(inputs: Mapping[str, Mapping[str, bytes]]) -> list[dict[str, Any]]:
    entries = []
    receipt = _json(inputs, 'X2', 's0.receipt.json')
    for found in [receipt, *((_json(inputs, 'gate', 'gate_receipts.json', {}) or {}).get('witness') or [])]:
        if not found:
            continue
        rekor = found.get('rekor') or {}
        entries.append({
            'kind': found['kind'], 'digest': found['digest'], 'mode': found.get('mode', 'dry'),
            'log_index': found.get('log_index', rekor.get('logIndex')),
            'integrated_time': found.get('integrated_time', rekor.get('integratedTime')),
        })  # fmt: skip
    return entries


def _claude_tokens(inputs: Mapping[str, Mapping[str, bytes]], run_id: str) -> dict[str, Any]:
    raw = _json(inputs, 'gate', 'claude_plan_tokens.json', {}) or {}
    tokens = int(raw.get('tokens') or 0)
    return {'tokens': tokens, 'run_cap': 500_000 if run_id == 'r00' else None,
            'arc_to_date': int(raw.get('arc_to_date') or tokens), 'arc_cap': 800_000}  # fmt: skip


def _determinism(inputs: Mapping[str, Mapping[str, bytes]]) -> dict[str, Any]:
    raw = _json(inputs, 'S9', 'determinism.json', {}) or {}
    return {'rerun_identical': raw.get('rerun_identical'),
            'resumed_after_preemption': bool(raw.get('resumed_after_preemption', False)),
            'artifact_hashes': dict(raw.get('artifact_hashes') or {})}  # fmt: skip


# ---- the tail ---------------------------------------------------------------------------------


def final_report(
    pre: Mapping[str, Any],
    *,
    verdicts_doc: Mapping[str, Any],
    verdicts_bytes: bytes,
    derived: Mapping[str, Any],
    rules_sha256: str,
    schema_sha256: str,
    a0_sha256: str | None,
    mde: Mapping[str, float],
    power: Mapping[str, Any] | None,
    fable_calls: Sequence[Mapping[str, Any]],
    artifacts: Sequence[Mapping[str, Any]],
    branch_path: str = 'N',
    read_points: Sequence[str] = ('r04', 'r06', 'r10'),
) -> dict[str, Any]:
    """report.json (arc-report/1, schema 1.1) around a computed verdicts document."""
    summary = verdicts_doc['gates_summary']
    run = dict(pre['run'])
    run.update(rules_sha256=rules_sha256, schema_sha256=schema_sha256,
               amendments=[{'id': 'PREREG-A0', 'sha256': a0_sha256}] if a0_sha256 else [])  # fmt: skip
    gates = {k: (None if v is None else dict(v)) for k, v in pre['gates'].items()}
    if gates.get('I1') is not None:
        gates['I1']['pass'] = bool(summary['I1_pass'])
        gates['I1']['pass_effective'] = bool(summary['I1_pass_effective'])
    if gates.get('I5') is not None:
        gates['I5']['prediction_met'] = derived.get('gates.I5.prediction_met')
    vault = verdicts_doc['proxy_vault']
    return {
        'schema': REPORT_SCHEMA,
        'schema_version': SCHEMA_VERSION,
        'run': run,
        'vm': pre.get('vm'),
        'cost': pre['cost'],
        'adoption': [],
        'production': {
            'config_sha256': sha256(io.canonical({'production': run['config_sha256']})),
            'votes': '3-0',
            'split_decision': False,
            'trained_on': 'all_main_line_records',
            'used_for_verdicts': False,
            'flag': {'mode': 'off', 'model': None, 'verdicts_sha256': sha256(verdicts_bytes)},
        },
        'ship': {'flag_branch': 'arc/main', 'production_branch_touched': False},
        'mde': dict(mde),
        'power': None if power is None else {
            'se': dict(power['report']['se']), 'verdict_probs': list(power['verdict_probs'])
        },
        'strata': pre['strata'],
        'gates': gates,
        'proxy_vault': {
            'reads_used': 0, 'read_points': list(read_points),
            'reads_budget_branch': 2 if branch_path == 'S-F' else 3,
            **{k: vault[k] for k in PROXY_VAULT_AGGREGATE}, 'reads': [],
        },  # fmt: skip
        'verdicts_doc': dict(verdicts_doc),
        'sizes': pre['sizes'],
        'latency': pre['latency'],
        'remeaning': None,
        'density': pre['density'],
        'weirdness': pre['weirdness'],
        'constraint_audit': None,
        'collisions': pre['collisions'],
        'panel': pre['panel'],
        'provenance': pre['provenance'],
        'contamination': pre['contamination'],
        'witness': pre['witness'],
        'claude_plan_tokens': pre['claude_plan_tokens'],
        'fable': [dict(c) for c in fable_calls],
        'agreement': None,
        'determinism': pre['determinism'],
        'artifacts': [dict(a) for a in artifacts],
    }


def artifact(path: str, data: bytes, kind: str) -> dict[str, Any]:
    return {'path': path, 'sha256': sha256(data), 'bytes': len(data), 'kind': kind}


def write_scores(run_dir: Path, scores_tar: bytes) -> list[dict[str, Any]]:
    """Unpack S13's score files into a run directory; return their artifact entries."""
    out = []
    for name, data in sorted(io.untar(scores_tar).items()):
        target = run_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        if name.startswith('scores/'):
            out.append(artifact(name, data, 'scores'))
    return out
