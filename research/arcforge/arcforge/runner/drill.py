"""The spot-preemption drill: kill the runner mid-stage, recreate it, resume from the cache.

M1's exit criterion: "a spot-preemption drill (deleting the VM mid-stage) resumes to
byte-identical artifacts and books both VMs". The drill runs a dummy stage on a real spot runner:
a chain of steps, each content-addressed by sha256(stage, code, step, input hash, seed) and
stored in GCS as it completes, exactly the way the runtime's stage DAG keys its outputs. Once a
few steps are cached, the controller deletes the VM. The session sees the VM vanish, recreates it
(spot once more), and the stage on the new VM finds those steps in the cache and computes only
the rest. The final artifact must equal, byte for byte, the one computed locally with no VM at
all, and the booking must list both instances.

Two halves, one module:
- `stage` runs in the container on the VM (google-cloud-storage from the cloud extra);
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
STEP_BYTES = 1 << 20


class Store(Protocol):
    def get(self, key: str) -> bytes | None: ...
    def put(self, key: str, data: bytes) -> None: ...


class DirStore:
    """A local directory store, for tests and for computing the expected artifact."""

    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)

    def get(self, key: str) -> bytes | None:
        path = self.root / key
        return path.read_bytes() if path.exists() else None

    def put(self, key: str, data: bytes) -> None:
        (self.root / key).write_bytes(data)


class GcsStore:
    """gs://bucket/prefix/<key>, through google-cloud-storage and the VM's metadata credentials."""

    def __init__(self, url: str):
        from google.cloud import storage  # the cloud extra, present in the runner image

        bucket, _, prefix = url.removeprefix('gs://').partition('/')
        self.bucket = storage.Client().bucket(bucket)
        self.prefix = prefix.rstrip('/')

    def _blob(self, key: str):
        return self.bucket.blob(f'{self.prefix}/{key}' if self.prefix else key)

    def get(self, key: str) -> bytes | None:
        blob = self._blob(key)
        return blob.download_as_bytes() if blob.exists() else None

    def put(self, key: str, data: bytes) -> None:
        self._blob(key).upload_from_string(data, content_type='application/octet-stream')


def step_key(step: int, input_sha256: str, seed: int) -> str:
    """Content address of one step: what the runtime's cache key is, in miniature."""
    material = {'stage': 'drill', 'code': DRILL_CODE, 'step': step, 'input': input_sha256, 'seed': seed}
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
    store: Store,
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
    artifact = json.dumps({'stage': 'drill', 'code': DRILL_CODE, 'seed': seed, 'steps': rows}, indent=1, sort_keys=True).encode()
    return artifact, counts


def expected_artifact(tmp: Path, *, steps: int, seed: int) -> bytes:
    """The artifact a clean, uninterrupted run produces, computed locally with no VM."""
    artifact, _ = stage(DirStore(tmp), steps=steps, seed=seed, log=lambda _m: None)
    return artifact


# --- the on-VM entry point: python -m arcforge.runner.drill stage … --------------------------


def _main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(prog='python -m arcforge.runner.drill')
    sub = parser.add_subparsers(dest='cmd', required=True)
    run = sub.add_parser('stage', help='run or resume the dummy stage against a GCS cache')
    run.add_argument('--cache', required=True, help='gs:// prefix of the drill cache')
    run.add_argument('--out', required=True, help='gs:// URL for the final artifact')
    run.add_argument('--steps', type=int, default=6)
    run.add_argument('--seed', type=int, default=1729)
    run.add_argument('--step-seconds', type=float, default=40.0)
    args = parser.parse_args(argv)

    artifact, counts = stage(GcsStore(args.cache), steps=args.steps, seed=args.seed, step_seconds=args.step_seconds)
    out_dir, _, name = args.out.rpartition('/')
    GcsStore(out_dir).put(name, artifact)
    print(f'drill: done, {counts["cached"]} steps from cache, {counts["computed"]} computed, '
          f'artifact sha256 {hashlib.sha256(artifact).hexdigest()}')
    return 0


# --- the controller -------------------------------------------------------------------------


def count_cached(shell, cache_url: str) -> int:
    result = shell.run(['gcloud', 'storage', 'ls', cache_url.rstrip('/') + '/'], timeout=60)
    return len(result.stdout.split()) if result.ok else 0


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
    cache = f'gs://{bucket}/cache/drill/{drill_id}'
    out = f'gs://{bucket}/runs/{session.run_id}/artifacts/drill.json'
    job = Job(
        image=image,
        entrypoint='python',
        argv=('-m', 'arcforge.runner.drill', 'stage', '--cache', cache, '--out', out,
              '--steps', str(steps), '--seed', str(seed), '--step-seconds', str(step_seconds)),
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
    log_text = session.shell.run(['gcloud', 'storage', 'cat', f'{session.status_url(session.instances[-1].name)}/job.log'], timeout=60)
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
