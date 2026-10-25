"""Row statistics: estimators, Holm, determinism and the score file's failure modes."""

from __future__ import annotations

import math
import statistics

import pytest

from arcforge.contract import stats

FAST = dict(alpha=0.05, resamples=300, permutations=300, refit_resamples=60)


def items(diffs, parts=None, sources=None, targets=None, seeds=1, base=0.5):
    out = []
    for i, d in enumerate(diffs):
        out.append(
            {
                'id': f'q{i}',
                'part': parts[i] if parts else 'A',
                'source': None if sources is None else sources[i],
                'targets': [] if targets is None else targets[i],
                'a': [base + d] * seeds,
                'b': [base],
            }
        )
    return out


def scores(item_list, estimator='pigeonhole', seeds=1):
    return {'estimator': estimator, 'seeds': list(range(seeds)), 'items': item_list}


def test_quantile_interpolates_linearly():
    values = [0.0, 1.0, 2.0, 3.0]
    assert stats.quantile(values, 0.0) == 0.0
    assert stats.quantile(values, 1.0) == 3.0
    assert stats.quantile(values, 0.5) == 1.5
    assert stats.quantile(values, 0.25) == 0.75
    with pytest.raises(stats.ScoresError):
        stats.quantile([], 0.5)


def test_holm_step_down_and_the_stop_rule():
    # m = 4: thresholds 0.0125, 0.0167, 0.025, 0.05. The third row fails to reject, so the
    # fourth keeps its alpha (0.025), not 0.05.
    result = stats.holm({'a': 0.001, 'b': 0.01, 'c': 0.03, 'd': 0.04}, 0.05)
    assert [result[k][0] for k in 'abcd'] == [1, 2, 3, 4]
    assert all(result[k][1] == 4 for k in 'abcd')
    assert [round(result[k][2], 6) for k in 'abcd'] == [0.0125, round(0.05 / 3, 6), 0.025, 0.025]
    assert [round(result[k][3], 6) for k in 'abcd'] == [0.004, 0.03, 0.06, 0.06]
    ties = stats.holm({'x2': 0.01, 'x1': 0.01}, 0.05)
    assert ties['x1'][0] == 1 and ties['x2'][0] == 2  # ties break by comparison id


def test_pigeonhole_point_and_determinism():
    data = scores(
        items(
            [0.1, 0.2, 0.3, 0.0],
            sources=['s1', 's1', 's2', 's3'],
            targets=[['t1'], ['t2'], ['t1'], ['t3']],
        )
    )
    first = stats.compute(data, comparison_id='H9.c1', **FAST)
    second = stats.compute(data, comparison_id='H9.c1', **FAST)
    assert first == second  # same comparison id, same streams, same numbers
    assert math.isclose(first.point, 0.15)
    assert first.ci_lo_raw <= first.point <= first.ci_hi_raw
    assert first.n_queries == 4 and first.n_clusters == 3 + 3
    other = stats.compute(data, comparison_id='H9.c2', **FAST)
    assert other.point == first.point and other.replicates != first.replicates


def test_pigeonhole_macro_averages_parts():
    # A has 3 queries with difference 0.3, B has 1 with 0.1: the pooled score weighs A and B
    # equally, (0.3 + 0.1) / 2, not the query mean 0.25.
    data = scores(
        items([0.3, 0.3, 0.3, 0.1], parts=['A', 'A', 'A', 'B'], sources=['s1', 's2', 's3', 's4'])
    )
    assert math.isclose(stats.compute(data, comparison_id='x.c1', **FAST).point, 0.2)


def test_a_constant_difference_has_a_degenerate_ci():
    data = scores(
        items(
            [0.05] * 24,
            sources=[f's{i}' for i in range(24)],
            targets=[[f't{i % 3}'] for i in range(24)],
        )
    )
    row = stats.compute(data, comparison_id='x.c1', **FAST)
    assert math.isclose(row.ci_lo_raw, 0.05) and math.isclose(row.ci_hi_raw, 0.05)
    assert row.p_raw == 1 / 301  # no sign flip of 24 equal terms reaches |sum| (but all +/all -)
    assert all(math.isclose(v, 0.05) for v in row.ci(0.0125))


def test_no_effect_gives_a_large_p_and_a_ci_around_zero():
    import random

    rng = random.Random(4)
    diffs = [rng.uniform(-0.1, 0.1) for _ in range(60)]
    data = scores(
        items(
            diffs,
            sources=[f's{i % 20}' for i in range(60)],
            targets=[[f't{i % 15}'] for i in range(60)],
        )
    )
    row = stats.compute(data, comparison_id='x.c1', **FAST)
    assert row.ci_lo_raw < 0 < row.ci_hi_raw
    assert row.p_raw > 0.05


def test_seed_sd_is_the_sd_of_per_seed_points():
    data = scores(
        [
            {
                'id': 'q1',
                'part': 'A',
                'source': 's1',
                'targets': [],
                'a': [0.6, 0.7, 0.8],
                'b': [0.5],
            },
            {
                'id': 'q2',
                'part': 'A',
                'source': 's2',
                'targets': [],
                'a': [0.6, 0.6, 0.6],
                'b': [0.5, 0.5, 0.5],
            },
        ],
        seeds=3,
    )
    row = stats.compute(data, comparison_id='x.c1', **FAST)
    per_seed = [((0.6 - 0.5) + 0.1) / 2, ((0.7 - 0.5) + 0.1) / 2, ((0.8 - 0.5) + 0.1) / 2]
    assert math.isclose(row.seed_sd, statistics.stdev(per_seed))
    assert math.isclose(row.point, statistics.fmean(per_seed))
    assert row.n_seeds == 3


