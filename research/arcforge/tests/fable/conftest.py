"""Fixtures for the Fable packet tests: inputs, a synthetic arc, and a simulated agent."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from arcforge.contract import synth
from arcforge.contract.lint import lint
from arcforge.fable.kinds import SIGNOFF_CHECKS

FABLE = 'claude-fable-5-1'


@pytest.fixture(scope='session')
def arc(tmp_path_factory: pytest.TempPathFactory):
    """A frozen rules file and a synthetic N path: (rules_path, rules, runs)."""
    root = tmp_path_factory.mktemp('arc')
    rules_path, rules = synth.write_rules(root)
    runs = synth.write_path(root / 'runs', synth.Scenario('N'), rules)
    return rules_path, rules, runs


@pytest.fixture
def root(tmp_path: Path) -> Path:
    return tmp_path / 'fable'


@pytest.fixture
def pairs(tmp_path: Path) -> Path:
    queries = []
    for q in range(3):
        candidates = [
            {
                'candidate_id': f'q{q}:c{c}',
                'record_id': f'record-{q}-{c}',
                'card': {'title': f'Record {q}.{c}', 'description': 'A synthetic card.'},
                'chunks': ['First chunk.', 'Second chunk.'],
                'entity_card': None if c else 'Adaeze Nwosu (radiologist) [local:adaeze-1]',
                'entity_card_scope': 'record-local',
            }
            for c in range(2)
        ]
        queries.append(
            {'query_id': f'q{q}', 'stratum': 'D', 'text': f'query {q}', 'candidates': candidates}
        )
    path = tmp_path / 'pairs.json'
    path.write_text(
        json.dumps(
            {'schema': 'arc-gold-pairs/1', 'run_id': 'r00', 'audit_index': 1, 'queries': queries}
        )
    )
    return path


@pytest.fixture
def rubric(tmp_path: Path) -> Path:
    path = tmp_path / 'rubric.md'
    path.write_text(
        '# UMBRELA 0-3\n\n3: exactly what the query is after. 0: unrelated, or a different person.\n'
    )
    return path


@pytest.fixture
def signoff_files(tmp_path: Path, arc) -> dict[str, Path]:
    rules_path, _, runs = arc
    r00 = runs[0].run_dir
    lint_path = tmp_path / 'lint.json'
    lint_path.write_text(json.dumps(lint(rules_path, frozen=True).to_json()))
    prereg = tmp_path / 'PREREG.md'
    prereg.write_text('# PREREG\n\nSynthetic pre-registration for the packet tests.\n')
    card = tmp_path / 'bench-card.md'
    card.write_text('# ARC-Bench v1\n\nvault sealed sha256: ' + '0' * 64 + '\n')
    from arcforge.contract.schema import REPORT_SCHEMA_PATH

    records = {}
    for name in ('amendment_a0', 'witness', 'model_choice', 'contamination', 'provenance',
                 'panel', 'quarantine'):  # fmt: skip
        path = tmp_path / f'{name}.json'
        path.write_text(json.dumps({'schema': f'synthetic-{name}', 'synthetic': True}))
        records[name] = path
    return {
        'prereg': prereg,
        'rules': rules_path,
        'schema': REPORT_SCHEMA_PATH,
        'lint': lint_path,
        'report': r00 / 'report.json',
        'verdicts': r00 / 'verdicts.json',
        'bench_card': card,
        **records,
    }


class Agent:
    """Writes output.json into an attempt directory, as a Fable workflow agent would."""

    @staticmethod
    def write(
        workdir: Path,
        kind: str,
        result: Any = None,
        *,
        status: str = 'ok',
        reason: str | None = None,
    ) -> None:
        output = {
            'schema': 'arc-fable-output/1',
            'kind': kind,
            'status': status,
            'reason': reason,
            'result': result,
        }
        (workdir / 'output.json').write_text(json.dumps(output, indent=1))

    @staticmethod
    def grades(workdir: Path, skip: int = 0) -> dict[str, Any]:
        doc = json.loads((workdir / 'inputs' / 'pairs.json').read_text())
        grades = [
            {'query_id': q['query_id'], 'candidate_id': c['candidate_id'], 'grade': 2, 'note': None}
            for q in doc['queries']
            for c in q['candidates']
        ]
        return {'grades': grades[skip:]}

    @staticmethod
    def signature(ok: bool = True) -> dict[str, Any]:
        checks = [{'id': check, 'ok': ok, 'note': 'checked'} for check in SIGNOFF_CHECKS]
        return {
            'decision': 'sign' if ok else 'refuse',
            'checks': checks,
            'required_changes': [] if ok else ['fix the lint'],
            'statement': 'Signed.' if ok else 'Refused.',
        }


@pytest.fixture
def agent() -> type[Agent]:
    return Agent
