"""`arcforge version` — print the package version and the git commit it runs from."""

from __future__ import annotations

import subprocess

from arcforge import __version__


def _commit() -> str:
    try:
        out = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, check=True)
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return 'unknown'


def run(_args) -> int:
    print(f'arcforge {__version__} @ {_commit()}')
    return 0


def register(subparsers) -> None:
    parser = subparsers.add_parser('version', help='print version and git commit')
    parser.set_defaults(func=run)
