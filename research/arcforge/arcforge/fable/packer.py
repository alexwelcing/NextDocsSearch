"""Write Fable packets: content-addressed, isolated working directories for orchestrator agents.

A packet is a manifest (packet.json) plus exactly the files it lists: INSTRUCTIONS.md, the output
schema, and the inputs the kind allows. Its id is the sha256 of the manifest's canonical bytes,
and the manifest pins every file's sha256, so the same inputs always make the same packet.

On disk (default root: $ARCFORGE_FABLE_DIR, else ~/.cache/arcforge/fable):

    <root>/<kind>-<run>-<sha12>/
      packet/        the canonical packet (never handed to an agent)
      attempt-1/     a copy of packet/: the ONLY directory the agent may see; it writes output.json
      attempt-2/     a fresh copy, created only for the single retry
      rejected/      outputs of rejected attempts, moved out of the agent's sight
      ledger.json    attempts, outcomes and the final status (fable/ledger.py)
      output.json    the accepted output, byte for byte, once there is one

The root must not lie inside a git work tree: an agent whose directory sits in the repository
could read the unstripped run files next to it. Blind packets hold only stripped verdicts files,
checked against arc-report/1's VerdictsDocBlind before anything is written.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from arcforge.contract.ids import RUN_IDS, STRIPPED_FIELDS
from arcforge.fable.kinds import FABLE_MODEL_PREFIX, KINDS, render_brief

PACKET_SCHEMA = 'arc-fable-packet/1'
LEDGER_SCHEMA = 'arc-fable-ledger/1'
GOLD_SHAPE = (60, 12)  # 60 queries x 12 candidates (models_and_baselines: Fable's roles)


class PacketError(ValueError):
    """A packet that cannot be made: missing or malformed inputs, or an unsafe location."""


@dataclass(frozen=True)
class Packet:
    root: Path
    sha256: str
    manifest: dict[str, Any]

    @property
    def canonical(self) -> Path:
        return self.root / 'packet'

    def workdir(self, attempt: int) -> Path:
        return self.root / f'attempt-{attempt}'

    @property
    def ledger_path(self) -> Path:
        return self.root / 'ledger.json'


def now_utc() -> str:
    return datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')


def canonical_bytes(obj: Any) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode('utf-8')


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def default_root() -> Path:
    env = os.environ.get('ARCFORGE_FABLE_DIR')
    return Path(env) if env else Path.home() / '.cache' / 'arcforge' / 'fable'


def inside_git_worktree(path: Path) -> Path | None:
    """The enclosing git work tree of `path` (existing or not), or None."""
    for candidate in [path.resolve(), *path.resolve().parents]:
        if (candidate / '.git').exists():
            return candidate
    return None


def _read(path: str | Path, what: str) -> bytes:
    try:
        return Path(path).read_bytes()
    except OSError as error:
        raise PacketError(f'{what}: cannot read {path} ({error.strerror or error})') from None


def _read_json(path: str | Path, what: str) -> Any:
    try:
        return json.loads(_read(path, what))
    except json.JSONDecodeError as error:
        raise PacketError(f'{what}: {path} is not JSON ({error})') from None


def _validate(instance: Any, schema: Mapping[str, Any], what: str, definition: str | None = None) -> None:
    from arcforge.contract import schema as report_schema

    problems = report_schema.errors(instance, schema, definition)
    if problems:
        raise PacketError(f'{what}: ' + '; '.join(problems[:5]))


def build(
    kind_name: str,
    role: str,
    run_id: str,
    inputs: Sequence[tuple[str, str, bytes]],
    context: Mapping[str, Any],
    *,
    root: str | Path | None = None,
    stripped: Sequence[str] = (),
    expected_model: str = FABLE_MODEL_PREFIX,
    allow_in_repo: bool = False,
) -> Packet:
    """Write (or reuse) a packet. `inputs` are (path under inputs/, role, bytes)."""
    kind = KINDS[kind_name]
    if role not in kind.roles or run_id not in kind.runs_by_role[role]:
        raise PacketError(f'{kind_name}: role {role!r} does not run at {run_id!r} ({dict(kind.runs_by_role)})')
    root = Path(root) if root is not None else default_root()
    repo = inside_git_worktree(root)
    if repo is not None and not allow_in_repo:
        raise PacketError(f'{root} is inside the git work tree {repo}: an agent there could read unstripped run files')

    files: dict[str, tuple[str, bytes]] = {
        'INSTRUCTIONS.md': ('instructions', render_brief(kind, context).encode('utf-8')),
        'output.schema.json': ('output_schema', (Path(__file__).with_name('schemas') / kind.output_schema).read_bytes()),
    }
    for rel, file_role, data in inputs:
        path = f'inputs/{rel}'
        if path in files or '..' in rel.split('/') or rel.startswith('/'):
            raise PacketError(f'{kind_name}: bad or duplicate input path {rel!r}')
        files[path] = (file_role, data)
    manifest = {
        'schema': PACKET_SCHEMA,
        'kind': kind_name,
        'role': role,
        'run_id': run_id,
        'expected_model': expected_model,
        'instructions': 'INSTRUCTIONS.md',
        'output': {'path': 'output.json', 'schema': 'output.schema.json'},
        'files': [
            {'path': path, 'role': file_role, 'sha256': sha256_bytes(data), 'bytes': len(data)}
            for path, (file_role, data) in sorted(files.items())
        ],
        'stripped': list(stripped),
    }
    manifest_bytes = canonical_bytes(manifest)
    digest = sha256_bytes(manifest_bytes)
    packet = Packet(root / f'{kind_name}-{run_id}-{digest[:12]}', digest, manifest)
    if packet.canonical.exists():
        verify_dir(packet.canonical, manifest, allow=('packet.json',))
        return packet  # content-addressed: the same inputs are the same packet

    staging = packet.root.with_name(packet.root.name + '.partial')
    if staging.exists():
        shutil.rmtree(staging)
    (staging / 'packet').mkdir(parents=True)
    for path, (_, data) in files.items():
        target = staging / 'packet' / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (staging / 'packet' / 'packet.json').write_bytes(json.dumps(manifest, indent=1).encode('utf-8') + b'\n')
    ledger = {
        'schema': LEDGER_SCHEMA,
        'packet_sha256': digest,
        'kind': kind_name,
        'role': role,
        'run_id': run_id,
        'created_utc': now_utc(),
        'attempts': [],
        'status': None,
        'output_sha256': None,
        'owner_note': None,
    }
    (staging / 'ledger.json').write_text(json.dumps(ledger, indent=1) + '\n', encoding='utf-8')
    staging.rename(packet.root)
    open_attempt(packet, 1)
    return packet


def verify_dir(directory: Path, manifest: Mapping[str, Any], allow: Sequence[str] = ()) -> list[str]:
    """Problems with `directory` as a copy of the manifest: changed, missing or extra files.

    `allow` names extra top-level files that may exist (packet.json; output.json in a workdir).
    """
    problems = []
    expected = {f['path']: f['sha256'] for f in manifest['files']}
    present = {p.relative_to(directory).as_posix() for p in directory.rglob('*') if p.is_file()}
    for path, digest in expected.items():
        target = directory / path
        if not target.is_file():
            problems.append(f'{path} is missing')
        elif sha256_bytes(target.read_bytes()) != digest:
            problems.append(f'{path} was changed')
    extra = sorted(present - set(expected) - set(allow))
    if extra:
        problems.append(f'unexpected files {extra[:5]}')
    return problems


def open_attempt(packet: Packet, attempt: int) -> Path:
    """Copy the canonical packet into a fresh attempt directory and record it in the ledger."""
    workdir = packet.workdir(attempt)
    if workdir.exists():
        raise PacketError(f'{workdir} already exists')
    shutil.copytree(packet.canonical, workdir)
    problems = verify_dir(workdir, packet.manifest, allow=('packet.json',))
    if problems:
        raise PacketError(f'{workdir}: {problems}')
    ledger = json.loads(packet.ledger_path.read_text(encoding='utf-8'))
    ledger['attempts'].append(
        {
            'attempt': attempt,
            'workdir': workdir.name,
            'opened_utc': now_utc(),
            'checked_utc': None,
            'agent_session': None,
            'model_reported': None,
            'output_sha256': None,
            'outcome': None,
            'errors': [],
        }
    )
    packet.ledger_path.write_text(json.dumps(ledger, indent=1) + '\n', encoding='utf-8')
    return workdir


def load(packet_root: str | Path) -> Packet:
    root = Path(packet_root)
    manifest_path = root / 'packet' / 'packet.json'
    try:
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as error:
        raise PacketError(f'{root} is not a packet ({error})') from None
    digest = sha256_bytes(canonical_bytes(manifest))
    if not root.name.endswith(digest[:12]):
        raise PacketError(f'{root}: packet.json hashes to {digest[:12]}, not the directory name')
    return Packet(root, digest, manifest)


# ---- the four kinds ---------------------------------------------------------------------------


def pack_gold_audit(
    pairs: str | Path, rubric: str | Path, *, shape: tuple[int, int] | None = GOLD_SHAPE, **kwargs: Any
) -> Packet:
    """Gold audit #1 (R00) or #2 (R10/R10K): pairs.json (arc-gold-pairs/1) and the rubric."""
    data = _read(pairs, 'pairs')
    doc = _read_json(pairs, 'pairs')
    schema = json.loads((Path(__file__).with_name('schemas') / 'gold-pairs-1.json').read_text(encoding='utf-8'))
    _validate(doc, schema, 'pairs')
    queries = doc['queries']
    ids = [q['query_id'] for q in queries]
    candidates = [c['candidate_id'] for q in queries for c in q['candidates']]
    if len(set(ids)) != len(ids) or len(set(candidates)) != len(candidates):
        raise PacketError('pairs: query ids and candidate ids must be unique')
    if shape is not None:
        counts = {len(q['candidates']) for q in queries}
        if len(queries) != shape[0] or counts != {shape[1]}:
            raise PacketError(f'pairs: a gold audit is {shape[0]} queries x {shape[1]} candidates, got {len(queries)} x {sorted(counts)}')
    role = f'gold_audit_{doc["audit_index"]}'
    context = {'audit_index': doc['audit_index'], 'run_id': doc['run_id'], 'n_queries': len(queries), 'n_pairs': len(candidates)}
    inputs = [('pairs.json', 'pairs', data), ('rubric.md', 'rubric', _read(rubric, 'rubric'))]
    return build('gold_audit', role, doc['run_id'], inputs, context, **kwargs)


