"""The R00 gate (m2-verdict, replay 'external'): the unattended reference + gold gate of A0.

Two legs run outside the VM and are collected here:
- Fable gold audit #1: the 60 x 12 gold frame, packed from S12r's gold-frame views (each
  candidate with its record-local entity card) into an isolated Fable packet; S13 merges the
  accepted grades as Fable gold.
- The Claude reference leg (claude-opus-5-5 as orchestrator agents, I1b and I1d): its packets
  carry no grades, and its outputs are witnessed (kind 'ref-claude') before any primary grade
  reaches the laptop. The collection is judge.claude_leg's (m2-judge); this stage calls it.

Then the r00-sets entry is witnessed: the sha256 of C_open, of the frontier set and the quarantine
sha256. Until both legs are accepted the stage fails with the exact list of pending packets
(packet roots, working directories, prompts) for the orchestrator, which runs the agents and
re-runs the gate (`arcforge run r00 --resume`). The gate never reads S12b's judgments: of S12b it
reads frames.json only, lazily.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from arcforge.core.dag import StageContext, StageError
from arcforge.eval.stagekit import stage

PROMPT = (
    'You are Fable. Your working directory holds one task packet. Read INSTRUCTIONS.md and do '
    'exactly what it says, using only the files in this directory. Write your answer to '
    'output.json, valid against output.schema.json, and write no other file. If you cannot or '
    'will not do the task, write the refusal form that INSTRUCTIONS.md gives.'
)
GOLD_SHAPE = (60, 12)


class Pending(StageError):
    """The gate is waiting for orchestrator agents; `pending` says which, where and how."""

    def __init__(self, pending: Sequence[Mapping[str, Any]]):
        self.pending = list(pending)
        super().__init__('the R00 gate is waiting on agents (pending packets):\n' + json.dumps(self.pending, indent=1))


def gold_pairs(views: Mapping[str, Any], *, run_id: str = 'r00', audit_index: int = 1) -> dict[str, Any]:
    """arc-gold-pairs/1 from S12r's gold-frame views (already arc-gold-pairs/1, or the frame)."""
    if views.get('schema') == 'arc-gold-pairs/1':
        return dict(views)
    queries = []
    for q in views.get('queries') or []:
        candidates = []
        for c in q['candidates']:
            candidates.append({
                'candidate_id': f'{q["query_id"]}:{c["slug"]}',
                'record_id': c['slug'],
                'card': {'title': c.get('title', ''), 'description': c.get('description', '')},
                'chunks': list(c.get('chunks') or [])[:2] or [''],
                'entity_card': c.get('entity_card'),
                'entity_card_scope': 'record-local',
            })  # fmt: skip
        queries.append({'query_id': q['query_id'], 'stratum': q.get('stratum', 'D'),
                        'text': q['text'], 'candidates': candidates})  # fmt: skip
    return {'schema': 'arc-gold-pairs/1', 'run_id': run_id, 'audit_index': audit_index, 'queries': queries}


def _fable_root() -> Path | None:
    env = os.environ.get('ARCFORGE_FABLE_DIR')
    return Path(env) if env else None


def pack_gold(pairs: Mapping[str, Any], rubric: bytes, *, shape: tuple[int, int] | None = GOLD_SHAPE):
    from arcforge.fable import packer  # noqa: PLC0415

    with tempfile.TemporaryDirectory() as tmp:
        pairs_path = Path(tmp) / 'pairs.json'
        pairs_path.write_text(json.dumps(pairs, indent=1), encoding='utf-8')
        rubric_path = Path(tmp) / 'rubric.md'
        rubric_path.write_bytes(rubric)
        return packer.pack_gold_audit(pairs_path, rubric_path, shape=shape, root=_fable_root())


def gold_status(packet) -> tuple[str, dict[str, Any] | None]:  # noqa: ANN001
    from arcforge.fable import ledger  # noqa: PLC0415

    status = json.loads(packet.ledger_path.read_text(encoding='utf-8'))['status']
    return status, ledger.accepted_output(packet.root) if status == 'ok' else None


def fable_gold_rows(output: Mapping[str, Any], pairs: Mapping[str, Any], packet_sha256: str) -> list[dict[str, Any]]:
    by_candidate = {
        c['candidate_id']: (q['query_id'], c['record_id']) for q in pairs['queries'] for c in q['candidates']
    }
    rows = []
    for grade in output['result']['grades']:
        query_id, slug = by_candidate[grade['candidate_id']]
        rows.append({'query_id': query_id, 'slug': slug, 'grade': int(grade['grade']),
                     'note': grade.get('note'), 'packet_sha256': packet_sha256})  # fmt: skip
    return sorted(rows, key=lambda r: (r['query_id'], r['slug']))


def collect_claude_leg(tar_bytes: bytes | None, ctx: StageContext) -> dict[str, Any]:
    """judge.claude_leg.collect (m2-judge); 'pending' with its packets when not yet accepted."""
    try:
        from arcforge.judge import claude_leg  # noqa: PLC0415
    except ImportError:
        return {'status': 'unavailable', 'pending': [{
            'leg': 'claude', 'reason': 'arcforge.judge.claude_leg is not installed (m2-judge)',
        }]}  # fmt: skip
    return dict(claude_leg.collect(tar_bytes, ctx))


