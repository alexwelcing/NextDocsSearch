import json
from pathlib import Path

import pytest

from arcforge.owner.desk import Desk
from arcforge.owner.records import Record, RecordIndex, series_of

SLUGS = (
    'far-shore-06-the-last-handshake',
    'threshold-01-the-first-door',
    'inheritance-03-the-seed-vault',
    'abundance-fork',
    'echo-chamber-02-the-fossil',
    'echo-chamber-04-the-settlers',
    'residue-01-the-last-prompt-engineer',
    'residue-02-the-training-data-ghosts',
)


def _record(slug: str) -> Record:
    series, order = series_of(slug)
    return Record(
        slug=slug,
        title=slug.replace('-', ' ').title(),
        date='2041-01-01',
        series=series,
        order=order,
        frontier=series if series in ('echo-chamber', 'residue') else None,
        description=f'About {slug}.',
    )


@pytest.fixture
def home(tmp_path, monkeypatch):
    """A temp HOME, so ~/arc-owner/ is private to the test."""
    path = tmp_path / 'home'
    path.mkdir()
    monkeypatch.setenv('HOME', str(path))
    return path


@pytest.fixture
def records() -> RecordIndex:
    return RecordIndex(source='test', records=tuple(_record(s) for s in SLUGS))


@pytest.fixture
def recipient(tmp_path) -> Path:
    return tmp_path / 'configs' / 'vault.recipient'


@pytest.fixture
def desk(home, records, recipient) -> Desk:
    return Desk(None, recipient_file=recipient, records=records)


def people_proposal() -> dict:
    return {
        'schema': 'arc-people-proposal/1',
        'generated_utc': '2026-10-24T00:00:00Z',
        'names': [
            {
                'name_id': 'adaeze',
                'name': 'Adaeze',
                'mentions': 41,
                'clusters': [
                    {
                        'cluster_id': 'adaeze-nwosu',
                        'label': 'Adaeze Nwosu (radiologist)',
                        'records': [
                            {
                                'slug': 'far-shore-06-the-last-handshake',
                                'role': 'the radiologist, at 103',
                            },
                            {'slug': 'threshold-01-the-first-door', 'role': 'reads the last scan'},
                        ],
                    },
                    {
                        'cluster_id': 'adaeze-obi',
                        'label': 'Adaeze Obi',
                        'records': [{'slug': 'abundance-fork', 'role': 'an economist'}],
                    },
                ],
            },
            {
                'name_id': 'priya-chakrabarti',
                'name': 'Priya Chakrabarti',
                'mentions': 9,
                'clusters': [
                    {
                        'cluster_id': 'priya-chakrabarti',
                        'label': 'Priya Chakrabarti',
                        'records': [{'slug': 'inheritance-03-the-seed-vault', 'role': 'archivist'}],
                    }
                ],
                'variants': [{'name_id': 'priya-chakraborty', 'reason': 'possible typo'}],
            },
            {
                'name_id': 'priya-chakraborty',
                'name': 'Priya Chakraborty',
                'mentions': 2,
                'clusters': [
                    {
                        'cluster_id': 'priya-chakraborty',
                        'label': 'Priya Chakraborty',
                        'records': [{'slug': 'abundance-fork', 'role': 'archivist'}],
                    }
                ],
            },
        ],
    }


def registers_proposal() -> dict:
    return {
        'schema': 'arc-registers-proposal/1',
        'registers': [
            {'id': 'chronicles', 'label': 'Chronicles'},
            {'id': 'backstory', 'label': 'Backstory'},
            {'id': 'pm-essays', 'label': 'PM essays'},
        ],
        'records': [
            {'slug': 'far-shore-06-the-last-handshake', 'register': 'chronicles'},
            {'slug': 'threshold-01-the-first-door', 'register': 'chronicles', 'why': 'saga series'},
            {'slug': 'abundance-fork', 'register': 'pm-essays'},
            {'slug': 'inheritance-03-the-seed-vault', 'register': 'backstory'},
        ],
    }


def pairs(kind: str, n: int) -> dict:
    return {
        'schema': f'arc-{kind}-pairs/1',
        'pairs': [
            {
                'pair_id': f'{kind}-{i:03d}',
                'query': f'query {i}',
                'record': {'slug': 'far-shore-06-the-last-handshake'},
                'passages': ['first passage', 'second passage', 'a third the desk drops'],
                'judge_grades': {'gemini': 3},  # must never reach the page
                'system': 'B4',
            }
            for i in range(n)
        ],
    }


@pytest.fixture
def prep(home):
    """write(name, doc) drops a pipeline file into ~/arc-owner/prep/."""
    folder = home / 'arc-owner' / 'prep'

    def write(filename: str, doc) -> Path:
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / filename
        path.write_text(doc if isinstance(doc, str) else json.dumps(doc))
        return path

    return write


@pytest.fixture
def fixtures():
    return {'people': people_proposal, 'registers': registers_proposal, 'pairs': pairs}
