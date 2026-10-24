from arcforge import cli


def test_discovers_commands():
    parser = cli.build_parser()
    sub = next(a for a in parser._actions if a.dest == 'command')
    assert 'version' in sub.choices


def test_version_runs(capsys):
    assert cli.main(['version']) == 0
    assert capsys.readouterr().out.startswith('arcforge ')


def test_no_command_prints_help():
    assert cli.main([]) == 2
