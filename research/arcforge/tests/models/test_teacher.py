import math

import pytest

from arcforge.models.teacher import OTHER, PROMPT, QUERY_PROMPT, add, assign_tokens, cosine, doc_prompt, sum_parts


def test_prompts():
    assert QUERY_PROMPT == 'task: search result | query: '
    assert doc_prompt(None) == 'title: none | text: '
    assert doc_prompt('The Fossil') == 'title: The Fossil | text: '


def test_assign_tokens():
    prompt = 'p: '  # 3 characters
    # <bos>, 'p:', ' ', 'the', ' pa', 'use', ' x', <eos>
    offsets = [(0, 0), (0, 2), (2, 3), (3, 6), (6, 9), (9, 12), (12, 14), (0, 0)]
    spans = [(0, 9)]  # 'the pause' in the text
    assert assign_tokens(offsets, len(prompt), spans) == [PROMPT, PROMPT, PROMPT, 0, 0, 0, OTHER, PROMPT]


def test_a_token_straddling_two_occurrences_goes_to_the_first():
    offsets = [(0, 4), (4, 9)]
    assert assign_tokens(offsets, 0, [(0, 3), (3, 6)]) == [0, 1]
    assert assign_tokens([(2, 5)], 0, [(0, 3), (3, 6)]) == [0]


def test_parts_sum_to_the_mean_pool():
    states = [[1.0, 2.0], [3.0, -1.0], [0.5, 0.5], [-2.0, 4.0]]
    assignment = [PROMPT, 0, OTHER, 0]
    parts = sum_parts(states, assignment)
    assert parts[0] == [1.0, 3.0]
    total = add(list(parts.values()))
    mean = [sum(s[d] for s in states) / len(states) for d in range(2)]
    assert cosine(total, mean) == pytest.approx(1.0)
    with pytest.raises(ValueError):
        sum_parts(states, assignment[:-1])


def test_cosine():
    assert cosine([1, 0], [0, 1]) == 0
    assert cosine([1, 1], [2, 2]) == pytest.approx(1)
    assert cosine([0, 0], [1, 1]) == 0
    assert math.isclose(cosine([1, 2, 3], [-1, -2, -3]), -1)

