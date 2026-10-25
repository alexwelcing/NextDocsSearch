import pytest

from arcforge.owner import model
from arcforge.owner.model import Context, ValidationError

NOW = '2026-10-24T12:00:00Z'


def q(i, text='a query', **extra):
    return {'id': f'q-{i:04d}', 'text': text, 'record': None, 'section': 'main', **extra}


def norm_queries(items, ctx=None, next_seq=1):
    return model.normalize_queries({'queries': items, 'next_seq': next_seq}, ctx or Context(), NOW)


# ---- the 60-character box ------------------------------------------------------------------------


def test_utf16_len_counts_like_the_browser():
    assert model.utf16_len('abc') == 3
    assert model.utf16_len('Tomáš') == 5
    assert model.utf16_len('🜂') == 2  # an astral character is two UTF-16 units, as maxLength counts


def test_sixty_characters_is_the_limit():
    assert norm_queries([q(1, 'x' * 60)])['queries'][0]['text'] == 'x' * 60
    with pytest.raises(ValidationError, match='61 characters; the limit is 60'):
        norm_queries([q(1, 'x' * 61)])
    with pytest.raises(ValidationError, match='the limit is 60'):
        norm_queries([q(1, 'x' * 59 + '🜂')])


def test_text_is_trimmed_and_control_characters_flattened():
    assert norm_queries([q(1, '  the  fossil\n')])['queries'][0]['text'] == 'the  fossil'


# ---- queries -----------------------------------------------------------------------------------


def test_main_list_holds_100():
    norm_queries([q(i) for i in range(1, 101)])
    with pytest.raises(ValidationError, match='holds 100'):
        norm_queries([q(i) for i in range(1, 102)])


def test_frontier_section_holds_4_per_series_and_is_tagged():
    items = [q(i, section='frontier', series='residue') for i in range(1, 5)]
    out = norm_queries(items)['queries']
    assert all(x['frontier'] and x['frontier_reason'] == 'section' for x in out)
    with pytest.raises(ValidationError, match='The Residue has 4 slots'):
        norm_queries([*items, q(9, section='frontier', series='residue')])
    with pytest.raises(ValidationError, match='names its series'):
        norm_queries([q(1, section='frontier', series='threshold')])


def test_picking_a_withheld_record_retags_frontier(records):
    ctx = Context(records=records.by_slug())
    out = norm_queries(
        [
            q(1, record='echo-chamber-02-the-fossil'),
            q(2, record='far-shore-06-the-last-handshake'),
            q(3),
        ],
        ctx,
    )['queries']
    assert [(x['frontier'], x['frontier_reason']) for x in out] == [
        (True, 'record'),
        (False, None),
        (False, None),
    ]


def test_ids_must_be_well_formed_and_unique():
    with pytest.raises(ValidationError, match='malformed or repeated'):
        norm_queries([q(1), q(1)])
    with pytest.raises(ValidationError):
        norm_queries([{'id': 'x1', 'text': 'a'}])


def test_next_seq_never_goes_backwards():
    assert norm_queries([q(41)], next_seq=3)['next_seq'] == 42
    assert norm_queries([q(2)], next_seq=50)['next_seq'] == 50


def test_created_utc_is_kept_or_stamped():
    out = norm_queries([q(1, created_utc='2026-10-01T09:00:00Z'), q(2, created_utc='garbage')])[
        'queries'
    ]
    assert [x['created_utc'] for x in out] == ['2026-10-01T09:00:00Z', NOW]


def test_derived_queries_flags(records):
    ctx = Context(records=records.by_slug())
    doc = norm_queries(
        [
            q(1, 'The Fossil'),
            q(2, 'the fossil!'),
            q(3, ''),
            q(4, 'gone', record='renamed-since'),
            q(5, 'x', record='residue-01-the-last-prompt-engineer'),
            q(
                6,
                'e',
                section='frontier',
                series='echo-chamber',
                record='residue-02-the-training-data-ghosts',
            ),
        ],
        ctx,
    )
    d = model.derive_queries(doc, ctx)
    assert d['duplicates'] == {'q-0001': ['q-0002'], 'q-0002': ['q-0001']}
    assert d['empty'] == ['q-0003']
    assert d['unknown_records'] == ['q-0004']  # soft: the save went through
    assert d['series_mismatch'] == ['q-0006']
    assert (d['main_filled'], d['main_rows'], d['main_frontier_tagged']) == (4, 5, 1)
    assert d['frontier_filled'] == {'echo-chamber': 1, 'residue': 0}


# ---- voices ------------------------------------------------------------------------------------


def voices(**slots):
    base = {v: [''] * 5 for v in model.VOICE_IDS}
    base.update(slots)
    return base


def test_voices_shape():
    out = model.normalize_voices({'voices': {'literalist': ['a']}}, Context(), NOW)
    assert out['voices']['literalist'] == ['a', '', '', '', ''] and set(out['voices']) == set(
        model.VOICE_IDS
    )
    with pytest.raises(ValidationError, match='5 examples'):
        model.normalize_voices({'voices': {'literalist': ['a'] * 6}}, Context(), NOW)
    with pytest.raises(ValidationError, match='limit is 60'):
        model.normalize_voices({'voices': {'practitioner': ['y' * 61]}}, Context(), NOW)


