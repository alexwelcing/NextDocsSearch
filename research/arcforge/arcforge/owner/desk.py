"""The Owner Desk's application core, independent of HTTP: state, saves, locks and progress.

`Desk.state()` is everything the page renders; `Desk.save()` validates one document, writes it
atomically and returns the new state of that document plus fresh progress. The HTTP layer in
server.py is a thin shell over these two calls, and the tests drive this class directly.
"""

from __future__ import annotations

import threading
from pathlib import Path

from arcforge import __version__
from arcforge.owner import model, progress
from arcforge.owner.paths import ensure_private_dir, owner_dir, prep_dir, recipient_path
from arcforge.owner.prep import PREP_FILES, PrepFile, load_prep
from arcforge.owner.records import FRONTIER_SERIES, RecordIndex, load_records
from arcforge.owner.store import Conflict, DocStore, read_json, utc_now

S0_LOCK = 's0-lock.json'


class Locked(Exception):
    """The document was frozen at S0."""


class Desk:
    def __init__(
        self,
        repo_root: Path | None,
        *,
        recipient_file: Path | None = None,
        records: RecordIndex | None = None,
    ) -> None:
        self.root = ensure_private_dir(owner_dir())
        self.prep_root = prep_dir()
        self.repo_root = repo_root
        self.recipient_file = recipient_file or recipient_path()
        self.records = records if records is not None else load_records(repo_root)
        self._by_slug = self.records.by_slug()
        self.store = DocStore(self.root, model.DOCS)
        self._prep_cache: dict[str, PrepFile] = {}
        self._lock = threading.Lock()

    # ---- inputs --------------------------------------------------------------------------------

    def prep(self) -> dict[str, PrepFile]:
        """Every prep file, re-parsed only when its mtime or size changed."""
        out = {}
        for name, (filename, _) in PREP_FILES.items():
            cached = self._prep_cache.get(name)
            try:
                stat = (self.prep_root / filename).stat()
                signature = (stat.st_mtime_ns, stat.st_size)
            except FileNotFoundError:
                signature = None
            if cached is None or cached.signature != signature:
                cached = load_prep(self.prep_root, name, self._by_slug)
                self._prep_cache[name] = cached
            out[name] = cached
        return out

    def s0_lock(self) -> dict | None:
        try:
            lock = read_json(self.root / S0_LOCK)
        except ValueError:
            return {'locked_utc': None, 'note': 's0-lock.json is unreadable; treating as locked'}
        return lock if isinstance(lock, dict) else None

    def recipient_present(self) -> bool:
        return self.recipient_file.is_file()

    def context(self, docs: dict[str, dict], prep: dict[str, PrepFile]) -> model.Context:
        return model.Context(
            records=self._by_slug,
            prep={name: (p.data or {}) for name, p in prep.items() if p.status == 'ok'},
            docs=docs,
        )

    # ---- state ---------------------------------------------------------------------------------

    def _assemble(self) -> dict:
        docs = {name: self.store.load(name) for name in model.DOCS}
        prep = self.prep()
        ctx = self.context(docs, prep)
        derived = {name: model.derive(name, doc, ctx) for name, doc in docs.items()}
        lock = self.s0_lock()
        state = {
            'version': __version__,
            'owner_dir': str(self.root),
            'docs': docs,
            'derived': derived,
            'prep': {name: p.to_json() for name, p in prep.items()},
            'lock': lock,
            'locked_docs': sorted(model.LOCKED_AT_S0) if lock else [],
            'vault': {
                'recipient_present': self.recipient_present(),
                'recipient_file': str(self.recipient_file),
            },
            'records': {'source': self.records.source, 'count': len(self.records.records)},
            'limits': {
                'max_chars': model.MAX_CHARS,
                'main_target': model.MAIN_TARGET,
                'frontier_per_series': model.FRONTIER_PER_SERIES,
                'frontier_series': FRONTIER_SERIES,
                'voice_slots': model.VOICE_SLOTS,
                'voices': [{'id': i, 'label': label, 'brief': b} for i, label, b in model.VOICES],
                'new_people': list(model.NEW_PEOPLE),
            },
        }
        state['progress'] = progress.compute(state)
        return state

    def state(self) -> dict:
        with self._lock:
            return self._assemble()

    def ping(self) -> dict:
        """The cheap poll: enough for the page to notice new prep files or a lock."""
        prep = self.prep()
        return {
            'prep': {name: p.status for name, p in prep.items()},
            'prep_signature': [list(p.signature) if p.signature else None for p in prep.values()],
            'locked': self.s0_lock() is not None,
            'recipient_present': self.recipient_present(),
        }

    def records_json(self) -> list[dict]:
        return [record.to_json() for record in self.records.records]

    # ---- saves ---------------------------------------------------------------------------------

    def save(self, name: str, base_rev: int, payload: object) -> dict:
        """Validate and write one document. Raises KeyError (unknown name), Locked, Conflict or
        model.ValidationError; returns {doc, derived, progress} on success."""
        if name not in model.DOCS:
            raise KeyError(name)
        with self._lock:
            if name in model.LOCKED_AT_S0 and self.s0_lock() is not None:
                raise Locked(f'{name} was frozen at S0 and is read-only now')
            docs = {n: self.store.load(n) for n in model.DOCS}
            prep = self.prep()
            ctx = self.context(docs, prep)
            clean = model.normalize(name, payload, ctx, utc_now())
            if name == 'launch' and clean['requested_utc'] and not docs['launch'].get('requested_utc'):
                blockers = self._assemble()['progress']['blockers']
                if blockers:
                    raise model.ValidationError('Not ready to launch: ' + ' '.join(blockers))
            doc = self.store.save(name, clean, base_rev)
            docs[name] = doc
            state = self._assemble()
            return {
                'doc': doc,
                'derived': state['derived'][name],
                'derived_all': state['derived'],
                'progress': state['progress'],
            }


__all__ = ['Conflict', 'Desk', 'Locked']
