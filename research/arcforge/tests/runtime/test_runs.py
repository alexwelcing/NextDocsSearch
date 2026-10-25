"""The one command end to end: run, the determinism exit criterion, verify, diff, executors."""

import json
import sys
import types
from pathlib import Path

import pytest

from arcforge import cli
from arcforge.core import executor as executor_mod
from arcforge.core.cache import open_store
from arcforge.core.dag import RunEnv
from arcforge.core.executor import (
    ExecutorUnavailable,
    LocalExecutor,
    RunRequest,
    VMExecutor,
    vm_spec,
)
from arcforge.core.stages import REGISTRY

SETS = [
    '--set',
    'corpus.frontier.withheld=["the-echo-chamber"]',
    '--set',
    'corpus.rename_map={"old-name": "new-name"}',
    '--set',
    'corpus.ghosts_by_default=["old-ghost"]',
]


def _run(repo: Path, cache: Path, out: Path | None, *extra: str) -> int:
    argv = [
        'run',
        'r00',
        '--stages',
        'S0,S1',
        '--repo',
        str(repo),
        '--cache',
        str(cache),
        *SETS,
        *extra,
    ]
    argv += ['--out', str(out)] if out else ['--no-out']
    return cli.main(argv)


def _tree(root: Path) -> dict[str, bytes]:
    return {
        p.relative_to(root).as_posix(): p.read_bytes()
        for p in sorted(root.rglob('*'))
        if p.is_file()
    }


def test_two_runs_from_cache_are_byte_identical(repo, tmp_path, capsys):
    """M1 exit criterion: determinism. A replay from the cache equals the computed run."""
    cache = tmp_path / 'cache'
    assert _run(repo, cache, tmp_path / 'one') == 0
    first_log = capsys.readouterr().err
    assert 'S0    built' in first_log and 'S1    built' in first_log
    assert _run(repo, cache, tmp_path / 'two') == 0
    second_log = capsys.readouterr().err
    assert 'S0    cached' in second_log and 'S1    cached' in second_log
    one, two = _tree(tmp_path / 'one'), _tree(tmp_path / 'two')
    assert one == two
    assert set(one) == {
        'run.json',
        'plan.json',
        'S0/snapshot.json',
        'S0/corpus.jsonl',
        'S1/graph.json',
        'S1/rationales.json',
        'S1/counts.json',
    }
    # A cold cache recomputes everything and still lands on the same bytes.
    assert _run(repo, tmp_path / 'cold', tmp_path / 'three') == 0
    assert _tree(tmp_path / 'three') == one


def test_run_manifest_records_keys_digests_and_artifact_hashes(repo, tmp_path):
    assert _run(repo, tmp_path / 'cache', tmp_path / 'out') == 0
    doc = json.loads((tmp_path / 'out' / 'run.json').read_text())
    assert doc['schema'] == 'arc-run/1' and doc['run']['id'] == 'r00' and doc['run']['seed'] == 1729
    assert [s['stage'] for s in doc['stages']] == ['S0', 'S1']
    assert set(doc['artifact_hashes']) == {
        f'{s["stage"]}/{n}' for s in doc['stages'] for n in s['outputs']
    }
    store = open_store(str(tmp_path / 'cache'))
    assert json.loads(store.get_manifest('r00')) == doc
    for name, digest in doc['artifact_hashes'].items():
        assert store.get_object(digest) == (tmp_path / 'out' / name).read_bytes()


def test_force_recomputes_and_lands_on_the_same_record(repo, tmp_path, capsys):
    cache = tmp_path / 'cache'
    assert _run(repo, cache, None) == 0
    capsys.readouterr()
    assert _run(repo, cache, None, '--force', 'S1') == 0
    assert 'S1    built' in capsys.readouterr().err


def test_force_must_name_selected_stages(repo, tmp_path, capsys):
    assert _run(repo, tmp_path / 'cache', None, '--force', 'S5') == 2
    assert "outside the selection: ['S5']" in capsys.readouterr().err


