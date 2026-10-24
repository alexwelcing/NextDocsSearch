"""`arcforge` entry point.

Every subcommand is a module in arcforge/commands/ that exposes
`register(subparsers) -> None`, which adds its parser and sets `func` on it. Commands are
discovered by module name, so parallel workstreams each add their own file and never edit
this one.
"""

from __future__ import annotations

import argparse
import importlib
import pkgutil
import sys

from arcforge import __version__, commands


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog='arcforge', description=__doc__.splitlines()[0])
    parser.add_argument('--version', action='version', version=f'arcforge {__version__}')
    subparsers = parser.add_subparsers(dest='command', metavar='<command>')
    for info in sorted(pkgutil.iter_modules(commands.__path__), key=lambda m: m.name):
        if info.name.startswith('_'):
            continue
        module = importlib.import_module(f'{commands.__name__}.{info.name}')
        register = getattr(module, 'register', None)
        if callable(register):
            register(subparsers)
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
