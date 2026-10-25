"""The M1 LLM fixtures: Ministral's eval-query prompts, Qwen's training-query and audit-judge
prompts, their JSON schemas, and the validator the gates count with.

- ministral_fixture(): the 200-prompt fixture for the Ministral gate (schema-valid JSON on at
  least 99%). Each prompt asks for three eval queries of one ARC-Bench family (D's subfamilies,
  E, T, F) about one record card, under that family's schema.
- training_query_case(): S5's shape (six reader queries per chunk), Qwen's throughput load.
- audit_case(): the 25% audit judge. A separate, listwise prompt: the query and K numbered
  candidates in, one 0-3 grade per candidate out. Owner ruling 2 is stated in the rubric:
  people who share a name are different people.

Cards come from public/arc/records (first records by slug), so the fixture is fixed by the
corpus snapshot; synthetic_cards() stands in for tests. Nothing here calls a model.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

MINISTRAL_FIXTURE_SIZE = 200
QUERIES_PER_PROMPT = 3

# ARC-Bench query families Ministral writes (program.benchmark D, E, T, F).
FAMILIES: dict[str, str] = {
    'D-coinage-direct': "ask directly what one of the record's coined terms means ('what is calibration sickness').",
    'D-coinage-oblique': 'describe a coined term of the record without naming it (reverse dictionary).',
    'D-entity': 'ask about one named person in the record, by name, as someone who knows which person they mean.',
    'D-era': 'ask about the era, series or in-world period the record belongs to.',
    'D-concept': "ask about the idea the record explores, in the reader's own words, without its title.",
    'D-practitioner': 'ask the way a working practitioner in the field would search for this material.',
    'D-vibe': 'describe the tone or feeling of the record rather than its content.',
    'D-visitor-short': 'write short visitor searches: 1 to 5 words, at most 60 characters, typos allowed.',
    'D-negation': "ask for records like this one while excluding something ('stories about X, not the Y ones').",
    'E-lost-visitor': 'recall one or two vivid details of the record and misremember exactly one other detail.',
    'T-time': 'ask about a dated event or year mentioned or implied in the record.',
    'F-invented-title': 'invent a plausible title of a record that does not exist in this archive, phrased as a search.',
}

SYSTEM_EVAL = (
    'You write evaluation queries for a search engine over a private fiction-and-research '
    'archive. Each query must be something a real visitor could type. Never copy the title. '
    'Answer with JSON only, matching the schema.'
)
SYSTEM_TRAINING = (
    'You write search queries a reader might type to find a passage of an archive. '
    'Answer with JSON only, matching the schema.'
)
SYSTEM_AUDIT = (
    'You grade search results. For the query, grade every numbered candidate record on this '
    'scale: 3 = the record the query is about; 2 = highly relevant; 1 = partly relevant; '
    '0 = not relevant. People who share a name are different people: a record about a '
    'different person of the same name is 0 for a query about this one. Grade each candidate '
    'independently of the others. Answer with JSON only, matching the schema.'
)


@dataclass(frozen=True)
class Card:
    slug: str
    title: str
    description: str
    excerpt: str


@dataclass(frozen=True)
class PromptCase:
    id: str
    messages: list[dict]
    schema: dict
    # What a valid answer must also satisfy beyond the schema (reported, not gated).
    expect: dict = field(default_factory=dict)


def record_cards(records_dir: Path, n: int, excerpt_chars: int = 600) -> list[Card]:
    """The first n records by slug, each with title, description and an opening excerpt."""
    cards = []
    for path in sorted(Path(records_dir).glob('*.json'))[:n]:
        record = json.loads(path.read_text())
        body = ' '.join(
            b['x']
            for b in record.get('blocks', [])
            if isinstance(b, dict) and b.get('t') in ('p', 'q', 'l')
        )
        cards.append(
            Card(
                slug=str(record.get('slug', path.stem)),
                title=str(record.get('title', path.stem)),
                description=str(record.get('description', '')),
                excerpt=' '.join(body.split())[:excerpt_chars],
            )
        )
    return cards


def synthetic_cards(n: int) -> list[Card]:
    return [
        Card(
            slug=f'record-{i:03d}',
            title=f'Record {i}: The Calibration Runs',
            description=f'A story about calibration sickness in year {2040 + i % 30}.',
            excerpt=f'Adaeze Nwosu walked the territory during the pause, number {i}.',
        )
        for i in range(n)
    ]


def _card_text(card: Card) -> str:
    return f'Title: {card.title}\nSlug: {card.slug}\nDescription: {card.description}\nExcerpt: {card.excerpt}'


def eval_query_schema(family: str, n: int = QUERIES_PER_PROMPT) -> dict:
    max_length = 60 if family == 'D-visitor-short' else 160
    return {
        'type': 'object',
        'additionalProperties': False,
        'required': ['queries'],
        'properties': {
            'queries': {
                'type': 'array',
                'minItems': n,
                'maxItems': n,
                'items': {
                    'type': 'object',
                    'additionalProperties': False,
                    'required': ['text', 'family', 'grade_hint'],
                    'properties': {
                        'text': {'type': 'string', 'minLength': 3, 'maxLength': max_length},
                        'family': {'type': 'string', 'enum': [family]},
                        'grade_hint': {'type': 'integer', 'minimum': 0, 'maximum': 3},
                    },
                },
            }
        },
    }


def ministral_fixture(cards: list[Card], size: int = MINISTRAL_FIXTURE_SIZE) -> list[PromptCase]:
    """size prompts: card i % len(cards), family i % 12 (fixed order), three queries each."""
    if not cards:
        raise ValueError('ministral_fixture: no cards')
    families = list(FAMILIES)
    cases = []
    for i in range(size):
        card = cards[i % len(cards)]
        family = families[i % len(families)]
        user = (
            f'{_card_text(card)}\n\nFamily {family}: {FAMILIES[family]}\n'
            f'Write {QUERIES_PER_PROMPT} queries of this family. grade_hint is how relevant this '
            'record is to each query (3 = it is the answer, 0 = it is not, as for an invented title).'
        )
        cases.append(
            PromptCase(
                id=f'ministral-{i:03d}-{family}',
                messages=[
                    {'role': 'system', 'content': SYSTEM_EVAL},
                    {'role': 'user', 'content': user},
                ],
                schema=eval_query_schema(family),
            )
        )
    return cases


TRAINING_SCHEMA = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['queries'],
    'properties': {
        'queries': {
            'type': 'array',
            'minItems': 6,
            'maxItems': 6,
            'items': {'type': 'string', 'minLength': 3, 'maxLength': 200},
        }
    },
}


def training_query_case(card: Card, index: int) -> PromptCase:
    user = (
        f'{_card_text(card)}\n\nWrite 6 different search queries a reader might type to find this '
        'passage: two short keyword searches, two natural questions, one about a named person or '
        'coined term in it, and one that paraphrases its central idea.'
    )
    return PromptCase(
        id=f'training-{index:04d}',
        messages=[
            {'role': 'system', 'content': SYSTEM_TRAINING},
            {'role': 'user', 'content': user},
        ],
        schema=TRAINING_SCHEMA,
    )


def audit_schema(k: int) -> dict:
    return {
        'type': 'object',
        'additionalProperties': False,
        'required': ['grades'],
        'properties': {
            'grades': {
                'type': 'array',
                'minItems': k,
                'maxItems': k,
                'items': {
                    'type': 'object',
                    'additionalProperties': False,
                    'required': ['id', 'grade'],
                    'properties': {
                        'id': {'type': 'integer', 'minimum': 1, 'maximum': k},
                        'grade': {'type': 'integer', 'minimum': 0, 'maximum': 3},
                    },
                },
            }
        },
    }


def audit_case(query: str, candidates: list[Card], index: int, person_map: str = '') -> PromptCase:
    """The Qwen audit-judge prompt: one query, K numbered candidates, K grades back."""
    lines = [f'Query: {query}']
    if person_map:
        lines.append(f'People named in these records (person map):\n{person_map}')
    lines.append('Candidates:')
    for i, card in enumerate(candidates, 1):
        lines.append(f'[{i}] {card.title}: {card.description} {card.excerpt[:300]}')
    lines.append(f'Return one grade for each of the {len(candidates)} candidates, by id.')
    return PromptCase(
        id=f'audit-{index:04d}',
        messages=[
            {'role': 'system', 'content': SYSTEM_AUDIT},
            {'role': 'user', 'content': '\n'.join(lines)},
        ],
        schema=audit_schema(len(candidates)),
        expect={'ids': list(range(1, len(candidates) + 1))},
    )


def audit_fixture(cards: list[Card], n: int, k: int = 8) -> list[PromptCase]:
    """n audit prompts: query = card i's description; candidates = card i and k - 1 neighbours."""
    if len(cards) < k:
        raise ValueError(f'audit_fixture: need at least {k} cards')
    cases = []
    for i in range(n):
        target = cards[i % len(cards)]
        others = [cards[(i + j * 7) % len(cards)] for j in range(1, k)]
        pool = [target, *others]
        # Deterministic rotation so the target is not always candidate 1.
        shift = i % k
        pool = pool[shift:] + pool[:shift]
        cases.append(audit_case(target.description or target.title, pool, i))
    return cases


def validate(text: str, case: PromptCase) -> tuple[bool, str]:
    """(schema-valid, why not): the gate counts the first; `expect` failures are reported."""
    import jsonschema

    try:
        value = json.loads(text)
    except (TypeError, json.JSONDecodeError) as error:
        return False, f'not JSON: {error}'
    try:
        jsonschema.validate(value, case.schema)
    except jsonschema.ValidationError as error:
        return False, f'schema: {error.message}'
    return True, ''


def expectation_problems(text: str, case: PromptCase) -> list[str]:
    """Checks a schema cannot express: audit ids are exactly 1..K once each."""
    value = json.loads(text)
    problems = []
    if 'ids' in case.expect and sorted(g['id'] for g in value['grades']) != case.expect['ids']:
        problems.append('audit ids are not exactly 1..K')
    return problems
