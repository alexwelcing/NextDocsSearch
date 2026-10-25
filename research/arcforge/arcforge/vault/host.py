"""'Laptop only': recognize the machines a vault read must never run on.

The private key lives with the owner, so a read on a runner VM, in CI or in a container would
mean the key had been copied somewhere it must never be. These checks are cheap and stdlib-only;
the read refuses when any of them fires.
"""

from __future__ import annotations

import os
import socket
from collections.abc import Mapping
from pathlib import Path

DMI_FILES = (Path('/sys/class/dmi/id/product_name'), Path('/sys/class/dmi/id/bios_vendor'))
CONTAINER_MARKERS = (Path('/.dockerenv'), Path('/run/.containerenv'))


def runner_reason(
    environ: Mapping[str, str] | None = None,
    dmi_files: tuple[Path, ...] = DMI_FILES,
    container_markers: tuple[Path, ...] = CONTAINER_MARKERS,
    hostname: str | None = None,
) -> str | None:
    """Why this machine is not the owner's laptop, or None when nothing says it isn't."""
    env = os.environ if environ is None else environ
    if env.get('ARCFORGE_RUNNER'):
        return 'ARCFORGE_RUNNER is set (this is a runner VM or its container)'
    if env.get('GITHUB_ACTIONS') == 'true' or env.get('CI', '').lower() in ('1', 'true'):
        return 'this is a CI job'
    if env.get('KUBERNETES_SERVICE_HOST'):
        return 'this is a Kubernetes pod'
    for marker in container_markers:
        if marker.exists():
            return f'this is a container ({marker} exists)'
    for dmi in dmi_files:
        try:
            value = dmi.read_text(encoding='utf-8', errors='replace').strip()
        except OSError:
            continue
        if 'google' in value.lower():
            return f'this is a Google Compute Engine VM ({dmi} says {value!r})'
    name = socket.gethostname() if hostname is None else hostname
    if name.startswith('arc-run-'):
        return f'this is a runner VM (hostname {name})'
    return None
