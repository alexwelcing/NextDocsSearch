import json
from decimal import Decimal
from pathlib import Path

import pytest

from arcforge import cli
from arcforge.core.budget import make_plan, render
from arcforge.core.config import ARCFORGE_ROOT, ConfigError, load_config
from arcforge.core.prices import load_prices
from arcforge.core.stages import REGISTRY

PRICES = ARCFORGE_ROOT / 'prices' / '2026-10.yaml'


def _plan(overrides=None, prices=PRICES, budget=None):
    config = load_config('r00', overrides or {})
    return make_plan(config, load_prices(prices), REGISTRY, budget_usd=budget)


def _table_with(tmp_path: Path, old: str, new: str) -> Path:
    text = PRICES.read_text()
    assert old in text
    path = tmp_path / '2026-10.yaml'
    path.write_text(text.replace(old, new))
    return path


def test_price_table_flags_both_gemini_prices_and_the_spot_rate():
    flags = {(f['entry'], f['field']) for f in load_prices(PRICES).verify_at_launch()}
    assert {
        ('llm.gemini-3.1-flash-lite', 'usd_per_m_in'),
        ('llm.gemini-3.1-flash-lite', 'usd_per_m_out'),
        ('llm.gemini-3-flash', 'usd_per_m_in'),
        ('llm.gemini-3-flash', 'usd_per_m_out'),
        ('compute.g2-standard-8', 'spot_usd_per_h'),
    } <= flags


def test_price_arithmetic_is_exact():
    prices = load_prices(PRICES)
    assert prices.llm_usd('gemini-3-flash', 780_000, 390_000) == Decimal('1.56')
    assert prices.llm_usd('gemini-3.1-flash-lite', 14_800_000, 680_000) == Decimal('4.72')
    assert prices.vm_usd('g2-standard-8', 60) == Decimal('0.85')
    assert prices.vm_usd('g2-standard-8', 60, 'spot') == Decimal('0.34')


def test_a_bad_price_table_is_refused(tmp_path):
    with pytest.raises(ConfigError, match='flags unknown field'):
        load_prices(
            _table_with(tmp_path, 'verify_at_launch: [spot_usd_per_h]', 'verify_at_launch: [nope]')
        )


def test_plan_r00_comes_in_at_the_programs_11_78_under_the_20_cap():
    plan = _plan()
    doc = plan.to_json()
    assert doc['plan_usd'] == 11.78 <= 20
    assert (doc['subtotal_usd'], doc['contingency']['usd'], doc['dividend_usd']) == (
        10.24,
        1.54,
        0.0,
    )
    assert doc['ok'] and doc['limit_usd'] == doc['ceiling_usd'] == doc['cap_usd'] == 20
    assert doc['vm']['minutes'] == 115 and doc['vm']['usd'] == 1.63
    vertex = sum(line['usd'] for line in doc['lines'] if line['provider'] == 'vertex')
    assert round(vertex, 2) == 8.31  # 1.56 + 4.72 + 1.87 + 0.10 + 0.06
    assert not any(line['dividend'] for line in doc['lines'])  # R00 has no dividend lines


def test_plan_prices_every_stage():
    stages = [row['stage'] for row in _plan().to_json()['stages']]
    assert stages == list(REGISTRY)


def test_plan_prices_the_vm_at_on_demand_never_spot(tmp_path):
    spot = _table_with(tmp_path, 'spot_usd_per_h: 0.34', 'spot_usd_per_h: 0.01')
    assert _plan(prices=spot).to_json()['plan_usd'] == 11.78
    on_demand = _table_with(tmp_path, 'on_demand_usd_per_h: 0.85', 'on_demand_usd_per_h: 1.70')
    assert _plan(prices=on_demand).to_json()['vm']['usd'] == 3.26