def pack_signoff(
    *, prereg: str | Path, rules: str | Path, schema: str | Path, lint: str | Path, report: str | Path,
    verdicts: str | Path, bench_card: str | Path, **kwargs: Any,
) -> Packet:  # fmt: skip
    """The R00 PREREG sign-off: PREREG.md, the frozen rules, the schema, lint.json, R00's files."""
    lint_doc = _read_json(lint, 'lint')
    if not isinstance(lint_doc, Mapping) or lint_doc.get('schema') != 'arc-lint/1':
        raise PacketError('lint: expected the JSON of `arcforge prereg lint --json` (arc-lint/1)')
    verdicts_doc = _read_json(verdicts, 'verdicts')
    if (verdicts_doc.get('run') or {}).get('id') != 'r00':
        raise PacketError('verdicts: the sign-off reads the r00 verdicts.json')
    _read_json(report, 'report')
    inputs = [
        ('PREREG.md', 'prereg', _read(prereg, 'prereg')),
        ('rules.yaml', 'rules', _read(rules, 'rules')),
        ('arc-report-1.json', 'schema', _read(schema, 'schema')),
        ('lint.json', 'lint', _read(lint, 'lint')),
        ('r00/report.json', 'report', _read(report, 'report')),
        ('r00/verdicts.json', 'verdicts', _read(verdicts, 'verdicts')),
        ('bench-card.md', 'bench_card', _read(bench_card, 'bench_card')),
    ]
    return build('prereg_signoff', 'signoff', 'r00', inputs, {'run_id': 'r00'}, **kwargs)


