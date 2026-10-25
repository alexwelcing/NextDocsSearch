"""Create, inspect and delete one runner VM — the primitives under RunnerSession.

Every instance is created the same way:
- name arc-run-<run>-<sha7>[-<attempt>], labels arcforge-run=<run> + managed-by=claude, so
  `arcforge gc` can find it by label alone;
- SPOT or STANDARD provisioning, --max-run-duration (3 h) with --instance-termination-action
  DELETE, so the VM deletes itself even if the laptop that launched it disappears;
- no external address: SSH reaches it only through IAP (35.235.240.0/20), and Google APIs (GCS,
  Artifact Registry, Vertex, Secret Manager) through Private Google Access;
- project-wide SSH keys blocked, so a debugging key lives and dies with the instance.

create() walks the zones a → b → c for each provisioning model in the ladder (spot, then
on-demand) and moves on only for capacity or quota errors; anything else is a real error and
stops the run.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from arcforge.runner.config import NAME_PREFIX, NETWORK_TAG, RUN_LABEL, RunnerConfig
from arcforge.runner.shell import CommandError, Result, Shell, check, gcloud_json, is_not_found

# gcloud / Compute API phrases that mean "no capacity here, try elsewhere".
STOCKOUT_MARKERS = (
    'ZONE_RESOURCE_POOL_EXHAUSTED',
    'does not have enough resources available',
    'STOCKOUT',
    'resource pool exhausted',
)
# Quota is regional: on a quota error the other zones cannot help, but the other provisioning
# model can (spot and on-demand L4s are separate quotas).
QUOTA_MARKERS = ('QUOTA_EXCEEDED', 'Quota exceeded', "Quota '")
UNAVAILABLE_MARKERS = ('does not exist in zone', 'is not available in zone', 'UNSUPPORTED_OPERATION')
GONE_STATES = frozenset({'STOPPING', 'STOPPED', 'TERMINATED', 'SUSPENDING', 'SUSPENDED'})


class CapacityError(RuntimeError):
    """No zone in the ladder had capacity or quota for any allowed provisioning model."""


@dataclass
class Instance:
    name: str
    zone: str
    provisioning: str  # 'spot' | 'on_demand'
    created_utc: str
    attempt: int = 1
    deleted_utc: str | None = None
    ended: str | None = None  # 'done' | 'failed' | 'preempted' | 'lost' | 'expired' | 'aborted'

    @property
    def gce_provisioning(self) -> str:
        return 'SPOT' if self.provisioning == 'spot' else 'STANDARD'


def _label_value(text: str) -> str:
    value = re.sub(r'[^a-z0-9_-]', '-', text.lower())[:63]
    if not value:
        raise ValueError(f'cannot make a label value from {text!r}')
    return value


def instance_name(run_id: str, code_sha: str, attempt: int = 1) -> str:
    """arc-run-<run>-<sha7>, plus -<attempt> for a recreated VM (the first keeps the program's name)."""
    if not re.fullmatch(r'[0-9a-f]{7,40}', code_sha):
        raise ValueError(f'code_sha must be hex, got {code_sha!r}')
    run = _label_value(run_id).replace('_', '-').strip('-')
    name = f'{NAME_PREFIX}{run}-{code_sha[:7]}' + (f'-{attempt}' if attempt > 1 else '')
    if len(name) > 63 or not re.fullmatch(r'[a-z]([-a-z0-9]*[a-z0-9])?', name):
        raise ValueError(f'{name!r} is not a valid instance name')
    return name


def labels(cfg: RunnerConfig, run_id: str, code_sha: str, attempt: int) -> dict[str, str]:
    return {
        **cfg.labels,
        RUN_LABEL: _label_value(run_id),
        'arcforge-sha': code_sha[:12],
        'arcforge-attempt': str(attempt),
    }


def create_argv(
    cfg: RunnerConfig,
    name: str,
    zone: str,
    provisioning: str,
    labels: Mapping[str, str],
    startup_script: Path,
    metadata: Mapping[str, str] | None = None,
) -> list[str]:
    meta = {'block-project-ssh-keys': 'TRUE', 'install-nvidia-driver': 'True', **(metadata or {})}
    return [
        'gcloud', 'compute', 'instances', 'create', name,
        f'--project={cfg.project}',
        f'--zone={zone}',
        f'--machine-type={cfg.shape}',  # g2 shapes carry their L4; no --accelerator flag
        f'--provisioning-model={"SPOT" if provisioning == "spot" else "STANDARD"}',
        '--instance-termination-action=DELETE',
        f'--max-run-duration={cfg.max_run_seconds}s',
        '--maintenance-policy=TERMINATE',
        f'--image={cfg.boot_image}',
        f'--image-project={cfg.boot_image_project}',
        f'--boot-disk-size={cfg.boot_disk_gb}GB',
        f'--boot-disk-type={cfg.boot_disk_type}',
        f'--network-interface=network={cfg.network},no-address',
        f'--service-account={cfg.service_account}',
        '--scopes=cloud-platform',
        f'--tags={NETWORK_TAG}',
        '--labels=' + ','.join(f'{k}={v}' for k, v in sorted(labels.items())),
        '--metadata=' + ','.join(f'{k}={v}' for k, v in sorted(meta.items())),
        f'--metadata-from-file=startup-script={startup_script}',
        '--format=json',
    ]


def _classify(result: Result) -> str:
    text = f'{result.stderr}\n{result.stdout}'
    if any(m in text for m in STOCKOUT_MARKERS):
        return 'stockout'
    if any(m in text for m in QUOTA_MARKERS):
        return 'quota'
    if any(m in text for m in UNAVAILABLE_MARKERS):
        return 'unavailable'
    return 'error'


def create(
    shell: Shell,
    cfg: RunnerConfig,
    *,
    name: str,
    ladder: Sequence[str],
    labels: Mapping[str, str],
    startup_script: Path,
    attempt: int = 1,
    log=print,
) -> Instance:
    """Create the VM in the first zone × provisioning model that has capacity."""
    tried: list[str] = []
    for provisioning in ladder:
        for zone in cfg.zone_names:
            argv = create_argv(cfg, name, zone, provisioning, labels, startup_script)
            result = shell.run(argv, timeout=600)
            if result.ok:
                created = result.json()
                created = created[0] if isinstance(created, list) else created
                log(f'runner: created {name} in {zone} ({provisioning})')
                return Instance(name, zone, provisioning, created['creationTimestamp'], attempt)
            kind = _classify(result)
            tried.append(f'{zone}/{provisioning}: {kind}')
            if kind == 'error':
                raise CommandError(result)
            log(f'runner: {zone} {provisioning}: {kind}, trying the next option')
            if kind == 'quota':
                break  # regional: skip the remaining zones for this provisioning model
    raise CapacityError(f'no capacity for {cfg.shape}: ' + '; '.join(tried))


def describe(shell: Shell, cfg: RunnerConfig, name: str, zone: str) -> dict[str, Any] | None:
    """The instance resource, or None once it no longer exists."""
    result = shell.run(
        ['gcloud', 'compute', 'instances', 'describe', name, f'--project={cfg.project}', f'--zone={zone}', '--format=json'],
        timeout=120,
    )
    if is_not_found(result):
        return None
    return check(result).json()


def delete(shell: Shell, cfg: RunnerConfig, name: str, zone: str) -> bool:
    """Delete and wait. True if this call deleted it, False if it was already gone."""
    result = shell.run(
        ['gcloud', 'compute', 'instances', 'delete', name, f'--project={cfg.project}', f'--zone={zone}', '--quiet'],
        timeout=600,
    )
    if is_not_found(result):
        return False
    check(result)
    return True


def operations(shell: Shell, cfg: RunnerConfig, name: str, zone: str) -> list[dict[str, Any]]:
    """Zone operations that targeted this instance (insert, delete, compute.instances.preempted…)."""
    ops = gcloud_json(
        shell,
        ['compute', 'operations', 'list', f'--project={cfg.project}', f'--zones={zone}',
         f'--filter=targetLink ~ /instances/{name}$'],
    )
    return sorted(ops or [], key=lambda op: op.get('insertTime', ''))


def end_time(ops: Sequence[Mapping[str, Any]]) -> tuple[str | None, bool]:
    """(when the instance stopped existing, whether it was preempted), from its operations.

    The latest finished delete wins (the disk bills until then); a preemption without a later
    delete op (termination action DELETE deletes in the same step) gives the preemption time.
    """
    preempted = [op for op in ops if op.get('operationType') == 'compute.instances.preempted']
    deletes = [op for op in ops if op.get('operationType') == 'delete' and op.get('status') == 'DONE']
    if deletes:
        return max(op.get('endTime') or op['insertTime'] for op in deletes), bool(preempted)
    if preempted:
        return max(op.get('endTime') or op['insertTime'] for op in preempted), True
    return None, False


def list_runners(shell: Shell, cfg: RunnerConfig) -> list[dict[str, Any]]:
    """Every instance in the project that carries the runner label."""
    return gcloud_json(
        shell,
        ['compute', 'instances', 'list', f'--project={cfg.project}', f'--filter=labels.{RUN_LABEL}:*'],
    ) or []
