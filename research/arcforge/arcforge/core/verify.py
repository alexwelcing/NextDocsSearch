"""`arcforge verify`: rebuild every stage of a recorded run from the cache and diff the hashes.

For each stage in the run manifest, in order:
  1. integrity: its stage record exists under its key and agrees with the manifest, and every
     recorded artifact is in the cache and hashes to its address;
  2. rebuild: run the stage again, fresh, on its RECORDED inputs (the upstream artifacts read
     back from the cache, never recomputed), so a divergence is pinned to the one stage that
     produced it;
  3. diff: compare each rebuilt artifact's sha256 with the manifest's.
It also recomputes the stage key under the current code, config and external inputs and
reports `key_drift` when it moved: the rebuild then tests today's code against yesterday's
bytes, and a mismatch means the code (or the corpus) changed, not that the run was flaky.

The config comes from the manifest itself, so verify checks the run that happened, not
whatever configs/rNN.yaml says now.
"""

from __future__ import annotations

import json
from typing import Any

from arcforge.core.cache import CacheError, Store
from arcforge.core.config import Config
from arcforge.core.dag import (
    RunEnv,
    Stage,
    StageContext,
    StageError,
    key_material,
    outputs_digest,
    stage_key,
)
from arcforge.core.hashing import digest_of
from arcforge.core.pipeline import MANIFEST_SCHEMA, compute, describe_outputs


def config_of(doc: dict[str, Any]) -> Config:
    config = Config(data=doc['config'], path=None, sha256=digest_of(doc['config']))
    if config.sha256 != doc['run']['config_sha256']:
        raise StageError('run manifest: its config does not hash to run.config_sha256')
    return config


def load_manifest(data: bytes) -> dict[str, Any]:
    doc = json.loads(data)
    if doc.get('schema') != MANIFEST_SCHEMA:
        raise StageError(f'not an {MANIFEST_SCHEMA} manifest')
    return doc


def verify_run(
    doc: dict[str, Any], store: Store, env: RunEnv, stages: dict[str, Stage]
) -> dict[str, Any]:
    config = config_of(doc)
    recorded: dict[str, dict[str, bytes]] = {}
    digests: dict[str, str] = {}
    rows = []
    for entry in doc['stages']:
        name = entry['stage']
        row: dict[str, Any] = {'stage': name, 'key': entry['key'], 'problems': [], 'artifacts': {}}
        rows.append(row)
        stage = stages.get(name)
        if stage is None:
            row['problems'].append('unknown stage')
            continue
        record = store.get_record(name, entry['key'])
        if record is None:
            row['problems'].append('stage record missing from the cache')
        elif record['outputs'] != entry['outputs'] or record['digest'] != entry['digest']:
            row['problems'].append('stage record disagrees with the manifest')
        elif stage_key(record['key_material']) != entry['key']:
            row['problems'].append('stage record key material does not hash to its key')
        if outputs_digest(entry['outputs']) != entry['digest']:
            row['problems'].append('manifest digest does not match its outputs')
        data: dict[str, bytes] = {}
        for artifact, meta in entry['outputs'].items():
            try:
                data[artifact] = store.get_object(meta['sha256'])
            except CacheError as error:
                row['problems'].append(f'{artifact}: {error}')
        recorded[name] = data
        digests[name] = entry['digest']

        missing_inputs = [i for i in stage.inputs if i not in recorded]
        if missing_inputs:
            row['problems'].append(f'inputs {missing_inputs} are not in this manifest')
            continue
        ctx = StageContext(
            stage=stage,
            config=config,
            seed=config.seed if stage.seeded else None,
            inputs={i: recorded[i] for i in stage.inputs},
        )
        fingerprints = {}
        for external in stage.external:
            fingerprint, payload = external.load(ctx, env)
            ctx.external[external.name] = payload
            fingerprints[external.name] = fingerprint
        row['key_now'] = stage_key(
            key_material(stage, config, {i: digests[i] for i in stage.inputs}, fingerprints)
        )
        row['key_drift'] = row['key_now'] != entry['key']
        try:
            rebuilt = describe_outputs(compute(stage, ctx))
        except (StageError, NotImplementedError) as error:
            row['problems'].append(f'rebuild failed: {error}')
            continue
        for artifact, meta in entry['outputs'].items():
            now = rebuilt.get(artifact, {}).get('sha256')
            row['artifacts'][artifact] = {
                'recorded': meta['sha256'],
                'rebuilt': now,
                'match': now == meta['sha256'],
            }
            if now != meta['sha256']:
                row['problems'].append(
                    f'{artifact}: rebuilt {str(now)[:12]} != recorded {meta["sha256"][:12]}'
                )
    ok = all(not row['problems'] for row in rows)
    return {
        'schema': 'arc-verify/1',
        'run': doc['run'],
        'cache': store.url,
        'ok': ok,
        'artifacts_checked': sum(len(row['artifacts']) for row in rows),
        'stages': rows,
    }


def render(report: dict[str, Any]) -> str:
    lines = [
        f'arcforge verify {report["run"]["id"]} (config {report["run"]["config_sha256"][:12]}, '
        f'cache {report["cache"]})'
    ]
    for row in report['stages']:
        status = 'ok' if not row['problems'] else 'FAIL'
        drift = (
            '  (key drift: code, config or corpus changed since the run)'
            if row.get('key_drift')
            else ''
        )
        lines.append(f'  {row["stage"]:5} {status:4} {len(row["artifacts"])} artifacts{drift}')
        lines += [f'        {problem}' for problem in row['problems']]
    verdict = 'byte-identical' if report['ok'] else 'MISMATCH'
    lines.append(f'{verdict}: {report["artifacts_checked"]} artifacts rebuilt and compared')
    return '\n'.join(lines)
