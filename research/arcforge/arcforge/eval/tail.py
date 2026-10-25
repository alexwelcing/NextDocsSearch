"""The R00 tail: power, freeze, PREREG.md, lint, the final report and verdicts, the bench card.

`run_tail(pre, scores_tar, records, ...)` is a pure function of S13's outputs, the s0-committed
rules template and PREREG.pre.md, and the A0 records; it returns every tail output as bytes.
It computes and never inspects: PREREG prose is the template's, and only its placeholders take
values (the MDEs, taus, the verdict table, the I1 outcome, hashes, the R00 records' counts).

Order (so each step reads only what earlier steps fixed):
1. the MDEs from the power pair's score files, then `prereg freeze` (the diff against the
   template must touch mde_r00 only) and the verdict-probability table under the frozen rules;
2. `prereg lint --frozen` on the frozen copy (lint.json);
3. the sign-off preconditions, the verdicts (build_verdicts under the frozen rules), the report,
   and report_valid by validating that report against arc-report/1 (schema 1.1); if it is not
   valid the verdicts are rebuilt with report_valid false, so the sign-off fails rather than
   the record lying;
4. PREREG.md from PREREG.pre.md (every placeholder filled; I1's registered fallback and the R01
   re-judge line when I1 fails), and the bench card.
"""

from __future__ import annotations

import json
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from arcforge.contract import lint as contract_lint
from arcforge.contract import prereg_doc
from arcforge.contract import schema as report_schema
from arcforge.contract.build import build_verdicts
from arcforge.contract.ids import JUDGE_FREE_GLOSS
from arcforge.contract.rules import freeze_diff, freeze_text, loads_rules
from arcforge.contract.verdicts import dumps_doc
from arcforge.eval import io, power, report

R01_REJUDGE_LINE = {
    'stage': 'S12b',
    'item': 'I1 fallback: re-judge the pools under PREREG-A1 (registered at R00)',
    'rules': 'PREREG-A1 from the REF tune half; re-check on the check half, R01\'s 30 REF pairs, '
    'the re-judged probes and I1d recomputed',
}


class TailError(RuntimeError):
    """The tail cannot produce a consistent R00 record (the run fails; nothing is guessed)."""


def _sha(data: bytes) -> str:
    return report.sha256(data)


def signoff_preconditions(
    *,
    pre: Mapping[str, Any],
    lint_ok: bool,
    report_valid: bool,
    i1_fallback_scheduled: bool,
    witness_index: Sequence[Mapping[str, Any]],
    a0_bytes: bytes | None,
    model_choice: Mapping[str, Any] | None,
    produces: Mapping[str, Any],
) -> dict[str, bool]:
    """The A0 sign-off inputs (rules.yaml signoff), each measured, none assumed."""
    entries = [e for e in witness_index if e.get('kind')]
    ordered = sorted(
        entries,
        key=lambda e: (e.get('log_index') is None, e.get('log_index') or 0, e.get('integrated_time') or 0),
    )
    a0_first = bool(
        a0_bytes is not None
        and ordered
        and ordered[0]['kind'] == 'a0'
        and ordered[0].get('digest') == _sha(a0_bytes)
    )
    kinds = {e['kind'] for e in entries}
    contamination = pre.get('contamination') or {}
    precut = contamination.get('precutoff') or {}
    resolved = bool(contamination) and len(precut.get('slugs') or []) == 6 and (
        (precut.get('status') == 'landed' and precut.get('lookups') == 18)
        or precut.get('status') == 'excluded'
    )
    runs = (produces.get('runs') or {})

    def planned(run_id: str, field: str) -> bool:
        flat = json.dumps((runs.get(run_id) or {}).get('N') or {})
        return field in flat

    return {
        'lint_ok': bool(lint_ok),
        'report_valid': bool(report_valid),
        'a0_witness_first': a0_first,
        's0_witnessed': 's0' in kinds,
        'r00_sets_witnessed': 'r00-sets' in kinds,
        'model_choice_present': bool(model_choice) and any(
            k in model_choice for k in ('variant', 'chosen_variant', 'chosen')
        ),
        'contamination_present': bool(contamination),
        'precutoff_lookups_resolved': resolved,
        'provenance_present': bool(pre.get('provenance')),
        'i1_fallback_scheduled': bool(i1_fallback_scheduled),
        'i2_scheduled': planned('r04', 'gates_inputs.I2'),
        'i4_scheduled': planned('r01', 'gates_inputs.I4'),
    }