def test_voice_copy_flags():
    queries = {'queries': [q(1, 'stories about displaced work'), q(2, 'the cartographers diary')]}
    doc = {
        'voices': voices(
            literalist=[
                'Stories about displaced work!',
                'the cartographer diary',
                'fresh one',
                'fresh one',
                '',
            ]
        )
    }
    d = model.derive_voices(doc, Context(docs={'queries': queries}))
    flags = d['flags']['literalist']
    assert flags[0]['kind'] == 'copy' and flags[0]['query_id'] == 'q-0001'
    assert flags[1]['kind'] == 'close' and flags[1]['jaccard'] >= model.COPY_JACCARD
    assert flags[2] is None and flags[3] == {'kind': 'repeat'} and flags[4] is None
    assert (d['filled'], d['copies'], d['close']) == (4, 1, 1)


def test_char_ngrams_and_jaccard():
    assert model.char_ngrams('abc') == {'abc'}
    assert model.jaccard(model.char_ngrams('the fossil'), model.char_ngrams('The Fossil.')) == 1.0
    assert model.jaccard(frozenset(), frozenset({'a'})) == 0.0


# ---- settings, people, registers, labels, launch -------------------------------------------------


def test_settings():
    out = model.normalize_settings(
        {'inheritance03_renamed': True, 'confirmed_utc': 'yes'}, Context(), NOW
    )
    assert out['inheritance03_renamed'] is True and out['confirmed_utc'] == NOW
    with pytest.raises(ValidationError):
        model.normalize_settings({'inheritance03_renamed': 'true'}, Context(), NOW)


def test_people_keeps_only_departures_from_the_proposal(fixtures):
    proposal = fixtures['people']()
    ctx = Context(prep={'people': proposal})
    out = model.normalize_people(
        {
            'decisions': {
                'adaeze': {
                    'reviewed': True,
                    'assignment': {
                        'far-shore-06-the-last-handshake': 'adaeze-nwosu',
                        'abundance-fork': 'new-1',
                    },
                    'merge_with': ['adaeze', 'priya-chakrabarti'],
                }
            }
        },
        ctx,
        NOW,
    )
    decision = out['decisions']['adaeze']
    assert decision['assignment'] == {'abundance-fork': 'new-1'}
    assert decision['merge_with'] == ['priya-chakrabarti'] and decision['reviewed_utc'] == NOW
    d = model.derive_people(out, ctx)
    assert (d['reviewed'], d['total'], d['edited'], d['stale']) == (1, 3, 1, [])


def test_people_flags_stale_decisions(fixtures):
    ctx = Context(prep={'people': fixtures['people']()})
    out = model.normalize_people(
        {
            'decisions': {
                'gone': {'reviewed': True},
                'adaeze': {'assignment': {'abundance-fork': 'nobody'}},
            }
        },
        ctx,
        NOW,
    )
    assert model.derive_people(out, ctx)['stale'] == ['adaeze', 'gone']


def test_registers(fixtures):
    ctx = Context(prep={'registers': fixtures['registers']()})
    out = model.normalize_registers(
        {
            'overrides': {
                'abundance-fork': 'pm-essays',
                'inheritance-03-the-seed-vault': 'chronicles',
            },
            'reviewed_groups': ['chronicles', 'chronicles'],
        },
        ctx,
        NOW,
    )
    assert out['overrides'] == {'inheritance-03-the-seed-vault': 'chronicles'}
    assert out['reviewed_groups'] == ['chronicles']
    d = model.derive_registers(out, ctx)
    assert (d['reviewed'], d['total'], d['overrides'], d['groups']) == (
        1,
        3,
        1,
        ['backstory', 'chronicles', 'pm-essays'],
    )


@pytest.mark.parametrize('grade', [4, -1, True, '2', 1.5, None])
def test_labels_are_grades_0_to_3(grade):
    with pytest.raises(ValidationError, match='0, 1, 2 or 3'):
        model.normalize_labels('audit')({'labels': {'p-1': {'grade': grade}}}, Context(), NOW)


def test_labels_and_progress(fixtures):
    ctx = Context(prep={'audit': {'pairs': [{'pair_id': f'audit-{i:03d}'} for i in range(3)]}})
    out = model.normalize_labels('audit')(
        {'labels': {'audit-001': {'grade': 3}, 'old': {'grade': 0}}}, ctx, NOW
    )
    assert out['labels']['audit-001'] == {'grade': 3, 'utc': NOW}
    d = model.derive_labels('audit')(out, ctx)
    assert (d['graded'], d['total'], d['next_index'], d['stale']) == (1, 3, 0, ['old'])


def test_launch():
    assert model.normalize_launch({'requested_utc': 'now'}, Context(), NOW)['requested_utc'] == NOW
    assert model.normalize_launch({}, Context(), NOW)['requested_utc'] is None


def test_every_document_has_an_empty_form_and_a_normalizer():
    for name, (filename, factory) in model.DOCS.items():
        empty = factory()
        assert filename.endswith('.json') and empty['schema'].startswith('arc-owner-')
        assert model.normalize(name, empty, Context(), NOW)['schema'] == empty['schema']
    with pytest.raises(ValidationError):
        model.normalize('queries', ['not', 'an', 'object'], Context(), NOW)
