"""Canonical bytes and the vault's sha256 commitments.

The commitments are published in the bench card long before anyone can check them, so their
input bytes are pinned here once: canonical JSON (sorted keys, no whitespace, UTF-8) behind a
domain-separation tag. Changing anything in this file breaks every published commitment.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

QUERIES_TAG = b'arc-vault-queries/1\x00'
SPLIT_TAG = b'arc-s0-split/1\x00'


def canonical_json(obj: Any) -> bytes:
    return json.dumps(
        obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False
    ).encode('utf-8')


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1 << 16), b''):
            digest.update(block)
    return digest.hexdigest()


def queries_commitment(salt: bytes, queries: list[dict]) -> str:
    """The salted sha256 of the vault query file, published at S0.

    The salt is secret until the vault opens at R10 (it travels inside the sealed file), so the
    commitment reveals nothing about 70 short, guessable queries, yet anyone can check it later.
    """
    return sha256_hex(QUERIES_TAG + salt + canonical_json(queries))


def split_key(salt: bytes, query_id: str, text: str) -> str:
    """The S0 sort key: the 70 queries with the lowest keys go to the vault."""
    return sha256_hex(SPLIT_TAG + salt + query_id.encode('utf-8') + b'\x00' + text.encode('utf-8'))
