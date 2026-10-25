"""Where owner-held state lives, and how the desk finds the repo it serves records from.

Everything the owner writes stays in ~/arc-owner/ on the laptop: never the repo, the VM, GCS or
HF. The pipeline drops what the owner reviews (people.json, registers.json, the audit pairs) into
~/arc-owner/prep/, and the vault keeps its laptop-side files in ~/arc-owner/vault/.

The location is always `Path.home() / 'arc-owner'`, with no override: tests point HOME at a
temp directory instead, so no code path can be talked into writing owner data anywhere else.
"""

from __future__ import annotations

import os
from pathlib import Path

OWNER_DIRNAME = 'arc-owner'

# research/arcforge, the directory that holds pyproject.toml and configs/.
PACKAGE_ROOT = Path(__file__).resolve().parents[2]


def owner_dir() -> Path:
    return Path.home() / OWNER_DIRNAME


def prep_dir() -> Path:
    """The pipeline's inbox for the desk: files the owner reviews but never edits in place."""
    return owner_dir() / 'prep'


def vault_dir() -> Path:
    return owner_dir() / 'vault'


def recipient_path() -> Path:
    """configs/vault.recipient: the owner's public age recipient, safe to commit."""
    return PACKAGE_ROOT / 'configs' / 'vault.recipient'


def ensure_private_dir(path: Path) -> Path:
    """Create `path` (and parents) readable by the owner only, and tighten it if it exists."""
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path, 0o700)
    return path


def find_repo_root(start: Path | None = None) -> Path | None:
    """The NextDocsSearch checkout above `start`: the first directory with the record manifest
    (lib/generated/article-manifest.json) or the record bodies (public/arc/records)."""
    here = (start or PACKAGE_ROOT).resolve()
    for candidate in (here, *here.parents):
        if (candidate / 'lib' / 'generated' / 'article-manifest.json').is_file():
            return candidate
        if (candidate / 'public' / 'arc' / 'records').is_dir():
            return candidate
    return None
