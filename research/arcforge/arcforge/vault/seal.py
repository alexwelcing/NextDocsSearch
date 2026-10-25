"""Seal the vault: the 70 vault queries (and, at the end of R00, their qrels) to the owner.

The sealed payload is canonical JSON, piped straight into `age --encrypt --armor -r <owner>`, so
the combined plaintext never touches a disk. The salt rides inside it. Two public numbers come
out, for the bench card:
- queries_commitment_sha256: the salted sha256 of the vault query file (the S0 commitment,
  recomputed here, so a sealed file can never hold different queries than were committed);
- sealed_sha256: the sha256 of the sealed file itself.

Afterwards the plaintext inputs are shredded (overwritten, then deleted). On SSDs and APFS an
overwrite is best effort, so the plaintext is also kept off shared disks in the first place.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from arcforge.owner.store import read_json, utc_now, write_bytes_atomic, write_json_atomic
from arcforge.vault import age
from arcforge.vault.digest import canonical_json, queries_commitment, sha256_hex

PAYLOAD_SCHEMA = 'arc-vault/1'
COMMITMENTS_SCHEMA = 'arc-vault-commitments/1'
QRELS_SCHEMA = 'arc-vault-qrels/1'
GRADES = (0, 1, 2, 3)


class SealError(Exception):
    pass


@dataclass(frozen=True)
class Sealed:
    sealed_path: Path
    commitments_path: Path
    commitments: dict


def _read(path: Path) -> object:
    try:
        return read_json(path)
    except ValueError as error:
        raise SealError(f'{path} is not valid JSON ({error})') from None


def _load_vault_queries(path: Path) -> tuple[bytes, list[dict], str]:
    doc = _read(path)
    if not isinstance(doc, dict) or doc.get('schema') != 'arc-vault-queries/1':
        raise SealError(f'{path} is not an arc-vault-queries/1 file (from `arcforge vault split`)')
    try:
        salt = bytes.fromhex(doc['salt_hex'])
    except (KeyError, TypeError, ValueError):
        raise SealError(f'{path} has no valid salt') from None
    queries = doc.get('queries')
    if not isinstance(queries, list) or not queries:
        raise SealError(f'{path} holds no queries')
    commitment = queries_commitment(salt, queries)
    if doc.get('queries_commitment_sha256') not in (None, commitment):
        raise SealError(
            f'{path} no longer matches its S0 commitment; it was edited after the split'
        )
    return salt, queries, commitment


def _load_qrels(path: Path, vault_ids: set[str]) -> dict[str, dict[str, int]]:
    """{query_id: {slug: grade}} for vault queries only, grades 0-3, in sorted order."""
    doc = _read(path)
    rows = doc.get('qrels') if isinstance(doc, dict) else None
    if not isinstance(rows, dict) or doc.get('schema') != QRELS_SCHEMA:
        raise SealError(
            f'{path} must be {QRELS_SCHEMA}: {{"qrels": {{query_id: {{slug: grade}}}}}}'
        )
    out: dict[str, dict[str, int]] = {}
    for qid, grades in rows.items():
        if qid not in vault_ids:
            raise SealError(f'{path}: {qid} is not a vault query')
        valid = isinstance(grades, dict) and all(
            isinstance(slug, str) and not isinstance(g, bool) and g in GRADES
            for slug, g in grades.items()
        )
        if not valid:
            raise SealError(f'{path}: {qid} must map record slugs to grades 0-3')
        out[qid] = dict(sorted(grades.items()))
    return dict(sorted(out.items()))


def shred(path: Path) -> None:
    """Overwrite with random bytes, sync, then unlink (best effort on SSDs; see module doc)."""
    try:
        size = path.stat().st_size
    except FileNotFoundError:
        return
    with path.open('r+b') as handle:
        handle.write(os.urandom(size))
        handle.flush()
        os.fsync(handle.fileno())
    path.unlink()


def seal(
    vault_queries: Path,
    recipient_file: Path,
    out: Path,
    *,
    qrels: Path | None = None,
    commitments_out: Path | None = None,
    shred_inputs: bool = True,
) -> Sealed:
    if out.exists():
        raise SealError(
            f'{out} exists; a vault is sealed once (move it aside deliberately to reseal)'
        )
    recipient = age.read_recipient_file(recipient_file)
    salt, queries, commitment = _load_vault_queries(vault_queries)
    vault_ids = {q['id'] for q in queries}
    qrel_rows = _load_qrels(qrels, vault_ids) if qrels else None
    now = utc_now()
    payload = {
        'schema': PAYLOAD_SCHEMA,
        'sealed_utc': now,
        'salt_hex': salt.hex(),
        'queries': queries,
        'qrels': qrel_rows,
    }
    ciphertext = age.encrypt(canonical_json(payload), recipient)
    write_bytes_atomic(out, ciphertext, mode=0o644)
    commitments = {
        'schema': COMMITMENTS_SCHEMA,
        'sealed_utc': now,
        'sealed_file': out.name,
        'sealed_sha256': sha256_hex(ciphertext),
        'queries_commitment_sha256': commitment,
        'n_queries': len(queries),
        'has_qrels': qrel_rows is not None,
        'recipient': recipient,
        'age_version': age.version(),
    }
    commitments_path = commitments_out or out.with_name('vault-commitments.json')
    write_json_atomic(commitments_path, commitments, mode=0o644)
    if shred_inputs:
        shred(vault_queries)
        if qrels:
            shred(qrels)
    return Sealed(out, commitments_path, commitments)
