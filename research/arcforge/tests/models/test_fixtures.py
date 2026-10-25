import hashlib
import unicodedata

from arcforge.models import fixtures
from arcforge.models.bundle import META_NAME, Bundle


def test_committed_fixtures_are_current(tmp_path):
    fixtures.build_fixtures(tmp_path)
    assert fixtures.stale_files(fixtures.FIXTURE_DIR, tmp_path) == []


def test_parity_header_describes_the_strings():
    header, records = fixtures.read_parity()
    strings = fixtures.parity_strings()
    assert header['strings'] == len(records) == fixtures.N_STRINGS == len(strings)
    assert [r['s'] for r in records] == strings
    assert header['strings_sha256'] == hashlib.sha256('\x00'.join(strings).encode()).hexdigest()
    bundle = Bundle(fixtures.FIXTURE_DIR / 'toy' / META_NAME)
    assert header['lexicon_sha256'] == bundle.lexicon.sha256


def test_python_reproduces_every_committed_stream():
    """The same check lexemeEmbed.test.ts makes, on this Python (3.11 and 3.14 in CI)."""
    _, records = fixtures.read_parity()
    tokenizer = Bundle(fixtures.FIXTURE_DIR / 'toy' / META_NAME).tokenizer
    for record in records:
        q = [t.parity() for t in tokenizer.tokenize(record['s'], 'query')]
        d = [t.parity() for t in tokenizer.tokenize(record['s'], 'document')]
        assert fixtures.stream_digest(q) == record['h'], record['s']
        if 'q' in record:
            assert q == record['q']
        assert d == record.get('d', q), record['s']


def test_strings_use_long_assigned_characters_only():
    for text in fixtures.parity_strings():
        assert all(unicodedata.category(c) != 'Cn' for c in text), text


def test_strings_cover_the_interesting_cases():
    _, records = fixtures.read_parity()
    kinds = {token[1] for r in records if 'q' in r for token in r['q']}
    assert kinds == {0, 1, 2, 3, 4, 5}
    assert sum('d' in r for r in records) >= 10  # document-local alias rewriting
    assert any(not r['s'].isascii() for r in records) and any(r['s'].isascii() for r in records)
