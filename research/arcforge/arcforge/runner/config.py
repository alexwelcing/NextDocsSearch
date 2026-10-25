"""Runner settings: the `compute:` subtree of a run config, plus the fixed infrastructure names.

The program pins one shape of run: a g2-standard-8 with one NVIDIA L4, SPOT, in witching-606c6 /
us-central1, trying zones a, b, then c, falling back to on-demand, deleted after at most 3 h.
Everything here defaults to exactly that, so `RunnerConfig()` is the program's runner, and
`RunnerConfig.from_compute(config['compute'])` reads a run config's compute block exactly as
configs/arc-config-1.schema.json defines it (g2-standard-16 under the CPU-training fallback, say).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field, fields
from typing import Any

PROJECT = 'witching-606c6'
REGION = 'us-central1'
BUCKET = 'witching-606c6-arcforge'
AR_REPOSITORY = 'arcforge'
RUNNER_SA_NAME = 'arcforge-runner'
NAME_PREFIX = 'arc-run-'
# The runner's own label; `arcforge gc` deletes only instances that carry it.
RUN_LABEL = 'arcforge-run'
NETWORK_TAG = 'arcforge-runner'
# Google's IAP TCP-forwarding range: the only source the runner accepts SSH from.
IAP_RANGE = '35.235.240.0/20'

# The machine shapes the program allows. RAM is GiB; the L4 count is fixed by the shape.
SHAPES: dict[str, dict[str, int]] = {
    'g2-standard-8': {'vcpus': 8, 'ram_gib': 32, 'gpus': 1},
    'g2-standard-16': {'vcpus': 16, 'ram_gib': 64, 'gpus': 1},
}
PROVISIONING = ('spot', 'on_demand')


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class RunnerConfig:
    project: str = PROJECT
    region: str = REGION
    zones: tuple[str, ...] = (f'{REGION}-a', f'{REGION}-b', f'{REGION}-c')  # tried in this order
    shape: str = 'g2-standard-8'
    gpu: str = 'nvidia-l4'
    provisioning: str = 'spot'
    fallback: str | None = 'on_demand'
    max_run_hours: float = 3.0
    boot_disk_gb: int = 200
    boot_disk_type: str = 'pd-balanced'
    # Google's Deep Learning VM (Ubuntu 24.04, NVIDIA driver 580, CUDA 13.0 capable) with Docker
    # and the NVIDIA container toolkit baked in by `python -m arcforge.runner base-image build`
    # (baseimage.py). Pinned by image name, not family, so a driver bump is a reviewed change;
    # container/Dockerfile's CUDA base must stay at or below what the driver supports.
    boot_image: str = 'arcforge-runner-20261025-795f937'
    boot_image_project: str = PROJECT
    service_account: str = f'{RUNNER_SA_NAME}@{PROJECT}.iam.gserviceaccount.com'
    network: str = 'default'
    bucket: str = BUCKET
    labels: Mapping[str, str] = field(default_factory=lambda: {'managed-by': 'claude', 'purpose': 'arcforge'})

    def __post_init__(self) -> None:
        if self.shape not in SHAPES:
            raise ConfigError(f'compute.shape {self.shape!r} is not one of {sorted(SHAPES)}')
        if self.provisioning not in PROVISIONING:
            raise ConfigError(f'compute.provisioning must be one of {PROVISIONING}')
        if self.fallback not in (None, 'on_demand'):
            raise ConfigError("compute.fallback must be 'on_demand' or 'none'")
        if not 0 < self.max_run_hours <= 3:
            raise ConfigError('compute.max_run_hours must be in (0, 3]: a lost laptop must never leave a GPU billing')
        if not self.zones or any(not re.fullmatch(rf'{re.escape(self.region)}-[a-f]', z) for z in self.zones):
            raise ConfigError(f'compute.zones must be zones of {self.region}, e.g. [{self.region}-a, {self.region}-b]')

    @classmethod
    def from_compute(cls, compute: Mapping[str, Any] | None, **overrides: Any) -> RunnerConfig:
        """Build from a run config's `compute:` mapping. Unknown keys are an error, not ignored."""
        data = dict(compute or {})
        known = {f.name for f in fields(cls)}
        unknown = sorted(set(data) - known)
        if unknown:
            raise ConfigError(f'unknown compute keys: {unknown}')
        if 'zones' in data:
            region = data.get('region', REGION)
            # Full names, as configs/arc-config-1 writes them; bare letters are accepted too.
            data['zones'] = tuple(f'{region}-{z}' if len(z) == 1 else z for z in data['zones'])
        if data.get('fallback') == 'none':
            data['fallback'] = None
        if 'labels' in data:
            data['labels'] = {**cls().labels, **data['labels']}
        return cls(**{**data, **overrides})

    @property
    def zone_names(self) -> list[str]:
        return list(self.zones)

    @property
    def spec(self) -> dict[str, int]:
        return SHAPES[self.shape]

    @property
    def max_run_seconds(self) -> int:
        return int(self.max_run_hours * 3600)

    def provisioning_ladder(self, *, spot: bool = True) -> list[str]:
        """The provisioning models to try, in order. spot=False skips straight to on-demand."""
        ladder = ['spot'] if spot and self.provisioning == 'spot' else []
        if self.fallback == 'on_demand' or self.provisioning == 'on_demand' or not spot:
            ladder.append('on_demand')
        return ladder


def image_repository(project: str = PROJECT, region: str = REGION) -> str:
    return f'{region}-docker.pkg.dev/{project}/{AR_REPOSITORY}/arcforge'
