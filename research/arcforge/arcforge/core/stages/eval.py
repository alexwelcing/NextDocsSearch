"""S13, eval and report (m2-verdict): everything the run measured, as report.pre.json.

Reads the bench, the final judgments and grades, every system's rankings and the A0 records,
and writes: report.pre.json (the report as far as S13 knows it, with the verdict inputs and the
power inputs), scores.tar (arc-scores/1 per row and per power stratum), qrels.final.jsonl.gz
(A0 precedence), i1.json, strata.json, weirdness.json (when the record vectors exist) and
records.tar (the A0 records the sign-off packet carries, byte for byte). The computation lives in
arcforge.eval; this module is the stage wiring. Heavy imports stay inside run.
"""

from __future__ import annotations

from collections.abc import Mapping

from arcforge.core.dag import StageContext
from arcforge.eval.stagekit import stage

INPUTS = ('S0', 'S1', 'S2p', 'S12q', 'S6b', 'S9', 'S10', 'S11', 'S12a', 'S12b', 'S12r', 'gate',
          'X1', 'X2', 'P1')  # fmt: skip
# The A0 records the tail hands to Fable's sign-off, carried verbatim: (stage, output, name).
RECORDS = (
    ('X1', 'contamination.json', 'contamination.json'),
    ('S1', 'provenance.json', 'provenance.json'),
    ('P1', 'panel_diagnostics.json', 'panel-summary.json'),
    ('S12q', 'quarantine.json', 'quarantine.json'),
    ('gate', 'fable_calls.json', 'fable_calls.json'),
    ('gate', 'gate_receipts.json', 'gate_receipts.json'),
)


def run(ctx: StageContext) -> Mapping[str, bytes]:
    from arcforge.contract.rules import load_rules  # noqa: PLC0415
    from arcforge.eval import io, report  # noqa: PLC0415

    inputs = {name: dict(ctx.inputs.get(name) or {}) for name in INPUTS}
    config = {
        'run': ctx.cfg('run'),
        'eval': ctx.cfg('eval'),
        '_sha256': ctx.config.sha256 or None,
    }
    resamples = int((config['eval'] or {}).get('resamples', 10000))
    outputs = dict(
        report.evaluate_run(inputs, config, load_rules(), resamples=resamples)
    )
    records = {
        name: inputs[stage_name][output]
        for stage_name, output, name in RECORDS
        if output in inputs.get(stage_name, {})
    }
    outputs['records.tar'] = io.tar(records)
    return outputs


STAGES = (
    stage(
        name='S13',
        title='Eval and report',
        phase='tail',
        platform='cpu',
        inputs=INPUTS,
        outputs=(
            'report.pre.json', 'scores.tar', 'qrels.final.jsonl.gz', 'i1.json', 'strata.json',
            'ledger.json', 'records.tar', 'weirdness.json',
        ),  # fmt: skip
        config_keys=('run', 'eval'),
        code=(
            'arcforge.eval.report', 'arcforge.eval.strata', 'arcforge.eval.i1',
            'arcforge.eval.qrels', 'arcforge.eval.metrics', 'arcforge.eval.agreement',
            'arcforge.eval.geometry', 'arcforge.eval.io', 'arcforge.contract.stats',
            'arcforge.contract.rules',
        ),  # fmt: skip
        run=run,
        notes='held-out-fold metrics per stratum (A0 qrels precedence, quarantine apart), seed '
        'SD, per-query score files, judged@10 and condensed nDCG, the BM25 author-link pilot '
        'replication, I1 (A0) a-d, I3, I5, density, weirdness, sizes, cost.',
        replay='cpu',
        publish={
            'report.pre.json': 'private', 'scores.tar': 'public', 'qrels.final.jsonl.gz': 'public',
            'i1.json': 'public', 'strata.json': 'public', 'ledger.json': 'public',
            'records.tar': 'private', 'weirdness.json': 'public',
        },  # fmt: skip
    ),
)
