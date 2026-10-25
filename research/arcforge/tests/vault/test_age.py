"""The age wrapper, against the fake_age test double (test_age_real.py covers the real tool)."""

import pytest

from arcforge.vault import age


def test_generate_identity_is_in_memory_and_well_formed(fake_age, tmp_path):
    before = set(tmp_path.rglob('*'))
    identity, recipient = age.generate_identity()
    assert age.is_identity(identity) and age.is_recipient(recipient)
    assert set(tmp_path.rglob('*')) == before  # nothing written anywhere
    assert age.recipient_of(identity) == recipient


def test_round_trip(fake_age, tmp_path):
    identity, recipient = age.generate_identity()
    sealed = tmp_path / 'v.age'
    sealed.write_bytes(age.encrypt(b'seventy queries', recipient))
    assert sealed.read_bytes().startswith(age.ARMOR_HEADER)
    assert age.decrypt(sealed, identity) == b'seventy queries'


def test_the_wrong_key_fails_without_leaking_it(fake_age, tmp_path):
    _, recipient = age.generate_identity()
    other, _ = age.generate_identity()
    sealed = tmp_path / 'v.age'
    sealed.write_bytes(age.encrypt(b'x', recipient))
    with pytest.raises(age.AgeError, match='no identity matched') as error:
        age.decrypt(sealed, other)
    assert other not in str(error.value)


def test_malformed_keys_never_reach_the_tool(fake_age, tmp_path):
    with pytest.raises(age.AgeError, match='AGE-SECRET-KEY-1'):
        age.decrypt(tmp_path / 'v.age', 'not a key')
    with pytest.raises(age.AgeError):
        age.recipient_of('AGE-SECRET-KEY-1short')
    with pytest.raises(age.AgeError):
        age.encrypt(b'x', 'age1short')


def test_scrub_redacts_anything_key_shaped():
    text = 'age: error: bad AGE-SECRET-KEY-1QPZRY9 near age-secret-key-1abc'
    assert 'QPZRY9' not in age.scrub(text) and 'abc' not in age.scrub(text)


def test_missing_age_says_how_to_install(monkeypatch):
    monkeypatch.delenv(age.AGE_ENV, raising=False)
    monkeypatch.setattr(age.shutil, 'which', lambda _tool: None)
    monkeypatch.setattr(age, 'FALLBACK_DIRS', ())
    with pytest.raises(age.AgeError, match='brew install age'):
        age.find('age')
    assert not age.available()


def test_recipient_file(tmp_path, fake_age):
    _, recipient = age.generate_identity()
    path = tmp_path / 'vault.recipient'
    path.write_text(f'# a comment\n\n{recipient}\n')
    assert age.read_recipient_file(path) == recipient
    path.write_text(f'{recipient}\n{recipient}\n')
    with pytest.raises(age.AgeError, match='exactly one'):
        age.read_recipient_file(path)
    with pytest.raises(age.AgeError, match='vault keygen'):
        age.read_recipient_file(tmp_path / 'missing')


def test_version(fake_age):
    assert age.version() == 'v0.0.0-fake'
