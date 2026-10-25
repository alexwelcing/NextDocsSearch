"""Keep container/Dockerfile, uv.lock, pyproject and the runner's boot image in step."""

import re
import tomllib
from pathlib import Path

from arcforge.runner import baseimage, image
from arcforge.runner.config import RunnerConfig

ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = (ROOT / 'container' / 'Dockerfile').read_text()
# The newest CUDA major.minor each NVIDIA driver branch supports (NVIDIA's compatibility table).
DRIVER_CUDA = {
    '550': (12, 4),
    '570': (12, 8),
    '575': (12, 9),
    '580': (13, 0),
    '590': (13, 1),
    '595': (13, 2),
}


def test_base_images_are_pinned_by_digest():
    for arg in ('CUDA_IMAGE', 'UV_IMAGE'):
        line = re.search(rf'^ARG {arg}=(\S+)$', DOCKERFILE, re.M).group(1)
        assert re.search(r'@sha256:[0-9a-f]{64}$', line), line


def test_uv_matches_the_projects_required_version():
    pyproject = tomllib.loads((ROOT / 'pyproject.toml').read_text())
    required = pyproject['tool']['uv']['required-version'].lstrip('>=')
    assert f'ghcr.io/astral-sh/uv:{required}@' in DOCKERFILE


def test_cuda_base_fits_torchs_cuda_and_the_runners_driver():
    cuda = tuple(int(x) for x in image.cuda_version().split('.')[:2])
    lock = (ROOT / 'uv.lock').read_text()
    runtime = re.search(
        r'^name = "nvidia-cuda-runtime(?:-cu\d+)?"\nversion = "(\d+)\.(\d+)', lock, re.M
    )
    torch_cuda = (int(runtime.group(1)), int(runtime.group(2)))
    assert cuda[0] == torch_cuda[0], f'base CUDA {cuda} vs torch wheels {torch_cuda}'
    # The runner boots an image baked from this Deep Learning VM image (baseimage.py).
    driver = re.search(r'nvidia-(\d{3})', baseimage.SOURCE_IMAGE).group(1)
    assert max(cuda, torch_cuda) <= DRIVER_CUDA[driver], (
        f'driver {driver} supports CUDA {DRIVER_CUDA[driver]}'
    )


def test_image_installs_the_locked_gpu_and_cloud_extras():
    syncs = re.findall(r'^RUN uv sync (.+)$', DOCKERFILE, re.M)
    assert syncs and all(
        '--locked' in s and '--extra gpu' in s and '--extra cloud' in s and '--no-dev' in s
        for s in syncs
    )
    assert 'CUBLAS_WORKSPACE_CONFIG=:4096:8' in DOCKERFILE
    assert 'ENTRYPOINT ["arcforge"]' in DOCKERFILE


def test_build_context_ignore_file_keeps_what_the_dockerfile_copies():
    ignore = (ROOT / 'container' / '.gcloudignore').read_text()
    for path in ('pyproject.toml', 'uv.lock', 'README.md', 'arcforge/', 'container/Dockerfile'):
        assert f'!{path}' in ignore
    for copied in re.findall(r'^COPY (?!--from)(.+) \./?\S*$', DOCKERFILE, re.M):
        for part in copied.split():
            assert f'!{part}' in ignore or f'!{part}/' in ignore, part


def test_cloudbuild_pushes_to_the_us_central1_repository():
    recipe = (ROOT / 'container' / 'cloudbuild.yaml').read_text()
    assert 'us-central1-docker.pkg.dev/${PROJECT_ID}/arcforge/arcforge' in recipe
    assert '--file=container/Dockerfile' in recipe and 'ARCFORGE_COMMIT=${_COMMIT}' in recipe


def test_submit_argv(tmp_path):
    argv = image.submit_argv(RunnerConfig(), '3a74fb4c0ffe-dirty', source=tmp_path)
    assert argv[:4] == ['gcloud', 'builds', 'submit', str(tmp_path)]
    assert (
        '--region=us-central1' in argv
        and '--substitutions=_COMMIT=3a74fb4c0ffe-dirty' in argv
        and '--async' in argv
    )
    assert '--ignore-file=container/.gcloudignore' in argv


