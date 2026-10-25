"""`python -m arcforge.fable`, as the orchestrator calls it: JSON on stdout, exit codes 0/10/20."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FABLE = 'claude-fable-5-1'


def fable(*args: str) -> tuple[int, dict | None, str]:
    out = subprocess.run(
        [sys.executable, '-m', 'arcforge.fable', *args], cwd=ROOT, capture_output=True, text=True
    )
    try:
        payload = json.loads(out.stdout) if out.stdout.strip() else None
    except json.JSONDecodeError:
        payload = None
    return out.returncode, payload, out.stderr


def pack(pairs: Path, rubric: Path, root: Path) -> dict:
    code, payload, err = fable(
        'pack',
        '--root',
        str(root),
        'gold-audit',
        '--pairs',
        str(pairs),
        '--rubric',
        str(rubric),
        '--shape',
        '3x2',
    )
    assert code == 0, err
    return payload


def test_pack_check_accept(pairs, rubric, root, agent):
    packed = pack(pairs, rubric, root)
    assert packed['kind'] == 'gold_audit' and packed['status'] is None
    workdir = Path(packed['workdir'])
    agent.write(workdir, 'gold_audit', agent.grades(workdir))
    code, result, _ = fable('check', packed['packet_root'], '--session', 'sess-1', '--model', FABLE)
    assert code == 0 and result['decision'] == 'accepted'
    code, record, _ = fable('record', packed['packet_root'])
    assert (
        code == 0
        and record['status'] == 'ok'
        and record['packet_sha256'] == packed['packet_sha256']
    )


def test_retry_then_fail_closed(pairs, rubric, root, agent):
    packed = pack(pairs, rubric, root)
    agent.write(Path(packed['workdir']), 'gold_audit', status='refused', reason='cannot judge')
    code, result, _ = fable('check', packed['packet_root'], '--session', 's1', '--model', FABLE)
    assert code == 10 and result['decision'] == 'retry' and result['outcome'] == 'refused'
    retry = Path(result['workdir'])
    assert retry.name == 'attempt-2' and not (retry / 'output.json').exists()
    agent.write(retry, 'gold_audit', {'grades': []})
    code, result, _ = fable('check', packed['packet_root'], '--session', 's2', '--model', FABLE)
    assert code == 20 and result['decision'] == 'failed_closed' and result['status'] == 'failed'
    diff = Path(packed['packet_root']).parent / 'fix.diff'
    diff.write_text('x\n')
    code, _, err = fable('repair', packed['packet_root'], '--diff', str(diff), '--rules', str(diff))
    assert code == 1 and 'only a refused PREREG sign-off' in err
    code, _, err = fable('owner-sign', packed['packet_root'], '--note', 'x')
    assert code == 2  # A0: there is no manual sign


def test_errors_are_reported_not_raised(tmp_path):
    code, _, err = fable('check', str(tmp_path / 'nothing'), '--session', 's', '--model', FABLE)
    assert code == 1 and 'is not a packet' in err
    code, _, err = fable(
        'pack',
        '--root',
        str(tmp_path / 'r'),
        'gold-audit',
        '--pairs',
        str(tmp_path / 'none.json'),
        '--rubric',
        'x',
    )
    assert code == 1 and 'cannot read' in err


def test_help(tmp_path):
    out = subprocess.run(
        [sys.executable, '-m', 'arcforge.fable', '--help'], cwd=ROOT, capture_output=True, text=True
    )
    assert out.returncode == 0 and 'exit 0 accepted, 10 retry' in out.stdout
