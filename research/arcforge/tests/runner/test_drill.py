import hashlib
import json

import pytest

from arcforge.runner import drill
from arcforge.runner.config import RunnerConfig
from arcforge.runner.session import RunnerSession
from arcforge.runner.shell import Result


class Interrupt(Exception):
    pass


class FlakyStore(drill.DirStore):
    """Dies after `budget` puts: a VM deleted mid-stage."""

    def __init__(self, root, budget):
        super().__init__(root)
        self.budget = budget

    def put(self, key, data):
        if self.budget == 0:
            raise Interrupt
        self.budget -= 1
        super().put(key, data)


def test_step_keys_chain_and_are_deterministic():
    a = drill.step_key(0, 'root', 1729)
    assert a == drill.step_key(0, 'root', 1729)
    assert a != drill.step_key(0, 'root', 1730) != drill.step_key(1, 'root', 1729)
    assert drill.step_output(a) == drill.step_output(a) and len(drill.step_output(a)) == drill.STEP_BYTES


def test_an_interrupted_stage_resumes_byte_identical(tmp_path):
    clean = drill.expected_artifact(tmp_path / 'clean', steps=5, seed=1729)
    cache = tmp_path / 'cache'
    with pytest.raises(Interrupt):
        drill.stage(FlakyStore(cache, budget=2), steps=5, seed=1729, log=lambda _m: None)
    resumed, counts = drill.stage(drill.DirStore(cache), steps=5, seed=1729, log=lambda _m: None)
    assert counts == {'cached': 2, 'computed': 3}
    assert resumed == clean
    rows = json.loads(resumed)['steps']
    assert [r['step'] for r in rows] == list(range(5))
    assert rows[1]['key'] == drill.step_key(1, rows[0]['sha256'], 1729)


def test_run_drill_kills_the_first_vm_and_proves_the_resume(tmp_path, rates, make_cloud):
    """The controller end to end against the fake cloud: the 'VM' runs the real stage function."""
    cloud = make_cloud({})
    cache = {}

    class CloudStore:
        def get(self, key):
            return cache.get(key)

        def put(self, key, data):
            cache[key] = data

    # Each tick of the fake clock is one more step of work on whichever VM is alive; a VM
    # replays the stage from the top each time, so steps it finds in the cache cost nothing.
    progress: dict[str, int] = {}

    def vm_tick(name, inst):
        progress[name] = progress.get(name, 0) + 1
        prefix = f'gs://witching-606c6-arcforge/runs/{inst["run"]}'
        lines: list[str] = []
        artifact, _ = drill.stage(CloudStore(), steps=min(progress[name], 6), seed=1729, log=lines.append)
        cloud.objects[f'{prefix}/vm/{name}/job.log'] = '\n'.join(lines)
        if progress[name] >= 6:
            cloud.objects[f'{prefix}/artifacts/drill.json'] = artifact.decode()
            cloud.objects[f'{prefix}/vm/{name}/status.json'] = json.dumps({'phase': 'done', 'exit_code': 0})

    original_tick = cloud.tick

    def tick():
        original_tick()
        for name, inst in list(cloud.instances.items()):
            vm_tick(name, inst)

    cloud.tick = tick
    cloud.on('storage ls', then=lambda argv: Result(argv, 0, '\n'.join(f'{argv[3]}{k}' for k in cache)))

    runner = RunnerSession(RunnerConfig(), run_id='drill-x', code_sha='3a74fb4', shell=cloud, rates=rates,
                           clock=cloud.clock, sleep=cloud.sleep, poll_seconds=40, log=lambda _m: None)
    with runner:
        report = drill.run_drill(runner, image='r@sha256:' + 'f' * 64, drill_id='drill-x', steps=6, kill_after=2, workdir=tmp_path)
    assert report['byte_identical'] is True
    assert report['killed']['instance'] == 'arc-run-drill-x-3a74fb4' and report['killed']['steps_cached_at_kill'] == 2
    assert [i['name'] for i in report['instances']] == ['arc-run-drill-x-3a74fb4', 'arc-run-drill-x-3a74fb4-2']
    assert all(i['provisioning'] == 'SPOT' for i in report['instances'])
    assert report['preemptions'] == 1 and report['resumed_steps_on_last_vm'] >= 2
    assert report['expected_sha256'] == hashlib.sha256(drill.expected_artifact(tmp_path / 'again', steps=6, seed=1729)).hexdigest()
    assert cloud.instances == {}


def test_kill_after_must_split_the_stage(tmp_path):
    with pytest.raises(ValueError):
        drill.run_drill(None, image='i', drill_id='d', steps=3, kill_after=3, workdir=tmp_path)
