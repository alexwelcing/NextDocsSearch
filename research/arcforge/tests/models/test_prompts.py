import json
from pathlib import Path

import jsonschema

from arcforge.models import prompts

RECORDS = Path(__file__).resolve().parents[4] / 'public' / 'arc' / 'records'
CARDS = prompts.synthetic_cards(40)


def test_ministral_fixture_has_200_prompts_over_every_family():
    cases = prompts.ministral_fixture(CARDS)
    assert len(cases) == prompts.MINISTRAL_FIXTURE_SIZE == 200
    assert len({c.id for c in cases}) == 200
    families = [c.schema['properties']['queries']['items']['properties']['family']['enum'][0] for c in cases]
    assert set(families) == set(prompts.FAMILIES)
    for case in cases:
        jsonschema.Draft202012Validator.check_schema(case.schema)
        assert case.messages[0]['role'] == 'system' and 'JSON' in case.messages[0]['content']


def answer(family, n=3, text='what is calibration sickness'):
    return json.dumps({'queries': [{'text': text, 'family': family, 'grade_hint': 3}] * n})


def test_validate_counts_schema_validity():
    case = prompts.ministral_fixture(CARDS)[0]
    family = case.schema['properties']['queries']['items']['properties']['family']['enum'][0]
    assert prompts.validate(answer(family), case) == (True, '')
    assert not prompts.validate(answer(family, n=2), case)[0]
    assert not prompts.validate(answer('D-vibe' if family != 'D-vibe' else 'T-time'), case)[0]
    assert prompts.validate('not json', case)[1].startswith('not JSON')
    assert prompts.validate('```json\n{}\n```', case)[0] is False


def test_visitor_short_is_at_most_60_characters():
    case = next(c for c in prompts.ministral_fixture(CARDS) if 'visitor-short' in c.id)
    assert prompts.validate(answer('D-visitor-short', text='calibration sicknes'), case)[0]
    assert not prompts.validate(answer('D-visitor-short', text='x' * 61), case)[0]


def test_audit_fixture():
    cases = prompts.audit_fixture(CARDS, 16, k=8)
    assert len(cases) == 16
    case = cases[3]
    jsonschema.Draft202012Validator.check_schema(case.schema)
    user = case.messages[1]['content']
    assert user.count('\n[') == 8 and 'Query:' in user
    assert 'different people' in case.messages[0]['content']
    good = json.dumps({'grades': [{'id': i, 'grade': i % 4} for i in range(1, 9)]})
    assert prompts.validate(good, case)[0] and prompts.expectation_problems(good, case) == []
    dup = json.dumps({'grades': [{'id': 1, 'grade': 0}] * 8})
    assert prompts.validate(dup, case)[0] and prompts.expectation_problems(dup, case)
    # The target is not always candidate 1.
    targets = [c.messages[1]['content'].split('\n')[2] for c in cases[:8]]
    assert len(set(targets)) > 1


def test_training_case():
    case = prompts.training_query_case(CARDS[0], 0)
    good = json.dumps({'queries': ['a b c'] * 6})
    assert prompts.validate(good, case)[0]
    assert not prompts.validate(json.dumps({'queries': ['abc'] * 5}), case)[0]


def test_record_cards_from_the_corpus():
    if not RECORDS.is_dir():
        return
    cards = prompts.record_cards(RECORDS, 5)
    assert len(cards) == 5 and all(c.title and c.slug for c in cards)
    assert [c.slug for c in cards] == sorted(c.slug for c in cards)
