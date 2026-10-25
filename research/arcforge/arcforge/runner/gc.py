"""The janitor behind `arcforge gc`: delete runner VMs that outlived the 3-hour ceiling.

A runner VM normally disappears three ways: its own exit trap, the laptop's exit trap, or
--max-run-duration. gc is the fourth, for whatever slipped past all three (a VM powered off
because its service account could not delete itself, an instance created by hand for a test).
It only ever touches instances that carry the arcforge-run label AND an arc-run-* name.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from arcforge.runner import billing, lifecycle
from arcforge.runner.config import NAME_PREFIX, RUN_LABEL, RunnerConfig
from arcforge.runner.shell import Shell


@dataclass(frozen=True)
class Stale:
    name: str
    zone: str
    status: str
    created_utc: str
    age_hours: float
    run: str


def stale(instances: list[dict[str, Any]], *, now_utc: str, max_age_hours: float) -> list[Stale]:
    now = billing.parse_utc(now_utc)
    out = []
    for inst in instances:
        run = (inst.get('labels') or {}).get(RUN_LABEL)
        if not run or not inst['name'].startswith(NAME_PREFIX):
            continue
        age = (now - billing.parse_utc(inst['creationTimestamp'])).total_seconds() / 3600
        if age >= max_age_hours:
            zone = inst['zone'].rsplit('/', 1)[-1]
            out.append(
                Stale(
                    inst['name'],
                    zone,
                    inst.get('status', '?'),
                    inst['creationTimestamp'],
                    round(age, 2),
                    run,
                )
            )
    return sorted(out, key=lambda s: s.created_utc)


def collect(
    shell: Shell,
    cfg: RunnerConfig,
    *,
    now_utc: str,
    max_age_hours: float = 3.0,
    dry_run: bool = False,
    log: Callable[[str], None] = print,
) -> list[Stale]:
    """Find, and unless dry_run delete, every stale runner VM. Returns what it found."""
    found = stale(lifecycle.list_runners(shell, cfg), now_utc=now_utc, max_age_hours=max_age_hours)
    for s in found:
        verb = 'would delete' if dry_run else 'deleting'
        log(f'gc: {verb} {s.name} ({s.zone}, {s.status}, run {s.run}, {s.age_hours} h old)')
        if not dry_run:
            lifecycle.delete(shell, cfg, s.name, s.zone)
    return found
