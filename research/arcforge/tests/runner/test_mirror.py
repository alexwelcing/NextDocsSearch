import hashlib
import io
import json
import urllib.error

import pytest

from arcforge.runner import mirror
from arcforge.runner.pins import ModelPin
from arcforge.runner.shell import Result

REV = 'c202236235762e1c871ad0ccb60c8ee5ba337b9a'
PIN = ModelPin(key='toy', repo='Org/Toy-1B', revision=REV, role='test', exclude=('consolidated.safetensors',))
WEIGHTS = b'\x00weights' * 1000
CONFIG = b'{"hidden": 8}\n'


def git_blob(data: bytes) -> str:
    return hashlib.sha1(b'blob %d\0' % len(data) + data).hexdigest()  # noqa: S324


HUB_INFO = {
    'id': 'Org/Toy-1B', 'sha': REV, 'gated': False, 'lastModified': '2026-03-02T00:51:43.000Z',
    'siblings': [
        {'rfilename': 'config.json', 'size': len(CONFIG), 'blobId': git_blob(CONFIG)},
        {'rfilename': 'model.safetensors', 'size': len(WEIGHTS), 'blobId': 'x',
         'lfs': {'sha256': hashlib.sha256(WEIGHTS).hexdigest(), 'size': len(WEIGHTS)}},
        {'rfilename': 'consolidated.safetensors', 'size': 99, 'lfs': {'sha256': '0' * 64, 'size': 99}},
    ],
}


def hub(files=None, info=None):
    files = files or {'config.json': CONFIG, 'model.safetensors': WEIGHTS}
    opened = []

    def open_url(url):
        opened.append(url)
        if '/api/models/' in url:
            return io.BytesIO(json.dumps(info or HUB_INFO).encode())
        name = url.rsplit('/', 1)[-1]
        return io.BytesIO(files[name])

    open_url.opened = opened
    return open_url


def test_resolve_lists_wanted_files_and_checks_the_revision():
    resolved = mirror.resolve(PIN, open_url=hub())
    assert [f.path for f in resolved.files] == ['config.json', 'model.safetensors']  # consolidated excluded
    assert resolved.files[1].sha256 == hashlib.sha256(WEIGHTS).hexdigest()
    assert resolved.total_bytes == len(CONFIG) + len(WEIGHTS)
    with pytest.raises(mirror.MirrorError, match='resolved'):
        mirror.resolve(PIN, open_url=hub(info={**HUB_INFO, 'sha': 'f' * 40}))


def test_resolve_reports_a_missing_revision():
    def gone(url):
        raise urllib.error.HTTPError(url, 404, 'not found', {}, None)

    with pytest.raises(mirror.MirrorError, match='404'):
        mirror.resolve(PIN, open_url=gone)


def test_gcs_layout_is_repo_at_revision():
    assert PIN.gcs_prefix() == f'gs://witching-606c6-arcforge/models/Org/Toy-1B@{REV}/'


def test_download_verifies_lfs_and_git_hashes(tmp_path):
    resolved = mirror.resolve(PIN, open_url=hub())
    config, weights = resolved.files
    assert mirror.download(PIN, weights, tmp_path / 'w', open_url=hub()) == hashlib.sha256(WEIGHTS).hexdigest()
    assert mirror.download(PIN, config, tmp_path / 'c', open_url=hub()) == hashlib.sha256(CONFIG).hexdigest()
    corrupt = hub(files={'config.json': b'{"hidden": 9}\n', 'model.safetensors': WEIGHTS[:-1] + b'!'})
    with pytest.raises(mirror.MirrorError, match='sha256'):
        mirror.download(PIN, weights, tmp_path / 'w', open_url=corrupt)
    with pytest.raises(mirror.MirrorError, match='git blob'):
        mirror.download(PIN, config, tmp_path / 'c', open_url=corrupt)
    short = hub(files={'config.json': CONFIG[:-1], 'model.safetensors': WEIGHTS})
    with pytest.raises(mirror.MirrorError, match='bytes'):
        mirror.download(PIN, config, tmp_path / 'c', open_url=short)


