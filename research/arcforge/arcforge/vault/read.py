"""`arcforge vault read`: the laptop-only read at a registered read point.

In order, and refusing at the first failure:
1. the machine is not a runner VM, CI job or container (host.runner_reason);
2. the read log verifies, and the read is at a read point of the realized branch, inside its
   budget, not a repeat, and not before an earlier read (readpoints.check_read). A refusal is
   itself logged;
3. the sealed file's sha256 matches the published commitment;
4. the scorer is importable, so a missing model never burns a read;
5. the key is asked for on stdin (hidden when it is a terminal; never argv, env or a file), and
   its recipient must be the vault's;
6. 'open' is logged, the file is decrypted in memory, and the salted query commitment inside it
   is checked against the published one;
7. the scorer returns hyb(champion) and B2 nDCG@10 for every vault query;
8. 'release' is logged with the rounded aggregate, which is all a read before R10 releases. At
   R10/R10K the vault opens per query, and the salt is released so anyone can re-check S0.

A lost key is recorded as a release with sign 'unavailable' (rules.yaml vault.read), on the
owner's explicit confirmation.
"""

from __future__ import annotations

import importlib
import json
from collections.abc import Callable
from dataclasses import dataclass
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path

from arcforge.owner.paths import vault_dir
from arcforge.owner.store import read_json, utc_now, write_json_atomic
from arcforge.vault import age, readlog
from arcforge.vault.digest import queries_commitment, sha256_file
from arcforge.vault.host import runner_reason
from arcforge.vault.readpoints import OPEN_RUNS, READ_POINTS, ReadRefused, budget, check_read
from arcforge.vault.seal import PAYLOAD_SCHEMA

DEFAULT_SCORER = 'arcforge.models.vault_scorer:score'
HOST = 'owner-laptop'

# scorer(payload, run_id, branch) -> {query_id: (hyb_ndcg10, b2_ndcg10)} for every vault query.
# The payload is the decrypted vault: {'queries': [...], 'qrels': {...}, ...}. The scorer loads
# the fold champions' bundles and B2 for run_id itself, and scores on the CPU.
Scorer = Callable[[dict, str, str], dict[str, tuple[float, float]]]


class ReadError(Exception):
    """The read could not complete. Nothing was released."""


@dataclass(frozen=True)
class Paths:
    sealed: Path
    commitments: Path
    log: Path
    releases: Path

    @classmethod
    def default(cls) -> Paths:
        root = vault_dir()
        return cls(
            sealed=root / 'sealed' / 'vault.age',
            commitments=root / 'sealed' / 'vault-commitments.json',
            log=root / 'read-log.jsonl',
            releases=root / 'releases',
        )


def load_scorer(spec: str) -> Scorer:
    module_name, _, attr = spec.partition(':')
    try:
        module = importlib.import_module(module_name)
    except ImportError as error:
        raise ReadError(
            f'the vault scorer {spec} is not available ({error}); nothing was opened. It ships '
            'with the model code; until then a read cannot score.'
        ) from None
    scorer = getattr(module, attr or 'score', None)
    if not callable(scorer):
        raise ReadError(f'{spec} is not a callable scorer; nothing was opened')
    return scorer


