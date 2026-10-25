"""RunnerSession: one run's VMs, from creation to the exit-trap delete, with preemption recovery.

    cfg = RunnerConfig.from_compute(config['compute'])
    with RunnerSession(cfg, run_id='r00', code_sha=sha) as runner:
        result = runner.run(Job(argv=('run', 'config.json'), image=pins.load_image().ref))
    report['vm'] = runner.vm_report()

What it guarantees:
- Creation follows the ladder: spot in zones a → b → c, then on-demand in a → b → c.
- The laptop never holds an SSH session for the job. The VM runs it from its startup-script and
  reports through GCS (bootstrap.sh); the session polls that status and the instance itself.
- A VM that disappears before reporting `done` was preempted (or deleted by hand, which the
  drill does on purpose): the session recreates it — spot once more, then on-demand — and the
  job, which keys every stage output by content in the GCS cache, resumes where it stopped.
  A VM that reaches --max-run-duration is not recreated: the run failed its time budget.
- Exit trap: leaving the `with` block for any reason (success, an exception, Ctrl-C, SIGTERM,
  SIGHUP) deletes every instance this session created that still exists.
- Cost: every instance is booked at the catalog rate of the provisioning model it actually got;
  a preempted run books both (all) VMs.
"""

from __future__ import annotations

import json
import signal
import tempfile
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from arcforge.runner import billing, bootstrap, lifecycle
from arcforge.runner.bootstrap import Job
from arcforge.runner.config import RunnerConfig
from arcforge.runner.lifecycle import Instance
from arcforge.runner.shell import CommandError, Shell, SubprocessShell

MAX_ATTEMPTS = 3  # spot, spot once more, then on-demand
SPOT_ATTEMPTS = 2
# A VM gone within this margin of --max-run-duration expired; it was not preempted.
EXPIRY_MARGIN_S = 120
MAX_POLL_ERRORS = 10  # consecutive failed polls before the session gives up (and deletes)