def test_verify_passes_then_catches_tampering_and_corpus_drift(repo, tmp_path, capsys):
    cache = tmp_path / 'cache'
    assert _run(repo, cache, tmp_path / 'out') == 0
    verify = ['verify', 'r00', '--cache', str(cache), '--repo', str(repo)]
    assert cli.main(verify) == 0
    assert 'byte-identical: 5 artifacts rebuilt and compared' in capsys.readouterr().out

    (repo / 'pages/docs/articles/gamma.mdx').write_text(
        '---\ntitle: Gamma, edited\n---\nNew text.\n'
    )
    assert cli.main([*verify, '--json']) == 1
    report = json.loads(capsys.readouterr().out)
    s0 = report['stages'][0]
    assert s0['key_drift'] and not s0['artifacts']['snapshot.json']['match']
    assert (
        report['stages'][1]['problems'] == []
    )  # S1 rebuilt from its recorded inputs still matches

    doc = json.loads((tmp_path / 'out' / 'run.json').read_text())
    digest = doc['artifact_hashes']['S1/counts.json']
    (cache / 'objects' / digest[:2] / digest).write_bytes(b'tampered')
    assert cli.main([*verify, '--manifest', str(tmp_path / 'out' / 'run.json')]) == 1
    assert 'hashes to' in capsys.readouterr().out


def test_diff_reports_config_artifact_and_corpus_changes(repo, tmp_path, capsys):
    cache = tmp_path / 'cache'
    assert _run(repo, cache, tmp_path / 'a') == 0
    (repo / 'pages/docs/articles/gamma.mdx').write_text('---\ntitle: Gamma\n---\nchanged\n')
    (repo / 'pages/docs/articles/delta.mdx').write_text('---\ntitle: Delta\n---\nnew\n')
    assert _run(repo, cache, tmp_path / 'b', '--set', 'lexicon.min_count=2') == 0
    capsys.readouterr()
    a, b = str(tmp_path / 'a' / 'run.json'), str(tmp_path / 'b' / 'run.json')
    assert cli.main(['diff', a, b, '--cache', str(cache), '--json']) == 0
    report = json.loads(capsys.readouterr().out)
    assert not report['identical']
    assert report['config'] == [{'path': 'lexicon.min_count', 'a': 3, 'b': 2}]
    assert {s['stage'] for s in report['stages']} == {'S0', 'S1'}
    assert report['corpus']['added'] == ['delta'] and report['corpus']['changed'] == ['gamma']
    assert cli.main(['diff', a, a, '--cache', str(cache), '--exit-code']) == 0
    assert 'identical' in capsys.readouterr().out
    assert cli.main(['diff', a, b, '--cache', str(cache), '--exit-code']) == 1


def test_run_refuses_to_start_over_budget(repo, tmp_path, capsys):
    cache = tmp_path / 'cache'
    assert _run(repo, cache, None, '--budget', '5') == 4
    assert 'refusing to start' in capsys.readouterr().err
    assert not cache.exists()


def test_prep_stops_at_the_first_stub_with_its_contract(repo, tmp_path, capsys):
    argv = [
        'run',
        'r00',
        '--prep',
        '--repo',
        str(repo),
        '--cache',
        str(tmp_path / 'c'),
        '--no-out',
        *SETS,
    ]
    assert cli.main(argv) == 3
    err = capsys.readouterr().err
    assert 'S2 (Glossary and entity cards) is not implemented yet' in err
    assert 'outputs: cards.jsonl, glossary.json, person_map.proposed.json' in err


