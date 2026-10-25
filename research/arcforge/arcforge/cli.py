"""`arcforge` entry point.

Every subcommand is a public module in arcforge/commands/ that exposes
`register(subparsers) -> None`, which adds its parser and sets `func` on it. Commands are
discovered by module name, so parallel workstreams each add their own file and never edit
this one.

A command module that fails to import (a syntax error, or a missing optional dependency on a
machine without the gpu/cloud extras) must not take the rest of the CLI down with it: the
owner desk and vault have to run under a bare system python3. Such a module is registered as
a stub that reports why it is unavailable. Set ARCFORGE_STRICT_COMMANDS=1 (CI and the tests
do) to make any load failure fatal instead.
"""

from __future__ import annotations

import argparse
import importlib
import os
import pkgutil
import sys

if sys.version_info < (3, 11):
    sys.exit(
        f'arcforge needs Python 3.11+ (this is {sys.version.split()[0]}). '
        'On macOS use /opt/homebrew/bin/python3 or `uv run arcforge`.'
    )

from arcforge import __version__, commands  # noqa: E402

DESCRIPTION = 'arcforge: the run pipeline for RE-MEANING (arc-lexeme)'


def _strict() -> bool:
    return os.environ.get('ARCFORGE_STRICT_COMMANDS') == '1'


def _unavailable(subparsers, name: str, error: BaseException) -> None:
    reason = f'{type(error).__name__}: {error}'
    parser = subparsers.add_parser(name, help=f'unavailable ({reason})')

    def run(_args) -> int:
        print(f'arcforge {name}: unavailable on this machine — {reason}', file=sys.stderr)
        return 3

    parser.set_defaults(func=run)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog='arcforge', description=DESCRIPTION)
    parser.add_argument('--version', action='version', version=f'arcforge {__version__}')
    subparsers = parser.add_subparsers(dest='command', metavar='<command>')
    for info in sorted(pkgutil.iter_modules(commands.__path__), key=lambda m: m.name):
        if info.name.startswith('_'):
            continue
        try:
            module = importlib.import_module(f'{commands.__name__}.{info.name}')
            register = getattr(module, 'register', None)
            if not callable(register):
                raise AttributeError(f'arcforge.commands.{info.name} has no register(subparsers)')
            register(subparsers)
        except Exception as error:  # noqa: BLE001 — isolate one bad command from the rest
            if _strict():
                raise
            _unavailable(subparsers, info.name, error)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, 'func', None):
        parser.print_help()
        return 2
    return int(args.func(args) or 0)


if __name__ == '__main__':
    sys.exit(main())