def pack_blind(*, prereg: str | Path, rules: str | Path, verdicts: Sequence[str | Path], **kwargs: Any) -> Packet:
    """The end review's blind pass: PREREG.md, rules.yaml and every run's verdicts.json, stripped."""
    from arcforge.contract import schema as report_schema
    from arcforge.contract.branches import PathError, Step, follow
    from arcforge.contract.rules import RulesError, load_rules
    from arcforge.contract.verdicts import dumps_doc, strip, stripped_keys_present

    try:
        parsed_rules = load_rules(rules)
    except RulesError as error:
        raise PacketError(f'rules: {error}') from None
    docs = [_read_json(p, 'verdicts') for p in verdicts]
    docs.sort(key=lambda d: RUN_IDS.index((d.get('run') or {}).get('id', 'r00')))
    run_ids = [d['run']['id'] for d in docs]
    if len(set(run_ids)) != len(run_ids):
        raise PacketError(f'verdicts: duplicate runs {run_ids}')
    try:
        paths = follow(parsed_rules, [Step.from_doc(d) for d in docs])
    except PathError as error:
        raise PacketError(f'verdicts: {error}') from None
    final = run_ids[-1]
    if final not in ('r10', 'r10K') or not any(len(parsed_rules.branch_table[p]) == len(docs) for p in paths):
        raise PacketError(f'verdicts: the blind pass needs every run of the realized path through R10/R10K, got {run_ids}')
    inputs = []
    full_schema = report_schema.load()
    for doc in docs:
        blind = strip(doc)
        left = stripped_keys_present(blind)
        if left:
            raise PacketError(f'{doc["run"]["id"]}: stripped fields remain: {left}')
        _validate(blind, full_schema, f'{doc["run"]["id"]} (blind)', 'VerdictsDocBlind')
        inputs.append((f'verdicts/{doc["run"]["id"]}.json', 'verdicts_blind', dumps_doc(blind).encode('utf-8')))
    inputs += [('PREREG.md', 'prereg', _read(prereg, 'prereg')), ('rules.yaml', 'rules', _read(rules, 'rules'))]
    context = {
        'run_id': final,
        'final_run': final,
        'runs': ', '.join(run_ids),
        'stripped': ', '.join(f'`{f}`' for f in STRIPPED_FIELDS),
    }
    return build('blind_recompute', 'end_review', final, inputs, context, stripped=STRIPPED_FIELDS, **kwargs)


