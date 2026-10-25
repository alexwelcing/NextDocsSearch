import json
import shutil
import sys
from pathlib import Path

import pytest

from arcforge.vault import age
from arcforge.vault import read as vault_read

HERE = Path(__file__).resolve().parent


@pytest.fixture
def home(tmp_path, monkeypatch):
    """A temp HOME, so ~/arc-owner/ is private to the test."""
    path = tmp_path / 'home'
    path.mkdir()
    monkeypatch.setenv('HOME', str(path))
    return path


def _wrapper(folder: Path, tool: str) -> Path:
    script = folder / tool
    script.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{HERE / "fake_age.py"}" {tool} "$@"\n')
    script.chmod(0o755)
    return script


@pytest.fixture
def fake_age(tmp_path, monkeypatch):
    """Route arcforge.vault.age to the test double in fake_age.py."""
    folder = tmp_path / 'bin'
    folder.mkdir()
    monkeypatch.setenv(age.AGE_ENV, str(_wrapper(folder, 'age')))
    monkeypatch.setenv(age.KEYGEN_ENV, str(_wrapper(folder, 'age-keygen')))
    return folder


@pytest.fixture
def real_age(monkeypatch):
    """The real age CLI, or skip."""
    monkeypatch.delenv(age.AGE_ENV, raising=False)
    monkeypatch.delenv(age.KEYGEN_ENV, raising=False)
    if not (shutil.which('age') or Path('/opt/homebrew/bin/age').exists()) or not age.available():
        pytest.skip('age is not installed here')
    return True


@pytest.fixture
def laptop(monkeypatch):
    """Pretend this machine is the owner's laptop (CI and the forge VM are not)."""
    monkeypatch.setattr(vault_read, 'runner_reason', lambda: None)


def owner_queries(n_main: int = 100, per_series: int = 4) -> dict:
    """A complete ~/arc-owner/queries.json, as the desk writes it."""
    queries = []
    for i in range(1, n_main + 1):
        queries.append(
            {
                'id': f'q-{i:04d}',
                'text': f'query number {i} about the archive',
                'record': 'residue-02-the-training-data-ghosts' if i == 7 else None,
                'section': 'main',
                'series': None,
                'created_utc': '2026-10-24T10:00:00Z',
            }
        )
    seq = n_main + 1
    for series in ('echo-chamber', 'residue'):
        for j in range(per_series):
            queries.append(
                {
                    'id': f'q-{seq:04d}',
                    'text': f'{series} frontier {j}',
                    'record': None,
                    'section': 'frontier',
                    'series': series,
                    'created_utc': '2026-10-24T11:00:00Z',
                }
            )
            seq += 1
    return {'schema': 'arc-owner-queries/1', 'rev': 9, 'next_seq': seq, 'queries': queries}


@pytest.fixture
def write_queries(home):
    def write(doc: dict | None = None) -> Path:
        path = home / 'arc-owner' / 'queries.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc or owner_queries()))
        return path

    return write


@pytest.fixture
def make_queries():
    return owner_queries
