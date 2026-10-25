"""The R00 tail (m2-verdict): power, freeze, PREREG.md, lint, report.json, verdicts.json, the
bench card, and the packed Fable sign-off.

The computation is arcforge.eval.tail.run_tail; this module wires it to S13's outputs and to the
s0-committed contract files (rules.yaml template, PREREG.pre.md, produces.yaml) and the A0 records
in prereg/ (PREREG-A0.json, model-choice-a0.json, the witness index), which enter the stage key
through the 'prereg' external fingerprint. It refuses a rules template or PREREG.pre.md whose
sha256 differs from the one the s0 commitment recorded. After the outputs are computed it packs
the sign-off (`python -m arcforge.fable` packet, outside the repository) and records the packet in
signoff_packet.json; the signoff stage collects it.
"""

from __future__ import annotations

import hashlib
import json
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from arcforge.core.dag import External, RunEnv, StageContext, StageError
from arcforge.eval.stagekit import stage

PROMPT = (
    'You are Fable. Your working directory holds one task packet. Read INSTRUCTIONS.md and do '
    'exactly what it says, using only the files in this directory. Write your answer to '
    'output.json, valid against output.schema.json, and write no other file. If you cannot or '
    'will not do the task, write the refusal form that INSTRUCTIONS.md gives.'
)


def prereg_files() -> dict[str, Path]:
    from arcforge.contract.lint import PRODUCES_PATH  # noqa: PLC0415
    from arcforge.contract.prereg_doc import A0_PATH, PRE_PATH, PREREG_DIR  # noqa: PLC0415
    from arcforge.contract.rules import TEMPLATE_PATH  # noqa: PLC0415

    return {
        'rules_template': TEMPLATE_PATH,
        'prereg_pre': PRE_PATH,
        'produces': PRODUCES_PATH,
        'amendment_a0': A0_PATH,
        'model_choice': PREREG_DIR / 'model-choice-a0.json',
        'witness_index': PREREG_DIR / 'witness' / 'index.json',
    }


def load_prereg(ctx: StageContext, env: RunEnv) -> tuple[str, dict[str, bytes | None]]:
    payload = {}
    hashes = {}
    for name, path in prereg_files().items():
        data = path.read_bytes() if path.is_file() else None
        payload[name] = data
        hashes[name] = None if data is None else hashlib.sha256(data).hexdigest()
    return hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest(), payload


def _json_or_none(data: bytes | None) -> Any:
    return None if data is None else json.loads(data)


def run(ctx: StageContext) -> Mapping[str, bytes]:
    from arcforge.eval import io  # noqa: PLC0415
    from arcforge.eval.tail import TailError, run_tail  # noqa: PLC0415

    files = ctx.external['prereg']
    pre = json.loads(ctx.input_bytes('S13', 'report.pre.json'))
    for key in ('rules_template', 'prereg_pre', 'produces'):
        if files.get(key) is None:
            raise StageError(f'tail: {prereg_files()[key]} is missing')
    s0 = pre.get('s0') or {}
    for key, field in (('rules_template', 'rules_sha256'), ('prereg_pre', 'prereg_pre_sha256')):
        committed = s0.get(field)
        actual = hashlib.sha256(files[key]).hexdigest()
        if committed and committed != actual:
            raise StageError(
                f'tail: {prereg_files()[key].name} hashes to {actual}, but the s0 commitment '
                f'recorded {committed}; the contract changed after S0'
            )
    records = io.untar(ctx.input_bytes('S13', 'records.tar'))
    witness_index = _json_or_none(files.get('witness_index')) or []
    if isinstance(witness_index, Mapping):
        witness_index = witness_index.get('entries') or []
    witness_index = [*witness_index, *(e for e in pre.get('witness') or [] if e not in witness_index)]
    gate_calls = (_json_or_none(records.get('fable_calls.json')) or {}).get('calls') or []
    eval_cfg = ctx.cfg('eval') or {}
    try:
        outputs = run_tail(
            pre=pre,
            scores_tar=ctx.input_bytes('S13', 'scores.tar'),
            qrels_rows=io.read_jsonl(ctx.input_bytes('S13', 'qrels.final.jsonl.gz')),
            template_text=files['rules_template'].decode('utf-8'),
            pre_text=files['prereg_pre'].decode('utf-8'),
            produces_text=files['produces'].decode('utf-8'),
            a0_bytes=files.get('amendment_a0'),
            model_choice=_json_or_none(files.get('model_choice')),
            witness_index=witness_index,
            fable_calls=gate_calls,
            power_resamples=int(eval_cfg.get('power_resamples', 10000)),
        )
    except TailError as error:
        raise StageError(f'tail: {error}') from None
    outputs['signoff_packet.json'] = io.pretty(pack_signoff(outputs, files, records))
    outputs.setdefault('r01_plan_lines.json', io.pretty({'schema': 'arc-plan-lines/1', 'lines': []}))
    return outputs


