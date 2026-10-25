"""The owner's R00 checklist (program.owner_r00_checklist) as data, with live progress.

Each step keeps its budgeted minutes from the checklist; a step's time left is its budget times
the share still to do. The desk's Overview tab and `arcforge owner status` both render this, so
the page and the terminal can never disagree about what is done.
"""

from __future__ import annotations

from dataclasses import dataclass

from arcforge.owner.model import FRONTIER_PER_SERIES

SECTIONS = {
    'A': 'Any time before launch',
    'B': 'After the prep pass',
    'C': 'At the R00 owner gate',
}


@dataclass(frozen=True)
class Step:
    number: int
    key: str
    title: str
    where: str
    minutes: float
    section: str


STEPS: tuple[Step, ...] = (
    Step(1, 'vault', 'Create the vault key', 'Terminal: python3 -m arcforge vault keygen', 2, 'A'),
    Step(2, 'queries', 'Write 100 queries from memory', 'Queries', 60, 'A'),
    Step(3, 'frontier', 'Write 8 frontier queries', 'Queries › Frontier', 4, 'A'),
    Step(4, 'voices', 'Write 25 few-shot examples', 'Voices', 15, 'A'),
    Step(5, 'settings', 'Check the inheritance-03 default', 'Settings', 0.5, 'A'),
    Step(6, 'doctor', 'Preflight, only if needed', 'Terminal: uv run arcforge doctor', 3, 'B'),
    Step(7, 'people', 'Confirm the 30 most frequent people', 'People', 7, 'B'),
    Step(8, 'registers', 'Fix the register exceptions', 'Registers', 8, 'B'),
    Step(9, 'launch', 'Launch R00', 'Overview, or tell the orchestrator "go R00"', 1, 'B'),
    Step(10, 'audit', 'Blind audit: 150 pairs', 'Audit', 40, 'C'),
    Step(11, 'adjudicate', 'Adjudicate up to 30 pairs', 'Adjudicate', 6, 'C'),
    Step(12, 'rest', 'Nothing else: the orchestrator finishes R00', '', 0, 'C'),
)

# Status words: done, active (started), todo, waiting (its input has not arrived), manual (the
# desk cannot see it: a terminal step), info.


def _row(step: Step, status: str, done: int | None, total: int | None, note: str) -> dict:
    if status in ('done', 'info'):
        left = 0.0
    elif done is not None and total:
        left = step.minutes * (1 - min(done, total) / total)
    else:
        left = float(step.minutes)
    return {
        'number': step.number,
        'key': step.key,
        'title': step.title,
        'where': step.where,
        'minutes': step.minutes,
        'section': step.section,
        'status': status,
        'done': done,
        'total': total,
        'minutes_left': round(left, 1),
        'note': note,
    }


def _review_row(step: Step, prep_status: str, derived: dict) -> dict:
    """A step over a pipeline file: waiting until the file arrives, then counted."""
    if prep_status == 'missing':
        when = 'after the prep pass' if step.section == 'B' else 'at the owner gate'
        return _row(step, 'waiting', None, None, f'arrives {when}')
    if prep_status == 'invalid':
        return _row(step, 'waiting', None, None, 'the file is unreadable; see the tab')
    done = derived['reviewed'] if 'reviewed' in derived else derived['graded']
    total = derived['total']
    return _row(step, 'done' if total == 0 else _counted(done, total), done, total, '')


def _counted(done: int, total: int) -> str:
    if total == 0:
        return 'todo'
    return 'done' if done >= total else ('active' if done else 'todo')


