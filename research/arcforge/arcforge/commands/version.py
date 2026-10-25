"""`arcforge version` — print the package version and the exact code it runs from."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from arcforge import __version__


def commit() -> str:
    """git describe of the checkout this package lives in, '-dirty' when it has local edits.

    ARCFORGE_COMMIT overrides it inside containers and wheels, where there is no checkout.
    """
    override = os.environ.get('ARCFORGE_COMMIT')
    if override:
        return override
    try:
        out = subprocess.run(
            ['git', 'describe', '--always', '--dirty', '--abbrev=12'],
            cwd=Path(__file__).resolve().parent,
            capture_output=True,
            text=True,
            check=True,
        )
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return 'unknown'


def run(_args) -> int:
    print(f'arcforge {__version__} @ {commit()}')
    return 0


def register(subparsers) -> None:
    parser = subparsers.add_parser('version', help='print version and git commit')
    parser.set_defaults(func=run)