def test_multi_target_queries_weigh_the_mean_target_multiplicity():
    # One B query with two positives behaves like one query; the design still counts both
    # targets as clusters.
    data = scores(
        items([0.2, 0.0], parts=['B', 'B'], sources=['s1', 's2'], targets=[['t1', 't2'], ['t3']])
    )
    row = stats.compute(data, comparison_id='x.c1', **FAST)
    assert row.n_clusters == 2 + 3 and math.isclose(row.point, 0.1)


def test_cluster_ratio():
    data = scores(
        [
            {
                'id': f'f{i}',
                'part': 'FRONTIER',
                'source': None,
                'targets': [f'w{i % 5}'],
                'a': [0.45],
                'b': [0.5],
            }
            for i in range(20)
        ],
        estimator='cluster_ratio',
    )
    row = stats.compute(data, comparison_id='H6.r1', **FAST)
    assert math.isclose(row.point, 0.9) and math.isclose(row.ci_lo_raw, 0.9) and row.n_clusters == 5
    assert 0 < row.p_raw <= 1


def test_a_ratio_needs_positive_means():
    data = scores(
        [{'id': 'f', 'part': 'F', 'source': None, 'targets': ['w'], 'a': [0.4], 'b': [0.0]}],
        estimator='cluster_ratio',
    )
    with pytest.raises(stats.ScoresError, match='positive mean'):
        stats.compute(data, comparison_id='H6.r1', **FAST)


def p_at_k(hits_a, hits_b, k=100, remeant=150, refits=()):
    yes = [f'w{i:03d}' for i in range(remeant)]
    no = [f'n{i:03d}' for i in range(300)]

    def ranking(hits):
        return yes[:hits] + no[: k - hits]

    fits = [{'id': 'point', 'a': ranking(hits_a), 'b': ranking(hits_b)}]
    fits += [
        {'id': f'refit-{n}', 'a': ranking(a), 'b': ranking(b)} for n, (a, b) in enumerate(refits, 1)
    ]
    labels = {i: 1 for i in yes} | {i: 0 for i in no[:150]}
    return {'estimator': 'refit_pooled', 'k': k, 'labels': labels, 'fits': fits}


def test_p_at_100_difference_and_refit_sd():
    row = stats.compute(
        p_at_k(80, 40, refits=[(80, 40), (78, 40), (82, 40)]), comparison_id='H3.c1', **FAST
    )
    assert math.isclose(row.point, 0.4)
    assert math.isclose(row.seed_sd, statistics.stdev([0.40, 0.38, 0.42]))
    assert row.n_seeds == 3
    assert len(row.replicates) == 4 * FAST['refit_resamples']
    assert row.ci_lo_raw < 0.4 < row.ci_hi_raw and row.p_raw < 0.05


def test_p_at_100_is_normalized_when_fewer_than_100_items_are_remeant():
    # 50 re-meant items: the maximum achievable P@100 is 0.5, so P@100 = hits / 50.
    row = stats.compute(p_at_k(50, 25, remeant=50), comparison_id='H3.c1', **FAST)
    assert math.isclose(row.point, 0.5)


def test_unlabelled_ranked_items_count_as_not_remeant():
    data = p_at_k(80, 40)
    data['fits'][0]['a'] = [f'u{i}' for i in range(30)] + data['fits'][0]['a'][:70]
    row = stats.compute(data, comparison_id='H3.c1', **FAST)
    assert math.isclose(row.point, (70 - 40) / 100)


@pytest.mark.parametrize(
    ('change', 'message'),
    [
        (lambda d: d['items'][0].__setitem__('a', []), 'non-empty list'),
        (lambda d: d['items'][0].__setitem__('a', [float('nan')]), 'finite'),
        (lambda d: d['items'][0].__setitem__('a', [0.1, 0.2]), '2 values for 1 seeds'),
        (lambda d: d['items'].append(dict(d['items'][0])), 'duplicate id'),
        (lambda d: d['items'][0].__setitem__('targets', 'abc'), 'targets must be a list'),
        (lambda d: d.__setitem__('estimator', 'median'), 'unknown estimator'),
        (lambda d: d.__setitem__('seeds', []), 'seeds'),
    ],
)
def test_malformed_difference_scores(change, message):
    data = scores(items([0.1, 0.2], sources=['s1', 's2']))
    change(data)
    with pytest.raises(stats.ScoresError, match=message):
        stats.compute(data, comparison_id='x.c1', **FAST)


@pytest.mark.parametrize(
    ('change', 'message'),
    [
        (lambda d: d['fits'].append(dict(d['fits'][0])), "exactly one 'point' fit"),
        (lambda d: d['fits'][0].__setitem__('a', d['fits'][0]['a'][:50]), 'fewer than k=100'),
        (
            lambda d: d['fits'][0].__setitem__('a', d['fits'][0]['a'][:99] + d['fits'][0]['a'][:1]),
            'duplicate items',
        ),
        (
            lambda d: d.__setitem__('labels', {k: 0 for k in d['labels']}),
            'no item is labelled re-meant',
        ),
        (lambda d: d['labels'].__setitem__('w000', True), 'every label is 0 or 1'),
    ],
)
def test_malformed_p_at_k_scores(change, message):
    data = p_at_k(60, 40)
    change(data)
    with pytest.raises(stats.ScoresError, match=message):
        stats.compute(data, comparison_id='H3.c1', **FAST)


def test_a_single_cluster_part_redraws_until_it_has_weight():
    # Part B rests on one source; resamples that miss it are redrawn, not skipped.
    data = scores(items([0.1, 0.1, 0.3], parts=['A', 'A', 'B'], sources=['s1', 's2', 's3']))
    row = stats.compute(data, comparison_id='x.c1', **FAST)
    assert len(row.replicates) == FAST['resamples'] and math.isclose(row.point, 0.2)
