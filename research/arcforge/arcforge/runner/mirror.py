"""Copy pinned Hugging Face model revisions into the same-region GCS mirror.

Runner VMs never download from the Hub: they read gs://witching-606c6-arcforge/models/<owner>/
<name>@<revision>/, which is free and fast inside us-central1 and immune to a Hub outage or a
force-pushed branch. Each mirrored revision gets a MANIFEST.json beside its files, recording for
every file its size, sha256 and GCS object generation; the manifest is written last, so its
presence means the copy is complete.

Every byte is verified on the way through: LFS files against the Hub's published sha256, small
files against their git blob id (sha1 of 'blob <size>\\0' + content). A file whose bytes do not
match is never uploaded. Re-running is cheap: files already in the manifest with a live object
generation are skipped.

Only public, ungated repos are supported; the mirror sends no Hub credentials.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterator, Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, BinaryIO

from arcforge.runner.pins import ModelPin
from arcforge.runner.shell import Shell, check

HUB = 'https://huggingface.co'
CHUNK = 8 * 1024 * 1024


class MirrorError(RuntimeError):
    pass


@dataclass(frozen=True)
class HubFile:
    path: str
    size: int
    sha256: str | None  # LFS files only
    blob_id: str | None  # git sha1 of the blob; for non-LFS files this is the content check


@dataclass(frozen=True)
class Resolved:
    pin: ModelPin
    files: tuple[HubFile, ...]
    gated: bool
    last_modified: str | None

    @property
    def total_bytes(self) -> int:
        return sum(f.size for f in self.files)


Open = Callable[[str], BinaryIO]


def _open(url: str) -> BinaryIO:
    request = urllib.request.Request(url, headers={'User-Agent': 'arcforge-mirror'})
    return urllib.request.urlopen(request, timeout=120)  # noqa: S310 — fixed https host


def resolve(pin: ModelPin, *, open_url: Open = _open) -> Resolved:
    """Confirm the pinned revision exists on the Hub and list the files to mirror."""
    url = f'{HUB}/api/models/{pin.repo}/revision/{pin.revision}?blobs=true'
    try:
        with open_url(url) as response:
            info = json.load(response)
    except urllib.error.HTTPError as error:
        raise MirrorError(f'{pin.repo}@{pin.revision[:12]}: the Hub answered {error.code}') from error
    if info.get('sha') != pin.revision:
        raise MirrorError(f'{pin.repo}: asked for {pin.revision}, the Hub resolved {info.get("sha")}')
    files = []
    for sibling in info.get('siblings', []):
        path = sibling['rfilename']
        if not pin.wanted(path):
            continue
        lfs = sibling.get('lfs') or {}
        files.append(HubFile(path, int(sibling.get('size') or lfs.get('size') or 0), lfs.get('sha256'), sibling.get('blobId')))
    return Resolved(pin, tuple(sorted(files, key=lambda f: f.path)), bool(info.get('gated')), info.get('lastModified'))


def file_url(pin: ModelPin, path: str) -> str:
    return f'{HUB}/{pin.repo}/resolve/{pin.revision}/{urllib.parse.quote(path)}'


def download(pin: ModelPin, hub_file: HubFile, dest: Path, *, open_url: Open = _open) -> str:
    """Stream one file to dest, verifying size and hash. Returns its sha256."""
    sha256 = hashlib.sha256()
    git = hashlib.sha1(f'blob {hub_file.size}\0'.encode())  # noqa: S324 — git's object id, not security
    size = 0
    with open_url(file_url(pin, hub_file.path)) as response, dest.open('wb') as out:
        for chunk in iter(lambda: response.read(CHUNK), b''):
            sha256.update(chunk)
            git.update(chunk)
            out.write(chunk)
            size += len(chunk)
    digest = sha256.hexdigest()
    if size != hub_file.size:
        raise MirrorError(f'{hub_file.path}: got {size} bytes, the Hub lists {hub_file.size}')
    if hub_file.sha256 and digest != hub_file.sha256:
        raise MirrorError(f'{hub_file.path}: sha256 {digest} != the Hub\'s {hub_file.sha256}')
    if not hub_file.sha256 and hub_file.blob_id and git.hexdigest() != hub_file.blob_id:
        raise MirrorError(f'{hub_file.path}: git blob id {git.hexdigest()} != the Hub\'s {hub_file.blob_id}')
    return digest


# --- the GCS side ---------------------------------------------------------------------------


def read_manifest(shell: Shell, pin: ModelPin, bucket: str) -> dict[str, Any] | None:
    result = shell.run(['gcloud', 'storage', 'cat', pin.gcs_prefix(bucket) + 'MANIFEST.json'], timeout=60)
    return json.loads(result.stdout) if result.ok else None


def object_generations(shell: Shell, pin: ModelPin, bucket: str) -> dict[str, str]:
    """{relative path: generation} of every object under the revision's prefix."""
    prefix = pin.gcs_prefix(bucket)
    name_prefix = prefix.removeprefix(f'gs://{bucket}/')
    objects = check(shell.run(['gcloud', 'storage', 'objects', 'list', prefix + '**', '--format=json'], timeout=300)).json()
    return {
        obj['name'][len(name_prefix):]: str(obj['generation'])
        for obj in objects or []
        if obj.get('name', '').startswith(name_prefix)
    }


