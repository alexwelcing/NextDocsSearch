"""S0: split the owner's 100 queries by salted hash into 70 vault and 30 open-dev.

Nobody chooses which queries are sealed, the owner included: a fresh random salt orders the
queries by sha256(tag | salt | id | text) and the 70 lowest go to the vault. The salt stays
secret (it travels inside the sealed file) until the vault opens at R10, when anyone can
recompute the split and the commitment.

Outputs, in the S0 directory (default ~/arc-owner/vault/s0/):
- vault-queries.json  PLAINTEXT, mode 0600: the salt and the 70 vault queries. It goes to the
  R00 VM for pooling and judging only, and is shredded once `arcforge vault seal` has run.
- owner-open.json     the 30 open-dev queries plus the 8 frontier queries (not secret).
- s0-commitment.json  public: the salted sha256 of the vault query file, the counts and ids.
And ~/arc-owner/s0-lock.json, which freezes the desk's Queries and Settings tabs.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from pathlib import Path

from arcforge.owner import model
from arcforge.owner.paths import ensure_private_dir, owner_dir, vault_dir
from arcforge.owner.store import read_json, utc_now, write_json_atomic
from arcforge.vault.digest import queries_commitment, sha256_hex, split_key

N_QUERIES = model.MAIN_TARGET
N_VAULT = 70
SALT_BYTES = 32
LOCK_FILE = 's0-lock.json'


class SplitError(Exception):
    """The owner's queries are not ready for S0, or S0 already happened."""


@dataclass(frozen=True)
class SplitResult:
    vault: list[dict]
    open_dev: list[dict]
    frontier: list[dict]
    commitment: str
    out_dir: Path


def default_dir() -> Path:
    return vault_dir() / 's0'


def _public(query: dict) -> dict:
    return {
        'id': query['id'],
        'text': query['text'],
        'record': query.get('record'),
        'frontier': bool(query.get('frontier')),
    }


def check_queries(doc: dict) -> tuple[list[dict], list[dict]]:
    """(main, frontier) once the doc is complete; SplitError naming what is missing otherwise."""
    try:
        clean = model.normalize_queries(doc, model.Context(), utc_now())
    except model.ValidationError as error:
        raise SplitError(f'queries.json does not validate: {error}') from None
    derived = model.derive_queries(clean, model.Context())
    main = [q for q in clean['queries'] if q['section'] == 'main']
    frontier = [q for q in clean['queries'] if q['section'] == 'frontier']
    problems = []
    if derived['empty']:
        problems.append(f'empty queries: {", ".join(derived["empty"])}')
    if len(main) != N_QUERIES:
        problems.append(f'{len(main)} of {N_QUERIES} queries are written')
    if derived['duplicates']:
        problems.append(f'duplicate queries: {", ".join(sorted(derived["duplicates"]))}')
    for series, n in derived['frontier_filled'].items():
        if n != model.FRONTIER_PER_SERIES:
            problems.append(f'{n} of {model.FRONTIER_PER_SERIES} frontier queries for {series}')
    if problems:
        raise SplitError('not ready for S0: ' + '; '.join(problems))
    return main, frontier


def split(
    queries: list[dict], salt: bytes, n_vault: int = N_VAULT
) -> tuple[list[dict], list[dict]]:
    """(vault, open) by salted hash; each list sorted by query id. Deterministic given salt."""
    if not 0 <= n_vault <= len(queries):
        raise ValueError(f'cannot seal {n_vault} of {len(queries)} queries')
    ranked = sorted(queries, key=lambda q: split_key(salt, q['id'], q['text']))
    by_id = lambda q: q['id']  # noqa: E731
    return sorted(ranked[:n_vault], key=by_id), sorted(ranked[n_vault:], key=by_id)


def run_split(
    queries_path: Path | None = None,
    out_dir: Path | None = None,
    *,
    salt: bytes | None = None,
) -> SplitResult:
    """Split ~/arc-owner/queries.json once, write the S0 files and lock the desk."""
    owner = owner_dir()
    lock_path = owner / LOCK_FILE
    if lock_path.exists():
        raise SplitError(
            f'S0 already happened ({lock_path} exists). A second split with a new salt would let '
            'anyone re-roll which queries are sealed, so it is refused.'
        )
    queries_path = queries_path or owner / model.DOCS['queries'][0]
    try:
        doc = read_json(queries_path)
    except ValueError as error:
        raise SplitError(f'{queries_path} is not valid JSON ({error})') from None
    if not isinstance(doc, dict):
        raise SplitError(f'no owner queries at {queries_path}; write them in the Owner Desk first')
    main, frontier = check_queries(doc)
    salt = salt if salt is not None else secrets.token_bytes(SALT_BYTES)
    vault, open_dev = split(main, salt)
    vault_rows = [_public(q) for q in vault]
    commitment = queries_commitment(salt, vault_rows)
    out = ensure_private_dir(out_dir or default_dir())
    now = utc_now()
    write_json_atomic(
        out / 'vault-queries.json',
        {
            'schema': 'arc-vault-queries/1',
            'created_utc': now,
            'salt_hex': salt.hex(),
            'queries_commitment_sha256': commitment,
            'queries': vault_rows,
        },
    )
    write_json_atomic(
        out / 'owner-open.json',
        {
            'schema': 'arc-owner-open/1',
            'created_utc': now,
            'open_dev': [_public(q) for q in open_dev],
            'frontier': [{**_public(q), 'series': q['series']} for q in frontier],
        },
        mode=0o644,
    )
    public = {
        'schema': 'arc-s0-commitment/1',
        'created_utc': now,
        'queries_commitment_sha256': commitment,
        'commitment_rule': 'sha256("arc-vault-queries/1\\0" | salt | canonical_json(queries))',
        'split_rule': 'sha256("arc-s0-split/1\\0" | salt | id | "\\0" | text); lowest 70 sealed',
        'n_vault': len(vault),
        'n_open_dev': len(open_dev),
        'n_frontier': len(frontier),
        'vault_ids': [q['id'] for q in vault],
        'open_dev_ids': [q['id'] for q in open_dev],
        'salt_sha256': sha256_hex(salt),
    }
    write_json_atomic(out / 's0-commitment.json', public, mode=0o644)
    ensure_private_dir(owner)
    write_json_atomic(
        lock_path,
        {
            'schema': 'arc-s0-lock/1',
            'locked_utc': now,
            'queries_rev': doc.get('rev'),
            'queries_commitment_sha256': commitment,
        },
    )
    return SplitResult(vault_rows, [_public(q) for q in open_dev], frontier, commitment, out)
