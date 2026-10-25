"""The one seam between the runner and the outside world: running a CLI (gcloud, docker, uv).

Everything in arcforge.runner talks to Google Cloud through the gcloud CLI rather than client
libraries, for three reasons: it is already on the owner's laptop and on every runner image; it
needs no extras, so `uv run arcforge doctor` works on a bare checkout; and IAP SSH, Cloud Build
and quota reads are first-class there. Tests replace the shell with a scripted fake
(tests/runner/fakes.py), so no test ever reaches the network.
"""

from __future__ import annotations

import json
import shlex
import subprocess
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class Result:
    argv: tuple[str, ...]
    returncode: int
    stdout: str = ''
    stderr: str = ''

    @property
    def ok(self) -> bool:
        return self.returncode == 0

    def json(self) -> Any:
        return json.loads(self.stdout or 'null')

    def describe(self) -> str:
        """A one-line summary for errors: the command and the last line of stderr."""
        tail = (self.stderr or self.stdout).strip().splitlines()
        last = tail[-1] if tail else '(no output)'
        return f'`{shlex.join(self.argv)}` exited {self.returncode}: {last}'


class Shell(Protocol):
    def run(
        self, argv: Sequence[str], *, input: str | None = None, timeout: float | None = None
    ) -> Result: ...


class CommandError(RuntimeError):
    def __init__(self, result: Result):
        super().__init__(result.describe())
        self.result = result


class SubprocessShell:
    """The real shell. A missing binary is reported as exit 127, like a POSIX shell would."""

    def run(
        self, argv: Sequence[str], *, input: str | None = None, timeout: float | None = None
    ) -> Result:
        argv = tuple(argv)
        try:
            out = subprocess.run(
                argv, input=input, capture_output=True, text=True, timeout=timeout, check=False
            )
        except FileNotFoundError as error:
            return Result(argv, 127, '', str(error))
        except subprocess.TimeoutExpired:
            return Result(argv, 124, '', f'timed out after {timeout}s')
        return Result(argv, out.returncode, out.stdout, out.stderr)


def check(result: Result) -> Result:
    if not result.ok:
        raise CommandError(result)
    return result


def gcloud_json(shell: Shell, args: Sequence[str], *, timeout: float | None = 120) -> Any:
    """Run `gcloud ARGS --format=json` and parse the output, raising CommandError on failure."""
    return check(shell.run(['gcloud', *args, '--format=json'], timeout=timeout)).json()


def is_not_found(result: Result) -> bool:
    text = f'{result.stderr}\n{result.stdout}'
    return not result.ok and ('NOT_FOUND' in text or 'was not found' in text or 'not found' in text)
