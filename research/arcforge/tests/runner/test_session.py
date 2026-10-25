import signal

import pytest

from arcforge.runner.bootstrap import Job
from arcforge.runner.config import RunnerConfig
from arcforge.runner.session import RunnerError, RunnerSession

SHA = '3a74fb4c0ffee0000000000000000000000000ab'
IMAGE = 'us-central1-docker.pkg.dev/witching-606c6/arcforge/arcforge@sha256:' + 'b' * 64
JOB = Job(image=IMAGE, argv=('run', 'configs/r00.yaml'))


def session(cloud, rates, cfg: RunnerConfig | None = None) -> RunnerSession:
    return RunnerSession(
        cfg or RunnerConfig(),
        run_id='r00',
        code_sha=SHA,
        shell=cloud,
        rates=rates,
        clock=cloud.clock,
        sleep=cloud.sleep,
        poll_seconds=60,
        log=lambda _m: None,
    )


def test_a_clean_run_books_one_spot_vm(rates, make_cloud):
    cloud = make_cloud({1: [(60, 'running'), (600, ('done', 0))]})
    with session(cloud, rates) as runner:
        result = runner.run(JOB)
        vm = runner.vm_report()
    assert result.ok and result.exit_code == 0
    assert cloud.instances == {}  # deleted
    assert vm['preemptions'] == 0 and vm['shape'] == 'g2-standard-8' and vm['gpu'] == 'nvidia-l4'
    (inst,) = vm['instances']
    assert (
        inst['name'] == 'arc-run-r00-3a74fb4'
        and inst['provisioning'] == 'SPOT'
        and inst['zone'] == 'us-central1-a'
    )
    assert inst['billed_min'] == 10.0  # created 10:00, done seen at the 10-min poll, deleted then
    assert inst['rate_usd_per_h'] == round(rates['spot'].usd_per_hour, 4)
    assert inst['usd'] == round(10 / 60 * rates['spot'].usd_per_hour, 2)


def test_a_failed_job_is_reported_not_retried(rates, make_cloud):
    cloud = make_cloud({1: [(120, ('done', 3))]})
    with session(cloud, rates) as runner:
        result = runner.run(JOB)
    assert result.outcome == 'failed' and result.exit_code == 3 and len(cloud.created) == 1


def test_preemption_recreates_on_spot_once_more_and_books_both(rates, make_cloud):
    cloud = make_cloud(
        {1: [(60, 'running'), (300, 'preempt')], 2: [(60, 'running'), (240, ('done', 0))]}
    )
    with session(cloud, rates) as runner:
        result = runner.run(JOB)
        vm = runner.vm_report()
    assert result.ok
    assert [c[0] for c in cloud.created] == ['arc-run-r00-3a74fb4', 'arc-run-r00-3a74fb4-2']
    assert [c[2] for c in cloud.created] == ['SPOT', 'SPOT']
    assert vm['preemptions'] == 1
    first, second = vm['instances']
    assert first['billed_min'] == 5.0  # booked to the preemption, not to when the laptop noticed
    assert second['billed_min'] == 4.0
    assert [i['provisioning'] for i in vm['instances']] == ['SPOT', 'SPOT']
    # The recreated VM runs the identical job (it resumes from the cache by itself).
    scripts = [c for c in cloud.calls if 'instances create' in ' '.join(c)]
    assert len(scripts) == 2


def test_second_preemption_goes_on_demand(rates, make_cloud):
    cloud = make_cloud({1: [(300, 'preempt')], 2: [(300, 'preempt')], 3: [(300, ('done', 0))]})
    with session(cloud, rates) as runner:
        assert runner.run(JOB).ok
        vm = runner.vm_report()
    assert [c[2] for c in cloud.created] == ['SPOT', 'SPOT', 'STANDARD']
    assert [i['provisioning'] for i in vm['instances']] == ['SPOT', 'SPOT', 'STANDARD']
    assert vm['instances'][2]['rate_usd_per_h'] == round(rates['on_demand'].usd_per_hour, 4)
    assert vm['preemptions'] == 2


def test_a_vm_deleted_by_hand_is_treated_like_a_preemption(rates, make_cloud):
    cloud = make_cloud({1: [(180, 'vanish')], 2: [(180, ('done', 0))]})
    with session(cloud, rates) as runner:
        assert runner.run(JOB).ok
        assert [i.ended for i in runner.instances] == ['lost', 'done']


def test_gives_up_after_three_vms(rates, make_cloud):
    cloud = make_cloud({1: [(60, 'preempt')], 2: [(60, 'preempt')], 3: [(60, 'vanish')]})
    with session(cloud, rates) as runner, pytest.raises(RunnerError, match='gave up after 3'):
        runner.run(JOB)
    assert cloud.instances == {}