def _i1_text(gate: Mapping[str, Any] | None, passed: bool) -> str:
    if gate is None:
        return 'I1 was not measured.'
    comps = gate.get('components') or {}
    held = ', '.join(k for k in ('I1a', 'I1b', 'I1c', 'I1d') if comps.get(k))
    failed = ', '.join(k for k in ('I1a', 'I1b', 'I1c', 'I1d') if comps.get(k) is False)
    if passed:
        return f'I1 PASSED at R00 ({held} all hold).'
    return (
        f'I1 FAILED at R00 ({failed} did not hold). The registered fallback is engaged: '
        'PREREG-A1 is written from the REF tune half and hashed before any R01 judging; R01 '
        're-judges the pools and re-checks I1 on the check half, R01\'s 30 fresh REF pairs, the '
        're-judged probes and I1d recomputed; until I1 passes, H1\'s family is {c1, c3} (c2 and '
        'c4 exploratory) and the proxy-vault sign uses intent-only qrels. The R01 plan carries '
        'the re-judge line.'
    )


def _log_index(index: Sequence[Mapping[str, Any]], kind: str) -> str:
    for entry in index:
        if entry.get('kind') == kind:
            value = entry.get('log_index')
            return str(value) if value is not None else f'{entry.get("mode", "dry")} (no Rekor index)'
    return 'not witnessed'


def bench_card(pre: Mapping[str, Any], final: Mapping[str, Any], qrels_rows: Sequence[Mapping[str, Any]]) -> str:
    """ARC-Bench v1's card: what is in it, where it comes from, what it is not."""
    sources: dict[str, int] = {}
    for row in qrels_rows:
        sources[row['source']] = sources.get(row['source'], 0) + 1
    lines = [
        '# ARC-Bench v1 (RE-MEANING R00)',
        '',
        'No human relevance judgment enters this benchmark (Amendment A0). The A and B strata are '
        'corpus-intrinsic links written in owner-directed Claude Code sessions and merged by the '
        'owner, not human judgments. ' + JUDGE_FREE_GLOSS,
        '',
        '## Strata',
        '',
        '| Stratum | Queries | Source clusters | Target clusters | Exploratory |',
        '| --- | --- | --- | --- | --- |',
    ]
    for s in final['strata']:
        lines.append(
            f'| {s["id"]} | {s["n_queries"]} | {s["n_source_clusters"]} | {s["n_target_clusters"]} | {"yes" if s["exploratory"] else "no"} |'
        )
    lines += ['', '## Qrels by source (A0 precedence)', '', '| Source | Pairs |', '| --- | --- |']
    lines += [f'| {k} | {v} |' for k, v in sorted(sources.items())]
    lines += [
        '',
        'Precedence: the corpus links and the reader-intent labels are fixed; then Fable gold, '
        'then gemini-3-flash adjudication, then the primary judge. Reference grades never enter '
        'the qrels. Quarantined person clusters are scored in the QUARANTINE stratum only.',
        '',
        '## Commitments',
        '',
    ]
    for entry in final['witness']:
        lines.append(
            f'- {entry["kind"]}: sha256 {entry["digest"]} ({entry["mode"]}, Rekor logIndex '
            f'{entry["log_index"] if entry["log_index"] is not None else "none"})'
        )
    collisions = final.get('collisions') or {}
    lines += [
        '',
        '## People and contamination',
        '',
        f'- Person clusters checked by rule: {collisions.get("rule_checked", 0)}; quarantined: '
        + (', '.join(f'{q["name"]} ({q["rule"]})' for q in collisions.get('quarantined') or []) or 'none')
        + '.',
    ]
    contamination = final.get('contamination') or {}
    precut = contamination.get('precutoff') or {}
    lines.append(
        f'- Exact lookups: {contamination.get("lookups", 0)}; records hit: '
        f'{len(contamination.get("records_hit") or [])}; the six pre-cutoff records: '
        f'{precut.get("status", "unknown")}.'
    )
    lines += [
        '',
        '## Host of record',
        '',
        'research/arcforge/runs/r00/ in the public repository github.com/alexwelcing/NextDocsSearch '
        '(no record text: hashes, offsets, derived artifacts, queries, grades, bundles and '
        'reports). There is no vault seal and no key: each proxy-vault read is generated after a '
        'witnessed freeze.',
    ]
    return '\n'.join(lines) + '\n'


