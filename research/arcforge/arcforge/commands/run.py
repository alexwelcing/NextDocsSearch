"""`arcforge run configs/rNN.yaml --seed 1729 --budget 20` — the one command.

Plans first and refuses to start above the budget guard's limit (exit 4). Then it runs a stage
selection, closed over its inputs, against the content-addressed cache:

    (default)    the VM part: every 'vm' stage, on the runner VM (--executor vm)
    --prep       the laptop prep pass before launch (S0-S2)
    --resume     the owner gate and the laptop tail
    --stages     exactly these stages (and what they need), e.g. --stages S0,S1

--executor auto picks vm when the selection holds a 'vm' stage and local otherwise; local runs
every stage in-process (the forge, the tests, and the runner VM itself). Cached stages replay
from the cache, so a rerun is byte-identical and costs $0. The run manifest (run.json) goes to
the cache and, with every artifact, to --out (default runs/<run id>/).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from arcforge.core.cliutil import (
    EXIT_BUDGET,
    EXIT_OK,
    add_cache_arg,
    add_repo_arg,
    add_set_arg,
    default_repo_root,
    emit_json,
    guarded,
    split_csv,
)

PHASE_FLAGS = {'prep': ('prep',), 'resume': ('gate', 'tail'), 'vm': ('vm',)}


def select(stages: dict, phases: tuple[str, ...] | None, explicit: list[str]) -> list[str]:
    from arcforge.core.dag import closure  # noqa: PLC0415

    targets = explicit or [name for name, stage in stages.items() if stage.phase in (phases or ())]
    return closure(stages, targets)


def _run(args: argparse.Namespace) -> int:
    from arcforge.core.budget import make_plan, render  # noqa: PLC0415 — lazy, see commands/__init__
    from arcforge.core.cache import default_cache_url  # noqa: PLC0415
    from arcforge.core.config import ARCFORGE_ROOT, load_config, parse_override  # noqa: PLC0415
    from arcforge.core.dag import RunEnv  # noqa: PLC0415
    from arcforge.core.executor import RunRequest, get_executor  # noqa: PLC0415
    from arcforge.core.hashing import pretty_json  # noqa: PLC0415
    from arcforge.core.prices import load_prices  # noqa: PLC0415
    from arcforge.core.stages import REGISTRY  # noqa: PLC0415

    overrides = dict(parse_override(item) for item in args.set)
    if args.seed is not None:
        overrides['run.seed'] = args.seed
    config = load_config(args.config, overrides)
    plan = make_plan(config, load_prices(config.get('budget.prices')), REGISTRY, budget_usd=args.budget)
    if not plan.ok:
        print(render(plan), file=sys.stderr)
        print(f'arcforge run: refusing to start, plan ${plan.to_json()["plan_usd"]:.2f} is above '
              f'the ${plan.limit:.2f} limit', file=sys.stderr)
        return EXIT_BUDGET

    phase = 'prep' if args.prep else 'resume' if args.resume else 'vm'
    explicit = split_csv(args.stages)
    selection = select(REGISTRY, None if explicit else PHASE_FLAGS[phase], explicit)
    executor_name = args.executor
    if executor_name == 'auto':
        executor_name = 'vm' if any(REGISTRY[name].phase == 'vm' for name in selection) else 'local'
    force = frozenset(split_csv(args.force))
    unknown = sorted(force - set(selection))
    if unknown:
        print(f'arcforge run: --force names stages outside the selection: {unknown}', file=sys.stderr)
        return 2
    out = None if args.no_out else (args.out or ARCFORGE_ROOT / 'runs' / config.run_id)
    plan_doc = plan.to_json()
    request = RunRequest(
        config=config,
        stages=selection,
        cache_url=args.cache or default_cache_url(),
        env=RunEnv(repo_root=(args.repo or default_repo_root()).resolve()),
        out=out,
        force=force,
        budget_usd=args.budget,
        plan_usd=plan_doc['plan_usd'],
        extra_files={'plan.json': pretty_json(plan_doc)},
    )
    log = (lambda _msg: None) if args.json else (lambda msg: print(msg, file=sys.stderr))
    log(f'arcforge run {config.run_id} seed {config.seed}: {",".join(selection)} '
        f'via {executor_name}, cache {request.cache_url}, plan ${plan_doc["plan_usd"]:.2f} '
        f'of ${plan.limit:.2f}')
    outcome = get_executor(executor_name).execute(request, log)
    summary = {
        'run': config.run_id,
        'manifest_sha256': outcome.manifest_sha256,
        'stages': [entry['stage'] for entry in outcome.manifest['stages']],
        'out': str(out) if out else None,
        'cache': request.cache_url,
    }
    if args.json:
        emit_json(summary)
    else:
        print(f'run.json {outcome.manifest_sha256}' + (f' -> {out}' if out else ''))
    return EXIT_OK


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'run',
        help='run a stage selection against the cache (the one command)',
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('config', metavar='CONFIG', help="configs/rNN.yaml, or a run id such as 'r00'")
    parser.add_argument('--seed', type=int, help='the run seed (overrides run.seed)')
    parser.add_argument('--budget', metavar='USD', type=float, help='refuse to start if the plan exceeds this')
    which = parser.add_mutually_exclusive_group()
    which.add_argument('--prep', action='store_true', help='the laptop prep pass (phase prep: S0-S2)')
    which.add_argument('--resume', action='store_true', help='the owner gate and the laptop tail')
    which.add_argument('--stages', metavar='S0,S1', help='exactly these stages and what they need')
    parser.add_argument('--force', metavar='S1,...', help='recompute these stages even on a cache hit')
    parser.add_argument('--executor', choices=('auto', 'local', 'vm'), default='auto',
                        help='where to run (default auto: vm if the selection has a vm stage)')
    add_cache_arg(parser)
    add_repo_arg(parser)
    outputs = parser.add_mutually_exclusive_group()
    outputs.add_argument('--out', metavar='DIR', type=Path, help='write run.json and artifacts here (default runs/<run id>/)')
    outputs.add_argument('--no-out', action='store_true', help='write only to the cache')
    parser.add_argument('--json', action='store_true', help='print a JSON summary instead of the log')
    add_set_arg(parser)
    parser.set_defaults(func=guarded('run', _run))