def pack_signoff(outputs: Mapping[str, bytes], files: Mapping[str, bytes | None],
                 records: Mapping[str, bytes]) -> dict[str, Any]:  # fmt: skip
    """Pack the A0 sign-off from the tail's own outputs; the orchestrator runs the agent."""
    import os  # noqa: PLC0415

    from arcforge.contract.schema import REPORT_SCHEMA_PATH  # noqa: PLC0415
    from arcforge.fable import packer  # noqa: PLC0415

    missing = [n for n in ('amendment_a0', 'model_choice') if files.get(n) is None]
    witness_bytes = files.get('witness_index') or json.dumps({'entries': []}).encode()
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        paths = {}
        for name, data in {
            'prereg': outputs['PREREG.md'], 'rules': outputs['rules.frozen.yaml'],
            'schema': REPORT_SCHEMA_PATH.read_bytes(), 'lint': outputs['lint.json'],
            'report': outputs['report.json'], 'verdicts': outputs['verdicts.json'],
            'bench_card': outputs['bench-card.md'],
            'amendment_a0': files.get('amendment_a0') or b'{"missing": "prereg/amendments/PREREG-A0.json"}',
            'witness': witness_bytes,
            'model_choice': files.get('model_choice') or b'{"missing": "prereg/model-choice-a0.json"}',
            'contamination': records.get('contamination.json') or b'{"missing": "contamination"}',
            'provenance': records.get('provenance.json') or b'{"missing": "provenance"}',
            'panel': records.get('panel-summary.json') or b'{"missing": "panel"}',
            'quarantine': records.get('quarantine.json') or b'{"missing": "quarantine"}',
        }.items():  # fmt: skip
            paths[name] = base / name
            paths[name].write_bytes(data)
        env_root = os.environ.get('ARCFORGE_FABLE_DIR')
        packet = packer.pack_signoff(**paths, root=Path(env_root) if env_root else None)
    ledger = json.loads(packet.ledger_path.read_text(encoding='utf-8'))
    open_attempt = next((a for a in reversed(ledger['attempts']) if a['outcome'] is None), None)
    # Machine-independent: the packet is found by name under $ARCFORGE_FABLE_DIR (default
    # ~/.cache/arcforge/fable), so a rebuild of the tail reproduces these bytes.
    return {
        'schema': 'arc-signoff-packet/1',
        'packet_dir': packet.root.name,
        'packet_sha256': packet.sha256,
        'root': '$ARCFORGE_FABLE_DIR, else ~/.cache/arcforge/fable',
        'workdir': None if open_attempt is None else f'{packet.root.name}/{packet.workdir(open_attempt["attempt"]).name}',
        'model': 'claude-fable-5-1',
        'prompt': PROMPT,
        'then': f'python -m arcforge.fable check {packet.root} --session <id> --model <model>',
        'repair': 'on a refusal: python -m arcforge.fable repair <packet_root> --diff <fix.diff> '
        '--<input> <corrected file> (at most twice; a third refusal halts the arc)',
        'missing_records': missing,
    }


STAGES = (
    stage(
        name='tail',
        title='R00 tail',
        phase='tail',
        platform='laptop',
        inputs=('S13',),
        outputs=(
            'power.json', 'rules.frozen.yaml', 'PREREG.md', 'lint.json', 'report.json',
            'verdicts.json', 'bench-card.md', 'signoff_packet.json', 'tail_checks.json',
            'r01_plan_lines.json',
        ),  # fmt: skip
        config_keys=('eval',),
        external=(External('prereg', load_prereg),),
        code=('arcforge.eval.tail', 'arcforge.eval.power', 'arcforge.eval.report',
              'arcforge.contract.prereg_doc', 'arcforge.contract.lint', 'arcforge.contract.build',
              'arcforge.contract.verdicts', 'arcforge.fable.packer'),  # fmt: skip
        run=run,
        notes='MDEs and the verdict table, prereg freeze (mde_r00 only), PREREG.md, lint '
        '--frozen, report.json + verdicts.json (arcforge verdict reproduces them), the bench '
        'card, and the packed Fable sign-off.',
        replay='cpu',
        publish={name: 'public' for name in (
            'power.json', 'rules.frozen.yaml', 'PREREG.md', 'lint.json', 'report.json',
            'verdicts.json', 'bench-card.md', 'signoff_packet.json', 'tail_checks.json',
            'r01_plan_lines.json',
        )},  # fmt: skip
    ),
)
