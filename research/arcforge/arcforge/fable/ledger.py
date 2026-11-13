"""Check an agent's output: validate, retry once in a fresh directory, then fail closed.

`check(packet_root, session, model)` reads attempt-N/output.json and decides:
- ACCEPTED: valid against output.schema.json, semantically complete for its kind, from a model
  whose id starts with the packet's expected_model, inputs untouched, status 'ok'. The output is
  copied byte for byte to <packet>/output.json and the ledger is final with status 'ok'.
- RETRY: the first attempt was invalid or refused. Its output is moved to rejected/, its
  directory deleted, and attempt-2/ is a fresh copy of the packet for a fresh agent.
- FAILED CLOSED: the second attempt was invalid ('failed') or refused ('refused'). Nothing is
  substituted; a missing end review is marked 'missing' (`mark_missing`).

The PREREG sign-off follows Amendment A0's repair-or-halt instead (replacements[18]): there is no
manual sign. A refusal is final for its packet at once (no fresh-agent retry: the repair takes its
place). The orchestrator may then correct exactly the defects Fable listed and resubmit with the
refusal and the diff (`repair`), at most twice; every refusal is carried verbatim into the next
packet and published. A third refusal halts the arc at R00 (status 'halted'). An invalid output
is still retried once; two invalid outputs fail closed ('failed'), which also stops the arc.

`record(packet_root)` is the report.json `fable[]` entry (arc-report/1 $defs/FableCall).
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.fable.kinds import KINDS, MAX_REPAIRS
from arcforge.fable.packer import (
    Packet,
    PacketError,
    load,
    now_utc,
    open_attempt,
    repair_cycle,
    repair_signoff,
    sha256_bytes,
    verify_dir,
)

MAX_ATTEMPTS = 2


@dataclass
class CheckResult:
    decision: str  # 'accepted' | 'retry' | 'failed_closed'
    attempt: int
    outcome: str  # this attempt: 'ok' | 'invalid' | 'refused'
    status: str | None  # the ledger's final status, None while a retry is open
    workdir: Path | None  # the retry's directory
    errors: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        return {
            'decision': self.decision,
            'attempt': self.attempt,
            'outcome': self.outcome,
            'status': self.status,
            'workdir': None if self.workdir is None else str(self.workdir),
            'errors': self.errors,
        }


def _ledger(packet: Packet) -> dict[str, Any]:
    return json.loads(packet.ledger_path.read_text(encoding='utf-8'))


def _save(packet: Packet, ledger: dict[str, Any]) -> None:
    tmp = packet.ledger_path.with_suffix('.tmp')
    tmp.write_text(json.dumps(ledger, indent=1) + '\n', encoding='utf-8')
    tmp.replace(packet.ledger_path)


def validate_output(
    packet: Packet, data: bytes | None, model: str | None
) -> tuple[str, list[str], Any]:
    """('ok' | 'invalid' | 'refused', problems, parsed output) for one attempt's output bytes."""
    from arcforge.contract import schema as report_schema

    kind = KINDS[packet.manifest['kind']]
    if data is None:
        return 'invalid', ['no output.json was written'], None
    try:
        output = json.loads(data)
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        return 'invalid', [f'output.json is not JSON ({error})'], None
    problems = report_schema.errors(output, kind.schema())
    expected = packet.manifest['expected_model']
    if not model or not model.startswith(expected):
        problems.append(
            f'the output came from {model!r}, not {expected}* (no other model may stand in for Fable)'
        )
    if not problems:
        problems = kind.check(output, packet.canonical)
    if problems:
        return 'invalid', problems, output
    return ('ok' if output['status'] == 'ok' else 'refused'), [], output


def check(packet_root: str | Path, *, session: str, model: str) -> CheckResult:
    packet = load(packet_root)
    ledger = _ledger(packet)
    if ledger['status'] is not None:
        raise PacketError(f'{packet.root}: already final ({ledger["status"]})')
    damaged = verify_dir(packet.canonical, packet.manifest, allow=('packet.json',))
    if damaged:  # the semantic checks read the canonical inputs, so they must be intact
        raise PacketError(f'{packet.canonical} no longer matches its manifest: {damaged}')
    attempt = ledger['attempts'][-1]
    if attempt['outcome'] is not None:
        raise PacketError(f'{packet.root}: attempt {attempt["attempt"]} was already checked')
    n = attempt['attempt']
    workdir = packet.workdir(n)
    output_path = workdir / 'output.json'
    data = output_path.read_bytes() if output_path.is_file() else None
    outcome, problems, output = validate_output(packet, data, model)
    tampered = verify_dir(workdir, packet.manifest, allow=('packet.json', 'output.json'))
    if tampered:
        outcome, problems = 'invalid', [*problems, *(f'working directory: {t}' for t in tampered)]
    attempt.update(
        checked_utc=now_utc(),
        agent_session=session,
        model_reported=model,
        output_sha256=None if data is None else sha256_bytes(data),
        outcome=outcome,
        errors=problems,
    )
    if outcome == 'ok':
        assert data is not None
        (packet.root / 'output.json').write_bytes(data)
        ledger.update(status='ok', output_sha256=sha256_bytes(data))
        _save(packet, ledger)
        return CheckResult('accepted', n, outcome, 'ok', None, [])
    if data is not None:
        rejected = packet.root / 'rejected'
        rejected.mkdir(exist_ok=True)
        output_path.replace(rejected / f'attempt-{n}.output.json')
        if outcome == 'refused':
            attempt['refusal'] = f'rejected/attempt-{n}.output.json'
    shutil.rmtree(workdir)
    signoff = packet.manifest['kind'] == 'prereg_signoff'
    if signoff and outcome == 'refused':
        # A0: a refusal of the sign-off is final for this packet; repair, or halt on the third.
        halted = repair_cycle(packet) >= MAX_REPAIRS
        ledger['status'] = 'halted' if halted else 'refused'
        _save(packet, ledger)
        return CheckResult('failed_closed', n, outcome, ledger['status'], None, problems)
    if n < MAX_ATTEMPTS:
        _save(packet, ledger)
        retry = open_attempt(packet, n + 1)
        return CheckResult('retry', n, outcome, None, retry, problems)
    ledger['status'] = 'refused' if outcome == 'refused' else 'failed'
    _save(packet, ledger)
    return CheckResult('failed_closed', n, outcome, ledger['status'], None, problems)


