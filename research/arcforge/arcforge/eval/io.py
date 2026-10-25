"""Byte conventions for the verdict stages' artifacts (INTERFACES-M2 C), standard library only.

These mirror core/artifacts.py (m2-runtime): canonical JSON with a top-level schema, JSONL sorted
by its primary key, gzip with mtime 0 and no filename at level 6, ustar tar with sorted members,
mtime 0, uid/gid 0 and mode 0644. When core/artifacts.py lands, `canonical`, `jsonl`, `gz` and
`tar` defer to it.
"""

from __future__ import annotations

import gzip
import io
import json
import tarfile
from collections.abc import Iterable, Mapping
from typing import Any


def canonical(value: Any) -> bytes:
    from arcforge.core.hashing import canonical_json

    return canonical_json(value)


def pretty(value: Any) -> bytes:
    return (json.dumps(value, indent=1, ensure_ascii=False) + '\n').encode('utf-8')


def jsonl(rows: Iterable[Mapping[str, Any]], key: str | tuple[str, ...] | None = None) -> bytes:
    rows = list(rows)
    if key is not None:
        keys = (key,) if isinstance(key, str) else key
        rows.sort(key=lambda r: tuple(str(r.get(k)) for k in keys))
    return b''.join(canonical(r) + b'\n' for r in rows)


def read_jsonl(data: bytes) -> list[dict[str, Any]]:
    if data[:2] == b'\x1f\x8b':
        data = gzip.decompress(data)
    return [json.loads(line) for line in data.splitlines() if line.strip()]


def read_json(data: bytes) -> Any:
    if data[:2] == b'\x1f\x8b':
        data = gzip.decompress(data)
    return json.loads(data)


def gz(data: bytes) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=buffer, compresslevel=6, mtime=0) as f:
        f.write(data)
    return buffer.getvalue()


def tar(members: Mapping[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode='w', format=tarfile.USTAR_FORMAT) as archive:
        for name in sorted(members):
            info = tarfile.TarInfo(name)
            info.size = len(members[name])
            info.mtime = 0
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(members[name]))
    return buffer.getvalue()


def untar(data: bytes) -> dict[str, bytes]:
    out = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r') as archive:
        for member in archive.getmembers():
            if member.isfile():
                handle = archive.extractfile(member)
                assert handle is not None
                out[member.name] = handle.read()
    return out
