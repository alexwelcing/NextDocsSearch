"""Fixtures for the runtime tests: a tiny archive that exercises every S0/S1 rule.

Tests run under --import-mode=importlib, so nothing here is importable by module name: the
corpus, its writer and the git helper are handed out as fixtures.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

from arcforge.core.config import load_config

MDX = {
    'alpha': """---
title: 'Alpha: The First'
date: '2026-01-05'
series: the-interface
seriesOrder: 1
articleType: fiction
relatedArticles:
  - beta
  - gamma
---
Alpha opens the archive.

For the underlying mechanics of the whole archive, see [Beta](/articles/beta).
For a renamed story about the old forge, see [The Old Name](/articles/old-name).
For a story that no longer exists anywhere, see [Ghost](/articles/old-ghost).
A dangling link to [Nowhere](/articles/nowhere), a phantom [Lost Title](/docs/articles/lost-title),
a phantom that has a file [Gamma](/docs/articles/gamma) and a self-link [Alpha](/articles/alpha).
""",
    'beta': """---
title: The Withheld One
date: 2049-11-02
series: the-echo-chamber
seriesOrder: 2
---
For short, see [Alpha](/articles/alpha).
For the long account of the cartographers and their maps, see [Gamma](/articles/gamma).
""",
    'gamma': """---
title: Gamma
date: 2031-03-04
---
Tomáš walked to [Beta](/articles/beta#section) and back.
""",
    'new-name': """---
title: The New Name
date: Sun Jan 11 2026 00:00:00 GMT+0000
---
Renamed from the old name.
""",
}

RECORDS = {
    'alpha': ['Alpha opens the archive.', 'Calibration sickness, calibration again.'],
    'beta': ['The withheld one speaks of the fossil.'],
    'gamma': ['Tomáš walked to Beta and back.'],
    'new-name': ['Renamed from the old name.'],
}


def write_corpus(
    root: Path, mdx: dict[str, str] = MDX, records: dict[str, list[str]] = RECORDS
) -> Path:
    articles = root / 'pages' / 'docs' / 'articles'
    out = root / 'public' / 'arc' / 'records'
    articles.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    for slug, text in mdx.items():
        (articles / f'{slug}.mdx').write_text(text, encoding='utf-8')
    for slug, paragraphs in records.items():
        doc = {
            'slug': slug,
            'title': slug.title(),
            'date': '2026-01-01',
            'description': f'About {slug}.',
            'blocks': [{'t': 'p', 'x': p} for p in paragraphs],
        }
        (out / f'{slug}.json').write_text(json.dumps(doc, ensure_ascii=False), encoding='utf-8')
    return root


TEST_OVERRIDES = {
    'corpus.frontier.withheld': ['the-echo-chamber'],
    'corpus.rename_map': {'old-name': 'new-name'},
    'corpus.ghosts_by_default': ['old-ghost'],
}


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    return write_corpus(tmp_path / 'repo')


@pytest.fixture
def config():
    return load_config('r00', dict(TEST_OVERRIDES))


@pytest.fixture
def cache_dir(tmp_path: Path) -> Path:
    return tmp_path / 'cache'


def _git(root: Path, *args: str) -> str:
    env = {
        'GIT_AUTHOR_NAME': 't',
        'GIT_AUTHOR_EMAIL': 't@example.com',
        'GIT_COMMITTER_NAME': 't',
        'GIT_COMMITTER_EMAIL': 't@example.com',
        'GIT_CONFIG_GLOBAL': '/dev/null',
        'GIT_CONFIG_SYSTEM': '/dev/null',
        'PATH': '/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin',
    }
    out = subprocess.run(
        ['git', '-C', str(root), *args], env=env, capture_output=True, text=True, check=True
    )
    return out.stdout.strip()


@pytest.fixture
def mdx_texts() -> dict[str, str]:
    return dict(MDX)


@pytest.fixture
def make_repo():
    return write_corpus


@pytest.fixture
def git():
    return _git
