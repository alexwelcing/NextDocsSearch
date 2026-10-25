"""Execute a stage selection against the cache and write the deterministic run manifest.

For each stage in topological order: compute its key from the config subtree, its code, its
external fingerprints and its inputs' output digests; on a cache hit, load the recorded
outputs (each object is checked against its sha256); otherwise run it, store every artifact as
an object and write the stage record. The manifest (run.json) lists every stage's key, output
digest and artifact hashes, plus the resolved config, and contains nothing time- or
machine-dependent: two runs of the same selection are byte-identical whether they computed or
replayed from the cache. Timings and hit/miss go to the event log only.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.core.cache import CacheCorrupt, Store
from arcforge.core.config import Config
from arcforge.core.dag import (
    RunEnv,
    Stage,
    StageContext,
    StageError,
    key_material,
    not_implemented,
    outputs_digest,
    stage_key,
    toposort,
)
from arcforge.core.hashing import pretty_json, sha256_bytes

MANIFEST_SCHEMA = 'arc-run/1'
RECORD_SCHEMA = 'arc-stage-record/1'

Log = Callable[[str], None]


@dataclass
class StageResult:
    stage: str
    key: str
    digest: str
    outputs: dict[str, dict[str, Any]]  # artifact -> {sha256, bytes}
    data: dict[str, bytes] = field(repr=False)
    cached: bool = False


def _load_externals(stage: Stage, ctx: StageContext, env: RunEnv) -> dict[str, str]:
    fingerprints = {}
    for external in stage.external:
        fingerprint, payload = external.load(ctx, env)
        ctx.external[external.name] = payload
        fingerprints[external.name] = fingerprint
    return fingerprints


def compute(stage: Stage, ctx: StageContext) -> dict[str, bytes]:
    """Run one stage's function and check it produced exactly its declared outputs."""
    if stage.run is None:
        raise not_implemented(stage)
    produced = dict(stage.run(ctx))
    if set(produced) != set(stage.outputs):
        raise StageError(
            f'{stage.name} produced {sorted(produced)} but declares {sorted(stage.outputs)}'
        )
    for name, data in produced.items():
        if not isinstance(data, bytes):
            raise StageError(f'{stage.name}/{name} is {type(data).__name__}, not bytes')
    return {name: produced[name] for name in stage.outputs}


def describe_outputs(data: Mapping[str, bytes]) -> dict[str, dict[str, Any]]:
    return {name: {'sha256': sha256_bytes(blob), 'bytes': len(blob)} for name, blob in data.items()}


def run_stage(
    stage: Stage,
    config: Config,
    store: Store,
    env: RunEnv,
    upstream: Mapping[str, StageResult],
    *,
    use_cache: bool = True,
) -> StageResult:
    ctx = StageContext(
        stage=stage,
        config=config,
        seed=config.seed if stage.seeded else None,
        inputs={name: upstream[name].data for name in stage.inputs},
    )
    if stage.run is None:
        raise not_implemented(stage)
    fingerprints = _load_externals(stage, ctx, env)
    material = key_material(
        stage, config, {name: upstream[name].digest for name in stage.inputs}, fingerprints
    )
    key = stage_key(material)

    if use_cache:
        record = store.get_record(stage.name, key)
        if record is not None:
            outputs = record['outputs']
            if set(outputs) != set(stage.outputs) or outputs_digest(outputs) != record['digest']:
                raise CacheCorrupt(
                    f'stage record {stage.name}/{key} in {store.url} is inconsistent'
                )
            data = {name: store.get_object(outputs[name]['sha256']) for name in stage.outputs}
            return StageResult(stage.name, key, record['digest'], outputs, data, cached=True)

    data = compute(stage, ctx)
    outputs = describe_outputs(data)
    for blob in data.values():
        store.put_object(blob)
    digest = outputs_digest(outputs)
    store.put_record(
        {
            'schema': RECORD_SCHEMA,
            'stage': stage.name,
            'key': key,
            'key_material': material,
            'outputs': outputs,
            'digest': digest,
        }
    )
    return StageResult(stage.name, key, digest, outputs, data, cached=False)


def run_selection(
    stages: Mapping[str, Stage],
    selection: list[str],
    config: Config,
    store: Store,
    env: RunEnv,
    *,
    force: frozenset[str] = frozenset(),
    log: Log = lambda _msg: None,
) -> list[StageResult]:
    """Run `selection` (already closed over its inputs) in topological order."""
    order = [name for name in toposort(stages) if name in set(selection)]
    for name in order:
        missing = [i for i in stages[name].inputs if i not in selection]
        if missing:
            raise StageError(f'{name} needs {missing}, which are not in the selection')
    results: dict[str, StageResult] = {}
    for name in order:
        result = run_stage(stages[name], config, store, env, results, use_cache=name not in force)
        results[name] = result
        log(
            f'{name:5} {"cached " if result.cached else "built  "} {result.digest[:12]}  '
            f'key {result.key[:12]}'
        )
    return [results[name] for name in order]


def manifest(config: Config, results: list[StageResult]) -> dict[str, Any]:
    return {
        'schema': MANIFEST_SCHEMA,
        'run': {
            'id': config.run_id,
            'branch': config.branch,
            'seed': config.seed,
            'config_sha256': config.sha256,
        },
        'config': config.data,
        'stages': [
            {'stage': r.stage, 'key': r.key, 'digest': r.digest, 'outputs': r.outputs}
            for r in results
        ],
        'artifact_hashes': {
            f'{r.stage}/{name}': meta['sha256'] for r in results for name, meta in r.outputs.items()
        },
    }


def manifest_bytes(doc: Mapping[str, Any]) -> bytes:
    return pretty_json(dict(doc))


def _clear_previous_run(out: Path, extra: set[str]) -> None:
    try:
        previous = json.loads((out / 'run.json').read_bytes())
        owned = {f'{s["stage"]}/{name}' for s in previous['stages'] for name in s['outputs']}
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise StageError(
            f'{out} is not empty and holds no readable run.json; refusing to overwrite it'
        ) from error
    owned |= {'run.json'} | extra
    present = {p.relative_to(out).as_posix() for p in out.rglob('*') if not p.is_dir()}
    foreign = sorted(present - owned)
    if foreign:
        raise StageError(
            f'{out} holds files that no previous run wrote ({", ".join(foreign[:5])}); '
            'refusing to overwrite it'
        )
    for rel in present:
        (out / rel).unlink()
    for path in sorted((p for p in out.rglob('*') if p.is_dir()), key=lambda p: -len(p.parts)):
        path.rmdir()


def materialize(
    out: Path,
    doc: Mapping[str, Any],
    results: list[StageResult],
    extra: Mapping[str, bytes] | None = None,
) -> None:
    """Write run.json, any extra files, and every artifact as <out>/<stage>/<name>.

    A non-empty output directory is cleared only when everything in it belongs to a previous
    run (the files its run.json lists, plus the extra files); anything else is refused, never
    deleted.
    """
    if out.exists() and any(out.iterdir()):
        _clear_previous_run(out, set(extra or {}))
    out.mkdir(parents=True, exist_ok=True)
    for result in results:
        for name, blob in result.data.items():
            path = out / result.stage / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(blob)
    for name, blob in (extra or {}).items():
        (out / name).write_bytes(blob)
    (out / 'run.json').write_bytes(manifest_bytes(doc))
