"""The archive as files: pages/docs/articles/*.mdx plus public/arc/records/*.json.

S0 reads the corpus either from the worktree (corpus.git_sha null: the default while a run is
being prepared) or from a pinned commit (corpus.git_sha set: read from the object database
with `git cat-file --batch`, so a dirty or sparse worktree cannot leak into the snapshot).
Either way the result is {repo-relative path: bytes}, and its fingerprint (sha256 over sorted
(path, sha256(bytes))) is what enters S0's key.

Also here: the frontmatter reader and the word tokenizer that S1's count statistics use.
"""

from __future__ import annotations

import re
import subprocess
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from arcforge.core.hashing import pairs_id, sha256_bytes

MDX_SUFFIX = '.mdx'
RECORD_SUFFIX = '.json'


class CorpusError(RuntimeError):
    pass


@dataclass(frozen=True)
class CorpusFiles:
    mode: str  # 'worktree' | 'git'
    git_sha: str | None
    mdx_dir: str
    records_dir: str
    files: dict[str, bytes]

    @property
    def fingerprint(self) -> str:
        return pairs_id([(path, sha256_bytes(data)) for path, data in self.files.items()])

    def mdx(self) -> dict[str, bytes]:
        """slug -> mdx bytes."""
        return self._by_slug(self.mdx_dir, MDX_SUFFIX)

    def records(self) -> dict[str, bytes]:
        """slug -> record json bytes."""
        return self._by_slug(self.records_dir, RECORD_SUFFIX)

    def _by_slug(self, folder: str, suffix: str) -> dict[str, bytes]:
        prefix = folder.rstrip('/') + '/'
        out = {}
        for path, data in self.files.items():
            if path.startswith(prefix) and path.endswith(suffix) and '/' not in path[len(prefix) :]:
                out[path[len(prefix) : -len(suffix)]] = data
        return dict(sorted(out.items()))


def _in_scope(path: str, folder: str, suffix: str) -> bool:
    prefix = folder.rstrip('/') + '/'
    rest = path[len(prefix) :] if path.startswith(prefix) else None
    return rest is not None and '/' not in rest and rest.endswith(suffix)


def load_worktree(repo_root: Path, mdx_dir: str, records_dir: str) -> CorpusFiles:
    files: dict[str, bytes] = {}
    for folder, suffix in ((mdx_dir, MDX_SUFFIX), (records_dir, RECORD_SUFFIX)):
        base = repo_root / folder
        if not base.is_dir():
            raise CorpusError(f'corpus folder {base} does not exist')
        for path in sorted(base.glob(f'*{suffix}')):
            if path.is_file():
                files[f'{folder.rstrip("/")}/{path.name}'] = path.read_bytes()
    return CorpusFiles('worktree', None, mdx_dir, records_dir, files)


def _git(repo_root: Path, *args: str, stdin: bytes | None = None) -> bytes:
    try:
        out = subprocess.run(
            ['git', '-C', str(repo_root), *args], input=stdin, capture_output=True, check=True
        )
    except FileNotFoundError as error:
        raise CorpusError('git is not installed') from error
    except subprocess.CalledProcessError as error:
        raise CorpusError(f'git {" ".join(args[:2])}: {error.stderr.decode().strip()}') from error
    return out.stdout


def load_git(repo_root: Path, git_sha: str, mdx_dir: str, records_dir: str) -> CorpusFiles:
    listing = _git(
        repo_root, 'ls-tree', '-r', '-z', '--name-only', git_sha, '--', mdx_dir, records_dir
    )
    paths = sorted(
        p
        for p in listing.decode('utf-8').split('\0')
        if p and (_in_scope(p, mdx_dir, MDX_SUFFIX) or _in_scope(p, records_dir, RECORD_SUFFIX))
    )
    if not paths:
        raise CorpusError(f'no corpus files under {mdx_dir} or {records_dir} at {git_sha}')
    batch = _git(
        repo_root, 'cat-file', '--batch', stdin=''.join(f'{git_sha}:{p}\n' for p in paths).encode()
    )
    files: dict[str, bytes] = {}
    offset = 0
    for path in paths:
        newline = batch.index(b'\n', offset)
        header = batch[offset:newline].decode().split()
        if len(header) != 3 or header[1] != 'blob':
            raise CorpusError(f'git cat-file: unexpected header {header} for {path}')
        size = int(header[2])
        start = newline + 1
        files[path] = batch[start : start + size]
        offset = start + size + 1  # the content is followed by one newline
    return CorpusFiles('git', git_sha, mdx_dir, records_dir, files)


def load_corpus(
    repo_root: Path, mdx_dir: str, records_dir: str, git_sha: str | None
) -> CorpusFiles:
    if git_sha:
        return load_git(repo_root, git_sha, mdx_dir, records_dir)
    return load_worktree(repo_root, mdx_dir, records_dir)


# --- text helpers ------------------------------------------------------------------------------


def split_frontmatter(text: str) -> tuple[str, str]:
    """('---' fenced YAML, body). A file without frontmatter has an empty first part."""
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].strip() != '---':
        return '', text
    for index in range(1, len(lines)):
        if lines[index].strip() == '---':
            return ''.join(lines[1:index]), ''.join(lines[index + 1 :])
    raise CorpusError('frontmatter has no closing ---')


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    import yaml  # noqa: PLC0415 — lazy: see arcforge/commands/__init__.py

    head, body = split_frontmatter(text)
    if not head:
        return {}, body
    try:
        meta = yaml.safe_load(head)
    except yaml.YAMLError as error:
        raise CorpusError(f'invalid frontmatter: {error}') from error
    if meta is None:
        meta = {}
    if not isinstance(meta, dict):
        raise CorpusError('frontmatter is not a mapping')
    return meta, body


YEAR = re.compile(r'(?<!\d)(\d{4})(?!\d)')
ISO_DAY = re.compile(r'(\d{4})-(\d{2})-(\d{2})')


def normalize_date(value: Any) -> str | None:
    """Frontmatter dates come back as str, date or datetime; return 'YYYY-MM-DD' or the raw str."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        match = ISO_DAY.search(value)
        return '-'.join(match.groups()) if match else value.strip() or None
    return None


def year_of(value: str | None) -> int | None:
    match = YEAR.search(value or '')
    return int(match.group(1)) if match else None


WORD = re.compile(r'[a-z0-9]+')
TOKENIZER_ID = 'nfkd-lower-alnum/1'


def fold(text: str) -> str:
    """NFKD, drop combining marks, lowercase: Tomáš -> tomas (the M0 tokenize.ts folding)."""
    decomposed = unicodedata.normalize('NFKD', text)
    return ''.join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def words(text: str) -> list[str]:
    """The word tokenizer behind S1's counts: folded [a-z0-9]+ runs, nothing dropped."""
    return WORD.findall(fold(text))
