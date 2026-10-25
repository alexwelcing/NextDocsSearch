"""`arcforge mirror` — copy pinned HF model revisions to gs://witching-606c6-arcforge/models/."""

from __future__ import annotations

import argparse
from pathlib import Path


def run(args: argparse.Namespace) -> int:
    from arcforge.runner import mirror, pins
    from arcforge.runner.session import utc_now
    from arcforge.runner.shell import CommandError, SubprocessShell

    shell = SubprocessShell()
    try:
        selected = mirror.select(pins.load_models(), args.keys, all_pins=args.all)
    except mirror.MirrorError as error:
        print(f'arcforge mirror: {error}')
        return 2

    if args.list:
        bad = 0
        for pin in selected:
            problems = mirror.verify(shell, pin, args.bucket)
            bad += bool(problems)
            state = 'ok' if not problems else '; '.join(problems[:3])
            print(f'{pin.key:22} {pin.repo}@{pin.revision[:12]}  {state}')
        return 1 if bad else 0

    failed = 0
    for pin in selected:
        try:
            resolved = mirror.resolve(pin)
            print(f'{pin.key}: {pin.repo}@{pin.revision} exists on the Hub, '
                  f'{len(resolved.files)} files, {resolved.total_bytes / 1e9:.2f} GB'
                  + (' (GATED)' if resolved.gated else ''))
            if args.check:
                for line in mirror.iter_lines(resolved):
                    print(line)
                continue
            workdir = args.workdir or mirror.default_workdir()
            mirror.mirror(shell, resolved, bucket=args.bucket, workdir=workdir, now_utc=utc_now())
        except (mirror.MirrorError, CommandError, OSError) as error:
            failed += 1
            print(f'arcforge mirror: {pin.key}: {error}')
    return 1 if failed else 0


def register(subparsers) -> None:
    from arcforge.runner.config import BUCKET

    parser = subparsers.add_parser(
        'mirror',
        help='copy pinned HF model revisions into the GCS model mirror',
        description=(
            'Copy the model revisions pinned in arcforge/runner/pinned/models.json from the '
            'Hugging Face Hub to gs://<bucket>/models/<owner>/<name>@<revision>/, verifying every '
            'file against the Hub\'s hashes and writing MANIFEST.json last. With no KEY, mirrors '
            'the default pins (not the pre-named fallbacks). Run it inside us-central1 (the forge '
            'VM): the copy streams through local disk.'
        ),
    )
    parser.add_argument('keys', nargs='*', metavar='KEY', help='model keys to mirror (default: every default pin)')
    parser.add_argument('--all', action='store_true', help='include the pre-named fallback models')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--check', action='store_true', help='only confirm the revisions exist on the Hub and list their files')
    mode.add_argument('--list', action='store_true', help='show each pin and whether its mirror is complete')
    parser.add_argument('--bucket', default=BUCKET, help=f'mirror bucket (default: {BUCKET})')
    parser.add_argument('--workdir', type=Path, default=None, help='scratch directory, one file at a time (default: ~/.cache/arcforge/mirror-tmp)')
    parser.set_defaults(func=run)
