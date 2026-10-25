"""The registered vault read points, and the rule that decides whether a read may happen.

This table is pre-registered (PREREG, rules.yaml vault.read, the run config's
read_points_by_branch) and is deliberately a constant here, not a setting: a read is refused
unless it is at a read point of the realized branch, inside that branch's budget, at a run not
already read, and after every earlier read. Nothing at read time can widen it.
"""

from __future__ import annotations

import re

READ_POINTS: dict[str, tuple[str, ...]] = {
    'N': ('r04', 'r06', 'r10'),
    'N-F': ('r04', 'r06', 'r10K'),
    'S-F': ('r04', 'r10K'),
    'S-C': ('r04', 'r07', 'r10'),
    'S-C-F': ('r04', 'r07', 'r10K'),
}
BRANCHES = tuple(READ_POINTS)
READS_MAX = 3
# Before R10 a read releases only the rounded aggregate; at R10/R10K the vault opens per query.
OPEN_RUNS = frozenset({'r10', 'r10K'})

_RUN_RE = re.compile(r'^[rR](\d{2})([kK]?)$')


class ReadRefused(Exception):
    """The read is outside the registered read points or the budget. Nothing was opened."""


def normalize_run(run_id: str) -> str:
    """'R04' -> 'r04', 'r10k' -> 'r10K'."""
    match = _RUN_RE.match(run_id.strip())
    if not match:
        raise ValueError(f'not a run id: {run_id!r} (expected r00..r10, or r05K..r10K)')
    return f'r{match.group(1)}' + ('K' if match.group(2) else '')


def normalize_branch(branch: str) -> str:
    value = branch.strip().upper()
    if value not in READ_POINTS:
        raise ValueError(f'not a branch: {branch!r} (one of {", ".join(BRANCHES)})')
    return value


def budget(branch: str) -> int:
    return min(len(READ_POINTS[branch]), READS_MAX)


def check_read(run_id: str, branch: str, released: list[str]) -> int:
    """The read index (1-based) this read would take, or ReadRefused saying why not.

    `released` lists the run ids already read, in log order.
    """
    points = READ_POINTS[branch]
    listed = ', '.join(points)
    if run_id not in points:
        raise ReadRefused(
            f'{run_id} is not a registered read point for branch {branch} (read points: {listed})'
        )
    strays = [run for run in released if run not in points]
    if strays:
        raise ReadRefused(
            f'the read log already has reads at {", ".join(strays)}, which are not read points '
            f'of branch {branch}; the log and the branch disagree'
        )
    if len(released) >= min(budget(branch), READS_MAX):
        raise ReadRefused(
            f'the read budget for branch {branch} is used ({len(released)} of {budget(branch)}: '
            f'{", ".join(released)})'
        )
    if run_id in released:
        raise ReadRefused(f'the vault was already read at {run_id}')
    later = [run for run in released if points.index(run) > points.index(run_id)]
    if later:
        raise ReadRefused(f'{run_id} comes before {", ".join(later)}, which was already read')
    return len(released) + 1
