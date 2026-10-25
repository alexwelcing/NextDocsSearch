"""The vault read log: an append-only, hash-chained JSONL file on the owner's laptop.

Every attempt is logged, including refusals:
- 'refused': a read the rules turned down (nothing was opened);
- 'open': the key was accepted and the sealed file is about to be decrypted;
- 'release': the numbers were released. Releases are what the read budget counts.

An 'open' without a 'release' (say, a scorer crash) leaves the read point unused, so it can be
retried, but it stays visible in the log forever. Each entry carries the sha256 of the previous
one and its own, so a deleted, edited or reordered line breaks the chain and every later read is
refused until the log is restored. The orchestrator copies public_log() into report.json.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from arcforge.owner.paths import make_dirs_private
from arcforge.vault.digest import canonical_json, sha256_hex

GENESIS = '0' * 64
EVENTS = ('refused', 'open', 'release')


class LogCorrupt(Exception):
    """The read log does not verify: an entry was edited, removed or reordered."""


def _entry_hash(entry: dict) -> str:
    return sha256_hex(canonical_json({k: v for k, v in entry.items() if k != 'entry_sha256'}))


def load(path: Path) -> list[dict]:
    """Every entry, after verifying the whole chain. A missing log is an empty log."""
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except FileNotFoundError:
        return []
    entries: list[dict] = []
    prev = GENESIS
    for number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            raise LogCorrupt(f'{path}:{number} is not JSON') from None
        if not isinstance(entry, dict) or entry.get('event') not in EVENTS:
            raise LogCorrupt(f'{path}:{number} is not a read-log entry')
        if entry.get('seq') != len(entries) + 1 or entry.get('prev_sha256') != prev:
            raise LogCorrupt(f'{path}:{number} breaks the chain (an entry was removed or moved)')
        if entry.get('entry_sha256') != _entry_hash(entry):
            raise LogCorrupt(f'{path}:{number} was edited after it was written')
        entries.append(entry)
        prev = entry['entry_sha256']
    return entries


def append(path: Path, entry: dict) -> dict:
    """Chain `entry` onto the log, durably, and return it as written."""
    entries = load(path)
    chained = {
        'seq': len(entries) + 1,
        **entry,
        'prev_sha256': entries[-1]['entry_sha256'] if entries else GENESIS,
    }
    if chained.get('event') not in EVENTS:
        raise ValueError(f'unknown read-log event {chained.get("event")!r}')
    chained['entry_sha256'] = _entry_hash(chained)
    make_dirs_private(path.parent)
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
    with os.fdopen(fd, 'a', encoding='utf-8') as handle:
        handle.write(json.dumps(chained, ensure_ascii=False, sort_keys=True) + '\n')
        handle.flush()
        os.fsync(handle.fileno())
    return chained


def releases(entries: list[dict]) -> list[dict]:
    return [entry for entry in entries if entry['event'] == 'release']


def released_runs(entries: list[dict]) -> list[str]:
    return [entry['run_id'] for entry in releases(entries)]


def public_log(entries: list[dict]) -> list[dict]:
    """report.json's vault.log: one row per release, with no numbers beyond the run's own."""
    return [
        {
            'read_index': entry['read_index'],
            'run_id': entry['run_id'],
            'utc': entry['utc'],
            'sealed_sha256': entry['sealed_sha256'],
            'host': entry['host'],
        }
        for entry in releases(entries)
    ]
