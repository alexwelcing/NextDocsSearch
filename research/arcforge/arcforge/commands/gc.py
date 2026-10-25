"""`arcforge gc` — delete labeled arc-run-* VMs older than 3 h (the janitor of last resort)."""

from __future__ import annotations

import argparse
import json


def run(args: argparse.Namespace) -> int:
    from arcforge.runner import gc
    from arcforge.runner.config import RunnerConfig
    from arcforge.runner.session import utc_now
    from arcforge.runner.shell import CommandError, SubprocessShell

    try:
        found = gc.collect(
            SubprocessShell(),
            RunnerConfig(project=args.project),
            now_utc=utc_now(),
            max_age_hours=args.max_age_hours,
            dry_run=args.dry_run,
        )
    except CommandError as error:
        print(f'arcforge gc: {error}')
        return 1
    if args.json:
        print(json.dumps([vars(s) for s in found], indent=2))
    elif not found:
        print(f'gc: no runner VM older than {args.max_age_hours} h')
    return 0


def register(subparsers) -> None:
    from arcforge.runner.config import PROJECT

    parser = subparsers.add_parser(
        'gc',
        help='delete labeled arc-run-* VMs older than 3 h',
        description=(
            'Delete every instance named arc-run-* that carries the arcforge-run label and was '
            'created more than --max-age-hours ago, whatever its status. Runner VMs already '
            'delete themselves (exit traps and --max-run-duration); this catches the rest.'
        ),
    )
    parser.add_argument(
        '--max-age-hours', type=float, default=3.0, help='age threshold (default: 3)'
    )
    parser.add_argument(
        '--dry-run', action='store_true', help='list what would be deleted, delete nothing'
    )
    parser.add_argument('--project', default=PROJECT, help=f'GCP project (default: {PROJECT})')
    parser.add_argument('--json', action='store_true', help='print the stale instances as JSON')
    parser.set_defaults(func=run)