def refusal_bytes(packet_root: str | Path) -> bytes:
    """The refused sign-off output of a packet, byte for byte (it is published verbatim)."""
    packet = load(packet_root)
    ledger = _ledger(packet)
    refused = [a for a in ledger['attempts'] if a.get('refusal')]
    if ledger['status'] not in ('refused', 'halted') or not refused:
        raise PacketError(f'{packet.root} holds no refusal (status {ledger["status"]!r})')
    return (packet.root / refused[-1]['refusal']).read_bytes()


def repair(
    refused_root: str | Path, diff: str | Path, overrides: dict[str, Any] | None = None,
    **kwargs: Any,
) -> Packet:  # fmt: skip
    """Resubmit a refused sign-off with exactly the listed defects corrected (A0 repair or halt).

    The new packet carries the refusal verbatim and the diff; a refused third submission halts.
    """
    packet = load(refused_root)
    status = _ledger(packet)['status']
    if status == 'halted':
        raise PacketError(f'{packet.root}: the sign-off was refused three times; the arc halts')
    if packet.manifest['kind'] != 'prereg_signoff' or status != 'refused':
        raise PacketError(
            f'only a refused PREREG sign-off is repaired ({packet.manifest["kind"]}, status {status!r})'
        )
    return repair_signoff(
        refused_root, diff, refusal=refusal_bytes(refused_root), overrides=overrides, **kwargs
    )


def mark_missing(packet_root: str | Path, reason: str) -> dict[str, Any]:
    """An end review Fable never delivered: recorded as missing, never replaced."""
    packet = load(packet_root)
    ledger = _ledger(packet)
    if packet.manifest['role'] != 'end_review':
        raise PacketError('only the end review can be marked missing')
    if ledger['status'] == 'ok':
        raise PacketError('this review was delivered')
    if not reason.strip():
        raise PacketError('give the reason the review is missing')
    ledger.update(status='missing', note=reason.strip())
    _save(packet, ledger)
    return record(packet_root)


def accepted_output(packet_root: str | Path) -> dict[str, Any] | None:
    packet = load(packet_root)
    path = packet.root / 'output.json'
    if _ledger(packet)['status'] != 'ok' or not path.is_file():
        return None
    return json.loads(path.read_bytes())


def record(packet_root: str | Path) -> dict[str, Any]:
    """This call's entry for report.json's `fable` list (arc-report/1 $defs/FableCall)."""
    packet = load(packet_root)
    ledger = _ledger(packet)
    checked = [a for a in ledger['attempts'] if a['outcome'] is not None]
    last = checked[-1] if checked else None
    lint_ok = None
    refusals: list[str] = []
    if packet.manifest['kind'] == 'prereg_signoff':
        lint = json.loads((packet.canonical / 'inputs' / 'lint.json').read_text(encoding='utf-8'))
        lint_ok = bool(lint.get('ok'))
        # Every earlier refusal travels with the repair (inputs/repair/), then this packet's own.
        refusals = [
            f['sha256']
            for f in sorted(packet.manifest['files'], key=lambda f: f['path'])
            if f['role'] == 'refusal'
        ]
        refusals += [a['output_sha256'] for a in checked if a.get('refusal')]
    return {
        'role': packet.manifest['role'],
        'kind': packet.manifest['kind'],
        'via': 'orchestrator',
        'packet_sha256': packet.sha256,
        'output_sha256': ledger['output_sha256'] if ledger['status'] == 'ok' else None,
        'agent_session': None if last is None else last['agent_session'],
        'model_reported': None if last is None else last['model_reported'],
        'attempts': len(checked),
        'repair_cycle': repair_cycle(packet),
        'refusals': refusals,
        'status': ledger['status'],
        'lint_ok': lint_ok,
    }
