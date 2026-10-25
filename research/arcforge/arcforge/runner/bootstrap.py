"""Render a runner VM's startup-script: ARC_* assignments + the static body in bootstrap.sh."""

from __future__ import annotations

import re
import shlex
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path

BODY = Path(__file__).resolve().parent / 'bootstrap.sh'
_ENV_KEY = re.compile(r'[A-Z_][A-Z0-9_]*')
_FILE_NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]*')


@dataclass(frozen=True)
class Job:
    """What a runner VM executes.

    argv runs in the pinned container (`image`, repository@sha256:…) with the GPU attached; the
    image's entrypoint is `arcforge`, so argv is usually an arcforge subcommand (or set
    `entrypoint`, e.g. to python). host_script is bash run on the VM itself before the
    container starts, for checks that must see the host (the smoke test's nvidia-smi and docker
    versions). A job may have either or both.
    """

    argv: tuple[str, ...] = ()
    image: str | None = None
    env: Mapping[str, str] = field(default_factory=dict)
    host_script: str = ''
    entrypoint: str | None = None  # overrides the image's `arcforge` entrypoint (e.g. python)
    # {name: gs:// URL}: fetched by the host into the container's working directory, /work.
    files: Mapping[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.image and not self.host_script:
            raise ValueError('a Job needs an image (with argv) or a host_script')
        if self.image and '@sha256:' not in self.image:
            raise ValueError(f'runner images are pulled by digest only, got {self.image!r}')
        bad = [k for k in self.env if not _ENV_KEY.fullmatch(k)]
        if bad:
            raise ValueError(f'invalid environment variable names: {bad}')
        bad = [n for n, url in self.files.items() if not _FILE_NAME.fullmatch(n) or not url.startswith('gs://')]
        if bad:
            raise ValueError(f'job files are plain names fetched from gs:// URLs: {bad}')


def _array(name: str, items: Sequence[str]) -> str:
    return f'{name}=(' + ' '.join(shlex.quote(i) for i in items) + ')'


def render(job: Job, *, run_id: str, attempt: int, status_url: str) -> str:
    env = {**job.env, 'ARCFORGE_RUN_ID': run_id, 'ARCFORGE_ATTEMPT': str(attempt), 'ARCFORGE_STATUS_URL': status_url}
    docker_env: list[str] = []
    for key in sorted(env):
        docker_env += ['-e', f'{key}={env[key]}']
    header = [
        '#!/bin/bash',
        f'ARC_RUN_ID={shlex.quote(run_id)}',
        f'ARC_ATTEMPT={attempt}',
        f'ARC_STATUS_URL={shlex.quote(status_url.rstrip("/"))}',
        f'ARC_IMAGE={shlex.quote(job.image or "")}',
        f'ARC_HOST_SCRIPT={shlex.quote(job.host_script)}',
        _array('ARC_ENTRYPOINT', ['--entrypoint', job.entrypoint] if job.entrypoint else []),
        _array('ARC_ARGV', job.argv),
        _array('ARC_FILES', [f'{name}={job.files[name]}' for name in sorted(job.files)]),
        _array('ARC_DOCKER_ENV', docker_env),
    ]
    return '\n'.join(header) + '\n' + BODY.read_text()
