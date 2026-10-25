"""The preflight behind `arcforge doctor`: is this machine and project ready to launch a run?

Each check returns OK, WARN or FAIL with a one-line detail and, when not OK, the fix. FAIL
blocks a launch; WARN is worth knowing. Checks only ever read: secrets are checked for presence
(an enabled version exists), never accessed, and nothing is created or granted.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from pathlib import Path

from arcforge.runner import iam, pins
from arcforge.runner.config import IAP_RANGE, NETWORK_TAG, RunnerConfig
from arcforge.runner.mirror import read_manifest
from arcforge.runner.shell import Result, Shell

OK, WARN, FAIL = 'OK', 'WARN', 'FAIL'
UV_MIN = (0, 13, 5)
VAULT_RECIPIENT = Path(__file__).resolve().parents[2] / 'configs' / 'vault.recipient'


@dataclass(frozen=True)
class Check:
    name: str
    status: str
    detail: str
    fix: str = ''


@dataclass
class Context:
    shell: Shell
    cfg: RunnerConfig = field(default_factory=RunnerConfig)
    image: pins.ImagePin | None = None
    models: Sequence[pins.ModelPin] = ()
    vault_recipient: Path = VAULT_RECIPIENT

    def gcloud(self, *args: str, timeout: float = 60) -> Result:
        return self.shell.run(['gcloud', *args], timeout=timeout)


def _err(result: Result) -> str:
    lines = (result.stderr or result.stdout).strip().splitlines()
    return lines[-1][:200] if lines else f'exit {result.returncode}'


# --- local tools ----------------------------------------------------------------------------


def check_gcloud(ctx: Context) -> Check:
    result = ctx.gcloud('version', '--format=json')
    if result.returncode == 127:
        return Check('gcloud', FAIL, 'gcloud is not on PATH', 'install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install')
    if not result.ok:
        return Check('gcloud', FAIL, _err(result))
    return Check('gcloud', OK, f'Google Cloud SDK {result.json().get("Google Cloud SDK", "?")}')


def check_uv(ctx: Context) -> Check:
    result = ctx.shell.run(['uv', '--version'])
    if not result.ok:
        return Check('uv', FAIL, 'uv is not on PATH', 'install uv >= 0.13.5: https://docs.astral.sh/uv/')
    match = re.search(r'(\d+)\.(\d+)\.(\d+)', result.stdout)
    version = tuple(int(x) for x in match.groups()) if match else (0, 0, 0)
    if version < UV_MIN:
        return Check('uv', FAIL, result.stdout.strip(), 'uv self update  (pyproject requires >= 0.13.5)')
    return Check('uv', OK, result.stdout.strip())


def check_age(ctx: Context) -> Check:
    found = []
    for binary in ('age', 'age-keygen'):
        result = ctx.shell.run([binary, '--version'])
        if not result.ok:
            return Check('age', FAIL, f'{binary} is not on PATH', 'brew install age  (or apt install age): the vault needs age and age-keygen')
        found.append(f'{binary} {result.stdout.strip()}')
    return Check('age', OK, ', '.join(found))


def check_vault_recipient(ctx: Context) -> Check:
    path = ctx.vault_recipient
    if not path.exists():
        return Check('vault recipient', WARN, f'{path.name} not found', 'run `uv run arcforge vault keygen` (owner checklist step 1)')
    text = path.read_text().strip()
    if not text.startswith('age1'):
        return Check('vault recipient', FAIL, f'{path.name} does not hold an age recipient (age1…)', 'rerun `arcforge vault keygen`')
    return Check('vault recipient', OK, f'{path.name}: {text[:12]}…')


# --- project and access ---------------------------------------------------------------------


def check_auth(ctx: Context) -> Check:
    result = ctx.gcloud('auth', 'list', '--filter=status:ACTIVE', '--format=value(account)')
    account = result.stdout.strip().splitlines()[0] if result.ok and result.stdout.strip() else ''
    if not account:
        return Check('gcloud auth', FAIL, 'no active gcloud account', 'gcloud auth login && gcloud auth application-default login')
    return Check('gcloud auth', OK, account)


def check_project(ctx: Context) -> Check:
    project = ctx.cfg.project
    result = ctx.gcloud('projects', 'describe', project, '--format=value(lifecycleState)')
    if not result.ok:
        return Check('project', FAIL, f'cannot read {project}: {_err(result)}', f'ask the owner for access to {project}')
    configured = ctx.gcloud('config', 'get-value', 'project').stdout.strip()
    if configured != project:
        return Check('project', WARN, f'{project} is {result.stdout.strip()}, but the gcloud default project is {configured or "unset"}',
                     f'gcloud config set project {project}  (arcforge always passes --project, so this is cosmetic)')
    return Check('project', OK, f'{project} ({result.stdout.strip()})')


def check_vertex(ctx: Context) -> Check:
    result = ctx.gcloud('ai', 'models', 'list', f'--project={ctx.cfg.project}', f'--region={ctx.cfg.region}', '--limit=1', '--format=json')
    if not result.ok:
        return Check('vertex ai', FAIL, _err(result), f'enable aiplatform.googleapis.com and grant roles/aiplatform.user in {ctx.cfg.project}')
    return Check('vertex ai', OK, f'aiplatform reachable in {ctx.cfg.region}')


def check_secret(ctx: Context, secret: str) -> Check:
    name = f'secret {secret}'
    fix = (f'add {secret} in the GCP console (Secret Manager, project {ctx.cfg.project}). '
           'Never paste a token into chat or the repo.')
    described = ctx.gcloud('secrets', 'describe', secret, f'--project={ctx.cfg.project}', '--format=value(name)')
    if not described.ok:
        missing = 'NOT_FOUND' in described.stderr or 'not found' in described.stderr.lower()
        return Check(name, FAIL, 'missing' if missing else _err(described), fix)
    versions = ctx.gcloud('secrets', 'versions', 'list', secret, f'--project={ctx.cfg.project}',
                          '--filter=state:ENABLED', '--limit=1', '--format=value(name)')
    if not versions.ok or not versions.stdout.strip():
        return Check(name, FAIL, 'exists but has no enabled version', fix)
    return Check(name, OK, 'present (enabled version; value not read)')


QUOTA_NEEDS = {
    'NVIDIA_L4_GPUS': ('on-demand L4s', 1),
    'PREEMPTIBLE_NVIDIA_L4_GPUS': ('spot L4s', 1),
    'CPUS': ('vCPUs', 8),
    'SSD_TOTAL_GB': ('SSD GB (pd-balanced counts here)', 200),
}


def check_quota(ctx: Context) -> Check:
    result = ctx.gcloud('compute', 'regions', 'describe', ctx.cfg.region, f'--project={ctx.cfg.project}', '--format=json')
    if not result.ok:
        return Check('quota', FAIL, _err(result))
    quotas = {q['metric']: q for q in result.json().get('quotas', [])}
    need = dict(QUOTA_NEEDS)
    need['CPUS'] = ('vCPUs', ctx.cfg.spec['vcpus'])
    need['SSD_TOTAL_GB'] = (need['SSD_TOTAL_GB'][0], ctx.cfg.boot_disk_gb)
    short, parts = [], []
    for metric, (label, amount) in need.items():
        q = quotas.get(metric)
        free = (q['limit'] - q['usage']) if q else 0
        parts.append(f'{label} {free:g} free')
        if free < amount:
            short.append(metric)
    if not short:
        return Check('quota', OK, f'{ctx.cfg.region}: ' + ', '.join(parts))
    # Spot quota alone being short is survivable: the ladder falls back to on-demand.
    status = WARN if short == ['PREEMPTIBLE_NVIDIA_L4_GPUS'] and ctx.cfg.fallback else FAIL
    return Check('quota', status, f'short of {", ".join(short)}: ' + ', '.join(parts),
                 f'request more in the console (IAM & Admin > Quotas, region {ctx.cfg.region}) or wait for running VMs to finish')


def check_bucket(ctx: Context) -> Check:
    result = ctx.gcloud('storage', 'buckets', 'describe', f'gs://{ctx.cfg.bucket}', '--format=json')
    if not result.ok:
        return Check('bucket', FAIL, f'gs://{ctx.cfg.bucket}: {_err(result)}',
                     f'gcloud storage buckets create gs://{ctx.cfg.bucket} --location={ctx.cfg.region} --uniform-bucket-level-access')
    location = str(result.json().get('location', '')).lower()
    if location != ctx.cfg.region:
        return Check('bucket', WARN, f'gs://{ctx.cfg.bucket} is in {location}, not {ctx.cfg.region}: VM reads will cost egress')
    return Check('bucket', OK, f'gs://{ctx.cfg.bucket} ({location})')


def check_image(ctx: Context) -> Check:
    image = ctx.image or pins.load_image()
    if not image.ref:
        return Check('container', FAIL, 'no pinned image digest in arcforge/runner/pinned/image.json',
                     'python -m arcforge.runner image build')
    result = ctx.gcloud('artifacts', 'docker', 'images', 'describe', image.ref, '--format=json')
    if not result.ok:
        return Check('container', FAIL, f'{image.digest[:19]}…: {_err(result)}', 'python -m arcforge.runner image build')
    return Check('container', OK, f'{image.repository.rsplit("/", 1)[-1]}@{image.digest[:19]}… (built from {image.built_from or "?"})')


def check_boot_image(ctx: Context) -> Check:
    result = ctx.gcloud('compute', 'images', 'describe', ctx.cfg.boot_image, f'--project={ctx.cfg.boot_image_project}', '--format=json')
    if not result.ok:
        return Check('boot image', FAIL, f'{ctx.cfg.boot_image}: {_err(result)}', 'pin a current image in RunnerConfig.boot_image')
    info = result.json()
    deprecated = (info.get('deprecated') or {}).get('state')
    if info.get('status') != 'READY' or deprecated in ('OBSOLETE', 'DELETED'):
        return Check('boot image', FAIL, f'{ctx.cfg.boot_image} is {deprecated or info.get("status")}', 'pin a current image in RunnerConfig.boot_image')
    if deprecated == 'DEPRECATED':
        return Check('boot image', WARN, f'{ctx.cfg.boot_image} is deprecated', 'pin its successor in RunnerConfig.boot_image')
    return Check('boot image', OK, ctx.cfg.boot_image)


def check_runner_sa(ctx: Context) -> Check:
    sa = ctx.cfg.service_account
    fix = 'owner, once:\n    ' + '\n    '.join(iam.setup_commands(ctx.cfg))
    described = ctx.gcloud('iam', 'service-accounts', 'describe', sa, f'--project={ctx.cfg.project}', '--format=value(email,disabled)')
    if not described.ok:
        return Check('runner service account', FAIL, f'{sa} does not exist', fix)
    policy = ctx.gcloud('projects', 'get-iam-policy', ctx.cfg.project, '--flatten=bindings[].members',
                        f'--filter=bindings.members:serviceAccount:{sa}', '--format=value(bindings.role)')
    if not policy.ok:
        return Check('runner service account', WARN, f'{sa} exists; cannot read the project IAM policy: {_err(policy)}', fix)
    roles = set(policy.stdout.split())
    missing = [r for r in iam.PROJECT_ROLES if r not in roles]
    if iam.SECRET_ROLE not in roles:
        for secret in iam.SECRETS:
            binding = ctx.gcloud('secrets', 'get-iam-policy', secret, f'--project={ctx.cfg.project}', '--format=json')
            members = [m for b in (binding.json() or {}).get('bindings', []) if b.get('role') == iam.SECRET_ROLE
                       for m in b.get('members', [])] if binding.ok else []
            if f'serviceAccount:{sa}' not in members:
                missing.append(f'{iam.SECRET_ROLE} on {secret}')
    if missing:
        return Check('runner service account', FAIL, f'{sa} lacks {", ".join(missing)}', fix)
    return Check('runner service account', OK, f'{sa} ({", ".join(sorted(roles))})')


def _allows_iap_ssh(rule: dict, tags: set[str]) -> bool:
    if rule.get('direction') != 'INGRESS' or rule.get('disabled'):
        return False
    targets = set(rule.get('targetTags') or [])
    if targets and not targets & tags:
        return False
    sources = rule.get('sourceRanges') or []
    if IAP_RANGE not in sources and '0.0.0.0/0' not in sources:
        return False
    for allowed in rule.get('allowed') or []:
        if allowed.get('IPProtocol') in ('tcp', 'all'):
            ports = allowed.get('ports') or ['0-65535']
            for port in ports:
                low, _, high = port.partition('-')
                if int(low) <= 22 <= int(high or low):
                    return True
    return False


def check_iap_ssh(ctx: Context) -> Check:
    result = ctx.gcloud('compute', 'firewall-rules', 'list', f'--project={ctx.cfg.project}',
                        f'--filter=network ~ /{ctx.cfg.network}$', '--format=json')
    if not result.ok:
        return Check('iap ssh', WARN, f'cannot list firewall rules: {_err(result)}')
    rules = [r for r in result.json() or [] if _allows_iap_ssh(r, {NETWORK_TAG})]
    fix = (f'gcloud compute firewall-rules create arcforge-allow-iap-ssh --project={ctx.cfg.project} '
           f'--network={ctx.cfg.network} --direction=INGRESS --source-ranges={IAP_RANGE} --allow=tcp:22 '
           f'--target-tags={NETWORK_TAG}')
    if not rules:
        return Check('iap ssh', WARN, 'no ingress rule admits IAP to tcp:22 on runner VMs (jobs still run; only debugging SSH is affected)', fix)
    dedicated = [r['name'] for r in rules if IAP_RANGE in (r.get('sourceRanges') or [])]
    if dedicated:
        return Check('iap ssh', OK, f'IAP tcp:22 via {", ".join(dedicated)}; runners have no external address')
    return Check('iap ssh', OK, f'IAP reaches tcp:22 via the broad rule {rules[0]["name"]}; runners have no external '
                 'address, so nothing else can', fix)


def check_mirror(ctx: Context) -> Check:
    models = [m for m in (ctx.models or pins.load_models()) if m.default]
    missing = [m.key for m in models if read_manifest(ctx.shell, m, ctx.cfg.bucket) is None]
    if missing:
        return Check('model mirror', FAIL, f'not mirrored: {", ".join(missing)}', 'arcforge mirror  (from the forge VM, inside us-central1)')
    return Check('model mirror', OK, f'{len(models)} pinned revisions mirrored in gs://{ctx.cfg.bucket}/models/')


def _secret_check(secret: str) -> Callable[[Context], Check]:
    def check(ctx: Context) -> Check:
        return check_secret(ctx, secret)

    check.__name__ = f'check_secret_{secret}'
    return check


LOCAL_CHECKS: tuple[Callable[[Context], Check], ...] = (check_gcloud, check_uv, check_age, check_vault_recipient)
CLOUD_CHECKS: tuple[Callable[[Context], Check], ...] = (
    check_auth, check_project, check_vertex, *(_secret_check(s) for s in iam.SECRETS),
    check_quota, check_bucket, check_image, check_boot_image, check_runner_sa, check_iap_ssh, check_mirror,
)


def run_checks(ctx: Context, *, cloud: bool = True, workers: int = 8) -> list[Check]:
    """Run every check concurrently; results come back in the fixed order above."""
    checks = LOCAL_CHECKS + (CLOUD_CHECKS if cloud else ())

    def guarded(fn: Callable[[Context], Check]) -> Check:
        try:
            return fn(ctx)
        except Exception as error:  # noqa: BLE001 — one broken check must not hide the others
            name = getattr(fn, '__name__', 'check').removeprefix('check_').replace('_', ' ')
            return Check(name, FAIL, f'check crashed: {type(error).__name__}: {error}')

    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(guarded, checks))


def render(checks: Sequence[Check]) -> str:
    width = max(len(c.name) for c in checks)
    lines = []
    for c in checks:
        lines.append(f'{c.status:4}  {c.name:{width}}  {c.detail}')
        if c.status != OK and c.fix:
            lines.append(f'{"":4}  {"":{width}}  fix: {c.fix}')
    fails = sum(c.status == FAIL for c in checks)
    warns = sum(c.status == WARN for c in checks)
    lines.append('')
    summary = 'ready to launch' if not fails else f'{fails} blocking problem(s)'
    lines.append(summary + (f', {warns} warning(s)' if warns else ''))
    return '\n'.join(lines)


def to_json(checks: Sequence[Check]) -> str:
    return json.dumps({'ok': not any(c.status == FAIL for c in checks), 'checks': [asdict(c) for c in checks]}, indent=2)
