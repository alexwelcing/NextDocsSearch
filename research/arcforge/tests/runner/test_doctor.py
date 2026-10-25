import json

import pytest

from arcforge import cli
from arcforge.runner import doctor, iam
from arcforge.runner.pins import ImagePin, ModelPin

SA = 'arcforge-runner@witching-606c6.iam.gserviceaccount.com'
DIGEST = 'sha256:' + 'c' * 64
QUOTAS = [
    {'metric': 'NVIDIA_L4_GPUS', 'limit': 8.0, 'usage': 1.0},
    {'metric': 'PREEMPTIBLE_NVIDIA_L4_GPUS', 'limit': 8.0, 'usage': 0.0},
    {'metric': 'CPUS', 'limit': 200.0, 'usage': 16.0},
    {'metric': 'SSD_TOTAL_GB', 'limit': 1429.0, 'usage': 300.0},
]
FIREWALL = [
    {'name': 'default-allow-ssh', 'direction': 'INGRESS', 'sourceRanges': ['0.0.0.0/0'],
     'allowed': [{'IPProtocol': 'tcp', 'ports': ['22']}], 'network': '.../networks/default'},
]


def healthy(shell, tmp_path):
    """A project where everything is in place."""
    shell.on('gcloud version', then=shell.ok({'Google Cloud SDK': '589.0.0'}))
    shell.on('uv --version', then=shell.ok('uv 0.13.5 (x86_64-unknown-linux-gnu)\n'))
    shell.on('age --version', then=shell.ok('v1.2.1\n'))
    shell.on('age-keygen --version', then=shell.ok('v1.2.1\n'))
    shell.on('auth list', then=shell.ok('owner@example.com\n'))
    shell.on('projects describe', then=shell.ok('ACTIVE\n'))
    shell.on('config get-value project', then=shell.ok('witching-606c6\n'))
    shell.on('ai models list', then=shell.ok([]))
    shell.on('secrets describe', then=shell.ok('projects/1/secrets/x\n'))
    shell.on('secrets versions list', then=shell.ok('projects/1/secrets/x/versions/1\n'))
    shell.on('regions describe', then=shell.ok({'quotas': QUOTAS}))
    shell.on('buckets describe', then=shell.ok({'location': 'US-CENTRAL1'}))
    shell.on('artifacts docker images describe', then=shell.ok({}))
    shell.on('compute images describe', then=shell.ok({'status': 'READY'}))
    shell.on('service-accounts describe', then=shell.ok(f'{SA}\tFalse\n'))
    shell.on('get-iam-policy witching-606c6', then=shell.ok(
        'roles/aiplatform.user\nroles/logging.logWriter\nroles/secretmanager.secretAccessor\n'))
    shell.on('firewall-rules list', then=shell.ok(FIREWALL))
    shell.on('storage cat', then=shell.ok('{"files": []}'))
    recipient = tmp_path / 'vault.recipient'
    recipient.write_text('age1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqs3290gq\n')
    return doctor.Context(
        shell=shell,
        image=ImagePin(repository='us-central1-docker.pkg.dev/witching-606c6/arcforge/arcforge', digest=DIGEST, built_from='abc'),
        models=[ModelPin(key='m', repo='O/M', revision='a' * 40, role='r')],
        vault_recipient=recipient,
    )


def by_name(checks):
    return {c.name: c for c in checks}


def test_a_healthy_project_is_ready(shell, tmp_path):
    checks = doctor.run_checks(healthy(shell, tmp_path))
    assert [c.name for c in checks] == [
        'gcloud', 'uv', 'age', 'vault recipient', 'gcloud auth', 'project', 'vertex ai',
        'secret hf-write-token', 'secret cf-workers-ai-token', 'quota', 'bucket', 'container', 'boot image',
        'runner service account', 'iap ssh', 'model mirror',
    ]
    assert {c.status for c in checks} == {doctor.OK}, [c for c in checks if c.status != doctor.OK]
    assert doctor.render(checks).endswith('ready to launch')
    assert json.loads(doctor.to_json(checks))['ok'] is True


def test_secret_values_are_never_read(shell, tmp_path):
    doctor.run_checks(healthy(shell, tmp_path))
    assert not shell.called('versions access')
    assert not shell.called('print-access-token')


def test_missing_secrets_fail_with_the_console_fix(shell, tmp_path):
    ctx = healthy(shell, tmp_path)
    shell.on('secrets describe', 'cf-workers-ai-token', then=shell.fail('ERROR: NOT_FOUND: Secret [cf-workers-ai-token] not found'))
    shell.on('secrets versions list', 'hf-write-token', then=shell.ok(''))
    checks = by_name(doctor.run_checks(ctx))
    assert checks['secret cf-workers-ai-token'].status == doctor.FAIL and checks['secret cf-workers-ai-token'].detail == 'missing'
    assert checks['secret hf-write-token'].detail == 'exists but has no enabled version'
    assert 'Never paste a token' in checks['secret hf-write-token'].fix
    assert '2 blocking problem(s)' in doctor.render(list(checks.values()))