class Bucket:
    """Wires a FakeShell to an in-memory bucket for `gcloud storage cp/cat/objects`."""

    def __init__(self, shell):
        self.objects: dict[str, tuple[bytes, int]] = {}
        self.generation = 1000
        shell.on('storage cp', then=self.cp)
        shell.on('storage cat', then=self.cat)
        shell.on('storage objects list', then=self.ls)
        shell.on('storage objects describe', then=self.describe)
        self.shell = shell

    def cp(self, argv):
        self.generation += 1
        with open(argv[3], 'rb') as f:
            self.objects[argv[4]] = (f.read(), self.generation)
        return Result(argv, 0)

    def cat(self, argv):
        obj = self.objects.get(argv[3])
        return Result(argv, 0, obj[0].decode()) if obj else Result(argv, 1, '', 'matched no objects')

    def ls(self, argv):
        prefix = argv[4].removesuffix('**')
        rows = [{'name': url.removeprefix('gs://witching-606c6-arcforge/'), 'generation': str(gen)}
                for url, (_, gen) in self.objects.items() if url.startswith(prefix)]
        return Result(argv, 0, json.dumps(rows))

    def describe(self, argv):
        return Result(argv, 0, json.dumps({'generation': str(self.objects[argv[4]][1])}))


def test_mirror_uploads_verified_files_then_the_manifest(shell, tmp_path):
    bucket = Bucket(shell)
    resolved = mirror.resolve(PIN, open_url=hub())
    manifest = mirror.mirror(shell, resolved, bucket='witching-606c6-arcforge', workdir=tmp_path,
                             now_utc='2026-10-24T12:00:00Z', open_url=hub(), log=lambda _m: None)
    prefix = PIN.gcs_prefix()
    uploads = [c[4] for c in shell.called('storage cp')]
    assert uploads == [prefix + 'config.json', prefix + 'model.safetensors', prefix + 'MANIFEST.json']  # manifest last
    assert bucket.objects[prefix + 'model.safetensors'][0] == WEIGHTS
    assert [f['path'] for f in manifest['files']] == ['config.json', 'model.safetensors']
    assert manifest['files'][1]['sha256'] == hashlib.sha256(WEIGHTS).hexdigest()
    assert manifest['excluded'] == ['consolidated.safetensors'] and manifest['revision'] == REV
    assert list(tmp_path.iterdir()) == []  # temp files cleaned up
    assert mirror.verify(shell, PIN, 'witching-606c6-arcforge') == []


def test_rerun_skips_what_is_already_mirrored(shell, tmp_path):
    Bucket(shell)
    resolved = mirror.resolve(PIN, open_url=hub())
    mirror.mirror(shell, resolved, bucket='witching-606c6-arcforge', workdir=tmp_path, now_utc='t', open_url=hub(), log=lambda _m: None)
    again = hub()
    mirror.mirror(shell, resolved, bucket='witching-606c6-arcforge', workdir=tmp_path, now_utc='t', open_url=again, log=lambda _m: None)
    assert again.opened == []  # nothing downloaded the second time


def test_verify_catches_a_replaced_object(shell, tmp_path):
    bucket = Bucket(shell)
    resolved = mirror.resolve(PIN, open_url=hub())
    mirror.mirror(shell, resolved, bucket='witching-606c6-arcforge', workdir=tmp_path, now_utc='t', open_url=hub(), log=lambda _m: None)
    url = PIN.gcs_prefix() + 'model.safetensors'
    bucket.objects[url] = (b'tampered', 9999)
    assert mirror.verify(shell, PIN, 'witching-606c6-arcforge') == ['model.safetensors: generation 9999 != manifest 1002']


def test_gated_repos_are_refused(shell, tmp_path):
    resolved = mirror.resolve(PIN, open_url=hub(info={**HUB_INFO, 'gated': 'auto'}))
    with pytest.raises(mirror.MirrorError, match='gated'):
        mirror.mirror(shell, resolved, bucket='b', workdir=tmp_path, now_utc='t', open_url=hub())


def test_select():
    pins = [PIN, ModelPin(key='fb', repo='Org/Fb', revision=REV, role='r', default=False)]
    assert mirror.select(pins, [], all_pins=False) == [PIN]
    assert len(mirror.select(pins, [], all_pins=True)) == 2
    assert mirror.select(pins, ['fb'], all_pins=False)[0].key == 'fb'
    with pytest.raises(mirror.MirrorError, match='unknown'):
        mirror.select(pins, ['nope'], all_pins=False)
