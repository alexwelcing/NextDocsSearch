"""The content-addressed cache, over a local directory or GCS.

Layout (identical on both backends):

    objects/<aa>/<sha256>          artifact bytes, addressed by their own sha256
    stages/<stage>/<key>.json      a stage record: its key material and {artifact: sha256, bytes}
    runs/<run id>/<sha256>.json    a run manifest (run.json), addressed by its sha256
    runs/<run id>/latest           the sha256 of the newest manifest for that run id

Objects and records are write-once. Writing an object that exists is a no-op (same address,
same bytes). Writing a record that exists with DIFFERENT bytes raises CacheConflict: the same
key produced different outputs, which means a stage is not deterministic (or the cache is
corrupt), and the run must not paper over it. Every object read is checked against its address.

The GCS backend (gs://witching-606c6-arcforge/cache in production) imports
google-cloud-storage inside its methods, so this module stays importable without the cloud
extra. Create-only writes use if_generation_match=0, so two VMs racing on one key cannot
overwrite each other.
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from arcforge.core.hashing import canonical_json, is_sha256, sha256_bytes

DEFAULT_GCS = 'gs://witching-606c6-arcforge/cache'
GCS_PROJECT = 'witching-606c6'


def default_cache_url() -> str:
    """$ARCFORGE_CACHE, else ~/.cache/arcforge (the laptop and the forge)."""
    return os.environ.get('ARCFORGE_CACHE') or str(Path.home() / '.cache' / 'arcforge')


class CacheError(RuntimeError):
    pass


class CacheCorrupt(CacheError):
    """An object whose bytes do not hash to its address."""


class CacheConflict(CacheError):
    """A write-once record re-written with different bytes."""


class Backend(Protocol):
    url: str

    def read(self, path: str) -> bytes | None: ...

    def write(self, path: str, data: bytes, *, create_only: bool) -> bool:
        """Store data at path. With create_only, return False (and write nothing) if it exists."""
        ...

    def list(self, prefix: str) -> list[str]: ...


class LocalBackend:
    def __init__(self, root: Path | str):
        self.root = Path(root).expanduser()
        self.url = str(self.root)

    def _path(self, path: str) -> Path:
        if path.startswith('/') or '..' in path.split('/'):
            raise CacheError(f'bad cache path {path!r}')
        return self.root / path

    def read(self, path: str) -> bytes | None:
        try:
            return self._path(path).read_bytes()
        except FileNotFoundError:
            return None

    def write(self, path: str, data: bytes, *, create_only: bool) -> bool:
        target = self._path(path)
        if create_only and target.exists():
            return False
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=target.parent, prefix='.tmp-')
        try:
            with os.fdopen(fd, 'wb') as handle:
                handle.write(data)
            if create_only:
                try:
                    os.link(tmp, target)  # atomic create-only: fails if a racer got there first
                except FileExistsError:
                    return False
                except OSError:  # a filesystem without hard links: last writer wins
                    if target.exists():
                        return False
                    os.replace(tmp, target)
                    tmp = ''
            else:
                os.replace(tmp, target)
                tmp = ''
        finally:
            if tmp and os.path.exists(tmp):
                os.unlink(tmp)
        return True

    def list(self, prefix: str) -> list[str]:
        base = self._path(prefix) if prefix else self.root
        if not base.exists():
            return []
        out = []
        for path in base.rglob('*'):
            if path.is_file() and not path.name.startswith('.tmp-'):
                out.append(path.relative_to(self.root).as_posix())
        return sorted(out)


def _http_code(error: BaseException) -> int | None:
    """google.api_core exceptions carry the HTTP status in .code (NotFound 404, 412)."""
    code = getattr(error, 'code', None)
    return code if isinstance(code, int) else None


class GCSBackend:
    """gs://bucket/prefix. `client` is injectable for tests; by default a storage.Client."""

    def __init__(self, bucket: str, prefix: str = '', client: Any = None, project: str = GCS_PROJECT):
        self.bucket_name = bucket
        self.prefix = prefix.strip('/')
        self.url = f'gs://{bucket}/{self.prefix}' if self.prefix else f'gs://{bucket}'
        self._client = client
        self._project = project
        self._bucket_handle: Any = None

    def _bucket(self) -> Any:
        if self._bucket_handle is None:
            if self._client is None:
                try:
                    from google.cloud import storage  # noqa: PLC0415 — the cloud extra
                except ImportError as error:
                    raise CacheError(
                        'the GCS cache needs google-cloud-storage: uv sync --extra cloud'
                    ) from error
                self._client = storage.Client(project=self._project)
            self._bucket_handle = self._client.bucket(self.bucket_name)
        return self._bucket_handle

    def _name(self, path: str) -> str:
        return f'{self.prefix}/{path}' if self.prefix else path

    def read(self, path: str) -> bytes | None:
        blob = self._bucket().blob(self._name(path))
        try:
            return blob.download_as_bytes()
        except Exception as error:  # noqa: BLE001 — NotFound without importing api_core
            if _http_code(error) == 404:
                return None
            raise

    def write(self, path: str, data: bytes, *, create_only: bool) -> bool:
        blob = self._bucket().blob(self._name(path))
        content_type = 'application/json' if path.endswith('.json') else 'application/octet-stream'
        try:
            blob.upload_from_string(
                data, content_type=content_type, if_generation_match=0 if create_only else None
            )
        except Exception as error:  # noqa: BLE001 — PreconditionFailed: it already exists
            if create_only and _http_code(error) == 412:
                return False
            raise
        return True

    def list(self, prefix: str) -> list[str]:
        full = self._name(prefix)
        strip = len(self.prefix) + 1 if self.prefix else 0
        self._bucket()  # creates the client on first use
        blobs = self._client.list_blobs(self.bucket_name, prefix=full)
        return sorted(blob.name[strip:] for blob in blobs)


