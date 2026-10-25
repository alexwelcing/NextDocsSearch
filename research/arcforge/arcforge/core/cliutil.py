"""Shared plumbing for the runtime commands (plan, run, verify, diff, bench).

Exit codes, used the same way by every runtime command:
    0  ok
    1  the check failed (verify found a mismatch, a stage raised)
    2  usage error (argparse)
    3  unavailable here: a stub stage, a missing executor or extra (the CLI's stub code)
    4  the budget guard refused: the plan is above the ceiling, the cap or --budget
"""

from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from arcforge.core.config import ARCFORGE_ROOT

EXIT_OK = 0
EXIT_FAIL = 1
EXIT_UNAVAILABLE = 3
EXIT_BUDGET = 4


def default_repo_root() -> Path:
    """$ARCFORGE_REPO, else the NextDocsSearch checkout this package lives in."""
    override = os.environ.get('ARCFORGE_REPO')
    return Path(override).expanduser() if override else ARCFORGE_ROOT.parents[1]


def add_cache_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        '--cache',
        metavar='URL',
        help='cache location: a directory or gs://bucket/prefix '
        '(default $ARCFORGE_CACHE, else ~/.cache/arcforge; production gs://witching-606c6-arcforge/cache)',
    )


def add_repo_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        '--repo',
        metavar='DIR',
        type=Path,
        help='the NextDocsSearch checkout holding the corpus '
        '(default $ARCFORGE_REPO, else this checkout)',
    )


def add_set_arg(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        '--set',
        metavar='PATH=VALUE',
        action='append',
        default=[],
        help='override one config value (JSON-parsed), e.g. --set budget.contingency=0.2; '
        'repeatable',
    )


def guarded(
    name: str, body: Callable[[argparse.Namespace], int]
) -> Callable[[argparse.Namespace], int]:
    """Turn the runtime's expected failures into one-line messages and exit codes."""

    def run(args: argparse.Namespace) -> int:
        from arcforge.core.cache import CacheError  # noqa: PLC0415
        from arcforge.core.config import ConfigError  # noqa: PLC0415
        from arcforge.core.corpus import CorpusError  # noqa: PLC0415
        from arcforge.core.dag import StageError, StageNotImplemented  # noqa: PLC0415
        from arcforge.core.executor import ExecutorUnavailable  # noqa: PLC0415

        try:
            return body(args)
        except (StageNotImplemented, ExecutorUnavailable) as error:
            print(f'arcforge {name}: {error}', file=sys.stderr)
            return EXIT_UNAVAILABLE
        except (ConfigError, CacheError, CorpusError, StageError) as error:
            print(f'arcforge {name}: {error}', file=sys.stderr)
            return EXIT_FAIL
        except ModuleNotFoundError as error:
            print(
                f'arcforge {name}: needs {error.name}, which is not installed here '
                '(run it with `uv run arcforge ...`)',
                file=sys.stderr,
            )
            return EXIT_UNAVAILABLE

    return run


def split_csv(value: str | None) -> list[str]:
    return [part.strip() for part in (value or '').split(',') if part.strip()]


def emit_json(doc: Any) -> None:
    from arcforge.core.hashing import pretty_json  # noqa: PLC0415

    sys.stdout.write(pretty_json(doc).decode('utf-8'))
