"""`python -m arcforge.fable`: the orchestrator's side of the Fable packet interface.

  pack gold-audit|signoff|blind|mismatch   write a packet; print its root, id and attempt-1 dir
  check PACKET --session ID --model NAME   validate the agent's output.json
                                           exit 0 accepted, 10 retry in the printed fresh dir,
                                           20 failed closed
  compare BLIND_PACKET --verdicts F...     the blind pass vs the reported verdicts (comparison.json)
  record PACKET                            the report.json fable[] entry
  repair PACKET --diff FILE [--rules ...]  resubmit a refused sign-off with the listed defects
                                           corrected (A0: at most 2 repairs; exit 30 = halted)
  mark-missing PACKET --reason TEXT        an end review that never came

The handoff is described in arcforge/fable/README.md.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

EXIT_OK, EXIT_ERROR, EXIT_USAGE, EXIT_UNAVAILABLE, EXIT_RETRY, EXIT_FAILED = 0, 1, 2, 3, 10, 20
EXIT_HALTED = 30
SIGNOFF_ARGS = (
    'prereg', 'rules', 'schema', 'lint', 'report', 'verdicts', 'bench-card', 'amendment-a0',
    'witness', 'model-choice', 'contamination', 'provenance', 'panel', 'quarantine',
)  # fmt: skip


def _print(obj: object) -> None:
    print(json.dumps(obj, indent=1))


def _shape(text: str | None) -> tuple[int, int] | None:
    if text in (None, 'any'):
        return None
    queries, _, candidates = text.partition('x')
    return int(queries), int(candidates)


def cmd_pack(args: argparse.Namespace) -> int:
    from arcforge.fable import packer

    common = {'root': args.root, 'allow_in_repo': args.allow_in_repo}
    if args.kind == 'gold-audit':
        packet = packer.pack_gold_audit(args.pairs, args.rubric, shape=_shape(args.shape), **common)
    elif args.kind == 'signoff':
        files = {name.replace('-', '_'): getattr(args, name.replace('-', '_')) for name in SIGNOFF_ARGS}
        packet = packer.pack_signoff(**files, **common)
    elif args.kind == 'blind':
        packet = packer.pack_blind(
            prereg=args.prereg, rules=args.rules, verdicts=args.verdicts, **common
        )
    else:
        packet = packer.pack_mismatch(
            prereg=args.prereg, rules=args.rules, writeup=args.writeup, reports=args.reports,
            comparison=args.comparison, **common,
        )  # fmt: skip
    _print(_packed(packet))
    return EXIT_OK


def _packed(packet) -> dict:
    ledger = json.loads(packet.ledger_path.read_text(encoding='utf-8'))
    open_attempt = next((a for a in reversed(ledger['attempts']) if a['outcome'] is None), None)
    return {
        'packet_root': str(packet.root),
        'packet_sha256': packet.sha256,
        'kind': packet.manifest['kind'],
        'role': packet.manifest['role'],
        'repair_cycle': packet.manifest.get('repair_cycle'),
        'workdir': None if open_attempt is None else str(packet.workdir(open_attempt['attempt'])),
        'status': ledger['status'],
    }


def cmd_check(args: argparse.Namespace) -> int:
    from arcforge.fable.ledger import check

    result = check(args.packet, session=args.session, model=args.model)
    _print(result.to_json())
    if result.status == 'halted':
        return EXIT_HALTED
    return {'accepted': EXIT_OK, 'retry': EXIT_RETRY, 'failed_closed': EXIT_FAILED}[result.decision]


def cmd_compare(args: argparse.Namespace) -> int:
    from arcforge.fable.blind import compare
    from arcforge.fable.ledger import accepted_output
    from arcforge.fable.packer import PacketError, load, sha256_bytes

    packet = load(args.packet)
    if packet.manifest['kind'] != 'blind_recompute':
        raise PacketError('compare reads an accepted blind_recompute packet')
    output = accepted_output(args.packet)
    if output is None:
        raise PacketError(f'{args.packet} has no accepted output')
    docs = [json.loads(Path(p).read_text(encoding='utf-8')) for p in args.verdicts]
    table = compare(
        output['result'],
        docs,
        blind_packet_sha256=packet.sha256,
        blind_output_sha256=sha256_bytes((packet.root / 'output.json').read_bytes()),
    )
    text = json.dumps(table, indent=1) + '\n'
    if args.out:
        Path(args.out).write_text(text, encoding='utf-8')
    print(text, end='')
    return EXIT_OK


def cmd_record(args: argparse.Namespace) -> int:
    from arcforge.fable.ledger import record

    _print(record(args.packet))
    return EXIT_OK


def cmd_repair(args: argparse.Namespace) -> int:
    import json as _json

    from arcforge.fable.ledger import _ledger, repair
    from arcforge.fable.packer import PacketError, load

    overrides = {
        name.replace('-', '_'): getattr(args, name.replace('-', '_'))
        for name in SIGNOFF_ARGS
        if getattr(args, name.replace('-', '_'), None)
    }
    try:
        packet = repair(
            args.packet, args.diff, overrides, root=args.root, allow_in_repo=args.allow_in_repo
        )
    except PacketError as error:
        if _ledger(load(args.packet))['status'] == 'halted':
            print(_json.dumps({'status': 'halted', 'error': str(error)}, indent=1))
            return EXIT_HALTED
        raise
    _print(_packed(packet))
    return EXIT_OK


def cmd_mark_missing(args: argparse.Namespace) -> int:
    from arcforge.fable.ledger import mark_missing

    _print(mark_missing(args.packet, args.reason))
    return EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog='python -m arcforge.fable',
        description=__doc__.split('\n\n', 1)[1] if __doc__ else None,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest='command', metavar='<command>', required=True)

    pack = sub.add_parser('pack', help='write a packet and its first working directory')
    pack.add_argument(
        '--root', help='packet root (default: $ARCFORGE_FABLE_DIR, else ~/.cache/arcforge/fable)'
    )
    pack.add_argument('--allow-in-repo', action='store_true', help=argparse.SUPPRESS)
    kinds = pack.add_subparsers(
        dest='kind', metavar='<gold-audit|signoff|blind|mismatch>', required=True
    )
    gold = kinds.add_parser('gold-audit', help='gold audit #1 (R00) or #2 (R10/R10K)')
    gold.add_argument('--pairs', required=True, help='the pairs file (arc-gold-pairs/1)')
    gold.add_argument('--rubric', required=True, help='the 0-3 relevance rubric (markdown)')
    gold.add_argument(
        '--shape', default='60x12', help="queries x candidates to require (default 60x12; 'any')"
    )
    signoff = kinds.add_parser('signoff', help='the R00 PREREG sign-off (with the A0 records)')
    for name in SIGNOFF_ARGS:
        signoff.add_argument(f'--{name}', required=True)
    blind = kinds.add_parser('blind', help="the end review's blind pass (verdicts are stripped)")
    blind.add_argument('--prereg', required=True)
    blind.add_argument('--rules', required=True)
    blind.add_argument(
        '--verdicts',
        required=True,
        nargs='+',
        help="every run's verdicts.json (full; arcforge strips them)",
    )
    mismatch = kinds.add_parser('mismatch', help="the end review's mismatch pass")
    for name in ('prereg', 'rules', 'writeup', 'comparison'):
        mismatch.add_argument(f'--{name}', required=True)
    mismatch.add_argument('--reports', required=True, nargs='+', help="every run's report.json")
    pack.set_defaults(func=cmd_pack)

    check = sub.add_parser('check', help="validate the open attempt's output.json")
    check.add_argument('packet', help='the packet root printed by pack')
    check.add_argument('--session', required=True, help="the agent's session id")
    check.add_argument(
        '--model', required=True, help='the model id the harness reported for the agent'
    )
    check.set_defaults(func=cmd_check)

    comp = sub.add_parser(
        'compare', help='compare an accepted blind pass with the reported verdicts'
    )
    comp.add_argument('packet', help='the blind_recompute packet root')
    comp.add_argument('--verdicts', required=True, nargs='+', help="every run's full verdicts.json")
    comp.add_argument('--out', help='also write the table here (the mismatch pack --comparison)')
    comp.set_defaults(func=cmd_compare)

    rec = sub.add_parser('record', help='print the report.json fable[] entry')
    rec.add_argument('packet')
    rec.set_defaults(func=cmd_record)

    fix = sub.add_parser(
        'repair',
        help='resubmit a refused sign-off: the refusal verbatim, the diff, the corrected inputs',
    )
    fix.add_argument('packet', help='the refused sign-off packet root')
    fix.add_argument('--diff', required=True, help='the diff of exactly what was corrected')
    fix.add_argument('--root', help='packet root (default: as pack)')
    fix.add_argument('--allow-in-repo', action='store_true', help=argparse.SUPPRESS)
    for name in SIGNOFF_ARGS:
        fix.add_argument(f'--{name}', help='a corrected input (the others are carried over)')
    fix.set_defaults(func=cmd_repair)

    missing = sub.add_parser('mark-missing', help='record an end review that never came')
    missing.add_argument('packet')
    missing.add_argument('--reason', required=True)
    missing.set_defaults(func=cmd_mark_missing)
    return parser


def main(argv: list[str] | None = None) -> int:
    from arcforge.contract.schema import SchemaUnavailable
    from arcforge.fable.packer import PacketError

    args = build_parser().parse_args(argv)
    try:
        return int(args.func(args))
    except SchemaUnavailable as error:
        print(f'arcforge.fable: {error}', file=sys.stderr)
        return EXIT_UNAVAILABLE
    except (PacketError, OSError, ValueError) as error:
        print(f'arcforge.fable: {error}', file=sys.stderr)
        return EXIT_ERROR
