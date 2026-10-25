"""bootstrap.sh is executed for real here, against stub gcloud/docker/curl binaries on PATH."""

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

from arcforge.runner.bootstrap import Job, render

IMAGE = 'us-central1-docker.pkg.dev/witching-606c6/arcforge/arcforge@sha256:' + 'a' * 64
BASH = shutil.which('bash')
pytestmark = pytest.mark.skipif(BASH is None, reason='needs bash')

# Stubs record every call to $STUB_LOG. `gcloud storage cp SRC gs://…` writes into $GCS/<path>,
# so the test reads back exactly what the VM would have uploaded.
STUBS = {
    'curl': '''#!/bin/bash
case "$*" in *instance/name*) echo arc-run-r00-3a74fb4 ;; *instance/zone*) echo projects/1/zones/us-central1-b ;; esac
''',
    'gcloud': '''#!/bin/bash
echo "gcloud $*" >>"$STUB_LOG"
if [ "$1 $2" = "storage cp" ]; then
  dest="$GCS/${4#gs://}"; mkdir -p "$(dirname "$dest")"
  if [ "$3" = "-" ]; then cat >"$dest"; else cp "$3" "$dest"; fi
  exit 0
fi
if [ "$1 $2 $3" = "compute instances delete" ]; then exit "${SELF_DELETE_RC:-1}"; fi
exit 0
''',
    'docker': '''#!/bin/bash
echo "docker $*" >>"$STUB_LOG"
if [ "$1" = run ]; then echo "container says hi"; exit "${DOCKER_RC:-0}"; fi
''',
    'nvidia-smi': '#!/bin/bash\necho "NVIDIA L4, 580.95.05, 23034 MiB"\n',
    'poweroff': '#!/bin/bash\necho poweroff >>"$STUB_LOG"\n',
    'sleep': '#!/bin/bash\nexit 1\n',  # ends the heartbeat loop at once
}


@pytest.fixture
def vm(tmp_path):
    bin_dir = tmp_path / 'bin'
    bin_dir.mkdir()
    for name, body in STUBS.items():
        (bin_dir / name).write_text(body)
        (bin_dir / name).chmod(0o755)
    env = {
        'PATH': f'{bin_dir}:/usr/bin:/bin',
        'STUB_LOG': str(tmp_path / 'calls.log'),
        'GCS': str(tmp_path / 'gcs'),
        'ARC_WORK': str(tmp_path / 'work'),
        'HOME': str(tmp_path),
    }

    def boot(job: Job, **extra_env: str) -> tuple[int, str, Path]:
        script = tmp_path / 'startup.sh'
        script.write_text(render(job, run_id='r00', attempt=2, status_url='gs://bkt/runs/r00/vm/arc-run-r00-3a74fb4'))
        out = subprocess.run([BASH, str(script)], env={**env, **extra_env}, capture_output=True, text=True, timeout=60)
        calls = Path(env['STUB_LOG']).read_text() if Path(env['STUB_LOG']).exists() else ''
        return out.returncode, calls, tmp_path / 'gcs' / 'bkt' / 'runs' / 'r00' / 'vm' / 'arc-run-r00-3a74fb4'

    return boot


def test_render_quotes_everything():
    script = render(Job(image=IMAGE, argv=('run', "it's", '$HOME'), env={'X': 'a b'}, entrypoint='python'),
                    run_id='r00', attempt=1, status_url='gs://b/runs/r00/vm/n/')
    assert script.startswith('#!/bin/bash\n')
    assert "ARC_ARGV=(run 'it'\"'\"'s' '$HOME')" in script
    assert "ARC_ENTRYPOINT=(--entrypoint python)" in script
    assert "ARC_STATUS_URL=gs://b/runs/r00/vm/n\n" in script
    assert "'X=a b'" in script and 'ARCFORGE_ATTEMPT=1' in script


def test_rendered_script_is_valid_bash():
    script = render(Job(image=IMAGE, argv=('version',)), run_id='r00', attempt=1, status_url='gs://b/x')
    out = subprocess.run([BASH, '-n'], input=script, capture_output=True, text=True)
    assert out.returncode == 0, out.stderr


def test_job_validation():
    with pytest.raises(ValueError, match='by digest'):
        Job(image='us-central1-docker.pkg.dev/p/r/arcforge:latest')
    with pytest.raises(ValueError, match='needs an image'):
        Job()
    with pytest.raises(ValueError, match='invalid environment'):
        Job(image=IMAGE, env={'lower': '1'})


def test_happy_path_runs_the_container_and_reports_done(vm):
    rc, calls, gcs = vm(Job(image=IMAGE, argv=('version',), env={'ARCFORGE_X': '1'}, host_script='echo host-ok'))
    assert rc == 0
    status = json.loads((gcs / 'status.json').read_text())
    assert status['phase'] == 'done' and status['exit_code'] == 0
    assert status['instance'] == 'arc-run-r00-3a74fb4' and status['zone'] == 'us-central1-b'
    log = (gcs / 'job.log').read_text()
    assert 'host-ok' in log and 'container says hi' in log and 'NVIDIA L4' in log
    assert f'docker pull --quiet {IMAGE}' in calls
    run_line = next(line for line in calls.splitlines() if line.startswith('docker run'))
    assert '--gpus all' in run_line and run_line.endswith(f'{IMAGE} version')
    assert '-e ARCFORGE_X=1' in run_line and '-e ARCFORGE_ATTEMPT=2' in run_line and '-e ARCFORGE_RUN_ID=r00' in run_line
    assert 'gcloud auth configure-docker us-central1-docker.pkg.dev --quiet' in calls
    # VM-side exit trap: try to delete itself; the stub refuses, so it powers off instead.
    assert 'gcloud compute instances delete arc-run-r00-3a74fb4 --zone us-central1-b --quiet' in calls
    assert calls.rstrip().endswith('poweroff')


def test_self_delete_skips_poweroff_when_permitted(vm):
    rc, calls, _ = vm(Job(host_script='true'), SELF_DELETE_RC='0')
    assert rc == 0 and 'poweroff' not in calls


def test_a_failing_job_reports_its_exit_code(vm):
    rc, _, gcs = vm(Job(image=IMAGE, argv=('run',)), DOCKER_RC='7')
    assert rc == 7
    assert json.loads((gcs / 'status.json').read_text()) | {'updated_utc': None} == {
        'phase': 'done', 'exit_code': 7, 'instance': 'arc-run-r00-3a74fb4', 'zone': 'us-central1-b', 'updated_utc': None}


def test_a_failing_host_script_skips_the_container(vm):
    rc, calls, gcs = vm(Job(image=IMAGE, argv=('run',), host_script='echo before; exit 3; echo after'))
    assert rc == 3 and 'docker run' not in calls
    log = (gcs / 'job.log').read_text()
    assert 'before' in log and 'after' not in log


def test_a_second_boot_never_reruns_the_job(vm, tmp_path):
    vm(Job(host_script='echo first'))
    rc, calls, gcs = vm(Job(host_script='echo second'))
    assert json.loads((gcs / 'status.json').read_text())['exit_code'] == 125
    assert 'second' not in (gcs / 'job.log').read_text()
    assert os.path.exists(tmp_path / 'work' / 'started')
