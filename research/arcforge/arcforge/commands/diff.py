"""`arcforge diff rA rB` — what changed between two runs: config, stage keys, artifacts, corpus.

Each side is a run id (its latest manifest in the cache) or a path to a run.json. With both
snapshots in the cache, the corpus is diffed record by record (added, changed, removed,
renamed). Exits 0; with --exit-code, exits 1 when the runs differ.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from arcforge.core.cliutil import EXIT_FAIL, EXIT_OK, add_cache_arg, emit_json, guarded


def _load(ref: str, store) -> dict:
    from arcforge.core.verify import load_manifest  # noqa: PLC0415

    path = Path(ref)
    if path.suffix == '.json' and path.is_file():
        return load_manifest(path.read_bytes())
    return load_manifest(store.get_manifest(ref))


def _run(args: argparse.Namespace) -> int:
    from arcforge.core.cache import open_store  # noqa: PLC0415 — lazy, see commands/__init__
    from arcforge.core.diffing import diff_runs, render  # noqa: PLC0415

    store = open_store(args.cache)
    report = diff_runs(_load(args.a, store), _load(args.b, store), store)
    if args.json:
        emit_json(report)
    else:
        print(render(report))
    return EXIT_FAIL if args.exit_code and not report['identical'] else EXIT_OK


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'diff',
        help='diff two runs: config, stage keys, artifact hashes and the corpus',
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        'a', metavar='RUN_A', help='a run id (latest manifest in the cache) or a run.json path'
    )
    parser.add_argument(
        'b', metavar='RUN_B', help='a run id (latest manifest in the cache) or a run.json path'
    )
    add_cache_arg(parser)
    parser.add_argument('--json', action='store_true', help='print the arc-diff/1 report as JSON')
    parser.add_argument('--exit-code', action='store_true', help='exit 1 when the runs differ')
    parser.set_defaults(func=guarded('diff', _run))
