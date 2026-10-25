import hashlib
import json
from pathlib import Path

import pytest

from arcforge.core.cache import open_store
from arcforge.core.config import ARCFORGE_ROOT, load_config
from arcforge.core.corpus import (
    CorpusError,
    fold,
    load_corpus,
    normalize_date,
    split_frontmatter,
    words,
    year_of,
)
from arcforge.core.dag import RunEnv, StageError
from arcforge.core.pipeline import run_selection
from arcforge.core.stages import REGISTRY
from arcforge.core.stages.snapshot import diff_snapshots


def _run(repo: Path, config, cache: Path, stages=('S0', 'S1')):
    results = run_selection(
        REGISTRY, list(stages), config, open_store(str(cache)), RunEnv(repo_root=repo)
    )
    return {r.stage: r for r in results}


def _json(result, name):
    return json.loads(result.data[name])


def test_s0_corpus_ids_follow_the_program_formula(repo, config, cache_dir, mdx_texts):
    s0 = _run(repo, config, cache_dir, ['S0'])['S0']
    snap = _json(s0, 'snapshot.json')
    mdx = {slug: hashlib.sha256(text.encode()).hexdigest() for slug, text in mdx_texts.items()}
    lines = ''.join(f'{slug}\t{mdx[slug]}\n' for slug in sorted(mdx))
    assert snap['corpus_id'] == hashlib.sha256(lines.encode()).hexdigest()
    main = ''.join(f'{slug}\t{mdx[slug]}\n' for slug in sorted(mdx) if slug != 'beta')
    assert snap['main_corpus_id'] == hashlib.sha256(main.encode()).hexdigest()
    assert snap['frontier']['slugs'] == ['beta'] and snap['frontier']['missing_series'] == []
    assert snap['counts'] == {
        'records': 4,
        'main_line': 3,
        'withheld': 1,
        'missing_record_json': [],
        'orphan_record_json': [],
    }
    by_slug = {r['slug']: r for r in snap['records']}
    assert by_slug['beta']['withheld'] and by_slug['beta']['series'] == 'the-echo-chamber'
    assert by_slug['beta']['date'] == '2049-11-02'  # an unquoted YAML date
    assert by_slug['alpha']['series_order'] == 1 and by_slug['alpha']['article_type'] == 'fiction'
    corpus = [json.loads(line) for line in s0.data['corpus.jsonl'].splitlines()]
    assert [row['slug'] for row in corpus] == sorted(mdx_texts)
    assert {row['slug']: row['mdx'] for row in corpus} == mdx_texts


def test_s0_flags_missing_series_and_orphan_records(repo, cache_dir):
    (repo / 'public/arc/records/orphan.json').write_text('{}')
    (repo / 'public/arc/records/gamma.json').unlink()
    config = load_config('r00', {'corpus.frontier.withheld': ['the-echo-chamber', 'the-residue']})
    snap = _json(_run(repo, config, cache_dir, ['S0'])['S0'], 'snapshot.json')
    assert snap['frontier']['missing_series'] == ['the-residue']
    assert snap['counts']['orphan_record_json'] == ['orphan']
    assert snap['counts']['missing_record_json'] == ['gamma']


def test_s0_rejects_broken_sources(repo, config, cache_dir):
    (repo / 'public/arc/records/gamma.json').write_text('{not json')
    with pytest.raises(StageError, match='gamma.json'):
        _run(repo, config, cache_dir, ['S0'])
    with pytest.raises(CorpusError, match='does not exist'):
        _run(repo / 'nowhere', config, cache_dir, ['S0'])


def test_s0_reads_a_pinned_commit_not_the_worktree(tmp_path, cache_dir, make_repo, git):
    repo = make_repo(tmp_path / 'g')
    git(repo, 'init', '-q')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'corpus')
    sha = git(repo, 'rev-parse', 'HEAD')
    pinned = load_corpus(repo, 'pages/docs/articles', 'public/arc/records', sha)
    worktree = load_corpus(repo, 'pages/docs/articles', 'public/arc/records', None)
    assert pinned.files == worktree.files and pinned.fingerprint == worktree.fingerprint
    (repo / 'pages/docs/articles/alpha.mdx').write_text('---\ntitle: edited\n---\n')
    config = load_config('r00', {'corpus.git_sha': sha})
    snap = _json(_run(repo, config, cache_dir, ['S0'])['S0'], 'snapshot.json')
    assert snap['source']['mode'] == 'git' and snap['source']['git_sha'] == sha
    assert snap['source']['fingerprint'] == pinned.fingerprint
    assert (
        load_corpus(repo, 'pages/docs/articles', 'public/arc/records', None).fingerprint
        != pinned.fingerprint
    )
    with pytest.raises(CorpusError):
        load_corpus(repo, 'pages/docs/articles', 'public/arc/records', 'f' * 40)


