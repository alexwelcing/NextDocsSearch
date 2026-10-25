from arcforge import cli
from arcforge.runner import gc
from arcforge.runner.config import RunnerConfig

NOW = '2026-10-24T20:00:00Z'


def inst(name, created, *, run='r00', status='RUNNING', zone='us-central1-a'):
    labels = {'arcforge-run': run, 'managed-by': 'claude'} if run else {'managed-by': 'claude'}
    return {'name': name, 'creationTimestamp': created, 'status': status, 'labels': labels,
            'zone': f'https://www.googleapis.com/compute/v1/projects/witching-606c6/zones/{zone}'}


LISTING = [
    inst('arc-run-r00-3a74fb4', '2026-10-24T16:30:00Z'),  # 3.5 h: stale
    inst('arc-run-r01-3a74fb4-2', '2026-10-24T09:00:00.000-07:00', status='TERMINATED', zone='us-central1-b'),  # 4 h
    inst('arc-run-r02-3a74fb4', '2026-10-24T18:00:00Z'),  # 2 h: still inside its ceiling
    inst('holodeck-forge', '2026-01-01T00:00:00Z'),  # labeled but not a runner name
    inst('arc-run-manual', '2026-01-01T00:00:00Z', run=None),  # runner name, no runner label
]


def test_only_old_labeled_runners_are_stale():
    found = gc.stale(LISTING, now_utc=NOW, max_age_hours=3)
    assert [(s.name, s.zone, s.age_hours) for s in found] == [
        ('arc-run-r01-3a74fb4-2', 'us-central1-b', 4.0),
        ('arc-run-r00-3a74fb4', 'us-central1-a', 3.5),
    ]


def test_collect_deletes_each_stale_vm(shell):
    shell.on('instances list', '--filter=labels.arcforge-run:*', then=shell.ok(LISTING))
    shell.on('instances delete', then=shell.ok())
    found = gc.collect(shell, RunnerConfig(), now_utc=NOW, log=lambda _m: None)
    deleted = [(c[4], next(a for a in c if a.startswith('--zone='))) for c in shell.called('instances delete')]
    assert deleted == [('arc-run-r01-3a74fb4-2', '--zone=us-central1-b'), ('arc-run-r00-3a74fb4', '--zone=us-central1-a')]
    assert len(found) == 2


def test_dry_run_deletes_nothing(shell):
    shell.on('instances list', then=shell.ok(LISTING))
    gc.collect(shell, RunnerConfig(), now_utc=NOW, dry_run=True, log=lambda _m: None)
    assert not shell.called('instances delete')


def test_gc_command_is_registered(capsys):
    parser = cli.build_parser()
    args = parser.parse_args(['gc', '--dry-run', '--max-age-hours', '5'])
    assert args.dry_run and args.max_age_hours == 5.0 and args.project == 'witching-606c6'
