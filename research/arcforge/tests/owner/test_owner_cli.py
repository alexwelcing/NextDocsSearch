import json
import os
import subprocess
import sys
from pathlib import Path

from arcforge import cli

ROOT = Path(__file__).resolve().parents[2]


def test_status_renders_the_checklist(home, capsys):
    assert cli.main(['owner', 'status']) == 0
    out = capsys.readouterr().out
    assert f'ARC OWNER DESK · {home / "arc-owner"}' in out
    assert '2 h 27 min left of about 2 h 27 min' in out
    assert ' 2 · Write 100 queries from memory' in out and '0/100' in out
    assert 'Before launch:' in out and '- Create the vault key (step 1).' in out


def test_status_json(home, capsys):
    assert cli.main(['owner', 'status', '--json']) == 0
    status = json.loads(capsys.readouterr().out)
    assert status['progress']['minutes'] == 146.5 and status['lock'] is None


def test_status_runs_under_a_bare_python(home):
    """The owner's Mac has no uv extras: `python3 -S -m arcforge owner status` must work."""
    env = {
        **os.environ,
        'PYTHONPATH': str(ROOT),
        'HOME': str(home),
        'ARCFORGE_STRICT_COMMANDS': '1',
    }
    out = subprocess.run(
        [sys.executable, '-S', '-m', 'arcforge', 'owner', 'status'],
        env=env,
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert out.returncode == 0, out.stderr
    assert 'Write 100 queries from memory' in out.stdout


def test_owner_and_vault_import_only_the_standard_library():
    """Import every owner/vault module in a python with no site-packages at all."""
    modules = [
        f'arcforge.{pkg}.{p.stem}'
        for pkg in ('owner', 'vault')
        for p in sorted((ROOT / 'arcforge' / pkg).glob('*.py'))
        if p.stem != '__init__'
    ] + ['arcforge.commands.owner', 'arcforge.commands.vault']
    code = 'import importlib, sys\nfor m in sys.argv[1:]:\n    importlib.import_module(m)\n'
    env = {**os.environ, 'PYTHONPATH': str(ROOT)}
    out = subprocess.run(
        [sys.executable, '-S', '-c', code, *modules], env=env, capture_output=True, text=True
    )
    assert out.returncode == 0, out.stderr