def run_tail(
    *,
    pre: Mapping[str, Any],
    scores_tar: bytes,
    qrels_rows: Sequence[Mapping[str, Any]],
    template_text: str,
    pre_text: str,
    produces_text: str,
    a0_bytes: bytes | None,
    model_choice: Mapping[str, Any] | None,
    witness_index: Sequence[Mapping[str, Any]],
    fable_calls: Sequence[Mapping[str, Any]] = (),
    power_resamples: int = 10000,
) -> dict[str, bytes]:
    """Every tail output, as bytes (the stage stores them; the dry tail writes them to disk)."""
    members = io.untar(scores_tar)
    docs = {s: json.loads(members[p]) for s, p in (pre.get('power_inputs') or {}).items()}
    table = power.mde_table(docs, resamples=power_resamples)
    mde = table['mde']
    template = template_text
    frozen_text = freeze_text(template, mde)
    if freeze_diff(template, frozen_text) is None:
        raise TailError('the frozen rules.yaml changes more than mde_r00')
    rules_frozen = loads_rules(frozen_text)
    power_doc = power.power_doc(rules_frozen, table)

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        rules_path = tmpdir / 'rules.yaml'
        rules_path.write_text(frozen_text, encoding='utf-8')
        plan_path = tmpdir / 'produces.yaml'
        plan_path.write_text(produces_text, encoding='utf-8')
        lint_report = contract_lint.lint(rules_path, plan_path, frozen=True)
        lint_bytes = io.pretty(lint_report.to_json())

        run_dir = tmpdir / 'run'
        run_dir.mkdir()
        score_artifacts = report.write_scores(run_dir, scores_tar)
        inputs = json.loads(json.dumps(pre['verdict_inputs']))
        inputs['run']['rules_sha256'] = rules_frozen.sha256
        produces = _yaml(produces_text)
        gates = pre['gates']
        i1_inputs = inputs['gates_inputs']['I1']
        i1_passes = bool(i1_inputs) and bool((gates.get('I1') or {}).get('components')) and all(
            (gates['I1']['components'] or {}).values()
        )
        valid = True
        outcome = final = None
        for _ in range(2):
            inputs['signoff_inputs'] = signoff_preconditions(
                pre=pre, lint_ok=lint_report.ok, report_valid=valid,
                i1_fallback_scheduled=not i1_passes, witness_index=witness_index,
                a0_bytes=a0_bytes, model_choice=model_choice, produces=produces,
            )  # fmt: skip
            outcome = build_verdicts(rules_frozen, inputs, run_dir)
            if not outcome.ok:
                raise TailError('the R00 verdicts are not computable:\n' + '\n'.join(outcome.problems()))
            verdicts_bytes = dumps_doc(outcome.doc).encode('utf-8')
            final = report.final_report(
                pre, verdicts_doc=outcome.doc, verdicts_bytes=verdicts_bytes, derived=outcome.derived,
                rules_sha256=rules_frozen.sha256, schema_sha256=report_schema.sha256(),
                a0_sha256=_sha(a0_bytes) if a0_bytes else None, mde=mde, power=power_doc,
                fable_calls=fable_calls, artifacts=score_artifacts,
            )  # fmt: skip
            errors = report_schema.errors(final)
            if bool(errors) == (not valid):
                break
            valid = not errors
        assert outcome is not None and final is not None
        report_errors = report_schema.errors(final)

    passed = bool(outcome.doc['gates_summary']['I1_pass'])
    values = prereg_doc.values_for(
        rules_frozen,
        {
            'a0_sha256': _sha(a0_bytes) if a0_bytes else 'missing',
            'rules_sha256': rules_frozen.sha256,
            'schema_sha256': report_schema.sha256(),
            'code_sha': pre['run']['code_sha'],
            'witness_a0': _log_index(witness_index, 'a0'),
            'witness_s0': _log_index(witness_index, 's0'),
            'witness_r00_sets': _log_index(witness_index, 'r00-sets'),
            'power_table': power.markdown_table(power_doc),
            'i1_r00': _i1_text(gates.get('I1'), passed),
            'contamination_r00': _contamination_text(pre.get('contamination')),
            'quarantine_r00': _quarantine_text(pre.get('collisions')),
            'panel_r00': _panel_text(pre.get('panel')),
        },
    )
    prereg_md = prereg_doc.fill(pre_text, values)
    verdicts_bytes = dumps_doc(outcome.doc).encode('utf-8')
    outputs = {
        'power.json': io.pretty(power_doc),
        'rules.frozen.yaml': frozen_text.encode('utf-8'),
        'PREREG.md': prereg_md.encode('utf-8'),
        'lint.json': lint_bytes,
        'report.json': io.pretty(final),
        'verdicts.json': verdicts_bytes,
        'bench-card.md': bench_card(pre, final, qrels_rows).encode('utf-8'),
        'tail_checks.json': io.pretty({
            'schema': 'arc-tail-checks/1',
            'signoff_inputs': outcome.doc['signoff_inputs'],
            'report_errors': report_errors,
            'lint_errors': [str(f) for f in lint_report.errors],
            'statuses': {h['id']: h['status'] for h in outcome.doc['hypotheses']},
        }),
    }
    if not passed:
        outputs['r01_plan_lines.json'] = io.pretty({'schema': 'arc-plan-lines/1', 'lines': [R01_REJUDGE_LINE]})
    return outputs


