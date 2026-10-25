from arcforge.owner.prep import load_prep


def _load(home, name, records):
    return load_prep(home / 'arc-owner' / 'prep', name, records.by_slug())


def test_missing_files_are_missing(home, records):
    for name in ('people', 'registers', 'audit', 'adjudicate', 'remeaning'):
        state = _load(home, name, records)
        assert (state.status, state.data, state.signature) == ('missing', None, None)


def test_people_ok_and_titles_filled_in(home, records, prep, fixtures):
    prep('people.json', fixtures['people']())
    state = _load(home, 'people', records)
    assert state.status == 'ok' and state.signature
    adaeze = state.data['names'][0]
    assert adaeze['clusters'][0]['records'][0]['title'] == 'Far Shore 06 The Last Handshake'
    assert state.data['names'][1]['variants'] == [
        {'name_id': 'priya-chakraborty', 'reason': 'possible typo'}
    ]


def test_people_with_a_repeated_record_needs_mention_ids(home, records, prep, fixtures):
    doc = fixtures['people']()
    clusters = doc['names'][0]['clusters']
    clusters[1]['records'].append({'slug': 'far-shore-06-the-last-handshake', 'role': 'a namesake'})
    prep('people.json', doc)
    state = _load(home, 'people', records)
    assert state.status == 'invalid' and 'mention_id' in state.error
    clusters[1]['records'][-1]['mention_id'] = 'far-shore-06-the-last-handshake-2'
    prep('people.json', doc)
    assert _load(home, 'people', records).status == 'ok'


def test_audit_pairs_are_reduced_to_what_a_blind_audit_may_show(home, records, prep, fixtures):
    prep('audit-pairs.json', fixtures['pairs']('audit', 150))
    state = _load(home, 'audit', records)
    assert state.status == 'ok' and len(state.data['pairs']) == 150
    pair = state.data['pairs'][0]
    assert set(pair) == {'pair_id', 'query', 'record', 'passages'}
    assert set(pair['record']) == {'slug', 'title', 'date', 'description'}
    assert pair['passages'] == ['first passage', 'second passage']
    assert pair['record']['date'] == '2041-01-01'  # filled in from the record index
    assert 'gemini' not in str(state.to_json()) and 'B4' not in str(state.to_json())


def test_adjudicate_holds_at_most_30(home, records, prep, fixtures):
    prep('adjudicate-pairs.json', fixtures['pairs']('adjudicate', 31))
    state = _load(home, 'adjudicate', records)
    assert state.status == 'invalid' and 'at most 30' in state.error


def test_registers_must_use_declared_registers(home, records, prep, fixtures):
    doc = fixtures['registers']()
    prep('registers.json', doc)
    assert _load(home, 'registers', records).status == 'ok'
    doc['records'][0]['register'] = 'mystery'
    prep('registers.json', doc)
    state = _load(home, 'registers', records)
    assert state.status == 'invalid' and 'mystery' in state.error


def test_wrong_schema_and_bad_json_are_invalid_not_fatal(home, records, prep, fixtures):
    prep('people.json', {**fixtures['people'](), 'schema': 'arc-people-proposal/0'})
    assert 'schema must be' in _load(home, 'people', records).error
    prep('people.json', '{not json')
    state = _load(home, 'people', records)
    assert state.status == 'invalid' and state.data is None


def test_remeaning_is_counted_only(home, records, prep):
    prep('remeaning-pairs.json', {'schema': 'arc-remeaning-pairs/1', 'items': [{}, {}]})
    assert _load(home, 'remeaning', records).data == {'items': 2}
