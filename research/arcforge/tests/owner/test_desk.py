import json

import pytest

from arcforge.owner import model
from arcforge.owner.desk import Conflict, Desk, Locked


def lock(home):
    (home / 'arc-owner').mkdir(exist_ok=True)
    return home / 'arc-owner' / 's0-lock.json'


def full_queries():
    items = [
        {'id': f'q-{i:04d}', 'text': f'query {i}', 'record': None, 'section': 'main'}
        for i in range(1, 101)
    ]
    for j, series in enumerate(['echo-chamber'] * 4 + ['residue'] * 4):
        items.append(
            {
                'id': f'q-{101 + j:04d}',
                'text': f'{series} {j}',
                'section': 'frontier',
                'series': series,
            }
        )
    return {'queries': items, 'next_seq': 109}


def full_voices():
    return {'voices': {v: [f'{v} example {i}' for i in range(5)] for v in model.VOICE_IDS}}


@pytest.fixture
def complete(desk, prep, fixtures, recipient):
    """Steps 1-8 done, so the desk would launch."""

    def run():
        recipient.parent.mkdir(parents=True, exist_ok=True)
        recipient.write_text('age1' + 'q' * 58 + '\n')
        desk.save('queries', 0, full_queries())
        desk.save('voices', 0, full_voices())
        desk.save('settings', 0, {'inheritance03_renamed': False, 'confirmed_utc': 'now'})
        prep('people.json', fixtures['people']())
        prep('registers.json', fixtures['registers']())
        names = [n['name_id'] for n in fixtures['people']()['names']]
        desk.save('people', 0, {'decisions': {n: {'reviewed': True} for n in names}})
        desk.save('registers', 0, {'reviewed_groups': ['backstory', 'chronicles', 'pm-essays']})

    return run


def test_fresh_state(desk, home):
    state = desk.state()
    assert state['owner_dir'] == str(home / 'arc-owner')
    assert set(state['docs']) == set(model.DOCS)
    assert all(doc['rev'] == 0 for doc in state['docs'].values())
    assert {p['status'] for p in state['prep'].values()} == {'missing'}
    assert state['lock'] is None and state['locked_docs'] == []
    assert state['records'] == {'source': 'test', 'count': 8}
    assert state['limits']['max_chars'] == 60 and len(state['limits']['voices']) == 5
    assert not state['progress']['ready']
    # Nothing is written until the owner edits something.
    assert not (home / 'arc-owner').exists()


def test_save_returns_the_doc_derived_and_progress(desk, home):
    result = desk.save(
        'queries',
        0,
        {
            'queries': [
                {'id': 'q-0001', 'text': 'the fossil', 'record': 'echo-chamber-02-the-fossil'}
            ]
        },
    )
    assert result['doc']['rev'] == 1 and result['doc']['queries'][0]['frontier'] is True
    assert result['derived']['main_frontier_tagged'] == 1
    step = next(s for s in result['progress']['steps'] if s['key'] == 'queries')
    assert (step['done'], step['total'], step['status']) == (1, 100, 'active')
    on_disk = json.loads((home / 'arc-owner' / 'queries.json').read_text())
    assert on_disk == result['doc']


def test_voice_flags_follow_query_edits(desk):
    desk.save('voices', 0, {'voices': {'literalist': ['the fossil']}})
    result = desk.save('queries', 0, {'queries': [{'id': 'q-0001', 'text': 'The fossil'}]})
    assert result['derived_all']['voices']['copies'] == 1


def test_conflicts_and_unknown_documents(desk):
    desk.save('settings', 0, {'inheritance03_renamed': True})
    with pytest.raises(Conflict):
        desk.save('settings', 0, {'inheritance03_renamed': False})
    with pytest.raises(KeyError):
        desk.save('../secrets', 0, {})


def test_s0_freezes_queries_and_settings_only(desk, home):
    lock(home).write_text(json.dumps({'locked_utc': '2026-10-24T00:00:00Z'}))
    for name in ('queries', 'settings'):
        with pytest.raises(Locked):
            desk.save(name, 0, model.DOCS[name][1]())
    desk.save('voices', 0, full_voices())
    assert desk.state()['locked_docs'] == ['queries', 'settings']
    assert desk.ping()['locked'] is True


def test_launch_waits_for_steps_1_to_8(desk, complete):
    with pytest.raises(model.ValidationError, match='Not ready to launch: Create the vault key'):
        desk.save('launch', 0, {'requested_utc': 'now'})
    complete()
    state = desk.state()
    assert state['progress']['ready'], state['progress']['blockers']
    result = desk.save('launch', 0, {'requested_utc': 'now'})
    assert result['doc']['requested_utc'] and result['doc']['run'] == 'r00'
    launch = next(s for s in result['progress']['steps'] if s['key'] == 'launch')
    assert launch['status'] == 'done'


def test_prep_files_are_noticed_without_a_restart(desk, prep, fixtures):
    before = desk.ping()
    assert before['prep']['audit'] == 'missing'
    prep('audit-pairs.json', fixtures['pairs']('audit', 150))
    after = desk.ping()
    assert after['prep']['audit'] == 'ok' and after['prep_signature'] != before['prep_signature']
    assert desk.state()['derived']['audit'] == {
        'graded': 0,
        'total': 150,
        'next_index': 0,
        'stale': [],
    }


def test_an_unreadable_lock_still_locks(desk, home):
    lock(home).write_text('{')
    with pytest.raises(Locked):
        desk.save('queries', 0, {'queries': []})


def test_an_unreadable_document_is_never_overwritten(desk, home):
    desk.save('voices', 0, full_voices())
    path = home / 'arc-owner' / 'voices.json'
    path.write_text('{"rev": 1, "voices": ')  # say, a crash mid-edit by hand
    state = desk.state()
    assert 'voices.json cannot be read' in state['broken']['voices']
    assert state['docs']['voices']['rev'] == 0  # shown empty...
    with pytest.raises(model.ValidationError, match='will not overwrite'):
        desk.save('voices', 0, full_voices())
    assert path.read_text() == '{"rev": 1, "voices": '  # ...and left exactly as it was
    path.write_text('["not", "a", "document"]')
    assert 'not a desk document' in desk.state()['broken']['voices']
    desk.save('queries', 0, {'queries': []})  # the other documents still save


def test_real_repo_desk_constructs(home):
    from arcforge.owner.paths import find_repo_root

    repo = find_repo_root()
    if repo is None:
        pytest.skip('not inside the NextDocsSearch checkout')
    desk = Desk(repo)
    assert desk.state()['records']['count'] >= 300
