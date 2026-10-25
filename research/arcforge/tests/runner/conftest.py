"""Fixtures for the runner tests: a scripted stand-in for the gcloud CLI, so no test touches the
network, and the real Billing Catalog SKUs (captured 2026-10-24) as a fixture."""

from __future__ import annotations

import json
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

import pytest

from arcforge.runner.shell import Result

FIXTURES = Path(__file__).resolve().parent / 'fixtures'

Responder = Result | Callable[[tuple[str, ...]], Result]


def ok(payload: Any = '', stderr: str = '') -> Callable[[tuple[str, ...]], Result]:
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return lambda argv: Result(argv, 0, text, stderr)


def fail(stderr: str, code: int = 1) -> Callable[[tuple[str, ...]], Result]:
    return lambda argv: Result(argv, code, '', stderr)


NOT_FOUND = fail("ERROR: (gcloud) Could not fetch resource:\n - The resource 'x' was not found")


class FakeShell:
    """Answers each command with the first rule whose words all appear in it, in order.

    A rule's responder is a Result, a callable, or a list of them consumed one per call (the
    last one repeats). Unmatched commands fail loudly, so a test never passes by accident.
    """

    def __init__(self) -> None:
        self.rules: list[tuple[tuple[str, ...], list[Responder]]] = []
        self.calls: list[tuple[str, ...]] = []

    def on(self, *words: str, then: Responder | Sequence[Responder]) -> FakeShell:
        responders = list(then) if isinstance(then, list | tuple) else [then]
        self.rules.insert(0, (words, responders))  # later rules win
        return self

    def run(
        self, argv: Sequence[str], *, input: str | None = None, timeout: float | None = None
    ) -> Result:
        argv = tuple(argv)
        self.calls.append(argv)
        return self._scripted(argv)

    def _scripted(self, argv: tuple[str, ...]) -> Result:
        for words, responders in self.rules:
            if _matches(argv, words):
                responder = responders.pop(0) if len(responders) > 1 else responders[0]
                return responder(argv) if callable(responder) else responder
        raise AssertionError(f'FakeShell: unexpected command {argv}')

    def called(self, *words: str) -> list[tuple[str, ...]]:
        return [c for c in self.calls if _matches(c, words)]

    ok = staticmethod(lambda payload='', stderr='': ok(payload, stderr))
    fail = staticmethod(lambda stderr, code=1: fail(stderr, code))
    not_found = staticmethod(lambda: NOT_FOUND)


def _matches(argv: tuple[str, ...], words: tuple[str, ...]) -> bool:
    joined = ' '.join(argv)
    return all(w in joined for w in words)


@pytest.fixture
def shell() -> FakeShell:
    return FakeShell()


@pytest.fixture(scope='session')
def skus() -> list[dict[str, Any]]:
    return json.loads((FIXTURES / 'billing_skus.json').read_text())['skus']


