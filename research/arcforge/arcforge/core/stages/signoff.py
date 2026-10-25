"""The R00 sign-off (m2-verdict, replay 'external'): collect Fable's accepted signature.

The tail packed the sign-off. The orchestrator runs Fable on it (and, on a refusal, repairs at
most twice with `python -m arcforge.fable repair`, each repair a new packet that carries every
refusal verbatim). This stage follows the chain to its last packet, and:
- if the last packet's signature was accepted: writes signoff.json (the accepted output and its
  fable[] record), prereg_hashes.json (the sha256 of the signed PREREG.md, rules.yaml and the
  schema, from the accepted packet itself), prereg.receipt.json (witness kind 'prereg'), and
  report.json with the fable[] entries added; a repair that changed rules.yaml is refused (the
  tail must be re-run on the repaired rules, so the verdicts follow from them);
- if the chain halted (a third refusal) or failed closed: fails, and the arc halts at R00;
- otherwise: fails with the pending packet (where, which model, the prompt, the next command).
"""

from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from arcforge.core.dag import StageContext, StageError
from arcforge.eval.stagekit import stage


def fable_root() -> Path:
    from arcforge.fable.packer import default_root  # noqa: PLC0415

    env = os.environ.get('ARCFORGE_FABLE_DIR')
    return Path(env) if env else default_root()


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def follow_chain(first_root: Path) -> Path:
    """The newest packet of a repair chain: each repair carries the previous packet's refusal."""
    from arcforge.fable.ledger import refusal_bytes  # noqa: PLC0415
    from arcforge.fable.packer import load  # noqa: PLC0415

    current = first_root
    for _ in range(3):
        status = json.loads((current / 'ledger.json').read_text(encoding='utf-8'))['status']
        if status != 'refused':
            return current
        refusal = _sha(refusal_bytes(current))
        cycle = int(load(current).manifest.get('repair_cycle', 0))
        nxt = None
        for candidate in sorted(current.parent.glob('prereg_signoff-r00-*')):
            if candidate == current or not (candidate / 'packet' / 'packet.json').is_file():
                continue
            manifest = load(candidate).manifest
            if manifest.get('repair_cycle') != cycle + 1:
                continue
            carried = {f['sha256'] for f in manifest['files'] if f['role'] == 'refusal'}
            if refusal in carried:
                nxt = candidate
                break
        if nxt is None:
            return current
        current = nxt
    return current


def run(ctx: StageContext) -> Mapping[str, bytes]:
    from arcforge.eval import io  # noqa: PLC0415
    from arcforge.fable import ledger  # noqa: PLC0415
    from arcforge.fable.packer import load  # noqa: PLC0415

    info = json.loads(ctx.input_bytes('tail', 'signoff_packet.json'))
    first = fable_root() / info['packet_dir']
    if not (first / 'packet' / 'packet.json').is_file():
        raise StageError(f'signoff: the packed sign-off {first} is missing (re-run the tail)')
    last = follow_chain(first)
    packet = load(last)
    status = json.loads(packet.ledger_path.read_text(encoding='utf-8'))['status']
    record = ledger.record(last)
    if status in ('halted', 'failed'):
        raise StageError(
            f'signoff: the PREREG sign-off is {status} ({last}); the arc halts at R00. '
            f'Refusals to publish verbatim: {record["refusals"]}'
        )
    if status != 'ok':
        attempts = json.loads(packet.ledger_path.read_text(encoding='utf-8'))['attempts']
        open_attempt = next((a for a in reversed(attempts) if a['outcome'] is None), None)
        pending = {
            'leg': 'fable_prereg_signoff', 'packet_root': str(last), 'packet_sha256': packet.sha256,
            'status': status, 'repair_cycle': record['repair_cycle'],
            'workdir': None if open_attempt is None else str(packet.workdir(open_attempt['attempt'])),
            'model': 'claude-fable-5-1', 'prompt': info.get('prompt'),
            'then': info.get('then') if status is None else info.get('repair'),
        }  # fmt: skip
        raise StageError('signoff: waiting on Fable (pending packets):\n' + json.dumps([pending], indent=1))

    inputs = packet.canonical / 'inputs'
    signed_rules = (inputs / 'rules.yaml').read_bytes()
    if signed_rules != ctx.input_bytes('tail', 'rules.frozen.yaml'):
        raise StageError(
            'signoff: the accepted repair changed rules.yaml; re-run the tail with the repaired '
            'rules so the verdicts follow from them'
        )
    hashes = {
        'schema': 'arc-prereg-hashes/1',
        'prereg_sha256': _sha((inputs / 'PREREG.md').read_bytes()),
        'rules_sha256': _sha(signed_rules),
        'schema_sha256': _sha((inputs / 'arc-report-1.json').read_bytes()),
        'packet_sha256': packet.sha256,
        'output_sha256': record['output_sha256'],
    }
    from arcforge.core.stages.gate import witness  # noqa: PLC0415

    digest = _sha(json.dumps(hashes, sort_keys=True, separators=(',', ':')).encode())
    receipt = witness('prereg', digest, ctx)
    report = json.loads(ctx.input_bytes('tail', 'report.json'))
    report['fable'] = [*report.get('fable', []), record]
    report['witness'] = [*report.get('witness', []), {
        'kind': 'prereg', 'digest': digest, 'mode': receipt.get('mode', 'dry'),
        'log_index': receipt.get('log_index'), 'integrated_time': receipt.get('integrated_time'),
    }]  # fmt: skip
    accepted = ledger.accepted_output(last)
    return {
        'signoff.json': io.pretty({'schema': 'arc-signoff/1', 'output': accepted, 'record': record}),
        'prereg_hashes.json': io.pretty(hashes),
        'prereg.receipt.json': io.pretty(receipt),
        'report.json': io.pretty(report),
        'PREREG.md': (inputs / 'PREREG.md').read_bytes(),
    }


STAGES = (
    stage(
        name='signoff',
        title='Fable PREREG sign-off (A0: repair or halt)',
        phase='tail',
        platform='laptop+orchestrator',
        inputs=('tail',),
        outputs=('signoff.json', 'prereg_hashes.json', 'prereg.receipt.json', 'report.json', 'PREREG.md'),
        config_keys=(),
        code=('arcforge.fable.ledger', 'arcforge.fable.packer', 'arcforge.core.stages.gate'),
        run=run,
        notes='collects the accepted sign-off (following any repair chain), hashes the signed '
        'PREREG.md, rules.yaml and schema, witnesses kind prereg, adds fable[] to report.json.',
        replay='external',
        publish={'signoff.json': 'public', 'prereg_hashes.json': 'public',
                 'prereg.receipt.json': 'public', 'report.json': 'public', 'PREREG.md': 'public'},  # fmt: skip
    ),
)
