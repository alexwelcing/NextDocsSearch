"""Canonical JSON and sha256: the byte format behind every key, artifact and manifest.

Two runs are byte-identical only if every artifact serializes the same way, so JSON artifacts go
through `canonical_json` and nothing else: sorted keys, no insignificant whitespace, UTF-8 (not
\\u escapes), a trailing newline, and no floats that are not finite. Any change here changes
every artifact's bytes, which is why this module is part of every stage's code hash.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

HEX64 = frozenset('0123456789abcdef')


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode('utf-8'))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def is_sha256(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and set(value) <= HEX64


def _check_finite(value: Any, path: str = '$') -> None:
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError(f'non-finite float at {path}: canonical JSON has no NaN or Infinity')
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError(f'non-string key {key!r} at {path}')
            _check_finite(item, f'{path}.{key}')
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _check_finite(item, f'{path}[{index}]')


def canonical_json(value: Any) -> bytes:
    """The one serialization of a JSON value, as UTF-8 bytes ending in a newline."""
    _check_finite(value)
    text = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return (text + '\n').encode('utf-8')


def pretty_json(value: Any) -> bytes:
    """Human-readable but still canonical (sorted keys, fixed indent): for run.json and plans."""
    _check_finite(value)
    text = json.dumps(value, sort_keys=True, indent=1, ensure_ascii=False)
    return (text + '\n').encode('utf-8')


def digest_of(value: Any) -> str:
    """sha256 of a JSON value's canonical bytes."""
    return sha256_bytes(canonical_json(value))


def pairs_id(pairs: list[tuple[str, str]]) -> str:
    """sha256 over sorted (name, sha256) pairs, one 'name<TAB>sha256' line each.

    This is the corpus_id formula ('sha256 over sorted (slug, sha256(mdx))'); writing it as
    lines keeps it reproducible with sort and sha256sum.
    """
    lines = ''.join(f'{name}\t{digest}\n' for name, digest in sorted(pairs))
    return sha256_text(lines)
