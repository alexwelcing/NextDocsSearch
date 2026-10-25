"""The pinned inputs a runner VM boots from: the container digest and the model revisions.

Both live as JSON next to this module (arcforge/runner/pinned/), so they ship inside the package,
are hashed with the code, and change only through a reviewed commit. JSON rather than YAML keeps
the loader stdlib-only for `arcforge doctor` on a bare checkout.
"""

from __future__ import annotations

import fnmatch
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.runner.config import BUCKET

PINNED = Path(__file__).resolve().parent / 'pinned'
MODELS_FILE = PINNED / 'models.json'
IMAGE_FILE = PINNED / 'image.json'
_SHA1 = re.compile(r'[0-9a-f]{40}')
_DIGEST = re.compile(r'sha256:[0-9a-f]{64}')


class PinError(ValueError):
    pass


@dataclass(frozen=True)
class ModelPin:
    key: str
    repo: str
    revision: str
    role: str
    default: bool = True
    exclude: tuple[str, ...] = ()
    fallback_for: str | None = None
    note: str = ''

    def __post_init__(self) -> None:
        if not _SHA1.fullmatch(self.revision):
            raise PinError(f'{self.key}: revision must be a full 40-hex commit SHA, got {self.revision!r}')
        if self.repo.count('/') != 1:
            raise PinError(f'{self.key}: repo must be owner/name, got {self.repo!r}')

    def wanted(self, path: str) -> bool:
        return not any(fnmatch.fnmatchcase(path, pattern) for pattern in self.exclude)

    def gcs_prefix(self, bucket: str = BUCKET) -> str:
        """gs://<bucket>/models/<owner>/<name>@<revision>/ — the layout the program names."""
        return f'gs://{bucket}/models/{self.repo}@{self.revision}/'


@dataclass(frozen=True)
class ImagePin:
    repository: str
    digest: str | None
    built_from: str | None = None
    built_utc: str | None = None
    cuda: str | None = None
    torch: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def ref(self) -> str | None:
        """repository@sha256:… — the only form a runner VM pulls."""
        return f'{self.repository}@{self.digest}' if self.digest else None


def load_models(path: Path = MODELS_FILE) -> list[ModelPin]:
    raw = json.loads(path.read_text())['models']
    pins = [
        ModelPin(**{**entry, 'exclude': tuple(entry.get('exclude', ()))})
        for entry in raw
    ]
    keys = [p.key for p in pins]
    if len(set(keys)) != len(keys):
        raise PinError(f'duplicate model keys in {path.name}')
    for pin in pins:
        if pin.fallback_for and pin.fallback_for not in keys:
            raise PinError(f'{pin.key}: fallback_for names unknown key {pin.fallback_for!r}')
    return pins


def model(key: str, path: Path = MODELS_FILE) -> ModelPin:
    for pin in load_models(path):
        if pin.key == key:
            return pin
    raise PinError(f'no pinned model {key!r} (known: {", ".join(p.key for p in load_models(path))})')


def load_image(path: Path = IMAGE_FILE) -> ImagePin:
    raw = json.loads(path.read_text())
    raw.pop('comment', None)
    known = {'repository', 'digest', 'built_from', 'built_utc', 'cuda', 'torch'}
    pin = ImagePin(**{k: raw.pop(k) for k in known if k in raw}, extra=raw)
    if pin.digest is not None and not _DIGEST.fullmatch(pin.digest):
        raise PinError(f'image digest must be sha256:<64 hex>, got {pin.digest!r}')
    return pin


def write_image(pin: ImagePin, path: Path = IMAGE_FILE) -> None:
    body = {
        'comment': json.loads(path.read_text()).get('comment', '') if path.exists() else '',
        'repository': pin.repository,
        'digest': pin.digest,
        'built_from': pin.built_from,
        'built_utc': pin.built_utc,
        'cuda': pin.cuda,
        'torch': pin.torch,
        **pin.extra,
    }
    path.write_text(json.dumps(body, indent=2) + '\n')