def _yaml(text: str) -> Mapping[str, Any]:
    from arcforge.contract.rules import load_yaml  # noqa: PLC0415

    return load_yaml(text) or {}


def _contamination_text(c: Mapping[str, Any] | None) -> str:
    if not c:
        return 'The contamination report is missing.'
    pre = c.get('precutoff') or {}
    return (
        f'At R00: {c.get("lookups", 0)} exact lookups over {", ".join(c.get("indices") or [])}; '
        f'{len(c.get("records_hit") or [])} records hit; the six pre-cutoff records: '
        f'{pre.get("status", "unknown")}{" (lookup service outage recorded)" if pre.get("outage") else ""}.'
    )


def _quarantine_text(c: Mapping[str, Any] | None) -> str:
    if not c:
        return 'No collisions report.'
    q = c.get('quarantined') or []
    return f'At R00, {len(q)} clusters were quarantined: ' + (
        ', '.join(f'{x["name"]} ({x["rule"]})' for x in q) or 'none'
    ) + '.'


def _panel_text(p: Mapping[str, Any] | None) -> str:
    if not p:
        return 'the proxy reader did not run.'
    sets = ', '.join(f'{s["kind"]} {s["n"]}' for s in p.get('sets') or [])
    return f'{p["model"]} ({p["variant"]}, {p["quant"]}), yield {p["yield"]}; sets: {sets}.'
