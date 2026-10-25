"""Bake the runner's boot image: Google's Deep Learning VM + Docker + the NVIDIA container toolkit.

Google's Deep Learning VM image has the NVIDIA driver the L4 needs (580, CUDA 13.0 capable) but
no Docker, and a runner VM, having no external address, cannot apt-get it at boot. So the boot
image is baked once: a short-lived builder VM (with an external address, no GPU) installs
pinned Docker and toolkit versions from baseimage.sh and powers off; its disk becomes
`arcforge-runner-<date>-<sha7>` in image family arcforge-runner; the builder is deleted. The new
name then goes into RunnerConfig.boot_image as a reviewed change.
"""

from __future__ import annotations

import re
import tempfile
import time
from collections.abc import Callable
from pathlib import Path

from arcforge.runner import lifecycle
from arcforge.runner.config import RunnerConfig
from arcforge.runner.shell import Shell, check

SOURCE_IMAGE = 'common-cu129-ubuntu-2404-nvidia-580-v20261019'
SOURCE_PROJECT = 'deeplearning-platform-release'
FAMILY = 'arcforge-runner'
DOCKER_VERSION = '29.1.3-0ubuntu3~24.04.2'  # Ubuntu noble-updates docker.io
CTK_VERSION = '1.20.1-1'  # nvidia.github.io/libnvidia-container stable
BUILDER_SHAPE = 'e2-standard-4'
SCRIPT = Path(__file__).resolve().parent / 'baseimage.sh'


class BaseImageError(RuntimeError):
    pass


def image_name(date: str, code_sha: str) -> str:
    """arcforge-runner-<yyyymmdd>-<sha7>."""
    if not re.fullmatch(r'\d{8}', date) or not re.fullmatch(r'[0-9a-f]{7,40}', code_sha):
        raise ValueError(f'bad image name parts {date!r} {code_sha!r}')
    return f'{FAMILY}-{date}-{code_sha[:7]}'


def render_script() -> str:
    body = SCRIPT.read_text().split('\n', 1)[1]
    return f'#!/bin/bash\nDOCKER_VERSION={DOCKER_VERSION}\nCTK_VERSION={CTK_VERSION}\n{body}'


def builder_argv(cfg: RunnerConfig, name: str, zone: str, script: Path) -> list[str]:
    return [
        'gcloud',
        'compute',
        'instances',
        'create',
        name,
        f'--project={cfg.project}',
        f'--zone={zone}',
        f'--machine-type={BUILDER_SHAPE}',
        '--provisioning-model=STANDARD',
        # The safety net: a builder that hangs is deleted after an hour, disk and all.
        '--max-run-duration=3600s',
        '--instance-termination-action=DELETE',
        f'--image={SOURCE_IMAGE}',
        f'--image-project={SOURCE_PROJECT}',
        '--boot-disk-size=60GB',
        '--boot-disk-type=pd-balanced',  # auto-deleted with the builder
        f'--network-interface=network={cfg.network}',  # an external address: apt needs the internet
        '--no-service-account',
        '--no-scopes',
        '--labels='
        + ','.join(
            f'{k}={v}' for k, v in sorted({**cfg.labels, 'arcforge-run': 'base-image'}.items())
        ),
        '--metadata=block-project-ssh-keys=TRUE',
        f'--metadata-from-file=startup-script={script}',
        '--format=json',
    ]


_VERDICT = re.compile(r'(?:^|startup-script: )ARCFORGE-BASE (.+)$', re.M)


def _wait_for_verdict(
    shell: Shell,
    cfg: RunnerConfig,
    builder: str,
    zone: str,
    *,
    sleep: Callable[[float], None],
    poll_seconds: float,
    timeout_s: float,
) -> str:
    """The builder's last ARCFORGE-BASE line, once it has powered off.

    The serial port is read while the VM is still up: Compute Engine stops serving a VM's serial
    output once it is TERMINATED.
    """
    verdict, context = '', ''
    waited = 0.0
    while True:
        resource = lifecycle.describe(shell, cfg, builder, zone)
        if resource is None:
            raise BaseImageError(f'{builder} disappeared before finishing')
        status = resource.get('status')
        if status in ('RUNNING', 'STOPPING'):
            serial = shell.run(
                [
                    'gcloud',
                    'compute',
                    'instances',
                    'get-serial-port-output',
                    builder,
                    f'--project={cfg.project}',
                    f'--zone={zone}',
                ],
                timeout=120,
            )
            lines = _VERDICT.findall(serial.stdout) if serial.ok else []
            if lines:
                verdict = lines[-1].strip()
                # What the script printed just before its verdict: the reason, on a failure.
                script_lines = [
                    ln.split('startup-script: ', 1)[1]
                    for ln in serial.stdout.splitlines()
                    if 'startup-script: ' in ln
                ]
                context = '\n'.join(script_lines[-40:])
        if status == 'TERMINATED':
            if not verdict:
                return 'no ARCFORGE-BASE line seen on the serial port before it stopped'
            return (
                verdict
                if verdict.startswith('OK')
                else f'{verdict}\n--- builder output ---\n{context}'
            )
        if waited > timeout_s:
            raise BaseImageError(f'{builder} still {status} after {timeout_s:.0f}s')
        sleep(poll_seconds)
        waited += poll_seconds


def build(
    shell: Shell,
    cfg: RunnerConfig,
    *,
    code_sha: str,
    date: str,
    sleep: Callable[[float], None] = time.sleep,
    poll_seconds: float = 15,
    timeout_s: float = 1800,
    log: Callable[[str], None] = print,
) -> str:
    """Build the image and return its name. The builder VM (and its disk) is always deleted."""
    name = image_name(date, code_sha)
    builder = lifecycle.instance_name('base', code_sha)
    zone = cfg.zone_names[0]
    with tempfile.TemporaryDirectory() as tmp:
        script = Path(tmp) / 'baseimage.sh'
        script.write_text(render_script())
        check(shell.run(builder_argv(cfg, builder, zone, script), timeout=600))
    log(f'base-image: builder {builder} started in {zone}')
    try:
        verdict = _wait_for_verdict(
            shell, cfg, builder, zone, sleep=sleep, poll_seconds=poll_seconds, timeout_s=timeout_s
        )
        if not verdict.startswith('OK'):
            raise BaseImageError(f'builder failed: {verdict}')
        log(f'base-image: {verdict}')
        check(
            shell.run(
                [
                    'gcloud',
                    'compute',
                    'images',
                    'create',
                    name,
                    f'--project={cfg.project}',
                    f'--source-disk={builder}',
                    f'--source-disk-zone={zone}',
                    f'--family={FAMILY}',
                    f'--storage-location={cfg.region}',
                    '--labels=' + ','.join(f'{k}={v}' for k, v in sorted(cfg.labels.items())),
                    f'--description=arcforge runner boot image: {SOURCE_IMAGE} + '
                    f'docker.io {DOCKER_VERSION} + '
                    f'nvidia-container-toolkit {CTK_VERSION}; built from {code_sha[:12]}',
                ],
                timeout=1800,
            )
        )
        log(f'base-image: created {name} (family {FAMILY})')
        return name
    finally:
        lifecycle.delete(shell, cfg, builder, zone)
        log(f'base-image: builder {builder} deleted')
