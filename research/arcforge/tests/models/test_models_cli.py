import json
import subprocess
import sys

from arcforge.models.__main__ import main


def test_help_runs_without_the_gpu_extras():
    out = subprocess.run(
        [sys.executable, '-m', 'arcforge.models', '--help'], capture_output=True, text=True
    )
    assert out.returncode == 0, out.stderr
    for command in ('parity-fixtures', 'payload', 'pins', 'teacher-check', 'llm-check'):
        assert command in out.stdout


def test_pins_prints_json(capsys):
    assert main(['pins']) == 0
    report = json.loads(capsys.readouterr().out)
    assert report['teacher']['repo'] == 'google/embeddinggemma-2'


def test_parity_fixtures_check_passes_on_the_committed_files(capsys):
    assert main(['parity-fixtures', '--check']) == 0
    assert 'current' in capsys.readouterr().out


def test_parity_fixtures_check_fails_when_stale(tmp_path, capsys):
    assert main(['parity-fixtures', '--out', str(tmp_path)]) == 0
    (tmp_path / 'golden.json').write_text('{}')
    assert main(['parity-fixtures', '--out', str(tmp_path), '--check']) == 1
    assert 'golden.json' in capsys.readouterr().err
