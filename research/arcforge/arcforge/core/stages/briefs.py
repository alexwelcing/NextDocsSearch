"""S13b, growth briefs (m2-verdict, optional): proposals.md from gemini-3.1-flash-lite.

One paragraph per largest 5-NN gap and per most-referenced ghost, written from record titles and
S2 cards only (never from record text, never into the corpus, the scene or any prompt). It is
optional reading, and it is skipped (proposals.md says so, density.proposals_md_sha256 stays
null) when its cost would threaten the budget reserve. The LLM call goes through arcforge.llm
(m2-runtime) when it exists; toy mode (llm.fake, or no client) writes deterministic text.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from arcforge.core.dag import StageContext, StageError
from arcforge.eval.stagekit import stage

MODEL = 'gemini-3.1-flash-lite'
ESTIMATED_USD = 0.06  # J. PLAN LINES: S13b about $0.06
MAX_GAPS = 5
MAX_GHOSTS = 5


def _cards(data: bytes | None) -> dict[str, Mapping[str, Any]]:
    from arcforge.eval import io  # noqa: PLC0415

    if not data:
        return {}
    return {row['slug']: row for row in io.read_jsonl(data)}


def brief_prompts(pre: Mapping[str, Any], cards: Mapping[str, Mapping[str, Any]]) -> list[dict[str, Any]]:
    """The briefs to write: (brief_id, kind, target, neighbours, era, register, prompt)."""
    out = []
    for gap in (pre.get('density') or {}).get('top_gaps', [])[:MAX_GAPS]:
        neighbours = list(gap['neighbours'])
        summaries = [
            f'- {n}: {(cards.get(n) or {}).get("summary", "")[:300]}' for n in neighbours
        ]
        out.append({
            'brief_id': f'brief:{gap["gap_id"]}', 'kind': 'gap', 'target': gap['gap_id'],
            'neighbours': neighbours, 'era': str((cards.get(neighbours[0]) or {}).get('era') or ''),
            'register': str((cards.get(neighbours[0]) or {}).get('register_proposal') or ''),
            'prompt': 'In one paragraph, describe the record that would fill the gap between these '
            'archive records, from their cards alone:\n' + '\n'.join(summaries),
        })  # fmt: skip
    return out


def _fake(prompt: str) -> str:
    digest = hashlib.sha256(prompt.encode()).hexdigest()[:12]
    return f'(toy brief {digest}) A record that would sit between its five neighbours.'


def _write(briefs: list[dict[str, Any]], ctx: StageContext) -> tuple[list[str], dict[str, Any]]:
    empty = {'schema': 'arc-ledger/1', 'lines': [], 'gpu_min': 0.0, 'claude_plan_tokens': 0}
    if (ctx.cfg('llm') or {}).get('fake'):
        return [_fake(b['prompt']) for b in briefs], empty
    try:
        from arcforge import llm  # noqa: PLC0415 - m2-runtime's client
    except ImportError as error:
        raise StageError(f'S13b needs arcforge.llm (or llm.fake in toy mode): {error}') from None
    calls = [
        llm.Call(
            call_id=hashlib.sha256(f'S13b\tbrief\t{b["brief_id"]}'.encode()).hexdigest()[:32],
            provider='vertex', model=MODEL,
            messages=[{'role': 'user', 'content': b['prompt']}],
            params={'temperature': 0.0, 'top_p': 1.0, 'max_tokens': 400, 'seed': 0,
                    'thinking_level': None},
            guided=None,
        )
        for b in briefs
    ]  # fmt: skip
    client = llm.Client(ctx, 'briefs')
    results = client.run(calls)
    return [r.text for r in results], {**empty, 'lines': client.ledger()}


def _reserve_threatened(ctx: StageContext) -> bool:
    budget = ctx.cfg('budget') or {}
    reserve = budget.get('reserve_usd', budget.get('reserve'))
    spent = budget.get('spent_usd')
    cap = budget.get('cap_usd', 20)
    if reserve is None or spent is None:
        return False
    return float(spent) + ESTIMATED_USD > float(cap) - float(reserve)


def run(ctx: StageContext) -> Mapping[str, bytes]:
    from arcforge.eval import io  # noqa: PLC0415

    pre = json.loads(ctx.input_bytes('S13', 'report.pre.json'))
    cards = _cards((ctx.inputs.get('S2') or {}).get('cards.jsonl'))
    briefs = brief_prompts(pre, cards)
    if _reserve_threatened(ctx) or not briefs:
        why = 'the budget reserve is threatened' if briefs else 'there is no density gap to brief'
        text = f'# Growth briefs (R00)\n\nSkipped: {why}. This file is optional reading.\n'
        ledger = {'schema': 'arc-ledger/1', 'lines': [], 'gpu_min': 0.0, 'claude_plan_tokens': 0}
        return {'proposals.md': text.encode(), 'ledger.json': io.pretty(ledger),
                'briefs.json': io.pretty({'schema': 'arc-briefs/1', 'skipped': True, 'briefs': []})}  # fmt: skip
    texts, ledger = _write(briefs, ctx)
    lines = ['# Growth briefs (R00)', '',
             'Optional reading. Written by ' + MODEL + ' from record titles and S2 cards only; '
             'never fed into the corpus, the scene or any prompt.', '']  # fmt: skip
    for brief, text in zip(briefs, texts, strict=True):
        lines += [f'## {brief["target"]}', '', f'Neighbours: {", ".join(brief["neighbours"])}', '', text.strip(), '']
    summary = [{k: b[k] for k in ('brief_id', 'kind', 'target', 'neighbours', 'era', 'register')} for b in briefs]
    return {
        'proposals.md': '\n'.join(lines).encode(),
        'ledger.json': io.pretty(ledger),
        'briefs.json': io.pretty({'schema': 'arc-briefs/1', 'skipped': False, 'briefs': summary}),
    }


STAGES = (
    stage(
        name='S13b',
        title='Growth briefs',
        phase='tail',
        platform='vertex',
        inputs=('S2', 'S11', 'S13'),
        outputs=('proposals.md', 'ledger.json', 'briefs.json'),
        config_keys=('budget', 'llm'),
        code=('arcforge.eval.io',),
        run=run,
        notes='optional; gemini-3.1-flash-lite, one paragraph per largest 5-NN gap from titles '
        'and S2 cards only; skipped when the budget reserve is threatened.',
        replay='llm',
        publish={'proposals.md': 'public', 'ledger.json': 'public', 'briefs.json': 'public'},
    ),
)