def round_release(value: float) -> float:
    """Round to 0.01 (half to even, on the decimal value), with -0.0 folded to 0.0."""
    rounded = float(Decimal(repr(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_EVEN))
    return rounded + 0.0


def aggregate(scores: dict[str, tuple[float, float]]) -> tuple[float, int]:
    """(mean of hyb - B2 nDCG@10 rounded to 0.01, sign of that rounded value)."""
    diffs = [hyb - b2 for hyb, b2 in scores.values()]
    mean = round_release(sum(diffs) / len(diffs))
    return mean, (mean > 0) - (mean < 0)


def _checked(scores: object, ids: set[str]) -> dict[str, tuple[float, float]]:
    """The scorer's output as {id: (hyb, b2)}: every vault query, each score in [0, 1]."""
    if not isinstance(scores, dict) or set(scores) != ids:
        raise ReadError(
            'the scorer must return (hyb, B2) nDCG@10 for every vault query; nothing released'
        )
    out = {}
    for qid, pair in scores.items():
        try:
            hyb, b2 = (float(x) for x in pair)
        except (TypeError, ValueError):
            raise ReadError(f'the scorer returned {pair!r} for {qid}; nothing released') from None
        if not (0.0 <= hyb <= 1.0 and 0.0 <= b2 <= 1.0):  # also false for NaN
            raise ReadError(f'nDCG@10 outside [0, 1] for {qid}; nothing released')
        out[qid] = (hyb, b2)
    return out


def _base(run_id: str, branch: str) -> dict:
    return {'run_id': run_id, 'branch': branch, 'utc': utc_now(), 'host': HOST}


def _gate(run_id: str, branch: str, paths: Paths) -> tuple[list[dict], int]:
    """Steps 1-2. Returns the verified log entries and this read's index."""
    reason = runner_reason()
    if reason:
        raise ReadRefused(f'vault reads happen only on the owner’s laptop: {reason}')
    try:
        entries = readlog.load(paths.log)
    except readlog.LogCorrupt as error:
        raise ReadRefused(
            f'the read log does not verify ({error}); restore it before any read'
        ) from None
    # The chain catches edits, deletions and reordering, but not a cut-off tail. Each release
    # also leaves a release file, so a release missing from the log is caught here; the public
    # log copied into every report.json is the outside anchor for the rest.
    released = readlog.released_runs(entries)
    orphans = sorted(
        path.name
        for path in paths.releases.glob('release-*.json')
        if path.stem.removeprefix('release-') not in released
    )
    if orphans:
        raise ReadRefused(
            f'the read log is missing releases that happened ({", ".join(orphans)}); restore it'
        )
    try:
        index = check_read(run_id, branch, released)
    except ReadRefused as refusal:
        readlog.append(
            paths.log, {**_base(run_id, branch), 'event': 'refused', 'reason': str(refusal)}
        )
        raise
    return entries, index


def _commitments(paths: Paths) -> dict:
    doc = read_json(paths.commitments)
    if not isinstance(doc, dict) or 'sealed_sha256' not in doc:
        raise ReadError(f'no vault commitments at {paths.commitments}')
    try:
        actual = sha256_file(paths.sealed)
    except FileNotFoundError:
        raise ReadError(f'no sealed vault at {paths.sealed}') from None
    if actual != doc['sealed_sha256']:
        raise ReadError(
            f'{paths.sealed} is not the sealed file that was committed (sha256 {actual[:12]}… '
            f'vs {doc["sealed_sha256"][:12]}…); refusing to open it'
        )
    return doc


def read_vault(
    run_id: str,
    branch: str,
    *,
    key_source: Callable[[], str],
    scorer: Scorer | str = DEFAULT_SCORER,
    paths: Paths | None = None,
) -> dict:
    """Steps 1-8 (see the module doc). Returns the release, also written to paths.releases.

    `scorer` is a callable or a 'module:function' spec, imported only after the gate passes.
    """
    paths = paths or Paths.default()
    _, index = _gate(run_id, branch, paths)
    commitments = _commitments(paths)
    score = load_scorer(scorer) if isinstance(scorer, str) else scorer
    identity = key_source().strip()
    if not age.is_identity(identity):
        raise ReadError(
            'that is not an age secret key (it starts with AGE-SECRET-KEY-1); nothing was opened'
        )
    if age.recipient_of(identity) != commitments['recipient']:
        raise ReadError('this key does not belong to the vault’s recipient; nothing was opened')
    readlog.append(
        paths.log,
        {**_base(run_id, branch), 'event': 'open', 'sealed_sha256': commitments['sealed_sha256']},
    )
    plaintext = age.decrypt(paths.sealed, identity)
    try:
        payload = json.loads(plaintext)
    except ValueError:
        raise ReadError('the sealed file did not decrypt to a vault payload') from None
    if not isinstance(payload, dict) or payload.get('schema') != PAYLOAD_SCHEMA:
        raise ReadError('the sealed file did not decrypt to a vault payload')
    salt = bytes.fromhex(payload['salt_hex'])
    if queries_commitment(salt, payload['queries']) != commitments['queries_commitment_sha256']:
        raise ReadError('the vault queries do not match the S0 commitment; refusing to score')

    ids = {q['id'] for q in payload['queries']}
    scores = _checked(score(payload, run_id, branch), ids)
    value, sign = aggregate(scores)

    release = {
        'schema': 'arc-vault-release/1',
        **_base(run_id, branch),
        'read_index': index,
        'read_points': list(READ_POINTS[branch]),
        'reads_budget_branch': budget(branch),
        'sealed_sha256': commitments['sealed_sha256'],
        'queries_commitment_sha256': commitments['queries_commitment_sha256'],
        'n_queries': len(ids),
        'hybrid_minus_b2_ndcg10': value,
        'sign': sign,
    }
    readlog.append(
        paths.log,
        {
            **_base(run_id, branch),
            'event': 'release',
            'read_index': index,
            'sealed_sha256': commitments['sealed_sha256'],
            'hybrid_minus_b2_ndcg10': value,
            'sign': sign,
        },
    )
    if run_id in OPEN_RUNS:  # R10/R10K: the vault opens per query
        release['salt_hex'] = payload['salt_hex']
        release['per_query'] = [
            {
                'id': q['id'],
                'text': q['text'],
                'hyb_ndcg10': scores[q['id']][0],
                'b2_ndcg10': scores[q['id']][1],
            }
            for q in payload['queries']
        ]
    write_json_atomic(paths.releases / f'release-{run_id}.json', release)
    return release


def record_lost_key(run_id: str, branch: str, *, paths: Paths | None = None) -> dict:
    """The key is gone: record this read point as sign 'unavailable', with no number."""
    paths = paths or Paths.default()
    _, index = _gate(run_id, branch, paths)
    entry = readlog.append(
        paths.log,
        {
            **_base(run_id, branch),
            'event': 'release',
            'read_index': index,
            'sealed_sha256': None,
            'hybrid_minus_b2_ndcg10': None,
            'sign': 'unavailable',
        },
    )
    release = {
        'schema': 'arc-vault-release/1',
        **_base(run_id, branch),
        'read_index': index,
        'read_points': list(READ_POINTS[branch]),
        'reads_budget_branch': budget(branch),
        'sealed_sha256': None,
        'hybrid_minus_b2_ndcg10': None,
        'sign': 'unavailable',
        'log_entry_sha256': entry['entry_sha256'],
    }
    write_json_atomic(paths.releases / f'release-{run_id}.json', release)
    return release
