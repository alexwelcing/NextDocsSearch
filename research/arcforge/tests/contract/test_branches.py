"""The PREREG branch table: following a history, deciding the next run, refusing bad paths."""

from __future__ import annotations

import pytest

from arcforge.contract.branches import (
    PathError,
    Step,
    follow,
    next_step,
    path_of_final,
    paths_through,
)


def step(run_id, branch, **statuses):
    return Step(run_id, branch, {k.replace('_', '.'): v for k, v in statuses.items()})


def prefix(rules, path, upto, **decisions):
    """The first `upto` steps of `path`, decision rules set from `decisions` (run -> status)."""
    out = []
    for run_id, branch in rules.branch_table[path][:upto]:
        statuses = {}
        for decision in rules.decisions:
            if (decision.after, decision.branch) == (run_id, branch):
                statuses[decision.rule] = decisions[run_id]
        out.append(Step(run_id, branch, statuses))
    return out


def test_the_first_runs_are_shared(template):
    assert next_step(template, []) == ('r00', 'N')
    assert sorted(follow(template, prefix(template, 'N', 4))) == ['N', 'N-F', 'S-C', 'S-C-F', 'S-F']


def test_the_futility_look_routes_to_the_s_paths(template):
    fired = prefix(template, 'S-F', 5, r04='FIRED')
    assert sorted(follow(template, fired)) == ['S-C', 'S-C-F', 'S-F']
    assert next_step(template, fired) == ('r05K', 'S')
    clear = prefix(template, 'N', 5, r04='NOT_FIRED')
    assert next_step(template, clear) == ('r05', 'N')


@pytest.mark.parametrize(
    ('path', 'decisions', 'upto', 'expected'),
    [
        ('S-F', {'r04': 'FIRED', 'r05K': 'FALSIFIED'}, 6, ('r06', 'S-F')),
        ('S-C', {'r04': 'FIRED', 'r05K': 'NOT_FALSIFIED'}, 6, ('r06', 'S-C')),
        ('N-F', {'r04': 'NOT_FIRED', 'r06': 'FALSIFIED'}, 7, ('r07K', 'N-F')),
        ('N', {'r04': 'NOT_FIRED', 'r06': 'FUSION_ONLY'}, 7, ('r07', 'N')),
        ('N', {'r04': 'NOT_FIRED', 'r06': 'INCONCLUSIVE'}, 7, ('r07', 'N')),
        (
            'S-C-F',
            {'r04': 'FIRED', 'r05K': 'NOT_FALSIFIED', 'r07': 'FALSIFIED'},
            8,
            ('r08K', 'S-C-F'),
        ),
        ('S-C', {'r04': 'FIRED', 'r05K': 'NOT_FALSIFIED', 'r07': 'SUPPORTED'}, 8, ('r08', 'S-C')),
    ],
)
def test_decisions_pick_the_next_run(template, path, decisions, upto, expected):
    assert next_step(template, prefix(template, path, upto, **decisions)) == expected


def test_a_complete_path_has_no_next_run(template):
    history = prefix(template, 'N', 11, r04='NOT_FIRED', r06='SUPPORTED')
    assert next_step(template, history) is None
    assert path_of_final(template, 'r10', 'N') == ('N', list(template.branch_table['N'][:-1]))


def test_histories_that_no_path_explains_are_refused(template):
    with pytest.raises(PathError, match='no PREREG branch path'):
        follow(template, [step('r01', 'N')])
    fired = prefix(template, 'N', 5, r04='FIRED')  # the futility look fired: r05 cannot follow
    with pytest.raises(PathError, match='run 6 of the history is r05/N'):
        follow(template, [*fired, step('r05', 'N')])
    with pytest.raises(PathError, match='does not route'):
        follow(template, prefix(template, 'N', 5, r04='NOT_APPLICABLE'))


def test_every_final_run_lies_on_exactly_one_path(template):
    for name, seq in template.branch_table.items():
        assert paths_through(template, *seq[-1]) == [name]
    with pytest.raises(PathError):
        path_of_final(template, 'r04', 'N')