def upload(shell: Shell, local: Path, url: str) -> str:
    """Upload and return the new object's generation."""
    check(shell.run(['gcloud', 'storage', 'cp', str(local), url, '--quiet'], timeout=3600))
    described = check(shell.run(['gcloud', 'storage', 'objects', 'describe', url, '--format=json'], timeout=60)).json()
    return str(described['generation'])


@dataclass
class FileRecord:
    path: str
    size: int
    sha256: str
    gcs_generation: str


def mirror(
    shell: Shell,
    resolved: Resolved,
    *,
    bucket: str,
    workdir: Path,
    now_utc: str,
    open_url: Open = _open,
    log: Callable[[str], None] = print,
) -> dict[str, Any]:
    """Copy one resolved revision into GCS and write its manifest. Returns the manifest."""
    pin = resolved.pin
    if resolved.gated:
        raise MirrorError(f'{pin.repo} is gated on the Hub; the mirror only copies public repos')
    prefix = pin.gcs_prefix(bucket)
    previous = {f['path']: f for f in (read_manifest(shell, pin, bucket) or {}).get('files', [])}
    live = object_generations(shell, pin, bucket)
    records: list[FileRecord] = []
    workdir.mkdir(parents=True, exist_ok=True)
    for hub_file in resolved.files:
        old = previous.get(hub_file.path)
        if old and old['size'] == hub_file.size and live.get(hub_file.path) == old['gcs_generation'] and (
            not hub_file.sha256 or old['sha256'] == hub_file.sha256
        ):
            log(f'mirror: {pin.key}: {hub_file.path} already mirrored')
            records.append(FileRecord(**old))
            continue
        log(f'mirror: {pin.key}: {hub_file.path} ({hub_file.size / 1e9:.2f} GB)')
        with tempfile.NamedTemporaryFile(dir=workdir, delete=False) as tmp:
            local = Path(tmp.name)
        try:
            digest = download(pin, hub_file, local, open_url=open_url)
            generation = upload(shell, local, prefix + hub_file.path)
        finally:
            local.unlink(missing_ok=True)
        records.append(FileRecord(hub_file.path, hub_file.size, digest, generation))
    manifest = {
        'repo': pin.repo,
        'revision': pin.revision,
        'key': pin.key,
        'source': f'{HUB}/{pin.repo}/tree/{pin.revision}',
        'hub_last_modified': resolved.last_modified,
        'excluded': list(pin.exclude),
        'mirrored_utc': now_utc,
        'total_bytes': sum(r.size for r in records),
        'files': [asdict(r) for r in records],
    }
    body = workdir / f'MANIFEST-{pin.key}.json'
    body.write_text(json.dumps(manifest, indent=2, sort_keys=True) + '\n')
    try:
        upload(shell, body, prefix + 'MANIFEST.json')
    finally:
        body.unlink(missing_ok=True)
    log(f'mirror: {pin.key}: {len(records)} files, {manifest["total_bytes"] / 1e9:.2f} GB at {prefix}')
    return manifest


def verify(shell: Shell, pin: ModelPin, bucket: str) -> list[str]:
    """Problems with a mirrored revision (empty when the manifest matches the live objects)."""
    manifest = read_manifest(shell, pin, bucket)
    if manifest is None:
        return ['not mirrored (no MANIFEST.json)']
    if manifest.get('revision') != pin.revision:
        return [f'manifest is for revision {manifest.get("revision")}, the pin is {pin.revision}']
    live = object_generations(shell, pin, bucket)
    return [
        f'{f["path"]}: generation {live.get(f["path"])} != manifest {f["gcs_generation"]}'
        for f in manifest['files']
        if live.get(f['path']) != f['gcs_generation']
    ]


def default_workdir() -> Path:
    return Path(os.environ.get('ARCFORGE_MIRROR_TMP', Path.home() / '.cache' / 'arcforge' / 'mirror-tmp'))


def select(pins: Sequence[ModelPin], keys: Sequence[str], *, all_pins: bool) -> list[ModelPin]:
    if all_pins:
        return list(pins)
    if not keys:
        return [p for p in pins if p.default]
    by_key = {p.key: p for p in pins}
    unknown = [k for k in keys if k not in by_key]
    if unknown:
        raise MirrorError(f'unknown model keys {unknown}; known: {sorted(by_key)}')
    return [by_key[k] for k in keys]


def iter_lines(resolved: Resolved) -> Iterator[str]:
    for f in resolved.files:
        check_kind = 'sha256' if f.sha256 else 'git-blob'
        yield f'  {f.path}  {f.size:,} B  ({check_kind})'
