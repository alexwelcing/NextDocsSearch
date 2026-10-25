import json
import re

import pytest

from arcforge.models import pins


def all_pins():
    return [
        pins.TEACHER,
        pins.QWEN_9B,
        pins.QWEN_4B,
        pins.MINISTRAL_8B,
        pins.MINISTRAL_3B,
        pins.RERANKER,
        *pins.R08_TEACHERS,
    ]


def test_every_pin_is_a_full_commit_sha():
    for pin in all_pins():
        assert re.fullmatch('[0-9a-f]{40}', pin.revision), pin.repo


def test_teacher_is_embeddinggemma_2_without_substitution():
    assert pins.TEACHER.repo == 'google/embeddinggemma-2'


def test_qwen_gate():
    assert pins.qwen_gate(1000.0).pin is pins.QWEN_9B
    assert pins.qwen_gate(999.9).pin is pins.QWEN_4B
    assert pins.qwen_gate(999.9).passed is False
    assert pins.qwen_gate(None).passed is None and pins.qwen_gate(None).pin is pins.QWEN_9B
    with pytest.raises(ValueError):
        pins.qwen_gate(2000.0, concurrency=32)


def test_ministral_gate():
    assert pins.ministral_gate(True, 198, 200).pin is pins.MINISTRAL_8B
    assert pins.ministral_gate(True, 197, 200).pin is pins.MINISTRAL_3B
    assert pins.ministral_gate(False, 200, 200).pin is pins.MINISTRAL_3B
    assert pins.ministral_gate(None, None, None).passed is None
    with pytest.raises(ValueError):
        pins.ministral_gate(True, 99, 100)


def test_ministral_mirrors_hf_shards_only():
    from fnmatch import fnmatch

    patterns = pins.MINISTRAL_8B.allow_patterns
    assert any(fnmatch('model-00001-of-00003.safetensors', p) for p in patterns)
    assert not any(fnmatch('consolidated.safetensors', p) for p in patterns)


def test_text_only_vllm_args():
    assert '--language-model-only' in pins.QWEN_9B.vllm_args
    assert 'fp8' in pins.QWEN_9B.vllm_args
    assert '--limit-mm-per-prompt' in pins.MINISTRAL_8B.vllm_args


def test_pins_follow_the_measurements():
    report = pins.pins_report()
    json.dumps(report)
    measured = pins.llm_pins(pins.M1_MEASURED)
    assert report['llm']['queries']['pin']['repo'] == measured['queries'].pin.repo
    assert report['llm']['eval_queries']['pin']['repo'] == measured['eval_queries'].pin.repo


def test_m1_outcome():
    """M1 measured Qwen3.5-9B under the gate and Ministral-3-8B over it (see M1_MEASURED)."""
    gates = pins.llm_pins()
    assert gates['queries'].pin is pins.QWEN_4B and gates['queries'].passed is False
    assert gates['eval_queries'].pin is pins.MINISTRAL_8B and gates['eval_queries'].passed is True
    assert pins.M1_MEASURED['teacher']['min_reconstruction_cosine'] > 0.9999
