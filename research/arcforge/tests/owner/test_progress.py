from arcforge.owner.progress import STEPS


def _step(state, key):
    return next(s for s in state['progress']['steps'] if s['key'] == key)


def test_the_checklist_matches_the_program():
    # owner_r00_checklist: steps 1-12, about 81 + 19 + 46 minutes.
    assert [s.number for s in STEPS] == list(range(1, 13))
    by_section = {k: sum(s.minutes for s in STEPS if s.section == k) for k in 'ABC'}
    assert by_section == {'A': 81.5, 'B': 19, 'C': 46}


def test_fresh_progress(desk):
    p = desk.state()['progress']
    assert p['minutes'] == p['minutes_left'] == 146.5
    statuses = {s['key']: s['status'] for s in p['steps']}
    assert statuses == {
        'vault': 'todo',
        'queries': 'todo',
        'frontier': 'todo',
        'voices': 'todo',
        'settings': 'todo',
        'doctor': 'manual',
        'people': 'waiting',
        'registers': 'waiting',
        'launch': 'todo',
        'audit': 'waiting',
        'adjudicate': 'waiting',
        'rest': 'info',
    }
    assert p['blockers'][0] == 'Create the vault key (step 1).'
    assert 'People (step 7) opens after the prep pass.' in p['blockers']


def test_time_left_scales_with_what_is_left(desk):
    items = [{'id': f'q-{i:04d}', 'text': f'q {i}'} for i in range(1, 51)]
    state = desk.save('queries', 0, {'queries': items})
    step = next(s for s in state['progress']['steps'] if s['key'] == 'queries')
    assert (step['done'], step['minutes_left'], step['status']) == (50, 30.0, 'active')


def test_voice_copies_keep_step_4_open(desk):
    desk.save('queries', 0, {'queries': [{'id': 'q-0001', 'text': 'the fossil'}]})
    voices = {
        v: ['the fossil'] + [f'{v} {i}' for i in range(4)]
        for v in ('literalist', 'mood-seeker', 'lost-visitor', 'practitioner', 'thread-follower')
    }
    state = desk.save('voices', 0, {'voices': voices})
    step = next(s for s in state['progress']['steps'] if s['key'] == 'voices')
    assert step['status'] == 'active' and step['note'] == '5 copy one of your queries'
    assert 'Rewrite 5 voice examples that copy your queries.' in state['progress']['blockers']


def test_gate_steps_follow_the_pairs(desk, prep, fixtures):
    prep('audit-pairs.json', fixtures['pairs']('audit', 4))
    prep('adjudicate-pairs.json', fixtures['pairs']('adjudicate', 0))
    desk.save('audit', 0, {'labels': {'audit-000': {'grade': 2}, 'audit-001': {'grade': 0}}})
    state = desk.state()
    audit, adjudicate = _step(state, 'audit'), _step(state, 'adjudicate')
    assert (audit['done'], audit['total'], audit['minutes_left']) == (2, 4, 20.0)
    assert adjudicate['status'] == 'done'  # no disagreements: nothing to do


def test_a_broken_prep_file_waits(desk, prep):
    prep('people.json', '{')
    assert _step(desk.state(), 'people')['note'] == 'the file is unreadable; see the tab'
