"""`arcforge bench materialize` — rebuild ARC-Bench v1's text from the public repo (stub).

ARC-Bench v1 is published as POINTERS plus derived artifacts, never record text: no record text
is redistributed until the owner chooses a licence. Materializing turns the pointers back into
text and proves every byte matches.

Inputs
  --pointers FILE   the v1 pointer file from the arc-bench dataset (AlexWelcing/arc-bench):
                    the S0 git SHA; for each chunk its slug, block range [b0, b1), character
                    offsets, lib/retrieval chunk id (sha256(chunkerVersion|embedText), 16 hex)
                    and the sha256 of its text; plus every query, qrel and graph (none of
                    which is record text).
  the public repo   github.com/alexwelcing/NextDocsSearch at that SHA: public/arc/records/
                    <slug>.json, read through git, never from a worktree (--repo, default this
                    checkout; the SHA must be fetchable).
Outputs
  --out DIR         chunks.jsonl (each pointer with its text), records/<slug>.json at the SHA,
                    and materialize.json: the SHA, the counts, and every hash checked.
Exit status
  0 when every chunk id and text sha256 matches, 1 on any mismatch or missing record.

Status: not implemented. The pointer format is frozen with v1 at M2 (S0 + S1's chunker v2);
until then this command documents the contract and exits 3.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from arcforge.core.cliutil import EXIT_UNAVAILABLE

USAGE = 2


def _materialize(_args: argparse.Namespace) -> int:
    print(
        'arcforge bench materialize: not implemented yet; the ARC-Bench v1 pointer format is frozen '
        'at M2. Contract: arcforge bench materialize --help',
        file=sys.stderr,
    )
    return EXIT_UNAVAILABLE


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'bench',
        help='ARC-Bench tools: materialize (stub)',
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest='bench_command', metavar='<bench command>')
    materialize = sub.add_parser(
        'materialize',
        help="rebuild v1's text from the public repo at the pinned SHA and verify every hash (stub)",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    materialize.add_argument('--pointers', metavar='FILE', type=Path, help='the ARC-Bench v1 pointer file')
    materialize.add_argument('--repo', metavar='DIR', type=Path, help='a NextDocsSearch clone that has the S0 SHA')
    materialize.add_argument('--out', metavar='DIR', type=Path, help='where to write chunks.jsonl, records/ and materialize.json')
    materialize.set_defaults(func=_materialize)

    def _help(_args: argparse.Namespace) -> int:
        parser.print_help()
        return USAGE

    parser.set_defaults(func=_help)