def test_over_the_limit_is_not_ok_and_names_the_first_cut():
    plan = _plan(budget=10)
    doc = plan.to_json()
    assert not plan.ok and doc['limit_usd'] == 10
    assert doc['first_cut']['saving_usd'] == 0.47  # adjudication 20% -> 15%, as the program says
    assert 'pre-named first cut' in render(plan)


def test_a_bigger_workload_breaks_the_ceiling():
    lines = load_config('r00').get('plan.S12')
    heavy = [
        dict(line, tokens_in=line['tokens_in'] * 4) if line.get('id') == 'judging' else line
        for line in lines
    ]
    plan = _plan({'plan.S12': heavy})
    assert not plan.ok and plan.to_json()['plan_usd'] > 20


def _later(dividend):
    return {
        'run.id': 'r05',
        'budget.plan_ceiling': 17,
        'budget.dividend': dividend,
    }


DIVIDEND = [
    {
        'priority': 'new_queries',
        'stage': 'S12',
        'item': 'new judged queries',
        'model': 'gemini-3.1-flash-lite',
        'unit': 'query',
        'tokens_in_per_unit': 16000,
        'tokens_out_per_unit': 600,
        'max_units': 2000,
    },
    {
        'priority': 'pools',
        'stage': 'S12',
        'item': 'depth-20 pools',
        'model': 'gemini-3.1-flash-lite',
        'unit': 'query',
        'tokens_in_per_unit': 40000,
        'tokens_out_per_unit': 2000,
        'max_units': 50,
    },
]


def test_the_dividend_fills_to_the_17_ceiling_by_priority():
    plan = _plan(_later(DIVIDEND))
    doc = plan.to_json()
    dividend = [line for line in doc['lines'] if line['dividend']]
    # 'pools' comes first in dividend_priority even though it is listed second.
    assert [line['item'].split(' (')[0] for line in dividend] == [
        'depth-20 pools',
        'new judged queries',
    ]
    assert dividend[0]['item'] == 'depth-20 pools (50 x query)'
    # Whole units of $0.0049 fill the room left after the pools: the plan lands on the ceiling.
    assert plan.ok and doc['plan_usd'] == 17.0
    assert doc['limit_usd'] == 17


def test_the_dividend_respects_budget_and_max_units():
    capped = _plan(_later(DIVIDEND), budget=15).to_json()
    assert capped['plan_usd'] <= 15
    small = [dict(DIVIDEND[1], max_units=1)]
    one = _plan(_later(small)).to_json()
    assert [line['tokens_in'] for line in one['lines'] if line['dividend']] == [40000]


@pytest.mark.parametrize(
    ('overrides', 'message'),
    [
        ({'plan.S99': [{'kind': 'laptop', 'item': 'x'}]}, 'unknown stages'),
        ({'plan.S2': [{'kind': 'llm', 'item': 'x', 'model': 'gpt-9'}]}, 'no model'),
        (
            {'plan.S5': [{'kind': 'vm', 'item': 'x', 'model': 'gemini-3-flash', 'minutes': 1}]},
            'not a vLLM',
        ),
        ({'plan.S2': [{'kind': 'llm', 'item': 'x', 'model': 'qwen3.5-9b'}]}, 'not a Vertex'),
        ({'budget.first_cut': {'line': 'S12.nothing', 'scale': 0.5}}, 'names no plan line'),
    ],
)
def test_plan_rejects_bad_workloads(overrides, message):
    with pytest.raises(ConfigError, match=message):
        _plan(overrides)


def test_plan_command_exit_codes(capsys):
    assert cli.main(['plan', 'r00']) == 0
    out = capsys.readouterr().out
    assert 'PLAN              $  11.78' in out and 'verify at launch' in out
    assert cli.main(['plan', 'r00', '--json']) == 0
    assert json.loads(capsys.readouterr().out)['plan_usd'] == 11.78
    assert cli.main(['plan', 'r00', '--budget', '5']) == 4
    assert cli.main(['plan', 'r00', '--set', 'budget.cap=25']) == 1
    assert 'hard cap' in capsys.readouterr().err
