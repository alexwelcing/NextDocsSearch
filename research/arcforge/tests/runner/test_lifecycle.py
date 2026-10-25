from pathlib import Path

import pytest

from arcforge.runner import lifecycle
from arcforge.runner.config import RunnerConfig
from arcforge.runner.shell import CommandError

SHA = '3a74fb4c0ffee0000000000000000000000000ab'
CREATED = {'name': 'arc-run-r00-3a74fb4', 'creationTimestamp': '2026-10-24T10:00:00.000-07:00'}
STOCKOUT = ("ERROR: (gcloud.compute.instances.create) Could not fetch resource:\n - The zone 'projects/witching-606c6/"
            "zones/us-central1-a' does not have enough resources available to fulfill the request.  '(resource type:compute)'.")


def test_instance_name():
    assert lifecycle.instance_name('r00', SHA) == 'arc-run-r00-3a74fb4'
    assert lifecycle.instance_name('r05K', SHA, 2) == 'arc-run-r05k-3a74fb4-2'
    with pytest.raises(ValueError):
        lifecycle.instance_name('r00', 'not-a-sha')


def test_labels_carry_the_run():
    labels = lifecycle.labels(RunnerConfig(), 'r05K', SHA, 2)
    assert labels == {'managed-by': 'claude', 'purpose': 'arcforge', 'arcforge-run': 'r05k',
                      'arcforge-sha': SHA[:12], 'arcforge-attempt': '2'}


def test_create_argv_has_every_safety_property():
    argv = lifecycle.create_argv(RunnerConfig(), 'arc-run-r00-3a74fb4', 'us-central1-a', 'spot',
                                 {'arcforge-run': 'r00', 'managed-by': 'claude'}, Path('/tmp/s.sh'))
    flags = set(argv)
    assert {'--provisioning-model=SPOT', '--instance-termination-action=DELETE', '--max-run-duration=10800s',
            '--maintenance-policy=TERMINATE', '--machine-type=g2-standard-8', '--boot-disk-size=200GB',
            '--boot-disk-type=pd-balanced', '--scopes=cloud-platform', '--tags=arcforge-runner',
            '--network-interface=network=default,no-address',  # no external IP: IAP-only SSH
            '--service-account=arcforge-runner@witching-606c6.iam.gserviceaccount.com',
            '--labels=arcforge-run=r00,managed-by=claude'} <= flags
    assert any(a.startswith('--metadata=') and 'block-project-ssh-keys=TRUE' in a for a in argv)
    assert '--metadata-from-file=startup-script=/tmp/s.sh' in flags
    on_demand = lifecycle.create_argv(RunnerConfig(), 'n', 'us-central1-b', 'on_demand', {}, Path('/tmp/s.sh'))
    assert '--provisioning-model=STANDARD' in on_demand and '--instance-termination-action=DELETE' in on_demand


def _create(shell, ladder=('spot', 'on_demand')):
    return lifecycle.create(shell, RunnerConfig(), name='arc-run-r00-3a74fb4', ladder=list(ladder),
                            labels={}, startup_script=Path('/tmp/s.sh'), log=lambda _m: None)


def test_create_takes_the_first_zone_with_capacity(shell):
    shell.on('instances create', then=shell.ok([CREATED]))
    inst = _create(shell)
    assert (inst.zone, inst.provisioning, inst.created_utc) == ('us-central1-a', 'spot', CREATED['creationTimestamp'])
    assert len(shell.calls) == 1


def test_stockout_walks_zones_then_falls_back_to_on_demand(shell):
    shell.on('instances create', '--provisioning-model=SPOT', then=shell.fail(STOCKOUT))
    shell.on('instances create', '--provisioning-model=STANDARD', '--zone=us-central1-a',
             then=shell.fail('ZONE_RESOURCE_POOL_EXHAUSTED_WITH_DETAILS'))
    shell.on('instances create', '--provisioning-model=STANDARD', '--zone=us-central1-b', then=shell.ok([CREATED]))
    inst = _create(shell)
    assert (inst.zone, inst.provisioning) == ('us-central1-b', 'on_demand')
    tried = [(next(a for a in c if a.startswith('--zone=')), next(a for a in c if a.startswith('--provisioning')))
             for c in shell.calls]
    assert tried == [
        ('--zone=us-central1-a', '--provisioning-model=SPOT'),
        ('--zone=us-central1-b', '--provisioning-model=SPOT'),
        ('--zone=us-central1-c', '--provisioning-model=SPOT'),
        ('--zone=us-central1-a', '--provisioning-model=STANDARD'),
        ('--zone=us-central1-b', '--provisioning-model=STANDARD'),
    ]


def test_quota_skips_the_other_zones_of_that_model(shell):
    shell.on('instances create', '--provisioning-model=SPOT',
             then=shell.fail("Quota 'PREEMPTIBLE_NVIDIA_L4_GPUS' exceeded.  Limit: 8.0 in region us-central1."))
    shell.on('instances create', '--provisioning-model=STANDARD', then=shell.ok([CREATED]))
    inst = _create(shell)
    assert inst.provisioning == 'on_demand' and len(shell.calls) == 2


def test_no_capacity_anywhere(shell):
    shell.on('instances create', then=shell.fail(STOCKOUT))
    with pytest.raises(lifecycle.CapacityError, match='us-central1-c/on_demand: stockout'):
        _create(shell)
    assert len(shell.calls) == 6


def test_a_real_error_stops_immediately(shell):
    shell.on('instances create', then=shell.fail("ERROR: Invalid value for field 'resource.serviceAccounts[0].email'"))
    with pytest.raises(CommandError):
        _create(shell)
    assert len(shell.calls) == 1


def test_describe_and_delete_tolerate_a_vanished_instance(shell):
    shell.on('instances describe', then=shell.not_found())
    shell.on('instances delete', then=shell.not_found())
    cfg = RunnerConfig()
    assert lifecycle.describe(shell, cfg, 'n', 'us-central1-a') is None
    assert lifecycle.delete(shell, cfg, 'n', 'us-central1-a') is False
    shell.on('instances delete', then=shell.ok())
    assert lifecycle.delete(shell, cfg, 'n', 'us-central1-a') is True
    assert '--quiet' in shell.calls[-1]


def test_end_time_prefers_the_delete_then_the_preemption():
    insert = {'operationType': 'insert', 'insertTime': '2026-10-24T10:00:00Z', 'endTime': '2026-10-24T10:00:30Z', 'status': 'DONE'}
    preempt = {'operationType': 'compute.instances.preempted', 'insertTime': '2026-10-24T10:20:00Z', 'endTime': '2026-10-24T10:20:30Z', 'status': 'DONE'}
    delete = {'operationType': 'delete', 'insertTime': '2026-10-24T10:21:00Z', 'endTime': '2026-10-24T10:21:40Z', 'status': 'DONE'}
    assert lifecycle.end_time([insert]) == (None, False)
    assert lifecycle.end_time([insert, preempt]) == ('2026-10-24T10:20:30Z', True)
    assert lifecycle.end_time([insert, preempt, delete]) == ('2026-10-24T10:21:40Z', True)
    assert lifecycle.end_time([insert, delete]) == ('2026-10-24T10:21:40Z', False)
    running = {**delete, 'status': 'RUNNING', 'endTime': None}
    assert lifecycle.end_time([insert, running]) == (None, False)