class RunnerError(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')


@dataclass
class JobResult:
    outcome: str  # 'done' | 'failed'
    exit_code: int | None
    instances: list[Instance] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.outcome == 'done'


PollHook = Callable[['RunnerSession', Instance, Mapping[str, Any] | None], None]


class RunnerSession:
    def __init__(
        self,
        cfg: RunnerConfig,
        *,
        run_id: str,
        code_sha: str,
        shell: Shell | None = None,
        rates: Mapping[str, billing.RateCard] | None = None,
        clock: Callable[[], str] = utc_now,
        sleep: Callable[[float], None] = time.sleep,
        poll_seconds: float = 20.0,
        log: Callable[[str], None] = print,
    ):
        self.cfg = cfg
        self.run_id = run_id
        self.code_sha = code_sha
        self.shell = shell or SubprocessShell()
        self.rates = dict(rates) if rates else None
        self.clock = clock
        self.sleep = sleep
        self.poll_seconds = poll_seconds
        self.log = log
        self.instances: list[Instance] = []
        # Status objects live under a per-session prefix: a rerun of the same run id and code
        # gets the same instance names, and must never read the previous session's `done`.
        self.session_id = clock().replace('-', '').replace(':', '')
        self._saved_handlers: dict[int, Any] = {}
        self._scratch = tempfile.TemporaryDirectory(prefix='arcforge-runner-')

    # --- the exit trap ---------------------------------------------------------------------

    def __enter__(self) -> RunnerSession:
        # Rates first: if the catalog is unreachable the run never starts, and no handler is left
        # installed by an __enter__ that raised (__exit__ would not run to restore it).
        if self.rates is None:
            self.rates = billing.rate_cards(
                billing.fetch_skus(self.shell), self.cfg, fetched_utc=self.clock()
            )
        for sig in (signal.SIGTERM, signal.SIGHUP):
            try:
                self._saved_handlers[sig] = signal.signal(sig, self._on_signal)
            except ValueError:  # not the main thread: the caller owns signal handling
                break
        return self

    def __exit__(self, *_exc: object) -> None:
        # Ctrl-C during cleanup must not leave a GPU running.
        previous_int = signal.getsignal(signal.SIGINT)
        try:
            signal.signal(signal.SIGINT, signal.SIG_IGN)
        except ValueError:
            previous_int = None
        try:
            self.cleanup()
        finally:
            if previous_int is not None:
                signal.signal(signal.SIGINT, previous_int)
            for sig, handler in self._saved_handlers.items():
                signal.signal(sig, handler)
            self._scratch.cleanup()

    @staticmethod
    def _on_signal(signum: int, _frame: object) -> None:
        raise SystemExit(128 + signum)

    def cleanup(self) -> None:
        """Delete every live instance this session created (idempotent).

        One failed delete must not skip the others; it is reported, and --max-run-duration and
        `arcforge gc` remain as the backstops.
        """
        failed = []
        for inst in self.instances:
            if inst.deleted_utc is None:
                self.log(f'runner: exit trap deleting {inst.name}')
                try:
                    self._finish(inst, inst.ended or 'aborted')
                except Exception as error:  # noqa: BLE001 — keep deleting the rest
                    failed.append(f'{inst.name} ({error})')
        if failed:
            raise RunnerError(
                'could not delete ' + ', '.join(failed) + '; run `arcforge gc` to retry'
            )

    # --- running a job ---------------------------------------------------------------------

    def status_url(self, inst_name: str) -> str:
        return f'gs://{self.cfg.bucket}/runs/{self.run_id}/vm/{self.session_id}/{inst_name}'

    def run(self, job: Job, *, on_poll: PollHook | None = None) -> JobResult:
        if self.instances:
            raise RunnerError('one job per session: its instance names and booking are per run')
        spot_preemptions = 0
        for attempt in range(1, MAX_ATTEMPTS + 1):
            inst = self._create(job, attempt, spot=spot_preemptions < SPOT_ATTEMPTS)
            outcome, exit_code = self._wait(inst, on_poll)
            self._finish(inst, outcome)
            if outcome in ('done', 'failed'):
                return JobResult(outcome, exit_code, list(self.instances))
            if outcome == 'expired':
                raise RunnerError(
                    f'{inst.name} reached --max-run-duration ({self.cfg.max_run_hours} h) '
                    'before finishing'
                )
            if inst.provisioning == 'spot':
                spot_preemptions += 1
            self.log(f'runner: {inst.name} was {outcome}; recreating and resuming from the cache')
        raise RunnerError(f'gave up after {MAX_ATTEMPTS} VMs; every one was preempted or lost')

    def _create(self, job: Job, attempt: int, *, spot: bool) -> Instance:
        name = lifecycle.instance_name(self.run_id, self.code_sha, attempt)
        script = Path(self._scratch.name) / f'startup-{attempt}.sh'
        script.write_text(
            bootstrap.render(
                job, run_id=self.run_id, attempt=attempt, status_url=self.status_url(name)
            )
        )
        inst = lifecycle.create(
            self.shell,
            self.cfg,
            name=name,
            ladder=self.cfg.provisioning_ladder(spot=spot),
            labels=lifecycle.labels(self.cfg, self.run_id, self.code_sha, attempt),
            startup_script=script,
            attempt=attempt,
            log=self.log,
        )
        self.instances.append(inst)
        return inst

    def read_status(self, inst: Instance, obj: str = 'status.json') -> dict[str, Any] | None:
        result = self.shell.run(
            ['gcloud', 'storage', 'cat', f'{self.status_url(inst.name)}/{obj}'], timeout=60
        )
        if not result.ok:
            return None
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError:
            return None  # caught mid-write; the next poll reads it whole

    @staticmethod
    def _finished(status: Mapping[str, Any] | None) -> tuple[str, int | None] | None:
        if status and status.get('phase') == 'done':
            code = status.get('exit_code')
            return ('done' if code == 0 else 'failed'), code
        return None

    def _age_seconds(self, inst: Instance) -> float:
        return (
            billing.parse_utc(self.clock()) - billing.parse_utc(inst.created_utc)
        ).total_seconds()

    def _wait(self, inst: Instance, on_poll: PollHook | None) -> tuple[str, int | None]:
        last_phase = None
        errors = 0
        while True:
            status = self.read_status(inst)
            if finished := self._finished(status):
                return finished
            if status and status.get('phase') != last_phase:
                last_phase = status.get('phase')
                self.log(f'runner: {inst.name}: {last_phase}')
            try:
                resource = lifecycle.describe(self.shell, self.cfg, inst.name, inst.zone)
                if resource is None or resource.get('status') in lifecycle.GONE_STATES:
                    if finished := self._finished(self.read_status(inst)):  # reported, then stopped
                        return finished
                    if self._age_seconds(inst) >= self.cfg.max_run_seconds - EXPIRY_MARGIN_S:
                        return 'expired', None
                    _, preempted = lifecycle.end_time(
                        lifecycle.operations(self.shell, self.cfg, inst.name, inst.zone)
                    )
                    return ('preempted' if preempted else 'lost'), None
                errors = 0
            except CommandError as error:
                # A blip in the API must not abort (and so delete) a two-hour run.
                errors += 1
                self.log(f'runner: poll failed ({errors}/{MAX_POLL_ERRORS}): {error}')
                if errors >= MAX_POLL_ERRORS:
                    raise
            if on_poll:
                on_poll(self, inst, status)
            self.sleep(self.poll_seconds)

    def _finish(self, inst: Instance, outcome: str) -> None:
        """Make sure the instance is gone, then record when it stopped billing."""
        inst.ended = outcome
        lifecycle.delete(self.shell, self.cfg, inst.name, inst.zone)
        ended, _ = lifecycle.end_time(
            lifecycle.operations(self.shell, self.cfg, inst.name, inst.zone)
        )
        inst.deleted_utc = ended or self.clock()
        self.log(f'runner: {inst.name} deleted ({outcome})')

    # --- the report ------------------------------------------------------------------------

    def booking(self, inst: Instance) -> dict[str, Any]:
        if self.rates is None:
            raise RunnerError('no rate cards: enter the session first')
        deleted = inst.deleted_utc or self.clock()
        return {
            'name': inst.name,
            'zone': inst.zone,
            'provisioning': inst.gce_provisioning,
            'created_utc': inst.created_utc,
            'deleted_utc': deleted,
            **billing.book(inst.created_utc, deleted, self.rates[inst.provisioning]),
        }

    def vm_report(self) -> dict[str, Any]:
        """report.json's `vm` block (arc-report/1)."""
        return {
            'project': self.cfg.project,
            'region': self.cfg.region,
            'shape': self.cfg.shape,
            'gpu': self.cfg.gpu,
            'preemptions': sum(1 for i in self.instances if i.ended in ('preempted', 'lost')),
            'instances': [self.booking(i) for i in self.instances],
        }

    def cost_lines(self, stage: str) -> list[dict[str, Any]]:
        """One arc-report/1 cost line per instance, provider 'gcp', at the booked actual rate."""
        lines = []
        for booked in self.vm_report()['instances']:
            lines.append(
                {
                    'stage': stage,
                    'item': f'vm {booked["name"]} '
                    f'({booked["provisioning"].lower()}, {self.cfg.shape})',
                    'provider': 'gcp',
                    'endpoint': self.cfg.region,
                    'model': None,
                    'tokens_in': 0,
                    'tokens_out': 0,
                    'gpu_min': booked['billed_min'],
                    'usd': booked['usd'],
                    'cached': False,
                    'dividend': False,
                }
            )
        return lines

    def rates_report(self) -> dict[str, Any]:
        """Provenance of the booked rates: SKU ids, catalog effective time, fetch time."""
        return {k: v.to_json() for k, v in (self.rates or {}).items()}
