import hashlib
import os
from pathlib import Path

import pytest

from arcforge.core import config as cfg
from arcforge.core.config import ConfigError, load_config, parse_override
from arcforge.core.hashing import canonical_json, digest_of, pairs_id, pretty_json


def test_canonical_json_is_order_free_utf8_and_newline_terminated():
    a = canonical_json({'b': 1, 'a': ['é', 2.5]})
    assert a == canonical_json({'a': ['é', 2.5], 'b': 1})
    assert a == '{"a":["é",2.5],"b":1}\n'.encode()
    assert pretty_json({'b': 1, 'a': 2}).decode().startswith('{\n "a": 2')


def test_canonical_json_rejects_non_finite_floats():
    with pytest.raises(ValueError, match='non-finite'):
        canonical_json({'x': [float('nan')]})


def test_pairs_id_is_the_documented_formula():
    pairs = [('b', 'f' * 64), ('a', '0' * 64)]
    expected = hashlib.sha256(f'a\t{"0" * 64}\nb\t{"f" * 64}\n'.encode()).hexdigest()
    assert pairs_id(pairs) == expected == pairs_id(list(reversed(pairs)))


def test_r00_loads_validates_and_hashes_stably():
    one, two = load_config('r00'), load_config(cfg.CONFIGS_DIR / 'r00.yaml')
    assert one.sha256 == two.sha256 == digest_of(one.data)
    assert (one.run_id, one.branch, one.seed) == ('r00', 'N', 1729)
    assert one.get('budget.plan_ceiling') == one.get('budget.cap') == 20
    assert one.get('corpus.frontier.withheld') == ['the-echo-chamber', 'the-residue']


def test_overrides_change_the_hash():
    base = load_config('r00')
    seeded = load_config('r00', {'run.seed': 7})
    assert seeded.seed == 7 and seeded.sha256 != base.sha256
    assert parse_override('run.seed=7') == ('run.seed', 7)
    assert parse_override('run.one_change=two words') == ('run.one_change', 'two words')
    with pytest.raises(ConfigError):
        parse_override('no-equals-sign')


def _child(tmp_path: Path, body: str) -> Path:
    rel = os.path.relpath(cfg.CONFIGS_DIR / 'r00.yaml', tmp_path)
    path = tmp_path / 'r01.yaml'
    path.write_text(f'extends: {rel}\n{body}')
    return path


def test_extends_merges_mappings_and_replaces_lists(tmp_path):
    path = _child(
        tmp_path,
        'run: {id: r01, one_change: lexemes}\nbudget: {plan_ceiling: 17}\neval: {strata: [A, B]}\n',
    )
    child = load_config(path)
    assert child.run_id == 'r01' and child.get('run.seed') == 1729  # merged, not replaced
    assert child.get('budget.cap') == 20 and child.get('budget.plan_ceiling') == 17
    assert child.get('eval.strata') == ['A', 'B']  # replaced whole


def test_extends_cycle_is_an_error(tmp_path):
    (tmp_path / 'a.yaml').write_text('extends: b.yaml\n')
    (tmp_path / 'b.yaml').write_text('extends: a.yaml\n')
    with pytest.raises(ConfigError, match='cycle'):
        load_config(tmp_path / 'a.yaml')


@pytest.mark.parametrize(
    ('overrides', 'message'),
    [
        ({'run.id': 'r01'}, 'later run plans to \\$17'),
        ({'budget.cap': 25}, 'hard cap'),
        ({'budget.plan_ceiling': 21}, 'exceeds budget.cap'),
        ({'run.id': 'r01', 'budget.plan_ceiling': 17, 'budget.reserve': 4}, 'reserve'),
        ({'run.branch': 'X'}, 'run.branch'),
        ({'compute.max_run_hours': 4}, 'max_run_hours'),
        ({'llm.anthropic_key': 'sk-something'}, 'anthropic_key'),
        ({'bogus': 1}, 'Additional properties'),
        (
            {
                'budget.dividend': [
                    {
                        'priority': 'nope',
                        'stage': 'S12',
                        'item': 'x',
                        'model': 'm',
                        'unit': 'q',
                        'tokens_in_per_unit': 1,
                        'tokens_out_per_unit': 1,
                        'max_units': 1,
                    }
                ]
            },
            'priority',
        ),
    ],
)
def test_the_guard_rules_reject_bad_configs(overrides, message):
    with pytest.raises(ConfigError, match=message):
        load_config('r00', overrides)


def test_yaml_dates_must_be_quoted(tmp_path):
    path = _child(tmp_path, 'run: {id: r00, one_change: 2026-10-24}\n')
    with pytest.raises(ConfigError, match='not a plain JSON value'):
        load_config(path)


def test_flatten_gives_dotted_leaves():
    assert cfg.flatten({'a': {'b': 1, 'c': [1, 2]}, 'd': {}}) == {'a.b': 1, 'a.c': [1, 2], 'd': {}}
