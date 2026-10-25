"""`python -m arcforge.models <command>`: the M1 model tools (see arcforge/models/__init__.py).

    parity-fixtures   write (or --check) the committed tokenizer parity fixtures
    payload           build a bundle of the planned shape and measure it raw and gzipped
    pins              print every pinned model and the LLM gate decisions as JSON
    teacher-check     EmbeddingGemma-2 context-sum reconstruction (gpu extra, an L4)
    llm-check         text-only vLLM load + gate measurement for one LLM (vllm extra, an L4)
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
RECORDS = REPO_ROOT / 'public' / 'arc' / 'records'


def _emit(report: dict, out: Path | None) -> None:
    text = json.dumps(report, indent=2, sort_keys=False) + '\n'
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text)
    print(text, end='')


def cmd_parity_fixtures(args) -> int:
    from arcforge.models import fixtures

    if not args.check:
        for name, path in fixtures.build_fixtures(args.out).items():
            print(f'wrote {name}: {path}')
        return 0
    with tempfile.TemporaryDirectory() as tmp:
        fresh = fixtures.build_fixtures(Path(tmp))
        stale = fixtures.stale_files(args.out, Path(tmp))
    if stale:
        print('stale parity fixtures (rerun without --check): ' + ', '.join(stale), file=sys.stderr)
        return 1
    print(f'parity fixtures are current ({len(fresh)} artifacts)')
    return 0


def cmd_payload(args) -> int:
    from arcforge.models import payload

    records = args.records if args.records.is_dir() else None
    with tempfile.TemporaryDirectory() as tmp:
        out_dir = args.bundle_dir or Path(tmp)
        report = payload.build_and_measure(out_dir, records_dir=records, general_vocab=args.general_vocab)
    _emit(report, args.json)
    return 0 if report['bundle']['pass'] else 1


def cmd_pins(_args) -> int:
    from arcforge.models import pins

    _emit(pins.pins_report(), None)
    return 0


def cmd_teacher_check(args) -> int:
    import random

    from arcforge.models import payload, teacher
    from arcforge.models.lexicon import Lexicon
    from arcforge.models.tokenizer import LexemeTokenizer

    planned = payload.planned_lexicon(
        records_dir=args.records, general_vocab=None, shape=payload.PlannedShape(), rng=random.Random(1729)
    )
    tokenizer = LexemeTokenizer(Lexicon(planned.lexicon))
    model = teacher.load_teacher(device=args.device)
    cases = teacher.corpus_cases(args.records, args.docs, args.queries)
    report = {'teacher': teacher.TEACHER.id, **teacher.reconstruction_check(model, cases, tokenizer)}
    if not args.rows:
        report.pop('rows')
    _emit(report, args.json)
    return 0 if report['pass'] else 1


def cmd_llm_check(args) -> int:
    from arcforge.models import llm

    report = llm.check(
        args.model,
        records_dir=args.records,
        models_root=args.models_root,
        out_dir=args.out_dir,
        port=args.port,
        requests=args.requests,
        concurrency=args.concurrency,
    )
    print(json.dumps(report.get('gate'), indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    from arcforge.models import fixtures

    parser = argparse.ArgumentParser(prog='python -m arcforge.models', description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', metavar='<command>', required=True)

    p = sub.add_parser('parity-fixtures', help='write or check the tokenizer parity fixtures')
    p.add_argument('--out', type=Path, default=fixtures.FIXTURE_DIR, help='fixture directory (default: %(default)s)')
    p.add_argument('--check', action='store_true', help='fail if the committed fixtures are stale')
    p.set_defaults(func=cmd_parity_fixtures)

    p = sub.add_parser('payload', help='measure a planned-shape model bundle (target <= 4.0 MB raw)')
    p.add_argument('--records', type=Path, default=RECORDS, help='corpus records (default: %(default)s)')
    p.add_argument('--general-vocab', type=Path, help="a BPE vocab.json (e.g. Qwen's) for the 10k general words")
    p.add_argument('--bundle-dir', type=Path, help='keep the written bundle here (default: a temp dir)')
    p.add_argument('--json', type=Path, help='also write the report here')
    p.set_defaults(func=cmd_payload)

    p = sub.add_parser('pins', help='print pinned models and LLM gate decisions')
    p.set_defaults(func=cmd_pins)

    p = sub.add_parser('teacher-check', help='EmbeddingGemma-2 context-sum reconstruction (needs a GPU)')
    p.add_argument('--records', type=Path, default=RECORDS)
    p.add_argument('--docs', type=int, default=64, help='document cases (default: %(default)s)')
    p.add_argument('--queries', type=int, default=64, help='query cases (default: %(default)s)')
    p.add_argument('--device', default='cuda')
    p.add_argument('--rows', action='store_true', help='include per-case rows in the report')
    p.add_argument('--json', type=Path, help='also write the report here')
    p.set_defaults(func=cmd_teacher_check)

    p = sub.add_parser('llm-check', help='text-only vLLM load and gate measurement (needs a GPU)')
    p.add_argument('model', choices=['qwen3.5-9b', 'qwen3.5-4b', 'ministral-3-8b', 'ministral-3-3b'])
    p.add_argument('--records', type=Path, default=RECORDS)
    p.add_argument('--models-root', type=Path, default=Path.home() / 'models')
    p.add_argument('--out-dir', type=Path, default=Path('llm-check'))
    p.add_argument('--port', type=int, default=8011)
    p.add_argument('--requests', type=int, default=256, help='measured Qwen requests (default: %(default)s)')
    p.add_argument('--concurrency', type=int, default=64)
    p.set_defaults(func=cmd_llm_check)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args) or 0)


if __name__ == '__main__':
    sys.exit(main())
