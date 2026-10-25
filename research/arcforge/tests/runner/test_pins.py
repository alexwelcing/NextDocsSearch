import json

import pytest

from arcforge.runner import pins


def test_the_programs_models_are_pinned_by_full_sha():
    models = {m.key: m for m in pins.load_models()}
    defaults = {k for k, m in models.items() if m.default}
    assert defaults == {'embeddinggemma-2', 'qwen3.5-9b', 'ministral-3-8b', 'qwen3-reranker-0.6b'}
    assert models['embeddinggemma-2'].repo == 'google/embeddinggemma-2'
    assert models['qwen3.5-9b'].repo == 'Qwen/Qwen3.5-9B'
    assert models['ministral-3-8b'].repo == 'mistralai/Ministral-3-8B-Instruct-2512'
    assert models['qwen3-reranker-0.6b'].repo == 'Qwen/Qwen3-Reranker-0.6B'
    # The pre-named fallbacks are pinned too, mirrored only if a gate needs them.
    assert models['qwen3.5-4b'].fallback_for == 'qwen3.5-9b' and not models['qwen3.5-4b'].default
    assert models['ministral-3-3b'].fallback_for == 'ministral-3-8b'


def test_ministral_mirrors_hf_shards_only():
    ministral = pins.model('ministral-3-8b')
    assert not ministral.wanted('consolidated.safetensors')
    assert ministral.wanted('model-00001-of-00003.safetensors') and ministral.wanted('tekken.json')


def test_bad_pins_are_rejected(tmp_path):
    with pytest.raises(pins.PinError, match='40-hex'):
        pins.ModelPin(key='k', repo='o/n', revision='main', role='r')
    with pytest.raises(pins.PinError, match='owner/name'):
        pins.ModelPin(key='k', repo='nope', revision='a' * 40, role='r')
    dup = tmp_path / 'models.json'
    entry = {'key': 'k', 'repo': 'o/n', 'revision': 'a' * 40, 'role': 'r'}
    dup.write_text(json.dumps({'models': [entry, entry]}))
    with pytest.raises(pins.PinError, match='duplicate'):
        pins.load_models(dup)
    with pytest.raises(pins.PinError, match='no pinned model'):
        pins.model('nope')


def test_image_pin_round_trip(tmp_path):
    path = tmp_path / 'image.json'
    path.write_text(json.dumps({'comment': 'keep me', 'repository': 'r', 'digest': None}))
    assert pins.load_image(path).ref is None
    pin = pins.ImagePin(
        repository='r', digest='sha256:' + 'd' * 64, built_from='abc', cuda='13.0.3', torch='2.14.1'
    )
    pins.write_image(pin, path)
    again = pins.load_image(path)
    assert again.ref == 'r@sha256:' + 'd' * 64 and again.torch == '2.14.1'
    assert json.loads(path.read_text())['comment'] == 'keep me'
    path.write_text(json.dumps({'repository': 'r', 'digest': 'latest'}))
    with pytest.raises(pins.PinError):
        pins.load_image(path)


def test_the_shipped_image_pin_loads():
    image = pins.load_image()
    assert image.repository == 'us-central1-docker.pkg.dev/witching-606c6/arcforge/arcforge'
