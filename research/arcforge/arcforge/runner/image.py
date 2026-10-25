"""Build the runner container with Cloud Build and pin its digest.

`python -m arcforge.runner image build` submits research/arcforge to Cloud Build in us-central1
(container/cloudbuild.yaml), waits, and writes the pushed digest into pinned/image.json. Nothing
is built on the laptop: the Mac has neither the disk nor the docker daemon for a CUDA image.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path

from arcforge.runner import pins
from arcforge.runner.config import RunnerConfig, image_repository
from arcforge.runner.shell import Shell, check, gcloud_json

PACKAGE_ROOT = Path(__file__).resolve().parents[2]  # research/arcforge
DOCKERFILE = PACKAGE_ROOT / 'container' / 'Dockerfile'
UV_LOCK = PACKAGE_ROOT / 'uv.lock'
DONE = {'SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED', 'EXPIRED'}


class BuildError(RuntimeError):
    pass


def cuda_version(dockerfile: Path = DOCKERFILE) -> str:
    match = re.search(r'^ARG CUDA_IMAGE=nvidia/cuda:(\d+\.\d+\.\d+)-', dockerfile.read_text(), re.M)
    if not match:
        raise BuildError('container/Dockerfile has no ARG CUDA_IMAGE=nvidia/cuda:<x.y.z>-…')
    return match.group(1)


def locked_version(package: str, lock: Path = UV_LOCK) -> str | None:
    match = re.search(rf'^name = "{re.escape(package)}"\nversion = "([^"]+)"', lock.read_text(), re.M)
    return match.group(1) if match else None


def tag_for(commit: str) -> str:
    tag = re.sub(r'[^A-Za-z0-9_.-]', '-', commit)[:128]
    if not tag or tag == 'unknown':
        raise BuildError('cannot tag an image without a commit (is this a git checkout?)')
    return tag


def submit_argv(cfg: RunnerConfig, commit: str, source: Path = PACKAGE_ROOT) -> list[str]:
    return [
        'gcloud', 'builds', 'submit', str(source),
        f'--project={cfg.project}',
        f'--region={cfg.region}',
        '--config=container/cloudbuild.yaml',
        '--ignore-file=container/.gcloudignore',
        f'--substitutions=_COMMIT={tag_for(commit)}',
        '--async',
        '--format=json',
    ]


def build(
    shell: Shell,
    cfg: RunnerConfig,
    *,
    commit: str,
    now_utc: str,
    sleep: Callable[[float], None],
    poll_seconds: float = 20,
    log: Callable[[str], None] = print,
) -> pins.ImagePin:
    """Submit, wait for the build, and return the pin of what it pushed (not yet written)."""
    submitted = check(shell.run(submit_argv(cfg, commit), timeout=900)).json()
    build_id = submitted['id'] if 'id' in submitted else submitted['metadata']['build']['id']
    log(f'image: Cloud Build {build_id} submitted (logs: gcloud builds log {build_id} --region={cfg.region})')
    status = submitted.get('status', 'QUEUED')
    info = submitted
    while status not in DONE:
        sleep(poll_seconds)
        info = gcloud_json(shell, ['builds', 'describe', build_id, f'--project={cfg.project}', f'--region={cfg.region}'])
        if info.get('status') != status:
            status = info.get('status', '?')
            log(f'image: {status}')
    if status != 'SUCCESS':
        raise BuildError(f'Cloud Build {build_id} ended {status}: {info.get("statusDetail", "")}')
    images = (info.get('results') or {}).get('images') or []
    repository = image_repository(cfg.project, cfg.region)
    digests = [i['digest'] for i in images if i.get('name', '').startswith(repository)]
    if len(digests) != 1:
        raise BuildError(f'expected one pushed {repository} image, got {images}')
    return pins.ImagePin(
        repository=repository,
        digest=digests[0],
        built_from=commit,
        built_utc=now_utc,
        cuda=cuda_version(),
        torch=locked_version('torch'),
    )
