import io

import pytest

from arcforge.vault import age
from arcforge.vault.keygen import KeygenError, keygen


class Tty(io.StringIO):
    def isatty(self):
        return True


SHOWN = object()  # stands for "the key that was shown", pasted back correctly


@pytest.fixture
def run(monkeypatch):
    """keygen with scripted answers; returns (recipient, the identity shown, the output)."""
    original = age.generate_identity

    def run(path, answers, pasted, *, out=None, interactive=True, force=False):
        shown = {}

        def capture():
            shown['identity'], recipient = original()
            return shown['identity'], recipient

        def paste(_prompt):
            value = pasted.pop(0)
            return shown['identity'] if value is SHOWN else value

        monkeypatch.setattr(age, 'generate_identity', capture)
        out = out or io.StringIO()
        recipient = keygen(
            path,
            force=force,
            is_interactive=lambda: interactive,
            ask=lambda _prompt: answers.pop(0),
            ask_hidden=paste,
            out=out,
        )
        return recipient, shown.get('identity'), out.getvalue()

    return run


def test_keygen_shows_the_key_once_and_writes_only_the_recipient(fake_age, tmp_path, run):
    path = tmp_path / 'configs' / 'vault.recipient'
    recipient, identity, out = run(path, ['saved', 'SAVED'], [SHOWN])
    assert out.count(identity) == 1  # shown exactly once
    assert 'Not yet' in out  # 'saved' in lower case was not accepted
    assert age.read_recipient_file(path) == recipient == age.recipient_of(identity)
    assert identity not in path.read_text()
    assert [p.name for p in (tmp_path / 'configs').rglob('*')] == ['vault.recipient']  # no key file


def test_screen_is_cleared_on_a_terminal(fake_age, tmp_path, run):
    _, identity, out = run(tmp_path / 'r', ['SAVED'], [SHOWN], out=Tty())
    assert '\033[3J' in out and out.index('\033[3J') > out.index(identity)


def test_a_bad_paste_back_writes_nothing(fake_age, tmp_path, run):
    path = tmp_path / 'vault.recipient'
    with pytest.raises(KeygenError, match='never matched'):
        run(path, ['SAVED'], ['AGE-SECRET-KEY-1typo', 'nope', 'still no'])
    assert not path.exists()


def test_a_second_try_paste_back_is_fine(fake_age, tmp_path, run):
    path = tmp_path / 'vault.recipient'
    run(path, ['SAVED'], ['wrong', SHOWN])
    assert path.exists()


def test_refuses_without_a_terminal(fake_age, tmp_path, run):
    with pytest.raises(KeygenError, match='not through an agent'):
        run(tmp_path / 'r', [], [], interactive=False)


def test_refuses_to_replace_a_recipient(fake_age, tmp_path, run):
    path = tmp_path / 'vault.recipient'
    path.write_text('age1existing\n')
    with pytest.raises(KeygenError, match='orphan'):
        run(path, [], [])
    assert path.read_text() == 'age1existing\n'
    run(path, ['SAVED'], [SHOWN], force=True)
    assert age.is_recipient(age.read_recipient_file(path))