def open_backend(url: str | None = None, *, client: Any = None) -> Backend:
    url = url or default_cache_url()
    if url.startswith('gs://'):
        bucket, _, prefix = url[len('gs://') :].partition('/')
        if not bucket:
            raise CacheError(f'bad GCS url {url!r}')
        return GCSBackend(bucket, prefix, client=client)
    return LocalBackend(url)


@dataclass
class Store:
    """The cache layout over one backend."""

    backend: Backend

    @property
    def url(self) -> str:
        return self.backend.url

    # objects
    @staticmethod
    def object_path(digest: str) -> str:
        return f'objects/{digest[:2]}/{digest}'

    def put_object(self, data: bytes) -> str:
        digest = sha256_bytes(data)
        self.backend.write(self.object_path(digest), data, create_only=True)
        return digest

    def get_object(self, digest: str) -> bytes:
        if not is_sha256(digest):
            raise CacheError(f'bad object address {digest!r}')
        data = self.backend.read(self.object_path(digest))
        if data is None:
            raise CacheError(f'object {digest} is missing from {self.url}')
        actual = sha256_bytes(data)
        if actual != digest:
            raise CacheCorrupt(f'object {digest} in {self.url} hashes to {actual}')
        return data

    def has_object(self, digest: str) -> bool:
        return self.backend.read(self.object_path(digest)) is not None

    # stage records
    @staticmethod
    def record_path(stage: str, key: str) -> str:
        return f'stages/{stage}/{key}.json'

    def put_record(self, record: dict[str, Any]) -> None:
        data = canonical_json(record)
        path = self.record_path(record['stage'], record['key'])
        if not self.backend.write(path, data, create_only=True):
            existing = self.backend.read(path)
            if existing != data:
                raise CacheConflict(
                    f'{path} already holds different outputs for the same key: '
                    f'{record["stage"]} is not deterministic, or the cache is corrupt'
                )

    def get_record(self, stage: str, key: str) -> dict[str, Any] | None:
        data = self.backend.read(self.record_path(stage, key))
        if data is None:
            return None
        record = json.loads(data)
        if record.get('stage') != stage or record.get('key') != key:
            raise CacheCorrupt(f'record {stage}/{key} does not describe itself')
        return record

    # run manifests
    def put_manifest(self, run_id: str, data: bytes) -> str:
        digest = sha256_bytes(data)
        self.backend.write(f'runs/{run_id}/{digest}.json', data, create_only=True)
        self.backend.write(f'runs/{run_id}/latest', (digest + '\n').encode(), create_only=False)
        return digest

    def get_manifest(self, run_id: str, digest: str | None = None) -> bytes:
        if digest is None:
            pointer = self.backend.read(f'runs/{run_id}/latest')
            if pointer is None:
                raise CacheError(f'no run manifest for {run_id} in {self.url}')
            digest = pointer.decode().strip()
        data = self.backend.read(f'runs/{run_id}/{digest}.json')
        if data is None:
            raise CacheError(f'run manifest {run_id}/{digest} is missing from {self.url}')
        if sha256_bytes(data) != digest:
            raise CacheCorrupt(f'run manifest {run_id}/{digest} does not match its address')
        return data


def open_store(url: str | None = None, *, client: Any = None) -> Store:
    return Store(open_backend(url, client=client))
