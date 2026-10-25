"""`arcforge verdict rNN` — recompute a run's verdicts.json from its score files and rules.yaml.

Every row is recomputed from its per-query score file, every rule re-decided under rules.yaml,
and the result diffed against the stored verdicts.json (and report.json). Any mismatch, any
in-scope rule that reads a null (NOT_COMPUTABLE) and any contract error fails the run: exit 1.

With --inputs, the producer's input document (run, vault, gates_inputs, adoption,
signoff_inputs and rows of {comparison_id, scores_file, nested, vault_read}) is built into a
verdicts.json instead, which --emit writes.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

DESCRIPTION = __doc__.split('\n\n', 1)[1].strip() if __doc__ else ''
EXIT_OK, EXIT_FAIL, EXIT_USAGE, EXIT_UNAVAILABLE = 0, 1, 2, 3


def _rules_path(arg: str | None) -> str | None:
    return arg or os.environ.get('ARCFORGE_RULES') or None


def _run_dir(arg: str, runs_dir: str | None) -> Path:
    from arcforge.contract.ids import RUN_IDS

    if arg not in RUN_IDS:
        return Path(arg)
    return Path(runs_dir or os.environ.get('ARCFORGE_RUNS_DIR') or 'runs') / arg


def run(args: argparse.Namespace) -> int:
    from arcforge.contract.build import build_verdicts
    from arcforge.contract.check import load_history, load_json, verify_run
    from arcforge.contract.ids import RUN_IDS
    from arcforge.contract.rules import RulesError, load_rules
    from arcforge.contract.schema import SchemaUnavailable
    from arcforge.contract.verdicts import FINAL_RUNS, dumps_doc

    try:
        rules = load_rules(_rules_path(args.rules))
    except (RulesError, OSError) as error:
        print(f'arcforge verdict: {error}', file=sys.stderr)
        return EXIT_USAGE
    run_dir = _run_dir(args.run, args.runs_dir)
    if not run_dir.is_dir():
        known = ', '.join(RUN_IDS)
        print(
            f'arcforge verdict: no run directory {run_dir} (give a run id: {known}; or a path)',
            file=sys.stderr,
        )
        return EXIT_USAGE
    runs_root = Path(args.runs_dir) if args.runs_dir else run_dir.parent

    if args.inputs:
        try:
            inputs = load_json(Path(args.inputs))
            run_id = inputs['run']['id']
            history = (
                load_history(rules, runs_root, run_id, inputs['run']['branch'])
                if run_id in FINAL_RUNS
                else None
            )
        except (OSError, ValueError, KeyError, TypeError) as error:
            print(f'arcforge verdict: {args.inputs}: {error}', file=sys.stderr)
            return EXIT_USAGE
        outcome = build_verdicts(rules, inputs, run_dir, history)
        problems = outcome.problems()
        statuses = [(h['id'], h['status'], h['in_scope']) for h in outcome.doc['hypotheses']]
    else:
        try:
            result = verify_run(run_dir, rules, runs_root)
        except SchemaUnavailable as error:
            print(f'arcforge verdict: {error}', file=sys.stderr)
            return EXIT_UNAVAILABLE
        outcome = result.outcome
        problems = result.errors
        statuses = result.statuses()
        for warning in result.warnings:
            print(f'warning: {warning}', file=sys.stderr)

    ok = not problems
    if args.emit:
        if outcome is None or not outcome.ok:
            print(
                'arcforge verdict: not writing --emit: the verdicts are not computable',
                file=sys.stderr,
            )
        else:
            Path(args.emit).write_text(dumps_doc(outcome.doc), encoding='utf-8')
    if args.json:
        print(
            json.dumps(
                {
                    'run_dir': str(run_dir),
                    'rules_sha256': rules.sha256,
                    'ok': ok,
                    'statuses': {rule_id: status for rule_id, status, _ in statuses},
                    'problems': problems,
                },
                indent=1,
            )
        )
    else:
        print(f'arcforge verdict {run_dir} under rules {rules.sha256[:12]}')
        for rule_id, status, in_scope in statuses:
            print(f'  {rule_id:18} {status}{"" if in_scope else "  (out of scope)"}')
        for problem in problems:
            print(f'  FAIL {problem}')
        in_scope = sum(1 for *_, s in statuses if s)
        verdict = 'reproduced' if ok else f'FAILED ({len(problems)} problems)'
        print(f'verdict {verdict}: {len(statuses)} rules, {in_scope} in scope')
    return EXIT_OK if ok else EXIT_FAIL


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'verdict',
        help='recompute verdicts.json from per-query score files and rules.yaml; fail on mismatch',
        description=DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        'run', help='a run id (r00 .. r10, r05K, r07K, r08K, r09K, r10K) or a run directory'
    )
    parser.add_argument(
        '--runs-dir',
        help='the directory holding one sub-directory per run (default: $ARCFORGE_RUNS_DIR, else ./runs); '
        'R10/R10K read every earlier run of their path from it',
    )
    parser.add_argument(
        '--rules',
        help='the rules file (default: $ARCFORGE_RULES, else the packaged template); it must hash to run.rules_sha256',
    )
    parser.add_argument(
        '--inputs',
        metavar='JSON',
        help="build from the producer's input document instead of verifying",
    )
    parser.add_argument('--emit', metavar='PATH', help='write the recomputed verdicts.json to PATH')
    parser.add_argument('--json', action='store_true', help='print the result as JSON')
    parser.set_defaults(func=run)
