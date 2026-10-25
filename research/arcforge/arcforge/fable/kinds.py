"""The four packet kinds, their roles, schemas, briefs, and the semantic checks of their outputs.

Schema validity (output.schema.json) is necessary but not sufficient: a gold audit must grade
exactly the pairs it was given, a blind pass must cover every run, rule and row of its files, a
mismatch review must answer every mismatch. Those checks live here and read the packet's own
canonical inputs, never the agent's working copy.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from arcforge.contract.ids import RULE_IDS

SCHEMA_DIR = Path(__file__).with_name('schemas')
BRIEF_DIR = Path(__file__).with_name('briefs')
# Fable runs as Claude Code workflow agents on claude-fable-5-1; an output from any other model is
# rejected, so a missing review is never replaced by another model.
FABLE_MODEL_PREFIX = 'claude-fable'

SIGNOFF_CHECKS: tuple[str, ...] = (
    'lint_passed_with_branch_expansion',
    'i1_passed_or_fallback_engaged',
    'i3_i5_reported_with_predictions',
    'i2_i4_scheduled',
    'taus_equal_max_floor_mde',
    'mde_from_baseline_variance_only',
    'verdicts_list_every_rule_h_not_applicable',
    'h3_falsifier_ci_hi_raw_lt_0_05',
    'sf_read_budget_two',
    'vault_seal_published_no_key_material',
    'falsifiers_read_only_schema_fields',
)


@dataclass(frozen=True)
class Kind:
    name: str
    runs_by_role: Mapping[str, tuple[str, ...]]
    output_schema: str
    brief: str
    check: Callable[[Mapping[str, Any], Path], list[str]]

    @property
    def roles(self) -> tuple[str, ...]:
        return tuple(self.runs_by_role)

    def schema(self) -> dict[str, Any]:
        return json.loads((SCHEMA_DIR / self.output_schema).read_text(encoding='utf-8'))


def _json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def _exactly_once(expected: list[Any], got: list[Any], what: str) -> list[str]:
    problems = []
    seen: set[Any] = set()
    for item in got:
        if item in seen:
            problems.append(f'{what} {item!r} appears twice')
        seen.add(item)
    missing = [e for e in expected if e not in seen]
    extra = [g for g in dict.fromkeys(got) if g not in set(expected)]
    if missing:
        problems.append(f'{len(missing)} {what}s missing, e.g. {missing[:3]}')
    if extra:
        problems.append(f'{len(extra)} {what}s not in the packet, e.g. {extra[:3]}')
    return problems


def check_gold_audit(output: Mapping[str, Any], packet_dir: Path) -> list[str]:
    if output.get('status') != 'ok':
        return []
    pairs = _json(packet_dir / 'inputs' / 'pairs.json')
    expected = [(q['query_id'], c['candidate_id']) for q in pairs['queries'] for c in q['candidates']]
    got = [(g.get('query_id'), g.get('candidate_id')) for g in output['result']['grades']]
    return _exactly_once(expected, got, 'graded pair')


def check_signoff(output: Mapping[str, Any], packet_dir: Path) -> list[str]:
    result = output.get('result')
    if result is None:
        return []
    return _exactly_once(list(SIGNOFF_CHECKS), [c.get('id') for c in result['checks']], 'check')


def check_blind(output: Mapping[str, Any], packet_dir: Path) -> list[str]:
    if output.get('status') != 'ok':
        return []
    docs = {p.stem: _json(p) for p in sorted((packet_dir / 'inputs' / 'verdicts').glob('*.json'))}
    result = output['result']
    runs = {r.get('run_id'): r for r in result['runs']}
    problems = _exactly_once(list(docs), [r.get('run_id') for r in result['runs']], 'run')
    for run_id, doc in docs.items():
        entry = runs.get(run_id)
        if entry is None:
            continue
        problems += [f'{run_id}: {p}' for p in _exactly_once(list(RULE_IDS), [h.get('id') for h in entry['hypotheses']], 'rule')]
        rows = [r['comparison_id'] for r in doc.get('rows') or []]
        problems += [f'{run_id}: {p}' for p in _exactly_once(rows, [r.get('comparison_id') for r in entry['rows']], 'row')]
        adoption = [(a['rule'], a['fold']) for a in doc.get('adoption') or []]
        got = [(a.get('rule'), a.get('fold')) for a in entry['adoption']]
        problems += [f'{run_id}: {p}' for p in _exactly_once(adoption, got, 'adoption decision')]
    if result.get('arc_summary') is None:
        problems.append('arc_summary is required: the packet ends with the final run')
    else:
        problems += _exactly_once(list(RULE_IDS), [a.get('id') for a in result['arc_summary']], 'arc_summary rule')
    return problems


def check_mismatch(output: Mapping[str, Any], packet_dir: Path) -> list[str]:
    if output.get('status') != 'ok':
        return []
    comparison = _json(packet_dir / 'inputs' / 'comparison.json')
    expected = [m['mismatch_id'] for m in comparison['mismatches']]
    got = [m.get('mismatch_id') for m in output['result']['mismatches']]
    return _exactly_once(expected, got, 'mismatch')


KINDS: dict[str, Kind] = {
    'gold_audit': Kind(
        'gold_audit',
        {'gold_audit_1': ('r00',), 'gold_audit_2': ('r10', 'r10K')},
        'output-gold-audit-1.json',
        'gold_audit.md',
        check_gold_audit,
    ),
    'prereg_signoff': Kind(
        'prereg_signoff', {'signoff': ('r00',)}, 'output-prereg-signoff-1.json', 'prereg_signoff.md', check_signoff
    ),
    'blind_recompute': Kind(
        'blind_recompute',
        {'end_review': ('r10', 'r10K')},
        'output-blind-recompute-1.json',
        'blind_recompute.md',
        check_blind,
    ),
    'mismatch_review': Kind(
        'mismatch_review',
        {'end_review': ('r10', 'r10K')},
        'output-mismatch-review-1.json',
        'mismatch_review.md',
        check_mismatch,
    ),
}


def render_brief(kind: Kind, context: Mapping[str, Any]) -> str:
    """INSTRUCTIONS.md: the kind's brief plus the common ground rules, {{placeholders}} filled."""
    text = (BRIEF_DIR / kind.brief).read_text(encoding='utf-8') + (BRIEF_DIR / '_common.md').read_text(encoding='utf-8')
    for key, value in {**context, 'kind': kind.name}.items():
        text = text.replace('{{' + key + '}}', str(value))
    if '{{' in text:
        start = text.index('{{')
        raise ValueError(f'brief {kind.brief}: unfilled placeholder {text[start : text.index("}}", start) + 2]}')
    return text