def pack_mismatch(
    *, prereg: str | Path, rules: str | Path, writeup: str | Path, reports: Sequence[str | Path],
    comparison: str | Path, **kwargs: Any,
) -> Packet:  # fmt: skip
    """The end review's mismatch pass: the comparison table, the write-up and the full reports."""
    table = _read_json(comparison, 'comparison')
    if not isinstance(table, Mapping) or table.get('schema') != 'arc-fable-comparison/1':
        raise PacketError('comparison: expected the output of `python -m arcforge.fable compare`')
    inputs = []
    run_ids = []
    for path in reports:
        report = _read_json(path, 'report')
        run_id = (report.get('run') or {}).get('id')
        if run_id not in RUN_IDS or run_id in run_ids:
            raise PacketError(f'report {path}: run id {run_id!r} is unknown or repeated')
        run_ids.append(run_id)
        inputs.append((f'reports/{run_id}.json', 'report', _read(path, 'report')))
    final = max(run_ids, key=RUN_IDS.index) if run_ids else ''
    inputs += [
        ('comparison.json', 'comparison', _read(comparison, 'comparison')),
        ('writeup.md', 'writeup', _read(writeup, 'writeup')),
        ('PREREG.md', 'prereg', _read(prereg, 'prereg')),
        ('rules.yaml', 'rules', _read(rules, 'rules')),
    ]
    context = {'run_id': final, 'n_mismatches': len(table.get('mismatches') or [])}
    return build('mismatch_review', 'end_review', final, inputs, context, **kwargs)