def witness(kind: str, digest: str, ctx: StageContext) -> dict[str, Any]:
    """A witness receipt via a0.witness (m2-reader) or, without it, a dry receipt."""
    try:
        from arcforge.a0 import witness as a0_witness  # noqa: PLC0415
    except ImportError:
        return {'schema': 'arc-witness-receipt/1', 'kind': kind, 'digest': digest, 'mode': 'dry',
                'rekor': None, 'ots': None, 'log_index': None, 'integrated_time': None}  # fmt: skip
    return dict(a0_witness.witness(kind, digest, ctx))


def r00_sets_digest(c_open: bytes, c_frontier: bytes, quarantine_sha256: str) -> tuple[str, dict[str, str]]:
    members = {
        'c_open_sha256': hashlib.sha256(c_open).hexdigest(),
        'c_frontier_sha256': hashlib.sha256(c_frontier).hexdigest(),
        'quarantine_sha256': quarantine_sha256,
    }
    canonical = json.dumps(members, sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(canonical).hexdigest(), members


def run(ctx: StageContext) -> Mapping[str, bytes]:
    from arcforge.eval import io  # noqa: PLC0415
    from arcforge.fable import ledger  # noqa: PLC0415

    s12r = ctx.inputs.get('S12r') or {}
    views = io.read_json(ctx.input_bytes('S12r', 'gold_frame_views.json'))
    rubric = s12r.get('rubric.md') or (views.get('rubric') or '').encode()
    if not rubric:
        raise StageError('gate: S12r gives no rubric for the gold audit (rubric.md)')
    pairs = gold_pairs(views)
    shape = None if (ctx.cfg('eval') or {}).get('toy') else GOLD_SHAPE
    packet = pack_gold(pairs, rubric, shape=shape)
    status, output = gold_status(packet)
    claude = collect_claude_leg(s12r.get('claude_packets.tar'), ctx)

    pending = []
    if status != 'ok':
        attempts = json.loads(packet.ledger_path.read_text(encoding='utf-8'))['attempts']
        open_attempt = next((a for a in reversed(attempts) if a['outcome'] is None), None)
        if status in ('failed', 'refused'):
            raise StageError(f'gate: Fable gold audit #1 failed closed ({status}); nothing stands in for it')
        pending.append({
            'leg': 'fable_gold_audit_1', 'packet_root': str(packet.root), 'packet_sha256': packet.sha256,
            'workdir': None if open_attempt is None else str(packet.workdir(open_attempt['attempt'])),
            'model': 'claude-fable-5-1', 'prompt': PROMPT,
            'then': f'python -m arcforge.fable check {packet.root} --session <id> --model <model>',
        })  # fmt: skip
    if claude.get('status') != 'accepted':
        pending.extend(claude.get('pending') or [{'leg': 'claude', 'status': claude.get('status')}])
    if pending:
        raise Pending(pending)

    p1 = ctx.inputs.get('P1') or {}
    quarantine = io.read_json(ctx.input_bytes('S12q', 'quarantine.json'))
    digest, members = r00_sets_digest(p1.get('c_open.jsonl', b''), p1.get('c_frontier.jsonl', b''),
                                      quarantine.get('quarantine_sha256') or '')  # fmt: skip
    r00_sets = witness('r00-sets', digest, ctx)
    receipts = {
        'schema': 'arc-gate-receipts/1',
        'claude_leg_status': 'accepted',
        'r00_sets': members,
        'witness': [r00_sets, *(claude.get('receipts') or [])],
    }
    gold = fable_gold_rows(output, pairs, packet.sha256)
    record = ledger.record(packet.root)
    tokens = int(claude.get('tokens') or 0)
    return {
        'ref_claude.jsonl': io.jsonl(claude.get('rows') or [], 'pair_id'),
        'fable_gold.json': io.pretty({'schema': 'arc-fable-gold/1', 'grades': gold}),
        'gate_receipts.json': io.pretty(receipts),
        'fable_calls.json': io.pretty({'schema': 'arc-fable-calls/1', 'calls': [record]}),
        'claude_plan_tokens.json': io.pretty({'schema': 'arc-claude-plan-tokens/1', 'tokens': tokens}),
    }


STAGES = (
    stage(
        name='gate',
        title='Reference + gold gate (A0)',
        phase='gate',
        platform='laptop+orchestrator',
        # P1 and S12q are read for the r00-sets witness (their sha256s only).
        inputs=('S12r', 'P1', 'S12q'),
        outputs=('ref_claude.jsonl', 'fable_gold.json', 'gate_receipts.json', 'fable_calls.json',
                 'claude_plan_tokens.json'),  # fmt: skip
        config_keys=('eval',),
        code=('arcforge.fable.packer', 'arcforge.fable.ledger', 'arcforge.eval.io'),
        run=run,
        notes='packs Fable gold audit #1 from S12r gold-frame views, collects it and the Claude '
        'REF leg, witnesses r00-sets; fails with the pending packet list until both are accepted.',
        replay='external',
        publish={'ref_claude.jsonl': 'public', 'fable_gold.json': 'public',
                 'gate_receipts.json': 'public', 'fable_calls.json': 'public',
                 'claude_plan_tokens.json': 'public'},  # fmt: skip
    ),
)
