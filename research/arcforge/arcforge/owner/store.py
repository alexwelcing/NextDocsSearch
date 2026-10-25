"""Atomic JSON files and the desk's revisioned document store.

Every write goes to a temp file in the same directory, is fsynced, and then replaces the target
with os.replace, so a crash, a full disk or a yanked laptop lid leaves either the old file or the
new one — never half of either. The previous version of each document is kept in
~/arc-owner/history/<name>/ (the newest HISTORY_KEEP), so an edit made by mistake can be undone
by hand.

Documents carry a `rev` counter. A save names the rev it was based on, and a stale rev is a
Conflict: two browser windows on the same tab can never silently overwrite each other.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from arcforge.owner.paths import ensure_private_dir

HISTORY_KEEP = 50


def utc_now() -> str:
    """UTC timestamp with second precision, e.g. 2026-10-24T18:03:11Z."""
    return datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')


def dumps(obj: Any) -> str:
    """The on-disk form: indented for the owner to read, key order as built, trailing newline."""
    return json.dumps(obj, indent=2, ensure_ascii=False, allow_nan=False) + '\n'


def write_bytes_atomic(path: Path, data: bytes, *, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f'.{path.name}.', suffix='.tmp')
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(tmp, mode)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    try:  # make the rename itself durable
        dir_fd = os.open(path.parent, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(dir_fd)
    except OSError:
        pass
    finally:
        os.close(dir_fd)


def write_json_atomic(path: Path, obj: Any, *, mode: int = 0o600) -> None:
    write_bytes_atomic(path, dumps(obj).encode('utf-8'), mode=mode)


def read_json(path: Path) -> Any | None:
    """The parsed file, or None when it does not exist. Malformed JSON raises ValueError."""
    try:
        text = path.read_text(encoding='utf-8')
    except FileNotFoundError:
        return None
    return json.loads(text)


def _envelope(payload: dict, *, rev: int, updated_utc: str | None) -> dict:
    """schema, rev and updated_utc first, then the payload's own fields in their order."""
    head = {'schema': payload.get('schema'), 'rev': rev, 'updated_utc': updated_utc}
    return {**head, **{k: v for k, v in payload.items() if k not in head}}


class Conflict(Exception):
    """A save was based on an older rev than the one on disk."""

    def __init__(self, current: dict) -> None:
        super().__init__(f'stale rev: the document is at rev {current.get("rev")}')
        self.current = current


class DocStore:
    """Named JSON documents in one private directory, each with a rev and a short history.

    `defaults` maps each document name to (file name, factory for its empty payload). Only those
    names can be read or written, so a request path can never pick a file.
    """

    def __init__(self, root: Path, defaults: dict[str, tuple[str, Callable[[], dict]]]) -> None:
        self.root = root
        self.defaults = defaults
        self._lock = threading.Lock()

    def path(self, name: str) -> Path:
        return self.root / self.defaults[name][0]

    def load(self, name: str) -> dict:
        filename, factory = self.defaults[name]
        doc = read_json(self.root / filename)
        if not isinstance(doc, dict):
            doc = _envelope(factory(), rev=0, updated_utc=None)
        return doc

    def save(self, name: str, payload: dict, base_rev: int) -> dict:
        """Write `payload` as the next rev of `name`. Raises Conflict when base_rev is stale."""
        with self._lock:
            ensure_private_dir(self.root)
            current = self.load(name)
            if int(current.get('rev', 0)) != base_rev:
                raise Conflict(current)
            doc = _envelope(payload, rev=base_rev + 1, updated_utc=utc_now())
            target = self.path(name)
            if target.exists():
                self._archive(name, target, int(current.get('rev', 0)))
            write_json_atomic(target, doc)
            return doc

    def _archive(self, name: str, target: Path, rev: int) -> None:
        history = ensure_private_dir(self.root / 'history' / name)
        write_bytes_atomic(history / f'rev-{rev:06d}.json', target.read_bytes())
        old = sorted(history.glob('rev-*.json'))
        for stale in old[:-HISTORY_KEEP]:
            stale.unlink(missing_ok=True)
