"""The spot-preemption drill: kill the runner mid-stage, recreate it, resume from the cache.

M1's exit criterion: "a spot-preemption drill (deleting the VM mid-stage) resumes to
byte-identical artifacts and books both VMs". The drill runs a dummy stage on a real spot runner:
a chain of steps, each keyed by sha256(stage, code, step, input hash, seed) and stored as it
completes in the runtime's own content-addressed cache (arcforge.core.cache: write-once objects
and stage records, create-only on GCS). Once a few steps are cached, the controller deletes the
VM. The session sees the VM vanish and recreates it (spot once more); the stage on the new VM
finds those steps in the cache and computes only the rest. The final artifact must equal, byte
for byte, the one computed locally with no VM at all, and the booking must list both instances.

Two halves, one module:
- `stage` runs in the container on the VM (the GCS cache needs the cloud extra);
- `run_drill` runs on the laptop / forge and drives a RunnerSession.
"""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any, Protocol

DRILL_CODE = 'arcforge.runner.drill/v1'  # bump when the step function changes
STAGE = 'drill'
STEP_BYTES = 1 << 20


class Steps(Protocol):
    def get(self, key: str) -> bytes | None: ...
    def put(self, key: str, data: bytes) -> None: ...


class CacheSteps:
    """Steps kept in an arcforge.core.cache Store: one object + one stage record per step."""

    def __init__(self, url: str):
        from arcforge.core.cache import open_store

        self.store = open_store(url)

    def get(self, key: str) -> bytes | None:
        record = self.store.get_record(STAGE, key)
        return self.store.get_object(record['outputs']['out']) if record else None  # hash-checked

    def put(self, key: str, data: bytes) -> None:
        digest = self.store.put_object(data)
        self.store.put_record(
            {'stage': STAGE, 'key': key, 'outputs': {'out': digest}, 'bytes': len(data)}
        )


def step_key(step: int, input_sha256: str, seed: int) -> str:
    """Content address of one step: what the runtime's cache key is, in miniature."""
    material = {
        'stage': 'drill',
        'code': DRILL_CODE,
        'step': step,
        'input': input_sha256,
        'seed': seed,
    }
    return hashlib.sha256(json.dumps(material, sort_keys=True).encode()).hexdigest()


def step_output(key: str, size: int = STEP_BYTES) -> bytes:
    """Deterministic bytes for a step: a sha256 counter stream seeded by its key."""
    out = bytearray()
    counter = 0
    while len(out) < size:
        out += hashlib.sha256(f'{key}:{counter}'.encode()).digest()
        counter += 1
    return bytes(out[:size])


def stage(
    store: Steps,
    *,
    steps: int,
    seed: int,
    step_seconds: float = 0.0,
    sleep: Callable[[float], None] = time.sleep,
    log: Callable[[str], None] = print,
) -> tuple[bytes, dict[str, int]]:
    """Run (or resume) the dummy stage. Returns (artifact bytes, {'computed': n, 'cached': m})."""
    previous = 'root'
    rows = []
    counts = {'computed': 0, 'cached': 0}
    for step in range(steps):
        key = step_key(step, previous, seed)
        data = store.get(key)
        if data is None:
            sleep(step_seconds)  # stands in for real GPU work
            data = step_output(key)
            store.put(key, data)
            counts['computed'] += 1
            log(f'drill: step {step} computed ({key[:12]})')
        else:
            counts['cached'] += 1
            log(f'drill: step {step} cached ({key[:12]})')
        previous = hashlib.sha256(data).hexdigest()
        rows.append({'step': step, 'key': key, 'sha256': previous})
    artifact = json.dumps(
        {'stage': 'drill', 'code': DRILL_CODE, 'seed': seed, 'steps': rows},
        indent=1,
        sort_keys=True,
    ).encode()
    return artifact, counts


def expected_artifact(tmp: Path, *, steps: int, seed: int) -> bytes:
    """The artifact a clean, uninterrupted run produces, computed locally with no VM."""
    artifact, _ = stage(CacheSteps(str(tmp)), steps=steps, seed=seed, log=lambda _m: None)
    return artifact


# --- the on-VM entry point: python -m arcforge.runner.drill stage … --------------------------


