"""`arcforge tail` — the R00 tail outside the runtime: a dry run on toy inputs, or a real one.

dry     toy R00: synthetic upstream artifacts (arcforge.eval.toy) through S13 and the tail into
        a run directory (report.json, verdicts.json, scores/, PREREG.md, rules.frozen.yaml,
        lint.json, power.json, bench-card.md), then `prereg lint --frozen` and `arcforge verdict`
        on it. Exit 0 only if both pass. Nothing is packed for Fable and nothing leaves the
        directory.
power   the MDE table and the verdict-probability table from S13's power score files.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DESCRIPTION = __doc__.split('\n\n', 1)[1] if __doc__ else ''
EXIT_OK, EXIT_FAIL, EXIT_USAGE = 0, 1, 2


def dry(args: argparse.Namespace) -> int:
    from arcforge.contract import prereg_doc
    from arcforge.contract.check import verify_run
    from arcforge.contract.lint import PRODUCES_PATH, format_report, lint
    from arcforge.contract.rules import TEMPLATE_PATH, load_rules
    from arcforge.eval import io, report, tail, toy

    out = Path(args.out)
    run_dir = out / 'r00'
    if run_dir.exists() and any(run_dir.iterdir()) and not args.force:
        print(f'arcforge tail dry: {run_dir} is not empty (use --force)', file=sys.stderr)
        return EXIT_USAGE
    run_dir.mkdir(parents=True, exist_ok=True)
    inputs = toy.toy_inputs(i1_pass=not args.fail_i1)
    config = {
        'run': {'id': 'r00', 'branch': 'N', 'h1_provisional': None,
                'one_change': 'dry tail on toy inputs', 'prediction': 'synthetic'},
        'eval': {'bench': 'v1'},
    }  # fmt: skip
    s13 = report.evaluate_run(inputs, config, load_rules(), resamples=args.resamples)
    pre = json.loads(s13['report.pre.json'])
    a0 = json.dumps({'toy': 'PREREG-A0 stand-in'}).encode()
    witness = [
        {'kind': 'a0', 'digest': report.sha256(a0), 'mode': 'dry', 'log_index': 0},
        *[{**e, 'log_index': n + 1} for n, e in enumerate(pre.get('witness') or [])],
    ]
    outputs = tail.run_tail(
        pre=pre, scores_tar=s13['scores.tar'],
        qrels_rows=io.read_jsonl(s13['qrels.final.jsonl.gz']),
        template_text=TEMPLATE_PATH.read_text(encoding='utf-8'),
        pre_text=prereg_doc.PRE_PATH.read_text(encoding='utf-8'),
        produces_text=PRODUCES_PATH.read_text(encoding='utf-8'),
        a0_bytes=a0, model_choice={'variant': '13b', 'toy': True}, witness_index=witness,
        fable_calls=pre.get('fable') or [], power_resamples=args.resamples,
    )  # fmt: skip
    report.write_scores(run_dir, s13['scores.tar'])
    for name, data in outputs.items():
        (run_dir / name).write_bytes(data)
    rules_path = run_dir / 'rules.frozen.yaml'
    lint_report = lint(rules_path, frozen=True)
    print(format_report(lint_report))
    result = verify_run(run_dir, load_rules(rules_path), out)
    checks = json.loads(outputs['tail_checks.json'])
    print(f'statuses: {json.dumps(checks["statuses"])}')
    for problem in result.errors:
        print(f'  FAIL {problem}')
    ok = lint_report.ok and result.ok and not checks['report_errors']
    print(f'dry tail {"ok" if ok else "FAILED"}: {run_dir}')
    return EXIT_OK if ok else EXIT_FAIL


def power_cmd(args: argparse.Namespace) -> int:
    from arcforge.contract.rules import load_rules
    from arcforge.eval import io, power

    members = io.untar(Path(args.scores).read_bytes())
    docs = {
        name.split('/', 1)[1][:-5]: json.loads(data)
        for name, data in members.items()
        if name.startswith('power/')
    }
    table = power.mde_table(docs, resamples=args.resamples)
    if args.rules:
        doc = power.power_doc(load_rules(args.rules), table)
        print(json.dumps(doc, indent=1))
    else:
        print(json.dumps(table, indent=1))
    return EXIT_OK


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'tail',
        help='the R00 tail: a dry run on toy inputs, or the power table',
        description=DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest='tail_command', metavar='<dry|power>')
    parser.set_defaults(func=lambda _args: (parser.print_help(), EXIT_USAGE)[1])

    p_dry = sub.add_parser('dry', help='toy R00 through S13 and the tail, then lint and verdict')
    p_dry.add_argument('--out', required=True, help='a directory to hold r00/')
    p_dry.add_argument('--resamples', type=int, default=400, help='bootstrap resamples (toy)')
    p_dry.add_argument('--fail-i1', action='store_true', help='toy inputs where I1 fails')
    p_dry.add_argument('--force', action='store_true')
    p_dry.set_defaults(func=dry)

    p_power = sub.add_parser('power', help="the MDE table from S13's scores.tar")
    p_power.add_argument('scores', help='scores.tar (power/<stratum>.json members)')
    p_power.add_argument('--rules', help='a frozen rules.yaml: also print the verdict table')
    p_power.add_argument('--resamples', type=int, default=10000)
    p_power.set_defaults(func=power_cmd)