def test_the_vm_part_needs_the_runner_and_a_gcs_cache(repo, tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(
        executor_mod, 'RUNNER_MODULE', 'arcforge.runner_not_installed_for_this_test'
    )
    base = ['run', 'r00', '--repo', str(repo), '--no-out', *SETS]
    assert cli.main([*base, '--cache', str(tmp_path / 'c')]) == 3
    assert 'needs a gs:// cache' in capsys.readouterr().err
    assert cli.main([*base, '--cache', 'gs://witching-606c6-arcforge/cache']) == 3
    assert 'runner_not_installed_for_this_test' in capsys.readouterr().err


def test_vm_executor_hands_the_runner_a_complete_spec(repo, config, tmp_path, monkeypatch):
    seen = {}
    local_cache = tmp_path / 'cache'

    def execute_remote(spec):
        seen.update(spec)
        # Stand in for the VM: run the same selection with the local executor.
        request = RunRequest(
            config=config, stages=spec['stages'], cache_url=str(local_cache), env=RunEnv(repo)
        )
        return {
            'manifest_sha256': LocalExecutor().execute(request, lambda _m: None).manifest_sha256
        }

    monkeypatch.setitem(
        sys.modules, 'fake_runner', types.SimpleNamespace(execute_remote=execute_remote)
    )
    request = RunRequest(
        config=config,
        stages=['S0', 'S1'],
        cache_url='gs://witching-606c6-arcforge/cache',
        env=RunEnv(repo),
        force=frozenset({'S1'}),
        budget_usd=20,
        plan_usd=11.78,
    )
    # The VM wrote to the shared cache; here that is the local stand-in.
    monkeypatch.setattr(executor_mod, 'open_store', lambda _url: open_store(str(local_cache)))
    outcome = VMExecutor('fake_runner').execute(request, lambda _m: None)
    assert (
        seen['schema'] == 'arc-vm-request/1'
        and seen['stages'] == ['S0', 'S1']
        and seen['force'] == ['S1']
    )
    assert seen['config'] == config.data and seen['run']['config_sha256'] == config.sha256
    assert seen['argv'][:3] == ['arcforge', 'run', 'config.json'] and '--stages' in seen['argv']
    assert seen['compute']['shape'] == 'g2-standard-8'
    assert [s['stage'] for s in outcome.manifest['stages']] == ['S0', 'S1']
    assert vm_spec(request) == seen


def test_vm_executor_explains_a_runner_without_the_hook(monkeypatch, config, repo):
    monkeypatch.setitem(sys.modules, 'hookless_runner', types.SimpleNamespace())
    request = RunRequest(config=config, stages=['S0'], cache_url='gs://b/c', env=RunEnv(repo))
    with pytest.raises(ExecutorUnavailable, match='execute_remote'):
        VMExecutor('hookless_runner').execute(request, lambda _m: None)


def test_out_dir_with_foreign_files_is_not_overwritten(repo, tmp_path, capsys):
    out = tmp_path / 'out'
    out.mkdir()
    (out / 'precious.txt').write_text('keep me')
    assert _run(repo, tmp_path / 'cache', out) == 1
    assert 'refusing to overwrite' in capsys.readouterr().err
    assert (out / 'precious.txt').read_text() == 'keep me'


def test_rerunning_into_the_same_out_dir_replaces_only_the_previous_run(repo, tmp_path, capsys):
    out = tmp_path / 'out'
    assert _run(repo, tmp_path / 'cache', out) == 0
    first = _tree(out)
    assert _run(repo, tmp_path / 'cache', out) == 0
    assert _tree(out) == first
    (out / 'S1' / 'notes.txt').write_text('mine')
    assert _run(repo, tmp_path / 'cache', out) == 1
    assert 'S1/notes.txt' in capsys.readouterr().err
    assert (out / 'S1' / 'notes.txt').read_text() == 'mine'


def test_bench_materialize_is_a_documented_stub(capsys):
    assert cli.main(['bench', 'materialize']) == 3
    assert 'not implemented' in capsys.readouterr().err
    assert cli.main(['bench']) == 2
    assert '--pointers FILE' in capsys.readouterr().out


def test_every_runtime_command_has_help(capsys):
    for command in ('plan', 'run', 'verify', 'diff', 'bench'):
        with pytest.raises(SystemExit) as raised:
            cli.main([command, '--help'])
        assert raised.value.code == 0
        assert capsys.readouterr().out.startswith('usage: arcforge ' + command)


def test_stage_selection_by_phase():
    from arcforge.commands.run import PHASE_FLAGS, select

    assert select(REGISTRY, PHASE_FLAGS['prep'], []) == ['S0', 'S1', 'S2']
    vm = select(REGISTRY, PHASE_FLAGS['vm'], [])
    assert vm[:3] == ['S0', 'S1', 'S2'] and vm[-1] == 'S14' and 'gate' not in vm
    assert select(REGISTRY, PHASE_FLAGS['resume'], [])[-2:] == ['gate', 'tail']
    assert select(REGISTRY, None, ['S1']) == ['S0', 'S1']
