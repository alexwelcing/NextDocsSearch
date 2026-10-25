"""Check an agent's output: validate, retry once in a fresh directory, then fail closed.

`check(packet_root, session, model)` reads attempt-N/output.json and decides:
- ACCEPTED: valid against output.schema.json, semantically complete for its kind, from a model
  whose id starts with the packet's expected_model, inputs untouched, status 'ok'. The output is
  copied byte for byte to <packet>/output.json and the ledger is final with status 'ok'.
- RETRY: the first attempt was invalid or refused. Its output is moved to rejected/, its
  directory deleted, and attempt-2/ is a fresh copy of the packet for a fresh agent.
- FAILED CLOSED: the second attempt was invalid ('failed') or refused ('refused'). Nothing is
  substituted: no PREREG hash without a sign-off; the owner may sign manually (`owner_sign`,
  recorded as 'owner_signed'); a missing end review is marked 'missing' (`mark_missing`).

`record(packet_root)` is the report.json `fable[]` entry (arc-report/1 $defs/FableCall).
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.fable.kinds import KINDS
from arcforge.fable.packer import (
    Packet,
    PacketError,
    load,
    now_utc,
    open_attempt,
    sha256_bytes,
    verify_dir,
)

MAX_ATTEMPTS = 2
OUTPUT_SCHEMA = 'arc-fable-output/1'


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
    shutil.rmtree(workdir)
    if n < MAX_ATTEMPTS:
        _save(packet, ledger)
        retry = open_attempt(packet, n + 1)
        return CheckResult('retry', n, outcome, None, retry, problems)
    ledger['status'] = 'refused' if outcome == 'refused' else 'failed'
    _save(packet, ledger)
    return CheckResult('failed_closed', n, outcome, ledger['status'], None, problems)


def owner_sign(packet_root: str | Path, note: str) -> dict[str, Any]:
    """After a sign-off failed closed, record the owner's manual signature (never Fable's)."""
    packet = load(packet_root)
    ledger = _ledger(packet)
    if packet.manifest['kind'] != 'prereg_signoff':
        raise PacketError('only the PREREG sign-off can be signed by the owner')
    if ledger['status'] not in ('refused', 'failed'):
        raise PacketError(
            f'the owner signs only after the sign-off failed closed (status is {ledger["status"]!r})'
        )
    if not note.strip():
        raise PacketError('give a note saying why the owner signs')
    ledger.update(status='owner_signed', owner_note=note.strip(), owner_signed_utc=now_utc())
    _save(packet, ledger)
    return record(packet_root)


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
    ledger.update(status='missing', owner_note=reason.strip())
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
    if packet.manifest['kind'] == 'prereg_signoff':
        lint = json.loads((packet.canonical / 'inputs' / 'lint.json').read_text(encoding='utf-8'))
        lint_ok = bool(lint.get('ok'))
    return {
        'role': packet.manifest['role'],
        'kind': packet.manifest['kind'],
        'via': 'orchestrator',
        'packet_sha256': packet.sha256,
        'output_sha256': ledger['output_sha256'] if ledger['status'] == 'ok' else None,
        'agent_session': None if last is None else last['agent_session'],
        'model_reported': None if last is None else last['model_reported'],
        'attempts': len(checked),
        'status': ledger['status'],
        'lint_ok': lint_ok,
    }
