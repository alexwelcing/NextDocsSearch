import os
import pkgutil
import subprocess
import sys
from pathlib import Path

import pytest

from arcforge import cli, commands

ROOT = Path(__file__).resolve().parents[1]


def _subcommands(parser):
    return next(a for a in parser._actions if a.dest == 'command').choices


def test_discovers_commands():
    assert 'version' in _subcommands(cli.build_parser())


def test_every_public_command_module_registers():
    choices = _subcommands(cli.build_parser())
    public = [m.name for m in pkgutil.iter_modules(commands.__path__) if not m.name.startswith('_')]
    assert public and all(name in choices for name in public)


def test_version_runs(capsys):
    assert cli.main(['version']) == 0
    assert capsys.readouterr().out.startswith('arcforge ')


def test_no_command_prints_help():
    assert cli.main([]) == 2


def test_broken_command_is_isolated(tmp_path, monkeypatch):
    (tmp_path / 'broken.py').write_text('import module_that_does_not_exist\n')
    monkeypatch.setattr(commands, '__path__', [*commands.__path__, str(tmp_path)])
    monkeypatch.delenv('ARCFORGE_STRICT_COMMANDS', raising=False)
    parser = cli.build_parser()
    assert 'version' in _subcommands(parser)
    assert cli.main(['broken']) == 3

    monkeypatch.setenv('ARCFORGE_STRICT_COMMANDS', '1')
    with pytest.raises(ModuleNotFoundError):
        cli.build_parser()


def test_cli_boots_without_site_packages():
    """The owner desk and vault must work under a bare python3 with no extras installed."""
    env = {**os.environ, 'PYTHONPATH': str(ROOT), 'ARCFORGE_STRICT_COMMANDS': '1'}
    out = subprocess.run(
        [sys.executable, '-S', '-m', 'arcforge', '--help'], env=env, capture_output=True, text=True
    )
    assert out.returncode == 0, out.stderr
    assert 'version' in out.stdout
