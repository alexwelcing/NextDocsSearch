"""Executors: where a stage selection runs.

LOCAL runs every stage in-process against the cache. It is what the tests, the laptop phases
(prep, tail) and the runner VM itself use.

VM hands the run to the runner-VM lifecycle in `arcforge.runner` (the runner stream owns it):
create arc-run-<rNN>-<short sha> as a spot g2-standard-8 with one L4, run the same selection
there under the LOCAL executor against the GCS cache, publish, and delete the VM. This module
only defines the hook and imports arcforge.runner lazily, so the runtime works (and fails with
a clear message) before that package exists. The contract, version 'arc-vm-request/1':

    arcforge.runner.execute_remote(spec: dict) -> dict

    spec = {
      'schema': 'arc-vm-request/1',
      'run': {'id', 'branch', 'seed', 'config_sha256'},
      'config': the resolved config (write it as JSON; `arcforge run <file>` loads JSON),
      'stages': [stage names, closed over their inputs, in topological order],
      'force': [stage names to recompute even on a cache hit],
      'cache_url': 'gs://...' (the VM cannot see a laptop cache),
      'budget_usd': the --budget limit, 'plan_usd': the planned total it passed,
      'compute': config['compute'],
      'argv': the arcforge command line to run on the VM,
    }
    returns {'manifest_sha256': str, ...}: the run manifest the VM wrote to cache_url.
"""

from __future__ import annotations

import importlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from arcforge.core.cache import open_store
from arcforge.core.config import Config
from arcforge.core.dag import RunEnv
from arcforge.core.pipeline import (
    Log,
    StageResult,
    manifest,
    manifest_bytes,
    materialize,
    run_selection,
)
from arcforge.core.stages import REGISTRY

VM_REQUEST_SCHEMA = 'arc-vm-request/1'
RUNNER_MODULE = 'arcforge.runner'
RUNNER_HOOK = 'execute_remote'


class ExecutorUnavailable(RuntimeError):
    """The chosen executor cannot run on this machine or checkout."""


@dataclass(frozen=True)
class RunRequest:
    config: Config
    stages: list[str]
    cache_url: str
    env: RunEnv
    out: Path | None = None
    force: frozenset[str] = frozenset()
    budget_usd: float | None = None
    plan_usd: float | None = None
    extra_files: dict[str, bytes] = field(default_factory=dict)


@dataclass
class RunOutcome:
    manifest: dict[str, Any]
    manifest_sha256: str
    results: list[StageResult] | None = None


class Executor(Protocol):
    name: str

    def execute(self, request: RunRequest, log: Log) -> RunOutcome: ...


class LocalExecutor:
    name = 'local'

    def execute(self, request: RunRequest, log: Log) -> RunOutcome:
        store = open_store(request.cache_url)
        results = run_selection(
            REGISTRY,
            request.stages,
            request.config,
            store,
            request.env,
            force=request.force,
            log=log,
        )
        doc = manifest(request.config, results)
        digest = store.put_manifest(request.config.run_id, manifest_bytes(doc))
        if request.out is not None:
            materialize(request.out, doc, results, request.extra_files)
        return RunOutcome(doc, digest, results)


def vm_spec(request: RunRequest) -> dict[str, Any]:
    config = request.config
    argv = ['arcforge', 'run', 'config.json', '--executor', 'local', '--cache', request.cache_url]
    argv += ['--stages', ','.join(request.stages)]
    if request.force:
        argv += ['--force', ','.join(sorted(request.force))]
    if request.budget_usd is not None:
        argv += ['--budget', f'{request.budget_usd:g}']
    return {
        'schema': VM_REQUEST_SCHEMA,
        'run': {
            'id': config.run_id,
            'branch': config.branch,
            'seed': config.seed,
            'config_sha256': config.sha256,
        },
        'config': config.data,
        'stages': list(request.stages),
        'force': sorted(request.force),
        'cache_url': request.cache_url,
        'budget_usd': request.budget_usd,
        'plan_usd': request.plan_usd,
        'compute': config.data['compute'],
        'argv': argv,
    }


class VMExecutor:
    name = 'vm'

    def __init__(self, module: str | None = None):
        self.module = module or RUNNER_MODULE

    def hook(self) -> Any:
        try:
            runner = importlib.import_module(self.module)
        except ModuleNotFoundError as error:
            if error.name and self.module.startswith(error.name):
                raise ExecutorUnavailable(
                    f'the VM executor needs {self.module} (the runner-VM lifecycle), which is not '
                    'in this checkout yet. Run on this machine with --executor local, or install '
                    'the runner stream.'
                ) from error
            raise
        hook = getattr(runner, RUNNER_HOOK, None)
        if not callable(hook):
            raise ExecutorUnavailable(
                f'{self.module} has no {RUNNER_HOOK}(spec) -> dict; see arcforge/core/executor.py '
                f'for the {VM_REQUEST_SCHEMA} contract'
            )
        return hook

    def execute(self, request: RunRequest, log: Log) -> RunOutcome:
        if not request.cache_url.startswith('gs://'):
            raise ExecutorUnavailable(
                'the VM executor needs a gs:// cache the runner VM can reach '
                f'(got {request.cache_url}); '
                'pass --cache gs://witching-606c6-arcforge/cache'
            )
        if not request.config.get('corpus.git_sha'):
            raise ExecutorUnavailable(
                'the VM part needs corpus.git_sha pinned, so the runner snapshots the same corpus '
                'as the laptop prep pass (an unpinned worktree would re-run S0-S2 on the VM)'
            )
        hook = self.hook()
        log(f'vm: handing {len(request.stages)} stages to {self.module}.{RUNNER_HOOK}')
        reply = hook(vm_spec(request))
        digest = reply.get('manifest_sha256') if isinstance(reply, dict) else None
        if not isinstance(digest, str):
            raise ExecutorUnavailable(f'{self.module}.{RUNNER_HOOK} returned no manifest_sha256')
        doc = json.loads(open_store(request.cache_url).get_manifest(request.config.run_id, digest))
        if doc.get('run', {}).get('config_sha256') != request.config.sha256:
            raise ExecutorUnavailable(
                f'{self.module}.{RUNNER_HOOK} returned a manifest for a different config '
                f'({doc.get("run", {}).get("config_sha256")} != {request.config.sha256})'
            )
        return RunOutcome(doc, digest)


EXECUTORS = {'local': LocalExecutor, 'vm': VMExecutor}


def get_executor(name: str) -> Executor:
    try:
        return EXECUTORS[name]()
    except KeyError as error:
        raise ExecutorUnavailable(f'unknown executor {name!r} (local, vm)') from error