def test_build_waits_and_pins_the_pushed_digest(shell):
    repo = 'us-central1-docker.pkg.dev/witching-606c6/arcforge/arcforge'
    digest = 'sha256:' + 'e' * 64
    shell.on('builds submit', then=shell.ok({'id': 'b-1', 'status': 'QUEUED'}))
    shell.on(
        'builds describe',
        then=[
            shell.ok({'id': 'b-1', 'status': 'WORKING'}),
            shell.ok(
                {
                    'id': 'b-1',
                    'status': 'SUCCESS',
                    'results': {
                        'images': [
                            {'name': f'{repo}:abc', 'digest': digest},
                            {'name': f'{repo}:buildcache', 'digest': digest},
                        ]
                    },
                }
            ),
        ],
    )
    pin = image.build(
        shell,
        RunnerConfig(),
        commit='abc',
        now_utc='2026-10-24T12:00:00Z',
        sleep=lambda _s: None,
        log=lambda _m: None,
    )
    assert (
        pin.ref == f'{repo}@{digest}'
        and pin.built_from == 'abc'
        and pin.cuda == image.cuda_version()
    )
    assert pin.torch == image.locked_version('torch')


def test_a_failed_build_raises(shell):
    import pytest

    shell.on('builds submit', then=shell.ok({'id': 'b-2', 'status': 'QUEUED'}))
    shell.on(
        'builds describe',
        then=shell.ok({'id': 'b-2', 'status': 'FAILURE', 'statusDetail': 'step 0 failed'}),
    )
    with pytest.raises(image.BuildError, match='step 0 failed'):
        image.build(
            shell,
            RunnerConfig(),
            commit='abc',
            now_utc='t',
            sleep=lambda _s: None,
            log=lambda _m: None,
        )


def test_base_image_builder(shell):
    shell.on('instances create', then=shell.ok([{}]))
    shell.on(
        'instances describe',
        then=[
            shell.ok({'status': 'RUNNING'}),
            shell.ok({'status': 'STOPPING'}),
            shell.ok({'status': 'TERMINATED'}),
        ],
    )
    # Serial output is only served while the VM is up; once TERMINATED it reads back empty.
    shell.on(
        'get-serial-port-output',
        then=[
            shell.ok('startup-script: + apt-get update\n'),
            shell.ok(
                "startup-script: ++ echo 'ARCFORGE-BASE OK docker=x'\n"
                'startup-script: ARCFORGE-BASE OK docker=29.1.3 ctk=1.20.1\n'
            ),
            shell.ok(''),
        ],
    )
    shell.on('images create', then=shell.ok())
    shell.on('instances delete', then=shell.ok())
    name = baseimage.build(
        shell,
        RunnerConfig(),
        code_sha='3a74fb4c0ffe',
        date='20261025',
        sleep=lambda _s: None,
        log=lambda _m: None,
    )
    assert name == 'arcforge-runner-20261025-3a74fb4'
    create = shell.called('instances create')[0]
    assert (
        'arc-run-base-3a74fb4' in create
        and '--max-run-duration=3600s' in create
        and '--no-service-account' in create
    )
    (images,) = shell.called('images create')
    assert '--source-disk=arc-run-base-3a74fb4' in images and '--family=arcforge-runner' in images
    assert shell.called('instances delete')  # the builder never outlives the build


def test_base_image_failure_still_deletes_the_builder(shell):
    import pytest

    shell.on('instances create', then=shell.ok([{}]))
    shell.on(
        'instances describe',
        then=[shell.ok({'status': 'STOPPING'}), shell.ok({'status': 'TERMINATED'})],
    )
    shell.on(
        'get-serial-port-output', then=shell.ok('ARCFORGE-BASE FAILED line 12: apt-get update\n')
    )
    shell.on('instances delete', then=shell.ok())
    with pytest.raises(baseimage.BaseImageError, match='FAILED line 12'):
        baseimage.build(
            shell,
            RunnerConfig(),
            code_sha='3a74fb4',
            date='20261025',
            sleep=lambda _s: None,
            log=lambda _m: None,
        )
    assert shell.called('instances delete') and not shell.called('images create')


def test_base_image_script_pins_versions():
    script = baseimage.render_script()
    assert script.startswith(
        '#!/bin/bash\nDOCKER_VERSION=29.1.3-0ubuntu3~24.04.2\nCTK_VERSION=1.20.1-1\n'
    )
    assert (
        '"docker.io=${DOCKER_VERSION}"' in script
        and 'nvidia-ctk runtime configure --runtime=docker' in script
    )