def _main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(prog='python -m arcforge.runner.drill')
    sub = parser.add_subparsers(dest='cmd', required=True)
    run = sub.add_parser('stage', help='run or resume the dummy stage against a GCS cache')
    run.add_argument(
        '--cache',
        required=True,
        help='the drill cache (gs://… on the VM; any arcforge.core.cache URL)',
    )
    run.add_argument('--out', required=True, help='gs:// URL for the final artifact')
    run.add_argument('--steps', type=int, default=6)
    run.add_argument('--seed', type=int, default=1729)
    run.add_argument('--step-seconds', type=float, default=40.0)
    args = parser.parse_args(argv)

    artifact, counts = stage(
        CacheSteps(args.cache), steps=args.steps, seed=args.seed, step_seconds=args.step_seconds
    )
    from arcforge.core.cache import open_backend

    out_dir, _, name = args.out.rpartition('/')
    open_backend(out_dir).write(name, artifact, create_only=False)
    print(
        f'drill: done, {counts["cached"]} steps from cache, {counts["computed"]} computed, '
        f'artifact sha256 {hashlib.sha256(artifact).hexdigest()}'
    )
    return 0


# --- the controller -------------------------------------------------------------------------


def count_cached(shell, cache_url: str) -> int:
    """Steps recorded so far: the stage records under <cache>/stages/drill/."""
    result = shell.run(
        ['gcloud', 'storage', 'ls', f'{cache_url.rstrip("/")}/stages/{STAGE}/'], timeout=60
    )
    return sum(line.endswith('.json') for line in result.stdout.split()) if result.ok else 0


def run_drill(
    session,
    *,
    image: str,
    drill_id: str,
    steps: int = 6,
    kill_after: int = 2,
    step_seconds: float = 40.0,
    seed: int = 1729,
    workdir: Path,
) -> dict[str, Any]:
    """Drive one drill through `session` (an entered RunnerSession). Returns the drill report."""
    from arcforge.runner import lifecycle
    from arcforge.runner.bootstrap import Job

    if not 0 < kill_after < steps:
        raise ValueError('kill_after must leave work both before and after the kill')
    bucket = session.cfg.bucket
    cache = f'gs://{bucket}/drill/{drill_id}/cache'  # its own prefix: never the production cache
    out = f'gs://{bucket}/runs/{session.run_id}/artifacts/drill.json'
    job = Job(
        image=image,
        entrypoint='python',
        argv=(
            '-m',
            'arcforge.runner.drill',
            'stage',
            '--cache',
            cache,
            '--out',
            out,
            '--steps',
            str(steps),
            '--seed',
            str(seed),
            '--step-seconds',
            str(step_seconds),
        ),
    )
    killed: dict[str, Any] = {}

    def on_poll(sess, inst, status: Mapping[str, Any] | None) -> None:
        if killed or inst.attempt != 1:
            return
        done = count_cached(sess.shell, cache)
        if done >= kill_after:
            sess.log(f'drill: {done} steps cached on {inst.name}; deleting it mid-stage')
            lifecycle.delete(sess.shell, sess.cfg, inst.name, inst.zone)
            killed.update(instance=inst.name, steps_cached_at_kill=done, at_utc=sess.clock())

    result = session.run(job, on_poll=on_poll)
    got = session.shell.run(['gcloud', 'storage', 'cat', out], timeout=60)
    want = expected_artifact(workdir / 'expected', steps=steps, seed=seed)
    got_bytes = got.stdout.encode() if got.ok else b''
    log_text = session.shell.run(
        ['gcloud', 'storage', 'cat', f'{session.status_url(session.instances[-1].name)}/job.log'],
        timeout=60,
    )
    resumed = log_text.stdout.count('cached (') if log_text.ok else None
    vm = session.vm_report()
    return {
        'drill_id': drill_id,
        'outcome': result.outcome,
        'killed': killed,
        'instances': vm['instances'],
        'preemptions': vm['preemptions'],
        'resumed_steps_on_last_vm': resumed,
        'expected_sha256': hashlib.sha256(want).hexdigest(),
        'got_sha256': hashlib.sha256(got_bytes).hexdigest() if got.ok else None,
        'byte_identical': got.ok and got_bytes == want,
        'usd': round(sum(i['usd'] for i in vm['instances']), 2),
    }


if __name__ == '__main__':
    raise SystemExit(_main())
