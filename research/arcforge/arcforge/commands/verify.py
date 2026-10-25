"""`arcforge verify rNN` — rebuild a recorded run from the cache and diff its artifact hashes.

Reads the run's manifest (the latest one for that run id in the cache, or --manifest), then
for every stage: checks the cache's copy, rebuilds the stage fresh from its recorded inputs,
and compares every artifact's sha256. Exits 0 when the rebuild is byte-identical, 1 otherwise.
This is M1's determinism check: two runs from the cache must be byte-identical.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from arcforge.core.cliutil import (
    EXIT_FAIL,
    EXIT_OK,
    add_cache_arg,
    add_repo_arg,
    default_repo_root,
    emit_json,
    guarded,
)


def _run(args: argparse.Namespace) -> int:
    from arcforge.core.cache import open_store  # noqa: PLC0415 — lazy, see commands/__init__
    from arcforge.core.dag import RunEnv  # noqa: PLC0415
    from arcforge.core.stages import REGISTRY  # noqa: PLC0415
    from arcforge.core.verify import load_manifest, render, verify_run  # noqa: PLC0415

    store = open_store(args.cache)
    data = args.manifest.read_bytes() if args.manifest else store.get_manifest(args.run)
    doc = load_manifest(data)
    if not args.manifest and doc['run']['id'] != args.run:
        print(f'arcforge verify: the latest manifest for {args.run} is for {doc["run"]["id"]}')
        return EXIT_FAIL
    report = verify_run(
        doc, store, RunEnv(repo_root=(args.repo or default_repo_root()).resolve()), REGISTRY
    )
    if args.json:
        emit_json(report)
    else:
        print(render(report))
    return EXIT_OK if report['ok'] else EXIT_FAIL


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'verify',
        help='rebuild a run from the cache and diff artifact hashes (exit 1 on any mismatch)',
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        'run', metavar='RUN', help='the run id whose latest manifest to verify, e.g. r00'
    )
    parser.add_argument(
        '--manifest', metavar='RUN_JSON', type=Path, help='verify this run.json instead'
    )
    add_cache_arg(parser)
    add_repo_arg(parser)
    parser.add_argument('--json', action='store_true', help='print the arc-verify/1 report as JSON')
    parser.set_defaults(func=guarded('verify', _run))
