"""execute_remote against the fake cloud: the runtime's arc-vm-request/1 contract, end to end."""

import functools
import json
from pathlib import Path

import pytest

from arcforge import runner
from arcforge.runner import remote
from arcforge.runner.pins import ImagePin
from arcforge.runner.session import RunnerError, RunnerSession
from arcforge.runner.shell import Result

SHA = '3a74fb4c0ffee0000000000000000000000000ab'
IMAGE = ImagePin(
    repository='us-central1-docker.pkg.dev/witching-606c6/arcforge/arcforge',
    digest='sha256:' + 'a' * 64,
    built_from=SHA,
)
COMPUTE = {
    'project': 'witching-606c6',
    'region': 'us-central1',
    'zones': ['us-central1-a', 'us-central1-b', 'us-central1-c'],
    'shape': 'g2-standard-8',
    'gpu': 'nvidia-l4',
    'provisioning': 'spot',
    'fallback': 'on_demand',
    'max_run_hours': 3,
}
SPEC = {
    'schema': 'arc-vm-request/1',
    'run': {'id': 'r00', 'branch': 'N', 'seed': 1729, 'config_sha256': 'c' * 64},
    'config': {'run': {'id': 'r00'}, 'compute': COMPUTE},
    'stages': ['S3', 'S4'],
    'force': [],
    'cache_url': 'gs://witching-606c6-arcforge/cache',
    'budget_usd': 20,
    'plan_usd': 11.8,
    'compute': COMPUTE,
    'argv': [
        'arcforge',
        'run',
        'config.json',
        '--executor',
        'local',
        '--cache',
        'gs://witching-606c6-arcforge/cache',
        '--stages',
        'S3,S4',
        '--budget',
        '20',
    ],
}


@pytest.fixture
def wired(make_cloud, rates, monkeypatch):
    monkeypatch.setenv('ARCFORGE_COMMIT', SHA)

    def build(plans):
        cloud = make_cloud(plans)
        scripts = []
        real = cloud.run

        def run(argv, **kw):
            argv = tuple(argv)
            joined = ' '.join(argv)
            if 'instances create' in joined:
                path = next(a for a in argv if a.startswith('--metadata-from-file=startup-script='))
                scripts.append(Path(path.split('=', 2)[2]).read_text())
            if 'storage cp -' in joined:
                cloud.calls.append(argv)
                cloud.objects[argv[4]] = kw.get('input')
                return Result(argv, 0)
            return real(argv, **kw)

        cloud.run = run
        cloud.objects['gs://witching-606c6-arcforge/cache/runs/r00/latest'] = 'f' * 64 + '\n'
        factory = functools.partial(
            RunnerSession, rates=rates, clock=cloud.clock, sleep=cloud.sleep, poll_seconds=60
        )
        call = functools.partial(
            remote.execute_remote,
            shell=cloud,
            session_factory=factory,
            image=IMAGE,
            log=lambda _m: None,
        )
        return cloud, scripts, call

    return build


def test_a_run_comes_back_with_its_manifest_and_booking(wired):
    cloud, scripts, call = wired({1: [(60, 'running'), (900, ('done', 0))]})
    reply = call(SPEC)
    assert reply['schema'] == 'arc-vm-reply/1' and reply['manifest_sha256'] == 'f' * 64
    assert reply['container_digest'] == IMAGE.digest and reply['code_sha'] == SHA
    assert reply['vm']['instances'][0]['name'] == 'arc-run-r00-3a74fb4'
    assert set(reply['rates']) == {'spot', 'on_demand'}
    # The resolved config travels through GCS into the container's working directory.
    assert (
        json.loads(cloud.objects['gs://witching-606c6-arcforge/runs/r00/vm/config.json'])
        == SPEC['config']
    )
    (script,) = scripts
    assert 'ARC_FILES=(config.json=gs://witching-606c6-arcforge/runs/r00/vm/config.json)' in script
    assert (
        'ARC_ARGV=(run config.json --executor local --cache gs://witching-606c6-arcforge/cache '
        '--stages S3,S4 --budget 20)' in script
    )
    assert f'ARC_IMAGE={IMAGE.ref}' in script
    assert cloud.instances == {}


def test_a_preempted_run_resumes_and_books_both_vms(wired):
    _, scripts, call = wired({1: [(600, 'preempt')], 2: [(300, ('done', 0))]})
    reply = call(SPEC)
    assert [i['provisioning'] for i in reply['vm']['instances']] == ['SPOT', 'SPOT']
    assert reply['vm']['preemptions'] == 1
    assert (
        scripts[0]
        .replace('ARC_ATTEMPT=1', 'ARC_ATTEMPT=2')
        .replace('/vm/arc-run-r00-3a74fb4', '/vm/arc-run-r00-3a74fb4-2')
        .replace('ARCFORGE_ATTEMPT=1', 'ARCFORGE_ATTEMPT=2')
        == scripts[1]
    )  # the same job, resumed


def test_a_failed_job_raises_with_its_log(wired):
    cloud, _, call = wired({1: [(60, ('done', 4))]})
    with pytest.raises(RunnerError, match='exited 4.*job.log'):
        call(SPEC)
    assert cloud.instances == {}


@pytest.mark.parametrize(
    ('patch', 'message'),
    [
        ({'schema': 'arc-vm-request/0'}, 'arc-vm-request/1'),
        ({'argv': ['python', 'x']}, 'arcforge command line'),
        ({'cache_url': '/tmp/cache'}, 'gs://'),
    ],
)
def test_bad_requests_are_refused_before_any_vm(wired, patch, message):
    cloud, _, call = wired({})
    with pytest.raises(RunnerError, match=message):
        call({**SPEC, **patch})
    assert not cloud.created


def test_the_package_exposes_the_hook():
    assert callable(runner.execute_remote)


def test_the_runtime_finds_the_hook_and_its_spec_validates(tmp_path):
    """The other side of the contract: arcforge/core/executor.py builds the spec we accept."""
    from arcforge.core.config import load_config
    from arcforge.core.dag import RunEnv
    from arcforge.core.executor import RunRequest, VMExecutor, vm_spec
    from arcforge.runner.config import RunnerConfig

    assert VMExecutor().hook() is runner.execute_remote
    spec = vm_spec(
        RunRequest(
            config=load_config('r00'),
            stages=['S3'],
            cache_url='gs://witching-606c6-arcforge/cache',
            env=RunEnv(tmp_path),
            budget_usd=20,
            plan_usd=11.8,
        )
    )
    remote._validate(spec)
    cfg = RunnerConfig.from_compute(spec['compute'])
    assert cfg == RunnerConfig()  # configs/r00.yaml asks for exactly the program's runner