class FakeCloud(FakeShell):
    """A stateful fake of the slice of Compute Engine + GCS the runner session uses.

    `plans[attempt]` scripts each VM: a list of (seconds after creation, event) where event is
    'running', ('done', exit_code), 'preempt' (the spot VM is reclaimed and, with termination
    action DELETE, deleted), 'vanish' (deleted with no preemption record, as the drill does) or
    'poweroff' (the VM stopped itself after reporting). The clock advances only when the session
    sleeps.
    """

    def __init__(
        self, plans: dict[int, list], *, start: str = '2026-10-24T10:00:00Z', stockouts=()
    ):
        super().__init__()
        from datetime import datetime

        self.now = datetime.fromisoformat(start.replace('Z', '+00:00'))
        self.plans = plans
        self.stockouts = set(stockouts)  # {(zone, 'SPOT'|'STANDARD')}
        self.instances: dict[str, dict[str, Any]] = {}
        self.objects: dict[str, str] = {}
        self.ops: list[dict[str, Any]] = []
        self.created: list[tuple[str, str, str]] = []

    # time ---------------------------------------------------------------------------------
    def clock(self) -> str:
        return self.now.strftime('%Y-%m-%dT%H:%M:%SZ')

    def sleep(self, seconds: float) -> None:
        from datetime import timedelta

        self.now += timedelta(seconds=seconds)
        self.tick()

    def tick(self) -> None:
        for name, inst in list(self.instances.items()):
            age = (self.now - inst['created']).total_seconds()
            plan = inst['plan']
            while plan and plan[0][0] <= age:
                _, event = plan.pop(0)
                self.apply(name, inst, event)

    def apply(self, name: str, inst: dict[str, Any], event: Any) -> None:
        url = f'gs://witching-606c6-arcforge/runs/{inst["run"]}/vm/{name}/status.json'
        if event == 'running':
            self.objects[url] = json.dumps({'phase': 'running', 'exit_code': None})
        elif isinstance(event, tuple) and event[0] == 'done':
            self.objects[url] = json.dumps({'phase': 'done', 'exit_code': event[1]})
        elif event == 'preempt':
            self.op(name, 'compute.instances.preempted')
            del self.instances[name]
        elif event == 'vanish':
            self.op(name, 'delete')
            del self.instances[name]
        elif event == 'poweroff':
            inst['status'] = 'TERMINATED'

    def op(self, name: str, kind: str) -> None:
        self.ops.append(
            {
                'operationType': kind,
                'targetLink': f'.../instances/{name}',
                'status': 'DONE',
                'insertTime': self.clock(),
                'endTime': self.clock(),
            }
        )

    # the CLI ------------------------------------------------------------------------------
    def run(self, argv, *, input=None, timeout=None) -> Result:
        argv = tuple(argv)
        self.calls.append(argv)
        joined = ' '.join(argv)
        flag = {
            a.split('=', 1)[0]: a.split('=', 1)[1] for a in argv if a.startswith('--') and '=' in a
        }
        if 'compute instances create' in joined:
            name, zone, model = argv[4], flag['--zone'], flag['--provisioning-model']
            if (zone, model) in self.stockouts:
                return Result(argv, 1, '', 'ZONE_RESOURCE_POOL_EXHAUSTED')
            attempt = int(flag['--labels'].split('arcforge-attempt=')[1].split(',')[0])
            run = flag['--labels'].split('arcforge-run=')[1].split(',')[0]
            self.instances[name] = {
                'zone': zone,
                'status': 'RUNNING',
                'created': self.now,
                'run': run,
                'plan': list(self.plans.get(attempt, [])),
            }
            self.created.append((name, zone, model))
            self.op(name, 'insert')
            return Result(argv, 0, json.dumps([{'name': name, 'creationTimestamp': self.clock()}]))
        if 'compute instances describe' in joined:
            inst = self.instances.get(argv[4])
            return (
                Result(argv, 0, json.dumps({'status': inst['status']})) if inst else NOT_FOUND(argv)
            )
        if 'compute instances delete' in joined:
            if argv[4] not in self.instances:
                return NOT_FOUND(argv)
            del self.instances[argv[4]]
            self.op(argv[4], 'delete')
            return Result(argv, 0)
        if 'compute operations list' in joined:
            name = flag['--filter'].rsplit('/', 1)[1].rstrip('$')
            return Result(
                argv, 0, json.dumps([o for o in self.ops if o['targetLink'].endswith('/' + name)])
            )
        if 'storage cat' in joined:
            body = self.objects.get(argv[3])
            return (
                Result(argv, 0, body)
                if body is not None
                else Result(argv, 1, '', 'matched no objects')
            )
        return self._scripted(argv)


@pytest.fixture
def rates(skus):
    from arcforge.runner import billing
    from arcforge.runner.config import RunnerConfig

    return billing.rate_cards(skus, RunnerConfig(), fetched_utc='2026-10-24T10:00:00Z')


@pytest.fixture
def make_cloud():
    return FakeCloud
