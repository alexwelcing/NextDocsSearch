"""The blind pass, after Fable answers: compare its recomputation with the reported verdicts.

`compare(result, docs)` lists every difference between a blind_recompute result and the full
verdicts.json files (statuses, verdict components, prediction_met, gates_summary, adoption
choices, arc_summary). The table, with a stable mismatch id per difference, is the input of the
mismatch pass (`pack_mismatch`), whose output is published as fable-end-review.json.

`reference_result(rules, blind_docs)` is what a correct blind pass returns, computed by the
contract's own verdict function from the stripped documents alone. The tests use it as the
simulated agent, which also proves the stripped files hold everything the rules read.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from arcforge.contract.ids import NOT_COMPUTABLE
from arcforge.contract.rules import Rules
from arcforge.contract.verdicts import FINAL_RUNS, evaluate

COMPARISON_SCHEMA = 'arc-fable-comparison/1'


def _items(doc: Mapping[str, Any]) -> dict[tuple[str, str], Any]:
    """{(item, field): value} of every verdict in one full or recomputed document."""
    out: dict[tuple[str, str], Any] = {}
    for entry in doc.get('hypotheses') or []:
        out[(f'hypotheses.{entry["id"]}', 'status')] = entry.get('status')
    for row in doc.get('rows') or []:
        for key in ('verdict_component', 'prediction_met'):
            out[(f'rows.{row["comparison_id"]}', key)] = row.get(key)
    for key, value in (doc.get('gates_summary') or {}).items():
        out[('gates_summary', key)] = value
    for entry in doc.get('adoption') or []:
        for key in ('chosen_arm', 'adopted'):
            out[(f'adoption.{entry["rule"]}.fold{entry["fold"]}', key)] = entry.get(key)
    for entry in doc.get('arc_summary') or []:
        for key in ('final_status', 'governing_run'):
            out[(f'arc_summary.{entry["id"]}', key)] = entry.get(key)
    return out


def compare(
    result: Mapping[str, Any],
    docs: Sequence[Mapping[str, Any]],
    *,
    blind_packet_sha256: str | None = None,
    blind_output_sha256: str | None = None,
) -> dict[str, Any]:
    """The comparison table: one entry per verdict where Fable and the reports differ."""
    by_run = {r['run_id']: r for r in result.get('runs') or []}
    mismatches = []
    checked = 0
    for doc in docs:
        run_id = doc['run']['id']
        blind = dict(by_run.get(run_id) or {})
        if run_id in FINAL_RUNS:
            blind['arc_summary'] = result.get('arc_summary')
        recomputed = _items(blind)
        for (item, key), reported in _items(doc).items():
            checked += 1
            value = recomputed.get((item, key), '(missing)')
            if value != reported or isinstance(value, bool) != isinstance(reported, bool):
                mismatches.append(
                    {
                        'run_id': run_id,
                        'item': item,
                        'field': key,
                        'reported': reported,
                        'recomputed': value,
                    }
                )
    for n, entry in enumerate(mismatches, start=1):
        entry['mismatch_id'] = f'm{n:03d}'
    return {
        'schema': COMPARISON_SCHEMA,
        'blind_packet_sha256': blind_packet_sha256,
        'blind_output_sha256': blind_output_sha256,
        'checked': checked,
        'mismatches': [{'mismatch_id': m.pop('mismatch_id'), **m} for m in mismatches],
    }


def reference_result(rules: Rules, blind_docs: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """A correct blind pass over `blind_docs` (stripped, in run order)."""
    runs = []
    history: list[dict[str, Any]] = []
    arc_summary = None
    for doc in blind_docs:
        outcome = evaluate(rules, doc, history if doc['run']['id'] in FINAL_RUNS else None)
        full = outcome.doc
        for entry in full['hypotheses']:
            if entry['id'] in {n.rule for n in outcome.not_computable}:
                entry['status'] = NOT_COMPUTABLE
        runs.append(
            {
                'run_id': full['run']['id'],
                'hypotheses': [{'id': h['id'], 'status': h['status']} for h in full['hypotheses']],
                'rows': [
                    {
                        'comparison_id': r['comparison_id'],
                        'verdict_component': r['verdict_component'],
                        'prediction_met': r['prediction_met'],
                    }
                    for r in full['rows']
                ],
                'gates_summary': full['gates_summary'],
                'adoption': [
                    {
                        'fold': a['fold'],
                        'rule': a['rule'],
                        'chosen_arm': a['chosen_arm'],
                        'adopted': a['adopted'],
                    }
                    for a in full['adoption'] or []
                ],
            }
        )
        if full['arc_summary'] is not None:
            arc_summary = full['arc_summary']
        history.append(full)
    return {
        'runs': runs,
        'arc_summary': arc_summary,
        'notes': 'reference recomputation by arcforge.contract',
    }