def test_s1_graph_statuses_and_counts(repo, config, cache_dir):
    graph = _json(_run(repo, config, cache_dir)['S1'], 'graph.json')
    edges = {(e['source'], e['target']): e for e in graph['edges']}
    assert ('alpha', 'alpha') not in edges  # self-links dropped
    assert edges[('alpha', 'beta')]['via'] == ['body', 'related']
    assert edges[('alpha', 'gamma')]['via'] == [
        'related'
    ]  # the /docs/ link is a phantom, not an edge
    assert edges[('gamma', 'beta')]['status'] == 'real'  # the #anchor is stripped
    assert (edges[('alpha', 'old-name')]['status'], edges[('alpha', 'old-name')]['resolved']) == (
        'renamed',
        'new-name',
    )
    assert edges[('alpha', 'old-ghost')]['status'] == 'ghost'
    assert edges[('alpha', 'nowhere')]['status'] == 'dangling'
    assert graph['counts'] == {
        'unique_edges': 8,
        'real_edges': 5,
        'renamed_edges': 1,
        'ghost_edges': 1,
        'dangling_edges': 1,
        'sources': 3,
        'targets': 3,
        'dangling_targets': 3,
        'main_line_real_edges': 1,
        'frontier_real_edges': {'from_withheld': 2, 'into_withheld': 2},
        'phantom_targets': 2,
        'phantom_targets_with_file': 1,
    }
    assert [(p['target'], p['title'], p['has_file']) for p in graph['phantoms']] == [
        ('gamma', 'gamma', True),
        ('lost-title', 'lost title', False),
    ]


def test_s1_rationales_feed_stratum_a(repo, config, cache_dir):
    rationales = _json(_run(repo, config, cache_dir)['S1'], 'rationales.json')
    assert rationales['counts'] == {
        'sentences': 5,
        'six_plus': 4,
        'short': 1,
        'six_plus_distinct': 4,
        'six_plus_dangling': 2,
        'a_items': 3,
        'a_renamed': 1,
        'a_core': 2,
        'a_frontier': 1,
        'ghosted': 1,
    }
    by_clause = {s['clause']: s for s in rationales['sentences']}
    withheld_target = by_clause['the underlying mechanics of the whole archive']
    assert withheld_target['frontier'] and not withheld_target['source_withheld']
    withheld_source = by_clause['the long account of the cartographers and their maps']
    assert (
        withheld_source['in_a']
        and not withheld_source['frontier']
        and withheld_source['source_withheld']
    )


def test_s1_lexicon_counts(repo, config, cache_dir):
    counts = _json(_run(repo, config, cache_dir)['S1'], 'counts.json')
    per = {r['slug']: r for r in counts['records']}
    # gamma: 'Gamma' + 'About gamma.' + 'Tomáš walked to Beta and back.'
    assert per['gamma'] == {'slug': 'gamma', 'words': 9, 'word_types': 8}
    assert counts['full']['records'] == 4 and counts['withheld']['records'] == 1
    assert counts['full']['words'] == counts['main_line']['words'] + counts['withheld']['words']
    assert counts['withheld_word_share'] == round(
        counts['withheld']['words'] / counts['full']['words'], 6
    )
    assert counts['decades'] == {'2020s': 2, '2030s': 1, '2040s': 1}
    assert counts['series'] == {'(none)': 2, 'the-echo-chamber': 1, 'the-interface': 1}
    assert counts['full']['types_at_min_count'] >= 1  # 'calibration' x2 plus title words


def test_text_helpers():
    assert fold('Tomáš Tūhoe Solène') == 'tomas tuhoe solene'
    assert words("Don't stop: Tomáš-42!") == ['don', 't', 'stop', 'tomas', '42']
    assert split_frontmatter('no fence\n') == ('', 'no fence\n')
    with pytest.raises(CorpusError, match='closing'):
        split_frontmatter('---\ntitle: x\n')
    assert normalize_date('Sun Jan 11 2026 00:00:00 GMT') == 'Sun Jan 11 2026 00:00:00 GMT'
    assert normalize_date('2026-01-11T10:00:00Z') == '2026-01-11'
    assert year_of('Sun Jan 11 2026') == 2026 and year_of(None) is None


def test_diff_snapshots_finds_adds_changes_removals_and_renames():
    def snap(**records):
        return {'records': [{'slug': s, 'mdx_sha256': h} for s, h in records.items()]}

    old = snap(a='1', b='2', c='3', d='4')
    new = snap(a='1', b='9', d2='4', e='5')
    assert diff_snapshots(old, new) == {
        'added': ['e'],
        'removed': ['c'],
        'changed': ['b'],
        'renamed': [{'from': 'd', 'to': 'd2'}],
    }


REAL_REPO = ARCFORGE_ROOT.parents[1]


@pytest.mark.skipif(
    not (REAL_REPO / 'pages/docs/articles').is_dir(), reason='needs the archive checkout'
)
def test_the_real_archive_snapshot(tmp_path):
    results = _run(REAL_REPO, load_config('r00'), tmp_path / 'cache')
    snap = _json(results['S0'], 'snapshot.json')
    mdx = sorted(p.stem for p in (REAL_REPO / 'pages/docs/articles').glob('*.mdx'))
    assert [r['slug'] for r in snap['records']] == mdx
    withheld = [r['slug'] for r in snap['records'] if r['withheld']]
    assert withheld and all(s.startswith(('echo-chamber-', 'residue-')) for s in withheld)
    assert snap['main_corpus_id'] != snap['corpus_id']
    graph = _json(results['S1'], 'graph.json')
    assert (
        graph['counts']['real_edges'] > 0
        and graph['counts']['frontier_real_edges']['from_withheld'] > 0
    )
