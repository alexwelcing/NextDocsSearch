"""`execute_remote`: the runtime's VM executor hook (contract arc-vm-request/1).

arcforge/core/executor.py hands the VM part of a run to `arcforge.runner.execute_remote(spec)`
and expects back the sha256 of the run manifest the VM wrote into the GCS cache. This module
turns that spec into one RunnerSession job:

- the resolved config is uploaded to gs://<bucket>/runs/<run>/vm/config.json and fetched by the
  VM into the container's working directory, so spec['argv'] (`arcforge run config.json
  --executor local --cache gs://…`) runs unchanged inside the pinned container;
- the session creates the spot runner, recreates it after a preemption (the stage DAG resumes
  from the cache by itself), and deletes it in its exit trap;
- the reply carries the manifest digest plus the runner's own record: report.vm, the rate
  cards it booked at, the image digest and the code it was built from.
"""

from __future__ import annotations

import json
import os
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from arcforge.runner import pins
from arcforge.runner.bootstrap import Job
from arcforge.runner.config import RunnerConfig
from arcforge.runner.session import RunnerError, RunnerSession
from arcforge.runner.shell import Shell, SubprocessShell, check

REQUEST_SCHEMA = 'arc-vm-request/1'
REPLY_SCHEMA = 'arc-vm-reply/1'


def code_sha(shell: Shell) -> str:
    """The commit this checkout runs (ARCFORGE_COMMIT overrides, as for `arcforge version`)."""
    override = os.environ.get('ARCFORGE_COMMIT', '').removesuffix('-dirty')
    if override:
        return override
    out = shell.run(['git', '-C', str(Path(__file__).resolve().parent), 'rev-parse', 'HEAD'])
    if not out.ok:
        raise RunnerError('not a git checkout: runner VMs are named and labeled by the code SHA')
    return out.stdout.strip()


def _validate(spec: Mapping[str, Any]) -> None:
    if spec.get('schema') != REQUEST_SCHEMA:
        raise RunnerError(f'expected a {REQUEST_SCHEMA} request, got {spec.get("schema")!r}')
    missing = [k for k in ('run', 'config', 'compute', 'argv', 'cache_url') if k not in spec]
    if missing:
        raise RunnerError(f'{REQUEST_SCHEMA} request lacks {missing}')
    argv = list(spec['argv'])
    if not argv or argv[0] != 'arcforge':
        raise RunnerError(f'argv must be an arcforge command line, got {argv[:3]}')
    if not str(spec['cache_url']).startswith('gs://'):
        raise RunnerError('the VM needs a gs:// cache')


def execute_remote(
    spec: Mapping[str, Any],
    *,
    shell: Shell | None = None,
    session_factory: Callable[..., RunnerSession] = RunnerSession,
    image: pins.ImagePin | None = None,
    log: Callable[[str], None] = print,
) -> dict[str, Any]:
    _validate(spec)
    shell = shell or SubprocessShell()
    run_id = spec['run']['id']
    cfg = RunnerConfig.from_compute(spec['compute'])
    image = image or pins.load_image()
    if not image.ref:
        raise RunnerError('no pinned runner image: python -m arcforge.runner image build')
    sha = code_sha(shell)
    if image.built_from and image.built_from != sha:
        log(
            f'runner: warning: the pinned image was built from {image.built_from[:12]}, '
            f'this checkout is {sha[:12]}; '
            "the VM runs the image's code"
        )

    config_url = f'gs://{cfg.bucket}/runs/{run_id}/vm/config.json'
    body = json.dumps(spec['config'], indent=1, sort_keys=True) + '\n'
    check(
        shell.run(['gcloud', 'storage', 'cp', '-', config_url, '--quiet'], input=body, timeout=120)
    )
    job = Job(image=image.ref, argv=tuple(spec['argv'][1:]), files={'config.json': config_url})

    with session_factory(cfg, run_id=run_id, code_sha=sha, shell=shell, log=log) as session:
        result = session.run(job)
        vm = session.vm_report()
        rates = session.rates_report()
        log_url = f'{session.status_url(session.instances[-1].name)}/job.log'
    if not result.ok:
        raise RunnerError(
            f'the VM job exited {result.exit_code}; its log: gcloud storage cat {log_url}'
        )
    latest = check(
        shell.run(
            [
                'gcloud',
                'storage',
                'cat',
                f'{str(spec["cache_url"]).rstrip("/")}/runs/{run_id}/latest',
            ],
            timeout=60,
        )
    ).stdout.strip()
    return {
        'schema': REPLY_SCHEMA,
        'manifest_sha256': latest,
        'vm': vm,
        'rates': rates,
        'container_digest': image.digest,
        'image_built_from': image.built_from,
        'code_sha': sha,
        'log_url': log_url,
    }
