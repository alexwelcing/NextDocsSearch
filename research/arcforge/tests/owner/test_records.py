import json

import pytest

from arcforge.owner.paths import find_repo_root
from arcforge.owner.records import (
    EMPTY,
    FRONTIER_SERIES,
    frontier_series_of,
    load_records,
    series_of,
)


@pytest.mark.parametrize(
    ('slug', 'series', 'order'),
    [
        ('far-shore-06-the-last-handshake', 'far-shore', 6),
        ('echo-chamber-03-the-withdrawal', 'echo-chamber', 3),
        ('residue-05-the-compatibility-museum', 'residue', 5),
        ('neural-implant-rejection-2030', None, None),
        ('abundance-fork', None, None),
        ('data-security-AI-next-23', None, None),
    ],
)
def test_series_of(slug, series, order):
    assert series_of(slug) == (series, order)


def test_frontier_series_are_the_two_withheld_ones():
    assert set(FRONTIER_SERIES) == {'echo-chamber', 'residue'}
    assert frontier_series_of('echo-chamber-02-the-fossil') == 'echo-chamber'
    assert frontier_series_of('residue-01-the-last-prompt-engineer') == 'residue'
    assert frontier_series_of('the-residue-of-things') is None
    assert frontier_series_of('far-shore-06-the-last-handshake') is None


def _repo(tmp_path, manifest=None, bodies=()):
    if manifest is not None:
        path = tmp_path / 'lib' / 'generated' / 'article-manifest.json'
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(manifest))
    folder = tmp_path / 'public' / 'arc' / 'records'
    folder.mkdir(parents=True)
    for slug, row in bodies:
        (folder / f'{slug}.json').write_text(json.dumps(row))
    return tmp_path


def test_load_from_the_manifest(tmp_path):
    repo = _repo(
        tmp_path,
        manifest=[
            {
                'slug': 'residue-02-the-training-data-ghosts',
                'title': ' The  Training Data Ghosts ',
                'date': '2043-02-01',
                'description': 'x' * 400,
            },
            {'slug': 'abundance-fork', 'title': 'The Abundance Fork'},
            {'slug': '../escape', 'title': 'bad'},
        ],
    )
    index = load_records(repo)
    assert index.source == 'lib/generated/article-manifest.json'
    assert [r.slug for r in index.records] == [
        'abundance-fork',
        'residue-02-the-training-data-ghosts',
    ]
    ghost = index.by_slug()['residue-02-the-training-data-ghosts']
    assert (
        ghost.title == 'The Training Data Ghosts'
        and ghost.frontier == 'residue'
        and ghost.order == 2
    )
    assert len(ghost.description) == 160 and ghost.description.endswith('…')


def test_falls_back_to_record_bodies(tmp_path):
    repo = _repo(
        tmp_path,
        bodies=[('echo-chamber-02-the-fossil', {'title': 'The Fossil', 'date': '2044-01-01'})],
    )
    index = load_records(repo)
    assert index.source == 'public/arc/records'
    assert (
        index.records[0].slug == 'echo-chamber-02-the-fossil'
        and index.records[0].frontier == 'echo-chamber'
    )


def test_nothing_to_load(tmp_path):
    assert load_records(None) is EMPTY
    assert load_records(_repo(tmp_path)) is EMPTY


def test_the_real_archive():
    """The checkout this package lives in: 327 records, 10 of them in the withheld series."""
    repo = find_repo_root()
    if repo is None:
        pytest.skip('not inside the NextDocsSearch checkout')
    index = load_records(repo)
    assert len(index.records) >= 300
    frontier = [r.slug for r in index.records if r.frontier]
    assert len(frontier) == 10
    assert sum(1 for s in frontier if s.startswith('echo-chamber-')) == 5
