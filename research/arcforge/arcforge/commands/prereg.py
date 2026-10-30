"""`arcforge prereg` — the pre-registration contract: lint, freeze and hash rules.yaml.

lint    expand every rule's applies_to over the PREREG branch table and prove each in-scope
        rule computable: every field it reads exists in arc-report/1 and the run plan
        produces it non-null. --frozen also requires every MDE (each tau = max(floor, MDE)).
freeze  write the R00 MDEs into a copy of the rules template (comments kept); the diff against
        the template touches mde_r00 only, and freeze proves it.
render  PREREG.pre.md from the rules template (--pre), or PREREG.md from PREREG.pre.md, the
        frozen rules and the R00 values (--values JSON); every placeholder filled, none unknown.
hash    print the sha256 of rules.yaml, the schema, the plan, PREREG.pre.md (what the s0
        commitment records) and PREREG.md, as report.run records them.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

DESCRIPTION = __doc__.split('\n\n', 1)[1] if __doc__ else ''
EXIT_OK, EXIT_FAIL, EXIT_USAGE = 0, 1, 2


def _rules_path(arg: str | None) -> str | None:
    return arg or os.environ.get('ARCFORGE_RULES') or None


def lint(args: argparse.Namespace) -> int:
    from arcforge.contract.lint import format_report
    from arcforge.contract.lint import lint as run_lint

    try:
        report = run_lint(_rules_path(args.rules), args.plan, args.schema, frozen=args.frozen)
    except OSError as error:
        print(f'arcforge prereg lint: {error}', file=sys.stderr)
        return EXIT_USAGE
    text = json.dumps(report.to_json(), indent=1)
    if args.out:
        Path(args.out).write_text(text + '\n', encoding='utf-8')
    print(text if args.json else format_report(report))
    return EXIT_OK if report.ok else EXIT_FAIL


def _parse_mde(arg: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for item in arg.split(','):
        key, sep, value = item.partition('=')
        if not sep:
            raise ValueError(f'{item!r} is not KEY=VALUE')
        out[key.strip()] = float(value)
    return out


def _s0_commitment(args: argparse.Namespace) -> dict:
    from arcforge.contract.prereg_doc import PreregError

    if not args.s0_hashes:
        raise PreregError(
            '--s0-hashes is required: supply the previously witnessed s0 hashes '
            '(prereg hash --json), not hashes regenerated after R00'
        )
    return json.loads(Path(args.s0_hashes).read_bytes())


def _registered_contract(args: argparse.Namespace, rules_path: Path, pre_path: Path) -> str:
    from arcforge.contract import prereg_doc
    from arcforge.contract.rules import loads_rules

    prereg_doc.verify_s0_hashes(_s0_commitment(args), rules_path=rules_path, pre_path=pre_path)
    # Read bytes explicitly: universal newline translation would erase committed CRLF edits.
    text = rules_path.read_bytes().decode('utf-8')
    rules = loads_rules(text)
    if any(value is not None for value in rules.mde_r00.values()):
        raise prereg_doc.PreregError('s0 rules must be the unmeasured template (all mde_r00 null)')
    if pre_path.read_bytes().decode('utf-8') != prereg_doc.render_pre(rules):
        raise prereg_doc.PreregError('s0 PREREG.pre.md does not match the registered rules render')
    return text


def freeze(args: argparse.Namespace) -> int:
    from arcforge.contract import prereg_doc
    from arcforge.contract.rules import TEMPLATE_PATH, RulesError, freeze_text

    try:
        mde = _parse_mde(args.mde) if args.mde else json.loads(Path(args.mde_json).read_text())
        template = Path(args.rules) if args.rules else TEMPLATE_PATH
        registered = _registered_contract(
            args, template, Path(args.prereg_pre or prereg_doc.PRE_PATH)
        )
        frozen = freeze_text(registered, mde)
    except (ValueError, OSError, RulesError) as error:
        print(f'arcforge prereg freeze: {error}', file=sys.stderr)
        return EXIT_USAGE
    from arcforge.contract.rules import freeze_diff

    changed = freeze_diff(registered, frozen)
    if changed is None:
        print('arcforge prereg freeze: the frozen copy changes more than mde_r00', file=sys.stderr)
        return EXIT_FAIL
    out = Path(args.out)
    if out.exists() and not args.force:
        print(f'arcforge prereg freeze: {out} exists (use --force to replace it)', file=sys.stderr)
        return EXIT_USAGE
    out.write_bytes(frozen.encode('utf-8'))
    print(f'wrote {out} (changed: {", ".join(changed)})')
    return EXIT_OK


def render(args: argparse.Namespace) -> int:
    from arcforge.contract import prereg_doc
    from arcforge.contract.rules import (
        TEMPLATE_PATH,
        RulesError,
        freeze_diff,
        load_rules,
        loads_rules,
    )

    try:
        if args.pre:
            text = prereg_doc.render_pre(load_rules(_rules_path(args.rules)))
        else:
            if not args.values:
                print('arcforge prereg render: --values is required without --pre', file=sys.stderr)
                return EXIT_USAGE
            pre_path = Path(args.template or prereg_doc.PRE_PATH)
            registered = _registered_contract(
                args, Path(args.registered_rules or TEMPLATE_PATH), pre_path
            )
            frozen_path = Path(_rules_path(args.rules) or TEMPLATE_PATH)
            frozen_text = frozen_path.read_bytes().decode('utf-8')
            if freeze_diff(registered, frozen_text) is None:
                raise prereg_doc.PreregError('frozen rules change more than mde_r00 relative to s0')
            rules = loads_rules(frozen_text, path=str(frozen_path))
            extra = json.loads(Path(args.values).read_text(encoding='utf-8'))
            template = pre_path.read_bytes().decode('utf-8')
            text = prereg_doc.fill(template, prereg_doc.values_for(rules, extra))
    except (RulesError, prereg_doc.PreregError, OSError, ValueError) as error:
        print(f'arcforge prereg render: {error}', file=sys.stderr)
        return EXIT_FAIL
    if args.out:
        Path(args.out).write_text(text, encoding='utf-8')
        print(f'wrote {args.out}')
    else:
        sys.stdout.write(text)
    return EXIT_OK


def hash_files(args: argparse.Namespace) -> int:
    from arcforge.contract import schema
    from arcforge.contract.lint import PRODUCES_PATH
    from arcforge.contract.rules import TEMPLATE_PATH, sha256_bytes

    from arcforge.contract.prereg_doc import PRE_PATH

    rules = Path(_rules_path(args.rules) or TEMPLATE_PATH)
    files = {
        'rules_sha256': rules,
        'schema_sha256': schema.REPORT_SCHEMA_PATH,
        'plan_sha256': Path(args.plan or PRODUCES_PATH),
        'prereg_pre_sha256': Path(args.prereg_pre or PRE_PATH),
    }
    if args.prereg:
        files['prereg_sha256'] = Path(args.prereg)
    try:
        hashes = {key: sha256_bytes(path.read_bytes()) for key, path in files.items()}
    except OSError as error:
        print(f'arcforge prereg hash: {error}', file=sys.stderr)
        return EXIT_USAGE
    if args.json:
        print(
            json.dumps(
                {key: {'path': str(files[key]), 'sha256': h} for key, h in hashes.items()}, indent=1
            )
        )
    else:
        for key, digest in hashes.items():
            print(f'{key:14} {digest}  {files[key]}')
    return EXIT_OK


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'prereg',
        help='lint, freeze and hash the pre-registered rules (rules.yaml)',
        description=DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest='prereg_command', metavar='<lint|freeze|render|hash>')
    parser.set_defaults(func=lambda _args: (parser.print_help(), EXIT_USAGE)[1])

    p_lint = sub.add_parser('lint', help='prove every in-scope rule computable on every branch')
    p_lint.add_argument(
        '--rules', help='rules file (default: $ARCFORGE_RULES, else the packaged template)'
    )
    p_lint.add_argument(
        '--plan', help='run plan (arc-produces/1; default: the packaged produces.yaml)'
    )
    p_lint.add_argument('--schema', help='report schema (default: the packaged arc-report-1.json)')
    p_lint.add_argument(
        '--frozen',
        action='store_true',
        help='require every mde_r00 (use at R00, before the sign-off)',
    )
    p_lint.add_argument('--json', action='store_true', help='print the lint report as JSON')
    p_lint.add_argument(
        '--out', metavar='PATH', help="also write the JSON report (the sign-off packet's lint.json)"
    )
    p_lint.set_defaults(func=lint)

    p_freeze = sub.add_parser('freeze', help='write the R00 MDEs into a copy of the rules template')
    group = p_freeze.add_mutually_exclusive_group(required=True)
    group.add_argument('--mde', help='AB=0.045,D=0.03,CE=0.05,G=0.045,vault=0.09,frontier=0.1')
    group.add_argument('--mde-json', metavar='PATH', help='a JSON object with the same six keys')
    p_freeze.add_argument('--rules', help='the template to freeze (default: the packaged template)')
    p_freeze.add_argument('--s0-hashes', help='previously witnessed s0 hashes (prereg hash --json)')
    p_freeze.add_argument(
        '--prereg-pre', help='the s0 PREREG.pre.md (default: prereg/PREREG.pre.md)'
    )
    p_freeze.add_argument('--out', required=True, help='where to write the frozen rules.yaml')
    p_freeze.add_argument('--force', action='store_true', help='replace --out if it exists')
    p_freeze.set_defaults(func=freeze)

    p_render = sub.add_parser(
        'render', help='write PREREG.pre.md (--pre) or the filled PREREG.md (--values)'
    )
    p_render.add_argument('--pre', action='store_true', help='render the template from the rules')
    p_render.add_argument(
        '--rules', help='rules file (the template for --pre, else the frozen copy)'
    )
    p_render.add_argument(
        '--template', help='PREREG.pre.md to fill (default: prereg/PREREG.pre.md)'
    )
    p_render.add_argument(
        '--registered-rules', help='s0 rules template (default: the packaged template)'
    )
    p_render.add_argument(
        '--s0-hashes', help='previously witnessed s0 hashes; required for final render'
    )
    p_render.add_argument('--values', metavar='JSON', help='the non-rule placeholder values')
    p_render.add_argument('--out', help='write here (default: stdout)')
    p_render.set_defaults(func=render)

    p_hash = sub.add_parser(
        'hash', help='print the sha256 of rules.yaml, the schema, the plan and PREREG.md'
    )
    p_hash.add_argument(
        '--rules', help='rules file (default: $ARCFORGE_RULES, else the packaged template)'
    )
    p_hash.add_argument('--plan', help='run plan (default: the packaged produces.yaml)')
    p_hash.add_argument('--prereg', help='PREREG.md, when it exists')
    p_hash.add_argument('--prereg-pre', help='PREREG.pre.md (default: prereg/PREREG.pre.md)')
    p_hash.add_argument('--json', action='store_true')
    p_hash.set_defaults(func=hash_files)
