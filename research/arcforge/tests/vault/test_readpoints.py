import pytest

from arcforge.vault.readpoints import (
    BRANCHES,
    OPEN_RUNS,
    READ_POINTS,
    READS_MAX,
    ReadRefused,
    budget,
    check_read,
    normalize_branch,
    normalize_run,
)


def test_table_is_the_registered_one():
    # program.benchmark C, rules.yaml vault.read, read_points_by_branch: identical everywhere.
    assert READ_POINTS == {
        'N': ('r04', 'r06', 'r10'),
        'N-F': ('r04', 'r06', 'r10K'),
        'S-F': ('r04', 'r10K'),
        'S-C': ('r04', 'r07', 'r10'),
        'S-C-F': ('r04', 'r07', 'r10K'),
    }
    assert READS_MAX == 3
    assert OPEN_RUNS == {'r10', 'r10K'}
    assert {b: budget(b) for b in BRANCHES} == {'N': 3, 'N-F': 3, 'S-F': 2, 'S-C': 3, 'S-C-F': 3}


@pytest.mark.parametrize(
    ('raw', 'run'), [('r04', 'r04'), ('R06', 'r06'), ('r10k', 'r10K'), (' R10K ', 'r10K')]
)
def test_normalize_run(raw, run):
    assert normalize_run(raw) == run


@pytest.mark.parametrize('raw', ['r4', 'run04', 'r100', '04', 'r04x', ''])
def test_normalize_run_rejects(raw):
    with pytest.raises(ValueError):
        normalize_run(raw)


def test_normalize_branch():
    assert normalize_branch('s-f') == 'S-F'
    with pytest.raises(ValueError):
        normalize_branch('K')


@pytest.mark.parametrize('branch', BRANCHES)
def test_every_branch_reads_its_points_in_order(branch):
    released: list[str] = []
    for index, run in enumerate(READ_POINTS[branch], start=1):
        assert check_read(run, branch, released) == index
        released.append(run)


@pytest.mark.parametrize('branch', BRANCHES)
def test_a_read_after_the_budget_is_refused(branch):
    released = list(READ_POINTS[branch])
    for run in READ_POINTS[branch]:
        with pytest.raises(ReadRefused, match='budget'):
            check_read(run, branch, released)


def test_a_fourth_read_is_refused():
    with pytest.raises(ReadRefused, match=r'budget for branch N is used \(3 of 3'):
        check_read('r10', 'N', ['r04', 'r06', 'r10'])


@pytest.mark.parametrize(
    ('run', 'branch'), [('r05', 'N'), ('r06', 'S-F'), ('r07', 'N'), ('r10', 'S-F'), ('r00', 'S-C')]
)
def test_reads_outside_the_read_points_are_refused(run, branch):
    with pytest.raises(ReadRefused, match='not a registered read point'):
        check_read(run, branch, [])


def test_s_f_takes_exactly_two_reads():
    assert check_read('r04', 'S-F', []) == 1
    assert check_read('r10K', 'S-F', ['r04']) == 2
    with pytest.raises(ReadRefused):
        check_read('r06', 'S-F', ['r04'])


def test_a_repeat_is_refused():
    with pytest.raises(ReadRefused, match='already read at r04'):
        check_read('r04', 'N', ['r04'])


def test_reads_cannot_go_backwards():
    with pytest.raises(ReadRefused, match='comes before'):
        check_read('r04', 'N', ['r06'])


def test_a_log_from_another_branch_is_refused():
    # r06 was read under N; the branch cannot later become S-F, whose points skip r06.
    with pytest.raises(ReadRefused, match='disagree'):
        check_read('r10K', 'S-F', ['r04', 'r06'])