def test_missing_runner_sa_prints_the_owner_commands(shell, tmp_path):
    ctx = healthy(shell, tmp_path)
    shell.on('service-accounts describe', then=shell.fail('NOT_FOUND'))
    check = by_name(doctor.run_checks(ctx))['runner service account']
    assert check.status == doctor.FAIL
    assert all(cmd in check.fix for cmd in iam.setup_commands(ctx.cfg))


def test_secret_role_may_be_granted_per_secret(shell, tmp_path):
    ctx = healthy(shell, tmp_path)
    shell.on('get-iam-policy witching-606c6', then=shell.ok('roles/aiplatform.user\nroles/logging.logWriter\n'))
    binding = {'bindings': [{'role': iam.SECRET_ROLE, 'members': [f'serviceAccount:{SA}']}]}
    shell.on('secrets get-iam-policy', then=shell.ok(binding))
    assert by_name(doctor.run_checks(ctx))['runner service account'].status == doctor.OK
    shell.on('secrets get-iam-policy', 'cf-workers-ai-token', then=shell.ok({'bindings': []}))
    check = by_name(doctor.run_checks(ctx))['runner service account']
    assert check.status == doctor.FAIL and 'on cf-workers-ai-token' in check.detail


@pytest.mark.parametrize(('metric', 'free', 'status'), [
    ('PREEMPTIBLE_NVIDIA_L4_GPUS', 0, doctor.WARN),  # on-demand fallback still works
    ('NVIDIA_L4_GPUS', 0, doctor.FAIL),
    ('SSD_TOTAL_GB', 100, doctor.FAIL),
])
def test_quota(shell, tmp_path, metric, free, status):
    ctx = healthy(shell, tmp_path)
    quotas = [{**q, 'usage': q['limit'] - free} if q['metric'] == metric else q for q in QUOTAS]
    shell.on('regions describe', then=shell.ok({'quotas': quotas}))
    check = by_name(doctor.run_checks(ctx))['quota']
    assert check.status == status and metric in check.detail


def test_unpinned_image_fails(shell, tmp_path):
    ctx = healthy(shell, tmp_path)
    ctx.image = ImagePin(repository='r', digest=None)
    check = by_name(doctor.run_checks(ctx))['container']
    assert check.status == doctor.FAIL and 'image build' in check.fix


def test_iap_rule_detection():
    tag = {'arcforge-runner'}
    assert doctor._allows_iap_ssh(FIREWALL[0], tag)
    iap = {'direction': 'INGRESS', 'sourceRanges': ['35.235.240.0/20'], 'allowed': [{'IPProtocol': 'tcp', 'ports': ['20-30']}],
           'targetTags': ['arcforge-runner']}
    assert doctor._allows_iap_ssh(iap, tag)
    assert not doctor._allows_iap_ssh({**iap, 'targetTags': ['hermitage']}, tag)
    assert not doctor._allows_iap_ssh({**iap, 'allowed': [{'IPProtocol': 'tcp', 'ports': ['5432']}]}, tag)
    assert not doctor._allows_iap_ssh({**iap, 'sourceRanges': ['10.0.0.0/8']}, tag)
    assert not doctor._allows_iap_ssh({**iap, 'disabled': True}, tag)


def test_missing_tools_and_recipient(shell, tmp_path):
    ctx = healthy(shell, tmp_path)
    shell.on('age --version', then=shell.fail('not found', 127))
    shell.on('uv --version', then=shell.ok('uv 0.9.0\n'))
    ctx.vault_recipient = tmp_path / 'absent'
    checks = by_name(doctor.run_checks(ctx, cloud=False))
    assert set(checks) == {'gcloud', 'uv', 'age', 'vault recipient'}
    assert checks['age'].status == doctor.FAIL and checks['uv'].status == doctor.FAIL
    assert checks['vault recipient'].status == doctor.WARN


def test_a_crashing_check_is_contained(shell, tmp_path):
    ctx = healthy(shell, tmp_path)
    shell.on('regions describe', then=shell.ok('not json'))
    check = by_name(doctor.run_checks(ctx))['quota']
    assert check.status == doctor.FAIL and 'crashed' in check.detail


def test_doctor_command_is_registered():
    args = cli.build_parser().parse_args(['doctor', '--local', '--json'])
    assert args.local and args.json
