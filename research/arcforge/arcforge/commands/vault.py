"""`arcforge vault` — the owner's age vault: keygen, S0 split, seal, laptop-only read, status.

Everything here is stdlib plus the `age` CLI, and the arcforge.vault modules are imported inside
each action, as the command rules ask.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DESCRIPTION = """\
The vault holds 70 of the owner's 100 queries (and their qrels), sealed with age to the owner's
public key. It is read only on the owner's laptop, only at the registered read points of the
realized branch, and at most three times in the arc.

  keygen   once, by the owner, in Terminal: makes the key (shown once, never stored) and
           writes configs/vault.recipient
  split    S0: split ~/arc-owner/queries.json by salted hash into 70 vault / 30 open-dev, and
           freeze the desk's Queries tab
  seal     encrypt the vault queries (and qrels) to the recipient; publish the commitments;
           shred the plaintext
  read     at a read point (laptop only): asks for the key on stdin, releases the rounded
           hyb - B2 nDCG@10 (per query only at R10/R10K)
  status   the recipient, the commitments and the read log at a glance
  shred    overwrite and delete plaintext files
"""

READ_POINTS_HELP = (
    'N: r04 r06 r10 · N-F: r04 r06 r10K · S-F: r04 r10K · S-C: r04 r07 r10 · S-C-F: r04 r07 r10K'
)


def _fail(message: str, code: int = 1) -> int:
    print(f'arcforge vault: {message}', file=sys.stderr)
    return code


def _keygen(args) -> int:
    from arcforge.owner.paths import recipient_path
    from arcforge.vault import age
    from arcforge.vault.keygen import KeygenError, keygen

    try:
        keygen(
            Path(args.recipient_file) if args.recipient_file else recipient_path(), force=args.force
        )
    except (KeygenError, age.AgeError) as error:
        return _fail(str(error))
    except (KeyboardInterrupt, EOFError):
        print(
            '\nAbandoned: nothing was written, and the key that was shown is now useless.',
            file=sys.stderr,
        )
        return 130
    return 0


def _split(args) -> int:
    from arcforge.vault.split import SplitError, run_split

    try:
        result = run_split(
            Path(args.queries) if args.queries else None, Path(args.out) if args.out else None
        )
    except SplitError as error:
        return _fail(str(error))
    print(
        f'S0 split done: {len(result.vault)} vault, {len(result.open_dev)} open-dev, '
        f'{len(result.frontier)} frontier.\n'
        f'  queries commitment  {result.commitment}\n'
        f'  files               {result.out_dir}\n'
        "  The desk's Queries and Settings tabs are frozen now.\n"
        '  vault-queries.json is plaintext: it goes to the R00 VM only, and `arcforge vault seal` '
        'shreds it.'
    )
    return 0


def _seal(args) -> int:
    from arcforge.owner.paths import recipient_path, vault_dir
    from arcforge.vault import age
    from arcforge.vault.seal import SealError, seal

    out = Path(args.out) if args.out else vault_dir() / 'sealed' / 'vault.age'
    try:
        sealed = seal(
            Path(args.vault_queries),
            Path(args.recipient_file) if args.recipient_file else recipient_path(),
            out,
            qrels=Path(args.qrels) if args.qrels else None,
            commitments_out=Path(args.commitments) if args.commitments else None,
            shred_inputs=not args.keep_plaintext,
        )
    except (SealError, age.AgeError) as error:
        return _fail(str(error))
    c = sealed.commitments
    qrels = ' with qrels' if c['has_qrels'] else ''
    kept = 'were kept (--keep-plaintext)' if args.keep_plaintext else 'shredded'
    print(
        f'Sealed {c["n_queries"]} vault queries{qrels} to the owner.\n'
        f'  sealed file         {sealed.sealed_path}\n'
        f'  sealed sha256       {c["sealed_sha256"]}\n'
        f'  queries commitment  {c["queries_commitment_sha256"]}\n'
        f'  commitments         {sealed.commitments_path}  (publish both in the bench card)\n'
        f'  plaintext inputs {kept}'
    )
    return 0


def _ask_key() -> str:
    if sys.stdin.isatty():
        import getpass

        return getpass.getpass('Paste the vault key (input hidden, never stored): ')
    return sys.stdin.readline()


def _paths(args):
    from arcforge.vault.read import Paths

    base = Paths.default()
    return Paths(
        sealed=Path(args.sealed) if args.sealed else base.sealed,
        commitments=Path(args.commitments) if args.commitments else base.commitments,
        log=Path(args.log) if args.log else base.log,
        releases=Path(args.releases) if args.releases else base.releases,
    )


def _read(args) -> int:
    from arcforge.vault import age
    from arcforge.vault.read import ReadError, read_vault, record_lost_key
    from arcforge.vault.readpoints import ReadRefused, normalize_branch, normalize_run

    try:
        run_id, branch = normalize_run(args.run), normalize_branch(args.branch)
    except ValueError as error:
        return _fail(str(error), 2)
    paths = _paths(args)
    try:
        if args.key_lost:
            if not sys.stdin.isatty():
                return _fail('--key-lost needs your confirmation in a terminal')
            prompt = f'Record the read at {run_id} as "unavailable": the key is lost? Type LOST: '
            if input(prompt).strip() != 'LOST':
                return _fail('not recorded')
            release = record_lost_key(run_id, branch, paths=paths)
        else:
            release = read_vault(
                run_id, branch, key_source=_ask_key, scorer=args.scorer, paths=paths
            )
    except ReadRefused as refusal:
        return _fail(f'refused: {refusal}', 4)
    except (ReadError, age.AgeError) as error:
        return _fail(str(error))
    except (KeyboardInterrupt, EOFError):
        return _fail('read abandoned; nothing was released', 130)
    value = release['hybrid_minus_b2_ndcg10']
    print(
        f'Vault read {release["read_index"]} of {release["reads_budget_branch"]} at {run_id} '
        f'(branch {branch}).\n'
        f'  hyb(champion) - B2, nDCG@10:  {"unavailable" if value is None else f"{value:+.2f}"}'
        f'   sign {release["sign"]}\n'
        f'  release file: {paths.releases / f"release-{run_id}.json"}'
        + (
            '\n  R10: the vault is open per query in the release file.'
            if 'per_query' in release
            else ''
        )
    )
    return 0


def _status(args) -> int:
    from arcforge.owner.paths import recipient_path
    from arcforge.owner.store import read_json
    from arcforge.vault import age, readlog

    paths = _paths(args)
    recipient_file = Path(args.recipient_file) if args.recipient_file else recipient_path()
    try:
        recipient = age.read_recipient_file(recipient_file)
    except age.AgeError:
        recipient = None
    try:
        entries = readlog.load(paths.log)
        log_ok, log_error = True, None
    except readlog.LogCorrupt as error:
        entries, log_ok, log_error = [], False, str(error)
    commitments = read_json(paths.commitments) if paths.commitments.is_file() else None
    status = {
        'recipient_file': str(recipient_file),
        'recipient': recipient,
        'age_installed': age.available(),
        'commitments': commitments,
        'read_log': str(paths.log),
        'read_log_ok': log_ok,
        'read_log_error': log_error,
        'reads': readlog.public_log(entries),
        'refusals': sum(1 for e in entries if e['event'] == 'refused'),
    }
    if args.json:
        print(json.dumps(status, indent=2))
        return 0
    missing = 'missing: the owner runs `uv run arcforge vault keygen` in Terminal'
    print(f'recipient    {recipient or missing}')
    print(f'age          {"installed" if status["age_installed"] else "missing: brew install age"}')
    if commitments:
        print(f'sealed       {commitments.get("sealed_sha256")}')
        print(f'commitment   {commitments.get("queries_commitment_sha256")}')
    else:
        print('sealed       not yet (R00 seals the vault)')
    if not log_ok:
        print(f'read log     BROKEN: {log_error}')
    else:
        reads = ', '.join(f'#{r["read_index"]} {r["run_id"]}' for r in status['reads']) or 'none'
        print(f'reads        {reads}   (read points: {READ_POINTS_HELP})')
    return 0


def _shred(args) -> int:
    from arcforge.vault.seal import shred

    for name in args.paths:
        shred(Path(name))
        print(f'shredded {name}')
    return 0


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'vault',
        help='the age vault: keygen, split (S0), seal, read (laptop only), status',
        description=DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    actions = parser.add_subparsers(dest='vault_action', metavar='<action>')

    keygen = actions.add_parser('keygen', help='make the owner key once (in your own Terminal)')
    keygen.add_argument(
        '--recipient-file', help='where the public recipient goes (default configs/vault.recipient)'
    )
    keygen.add_argument(
        '--force',
        action='store_true',
        help='replace an existing recipient (only before anything is sealed)',
    )
    keygen.set_defaults(func=_keygen)

    split = actions.add_parser('split', help='S0: salted-hash split into 70 vault / 30 open-dev')
    split.add_argument(
        '--queries', help='the owner queries file (default ~/arc-owner/queries.json)'
    )
    split.add_argument('--out', help='output directory (default ~/arc-owner/vault/s0)')
    split.set_defaults(func=_split)

    seal = actions.add_parser('seal', help='encrypt the vault queries (+ qrels) to the recipient')
    seal.add_argument(
        '--vault-queries', required=True, help='vault-queries.json from `arcforge vault split`'
    )
    seal.add_argument('--qrels', help='arc-vault-qrels/1 file for the vault queries (end of R00)')
    seal.add_argument('--recipient-file', help='default configs/vault.recipient')
    seal.add_argument('--out', help='the sealed file (default ~/arc-owner/vault/sealed/vault.age)')
    seal.add_argument(
        '--commitments', help='default vault-commitments.json next to the sealed file'
    )
    seal.add_argument(
        '--keep-plaintext', action='store_true', help='do not shred the inputs (debugging only)'
    )
    seal.set_defaults(func=_seal)

    read = actions.add_parser(
        'read',
        help='laptop-only read at a registered read point',
        description=f'Read the vault at a registered read point. Read points: {READ_POINTS_HELP}. '
        'The key is asked for on stdin (hidden in a terminal), never as an argument.',
    )
    read.add_argument('run', help='the run id, e.g. r04 or r10K')
    read.add_argument(
        '--branch', required=True, help='the realized branch: N, N-F, S-F, S-C or S-C-F'
    )
    read.add_argument(
        '--scorer',
        default='arcforge.models.vault_scorer:score',
        help='module:function that scores the vault',
    )
    read.add_argument(
        '--key-lost', action='store_true', help='record this read as sign "unavailable" (key lost)'
    )
    for flag in ('sealed', 'commitments', 'log', 'releases'):
        read.add_argument(
            f'--{flag}', help=f'override the default {flag} path under ~/arc-owner/vault/'
        )
    read.set_defaults(func=_read)

    status = actions.add_parser('status', help='recipient, commitments and the read log')
    status.add_argument(
        '--json', action='store_true', help='machine-readable (for doctor and the orchestrator)'
    )
    status.add_argument('--recipient-file', help='default configs/vault.recipient')
    for flag in ('sealed', 'commitments', 'log', 'releases'):
        status.add_argument(f'--{flag}', help=argparse.SUPPRESS)
    status.set_defaults(func=_status)

    shred = actions.add_parser('shred', help='overwrite and delete plaintext files')
    shred.add_argument('paths', nargs='+')
    shred.set_defaults(func=_shred)

    parser.set_defaults(func=lambda _args: parser.print_help() or 2)