def compute(state: dict) -> dict:
    """Progress for every step from the desk state (docs, derived, prep, vault, lock)."""
    derived = state['derived']
    prep = state['prep']
    docs = state['docs']
    q = derived['queries']
    v = derived['voices']
    launched = bool(docs['launch'].get('requested_utc'))
    rows = []
    for step in STEPS:
        if step.key == 'vault':
            present = state['vault']['recipient_present']
            note = 'configs/vault.recipient is in place' if present else 'not created yet'
            rows.append(_row(step, 'done' if present else 'todo', None, None, note))
        elif step.key == 'queries':
            done = min(q['main_filled'], q['main_target'])
            note = (
                f'{q["main_frontier_tagged"]} tagged FRONTIER' if q['main_frontier_tagged'] else ''
            )
            if q['duplicates']:
                note = (note + '; ' if note else '') + f'{len(q["duplicates"])} duplicated'
            rows.append(_row(step, _counted(done, q['main_target']), done, q['main_target'], note))
        elif step.key == 'frontier':
            done = sum(min(n, FRONTIER_PER_SERIES) for n in q['frontier_filled'].values())
            rows.append(
                _row(step, _counted(done, q['frontier_target']), done, q['frontier_target'], '')
            )
        elif step.key == 'voices':
            status = _counted(v['filled'], v['target'])
            if status == 'done' and v['copies']:
                status = 'active'
            note = f'{v["copies"]} copy one of your queries' if v['copies'] else ''
            rows.append(_row(step, status, v['filled'], v['target'], note))
        elif step.key == 'settings':
            confirmed = bool(docs['settings'].get('confirmed_utc'))
            renamed = docs['settings'].get('inheritance03_renamed')
            note = 'renamed (A = 178)' if renamed else 'default: a ghost query (A = 177)'
            rows.append(_row(step, 'done' if confirmed else 'todo', None, None, note))
        elif step.key == 'doctor':
            rows.append(
                _row(step, 'done' if launched else 'manual', None, None, 'skip it if all green')
            )
        elif step.key in ('people', 'registers', 'audit', 'adjudicate'):
            rows.append(_review_row(step, prep[step.key]['status'], derived[step.key]))
        elif step.key == 'launch':
            note = docs['launch']['requested_utc'] or ''
            rows.append(_row(step, 'done' if launched else 'todo', None, None, note))
        else:
            rows.append(_row(step, 'info', None, None, ''))
    sections = {
        key: {
            'title': title,
            'minutes': round(sum(r['minutes'] for r in rows if r['section'] == key), 1),
            'minutes_left': round(sum(r['minutes_left'] for r in rows if r['section'] == key), 1),
        }
        for key, title in SECTIONS.items()
    }
    blockers = launch_blockers(state, rows)
    return {
        'steps': rows,
        'sections': sections,
        'minutes': round(sum(r['minutes'] for r in rows), 1),
        'minutes_left': round(sum(r['minutes_left'] for r in rows), 1),
        'blockers': blockers,
        'ready': not blockers,
    }


def launch_blockers(state: dict, rows: list[dict]) -> list[str]:
    """What still stands between the owner and 'go R00' (steps 1-8)."""
    by_key = {row['key']: row for row in rows}
    q = state['derived']['queries']
    blockers = []
    if by_key['vault']['status'] != 'done':
        blockers.append('Create the vault key (step 1).')
    if q['main_filled'] < q['main_target']:
        blockers.append(f'Write {q["main_target"] - q["main_filled"]} more queries (step 2).')
    if q['empty']:
        blockers.append(f'Fill or delete {len(q["empty"])} empty query rows.')
    if q['duplicates']:
        blockers.append('Reword or delete the duplicate queries.')
    frontier = by_key['frontier']
    if frontier['done'] < frontier['total']:
        blockers.append(
            f'Write {frontier["total"] - frontier["done"]} more frontier queries (step 3).'
        )
    v = state['derived']['voices']
    if v['filled'] < v['target']:
        blockers.append(f'Write {v["target"] - v["filled"]} more voice examples (step 4).')
    if v['copies']:
        blockers.append(f'Rewrite {v["copies"]} voice examples that copy your queries.')
    for key, label in (('people', 'People (step 7)'), ('registers', 'Registers (step 8)')):
        row = by_key[key]
        if row['status'] == 'waiting':
            blockers.append(f'{label} opens after the prep pass.')
        elif row['status'] != 'done':
            blockers.append(f'Finish {label}.')
    return blockers
