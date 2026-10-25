"""`arcforge plan rNN` — a $0 dry run that prices every stage against the pinned price table.

Prices every stage of the DAG (laptop, VM, Vertex, Workers AI, storage, orchestrator lines),
adds the contingency and the benchmark dividend, and applies the budget guard: it exits 4 when
the plan is above the run's ceiling ($20 at R00, where the ceiling equals the cap; $17 later),
the $20 cap or --budget, naming the pre-named first cut.
"""

from __future__ import annotations

import argparse

from arcforge.core.cliutil import EXIT_BUDGET, EXIT_OK, add_set_arg, emit_json, guarded


def _run(args: argparse.Namespace) -> int:
    from arcforge.core.budget import make_plan, render  # noqa: PLC0415 — lazy, see commands/__init__
    from arcforge.core.config import load_config, parse_override  # noqa: PLC0415
    from arcforge.core.prices import load_prices  # noqa: PLC0415
    from arcforge.core.stages import REGISTRY  # noqa: PLC0415

    config = load_config(args.config, dict(parse_override(item) for item in args.set))
    prices = load_prices(args.prices or config.get('budget.prices'))
    plan = make_plan(config, prices, REGISTRY, budget_usd=args.budget)
    if args.json:
        emit_json(plan.to_json())
    else:
        print(render(plan))
    return EXIT_OK if plan.ok else EXIT_BUDGET


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'plan',
        help='price every stage of a run ($0 dry run); exits 4 above the ceiling or cap',
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('config', metavar='RUN', help="a run id ('r00' -> configs/r00.yaml) or a config path")
    parser.add_argument('--prices', metavar='YAML', help='price table to use instead of budget.prices')
    parser.add_argument('--budget', metavar='USD', type=float, help='an extra limit below the ceiling')
    parser.add_argument('--json', action='store_true', help='print the plan as arc-plan/1 JSON')
    add_set_arg(parser)
    parser.set_defaults(func=guarded('plan', _run))
