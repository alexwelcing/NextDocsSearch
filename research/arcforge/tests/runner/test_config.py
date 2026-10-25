import pytest

from arcforge.runner.config import ConfigError, RunnerConfig


def test_defaults_are_the_programs_runner():
    cfg = RunnerConfig()
    assert (cfg.project, cfg.region, cfg.shape, cfg.gpu) == ('witching-606c6', 'us-central1', 'g2-standard-8', 'nvidia-l4')
    assert cfg.zone_names == ['us-central1-a', 'us-central1-b', 'us-central1-c']
    assert (cfg.provisioning, cfg.fallback, cfg.max_run_seconds) == ('spot', 'on_demand', 10800)
    assert (cfg.boot_disk_gb, cfg.boot_disk_type) == (200, 'pd-balanced')
    assert cfg.service_account == 'arcforge-runner@witching-606c6.iam.gserviceaccount.com'
    assert cfg.spec == {'vcpus': 8, 'ram_gib': 32, 'gpus': 1}


def test_from_compute_reads_the_config_surface():
    cfg = RunnerConfig.from_compute({
        'project': 'witching-606c6', 'region': 'us-central1', 'zones': ['a', 'b', 'c'],
        'shape': 'g2-standard-16', 'provisioning': 'spot', 'fallback': 'on_demand', 'max_run_hours': 3,
        'labels': {'extra': 'yes'},
    })
    assert cfg.shape == 'g2-standard-16' and cfg.spec['vcpus'] == 16
    assert cfg.zones == ('a', 'b', 'c')
    assert cfg.labels == {'managed-by': 'claude', 'purpose': 'arcforge', 'extra': 'yes'}


@pytest.mark.parametrize('compute', [
    {'shape': 'a2-highgpu-1g'},
    {'max_run_hours': 4},
    {'max_run_hours': 0},
    {'provisioning': 'preemptible'},
    {'fallback': 'spot'},
    {'zones': []},
    {'zones': ['us-central1-a']},
    {'typo_key': 1},
])
def test_rejects_anything_outside_the_program(compute):
    with pytest.raises(ConfigError):
        RunnerConfig.from_compute(compute)


def test_provisioning_ladder():
    assert RunnerConfig().provisioning_ladder() == ['spot', 'on_demand']
    assert RunnerConfig().provisioning_ladder(spot=False) == ['on_demand']
    assert RunnerConfig(fallback=None).provisioning_ladder() == ['spot']
    # After the spot attempts are spent, on-demand is used even with no configured fallback.
    assert RunnerConfig(fallback=None).provisioning_ladder(spot=False) == ['on_demand']
    assert RunnerConfig(provisioning='on_demand').provisioning_ladder() == ['on_demand']