def test_reaching_max_run_duration_is_not_retried(rates, make_cloud):
    cloud = make_cloud({1: [(10790, 'vanish')]})
    with session(cloud, rates) as runner, pytest.raises(RunnerError, match='max-run-duration'):
        runner.run(JOB)
    assert len(cloud.created) == 1


def test_done_then_poweroff_is_a_success(rates, make_cloud):
    cloud = make_cloud({1: [(300, ('done', 0)), (300, 'poweroff')]})
    with session(cloud, rates) as runner:
        assert runner.run(JOB).ok
    assert cloud.instances == {}  # the laptop deletes the stopped VM


def test_stockout_falls_back_to_on_demand_and_books_it(rates, make_cloud):
    stockouts = {(f'us-central1-{z}', 'SPOT') for z in 'abc'}
    cloud = make_cloud({1: [(120, ('done', 0))]}, stockouts=stockouts)
    with session(cloud, rates) as runner:
        assert runner.run(JOB).ok
        assert runner.vm_report()['instances'][0]['provisioning'] == 'STANDARD'


def test_exit_trap_deletes_on_an_exception(rates, make_cloud):
    cloud = make_cloud({1: [(60, 'running')]})

    def boom(*_args):
        raise KeyboardInterrupt

    with pytest.raises(KeyboardInterrupt), session(cloud, rates) as runner:
        runner.run(JOB, on_poll=boom)
    assert cloud.instances == {}
    assert runner.instances[0].ended == 'aborted' and runner.instances[0].deleted_utc


def test_exit_trap_turns_sigterm_into_cleanup(rates, make_cloud):
    cloud = make_cloud({1: [(60, 'running')]})

    def terminate(*_args):
        signal.raise_signal(signal.SIGTERM)

    previous = signal.getsignal(signal.SIGTERM)
    with pytest.raises(SystemExit) as exc, session(cloud, rates) as runner:
        runner.run(JOB, on_poll=terminate)
    assert exc.value.code == 128 + signal.SIGTERM
    assert cloud.instances == {}
    assert signal.getsignal(signal.SIGTERM) is previous  # handlers restored


def test_one_job_per_session(rates, make_cloud):
    cloud = make_cloud({1: [(60, ('done', 0))]})
    with session(cloud, rates) as runner:
        runner.run(JOB)
        with pytest.raises(RunnerError, match='one job per session'):
            runner.run(JOB)


def test_cost_lines_follow_arc_report_1(rates, make_cloud):
    cloud = make_cloud({1: [(300, 'preempt')], 2: [(120, ('done', 0))]})
    with session(cloud, rates) as runner:
        runner.run(JOB)
        lines = runner.cost_lines('S14')
    assert len(lines) == 2
    assert all(
        line['provider'] == 'gcp' and line['endpoint'] == 'us-central1' and line['stage'] == 'S14'
        for line in lines
    )
    assert set(lines[0]) == {
        'stage',
        'item',
        'provider',
        'endpoint',
        'model',
        'tokens_in',
        'tokens_out',
        'gpu_min',
        'usd',
        'cached',
        'dividend',
    }


def test_status_urls_are_per_run_and_instance(rates, make_cloud):
    runner = session(make_cloud({}), rates)
    assert (
        runner.status_url('arc-run-r00-3a74fb4')
        == 'gs://witching-606c6-arcforge/runs/r00/vm/arc-run-r00-3a74fb4'
    )


def _flaky_describe(cloud, failures):
    """Make the next `failures` describe calls fail like a network blip."""
    from arcforge.runner.shell import Result

    real = cloud.run
    left = [failures]

    def run(argv, **kw):
        if 'instances describe' in ' '.join(argv) and left[0] > 0:
            left[0] -= 1
            cloud.calls.append(tuple(argv))
            return Result(
                tuple(argv),
                1,
                '',
                'ERROR: (gcloud) There was a problem refreshing your current auth tokens',
            )
        return real(argv, **kw)

    cloud.run = run


def test_transient_poll_errors_are_ridden_out(rates, make_cloud):
    cloud = make_cloud({1: [(600, ('done', 0))]})
    _flaky_describe(cloud, 3)
    with session(cloud, rates) as runner:
        assert runner.run(JOB).ok
    assert len(cloud.created) == 1


def test_persistent_poll_errors_abort_and_delete(rates, make_cloud):
    from arcforge.runner.shell import CommandError

    cloud = make_cloud({1: [(6000, ('done', 0))]})
    _flaky_describe(cloud, 10)
    with pytest.raises(CommandError), session(cloud, rates) as runner:
        runner.run(JOB)
    assert cloud.instances == {} and runner.instances[0].ended == 'aborted'
