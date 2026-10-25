"""The age and age-keygen command-line tools, driven through subprocess.

No crypto is implemented here: age (https://age-encryption.org, `brew install age`) does all of
it. Secrets only ever travel through pipes:
- `age-keygen` prints a new identity to its stdout, which is read into memory and never written
  to a file;
- `age -d -i -` reads the identity from stdin, so a key is never in argv (visible in `ps`), the
  environment or a temp file;
- plaintext goes in on stdin and ciphertext comes back on stdout.

Error text from the tools is scrubbed of anything shaped like a secret key before it is shown.

ARCFORGE_AGE and ARCFORGE_AGE_KEYGEN name other binaries; the tests use them to run a stand-in.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

AGE_ENV = 'ARCFORGE_AGE'
KEYGEN_ENV = 'ARCFORGE_AGE_KEYGEN'
# Homebrew's prefixes, for a shell whose PATH lacks them (a launchd job, a bare `python3 -S`).
FALLBACK_DIRS = ('/opt/homebrew/bin', '/usr/local/bin')

_BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
RECIPIENT_RE = re.compile(rf'^age1[{_BECH32}]{{58}}$')
IDENTITY_RE = re.compile(rf'^AGE-SECRET-KEY-1[{_BECH32.upper()}]{{58}}$')
_SECRETISH = re.compile(r'AGE-SECRET-KEY-1\S*', re.IGNORECASE)
ARMOR_HEADER = b'-----BEGIN AGE ENCRYPTED FILE-----'
TIMEOUT_S = 60


class AgeError(RuntimeError):
    """age is missing or a call failed. The message never contains key material."""


def scrub(text: str) -> str:
    return _SECRETISH.sub('AGE-SECRET-KEY-[redacted]', text)


def find(tool: str) -> str:
    """Path to `age` or `age-keygen`: the env override, then PATH, then Homebrew's prefixes."""
    override = os.environ.get(KEYGEN_ENV if tool == 'age-keygen' else AGE_ENV)
    if override:
        return override
    found = shutil.which(tool)
    if found:
        return found
    for folder in FALLBACK_DIRS:
        candidate = Path(folder) / tool
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    raise AgeError(f'`{tool}` is not installed. On the Mac: brew install age')


def available() -> bool:
    try:
        find('age')
        find('age-keygen')
    except AgeError:
        return False
    return True


def _run(argv: list[str], data: bytes | None) -> bytes:
    try:
        out = subprocess.run(argv, input=data, capture_output=True, timeout=TIMEOUT_S, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise AgeError(f'{Path(argv[0]).name} could not run: {type(error).__name__}') from None
    if out.returncode != 0:
        detail = scrub(out.stderr.decode('utf-8', 'replace')).strip().splitlines()
        reason = detail[0] if detail else f'exit {out.returncode}'
        raise AgeError(f'{Path(argv[0]).name} failed: {reason}')
    return out.stdout


def version() -> str:
    return _run([find('age'), '--version'], None).decode().strip()


def is_identity(text: str) -> bool:
    return bool(IDENTITY_RE.match(text))


def is_recipient(text: str) -> bool:
    return bool(RECIPIENT_RE.match(text))


def generate_identity() -> tuple[str, str]:
    """A fresh (identity, recipient) pair, held only in memory."""
    out = _run([find('age-keygen')], None).decode('utf-8')
    identities = [line.strip() for line in out.splitlines() if is_identity(line.strip())]
    if len(identities) != 1:
        raise AgeError('age-keygen printed no usable identity')
    identity = identities[0]
    return identity, recipient_of(identity)


def recipient_of(identity: str) -> str:
    """The public recipient for an identity (`age-keygen -y`, identity on stdin)."""
    if not is_identity(identity):
        raise AgeError('that is not an age secret key (it starts with AGE-SECRET-KEY-1)')
    recipient = _run([find('age-keygen'), '-y'], (identity + '\n').encode()).decode().strip()
    if not is_recipient(recipient):
        raise AgeError('age-keygen -y printed no recipient')
    return recipient


def encrypt(plaintext: bytes, recipient: str) -> bytes:
    """ASCII-armored ciphertext for one recipient."""
    if not is_recipient(recipient):
        raise AgeError(f'not an age recipient: {recipient[:12]}…')
    sealed = _run([find('age'), '--encrypt', '--armor', '-r', recipient], plaintext)
    if not sealed.startswith(ARMOR_HEADER):
        raise AgeError('age returned no armored ciphertext')
    return sealed


def decrypt(sealed: Path, identity: str) -> bytes:
    """Plaintext of `sealed`, decrypted in memory with the identity piped on stdin."""
    if not is_identity(identity):
        raise AgeError('that is not an age secret key (it starts with AGE-SECRET-KEY-1)')
    return _run([find('age'), '--decrypt', '-i', '-', str(sealed)], (identity + '\n').encode())


def read_recipient_file(path: Path) -> str:
    """The single recipient in configs/vault.recipient ('#' comment lines are allowed)."""
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except FileNotFoundError:
        raise AgeError(
            f'no vault recipient at {path}. The owner creates it once with '
            '`uv run arcforge vault keygen`.'
        ) from None
    entries = [line.strip() for line in lines if line.strip() and not line.startswith('#')]
    if len(entries) != 1 or not is_recipient(entries[0]):
        raise AgeError(f'{path} must hold exactly one age recipient (age1…)')
    return entries[0]
