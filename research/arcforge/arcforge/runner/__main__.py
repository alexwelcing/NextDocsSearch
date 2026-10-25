"""Operator commands for the runner: `python -m arcforge.runner <command>`.

These exercise the runner against the real project. They are not `arcforge` subcommands because
a run never needs them: `arcforge run` drives RunnerSession itself. Every command that creates a
VM deletes it before returning, and prints the booking.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from pathlib import Path

from arcforge.runner import billing, iam, pins
from arcforge.runner.config import RunnerConfig
from arcforge.runner.session import RunnerSession, utc_now
from arcforge.runner.shell import SubprocessShell

SMOKE_HOST = """\
echo "host: $(lsb_release -ds 2>/dev/null || uname -sr)"
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
docker --version
echo "nvidia container runtime: $(nvidia-container-cli --version 2>/dev/null | head -1 || echo missing)"
echo "external ip: $(curl -sf -m 3 -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || echo none)"
"""

SMOKE_CONTAINER = """\
import os, torch, arcforge
print('arcforge', arcforge.__version__, '@', os.environ.get('ARCFORGE_COMMIT'))
print('torch', torch.__version__, 'cuda', torch.version.cuda, 'available', torch.cuda.is_available())
x = torch.ones(1024, 1024, device='cuda')
print('device', torch.cuda.get_device_name(0), 'matmul sum', float((x @ x).sum()))
"""


def _git_sha() -> str:
    from arcforge.runner.remote import code_sha

    return code_sha(SubprocessShell())


def _print_job_log(session: RunnerSession) -> None:
    for inst in session.instances:
        result = session.shell.run(['gcloud', 'storage', 'cat', f'{session.status_url(inst.name)}/job.log'], timeout=60)
        print(f'--- job.log of {inst.name} ---')
        print(result.stdout.rstrip() if result.ok else '(no log)')


def _confirm_gone(shell: SubprocessShell, cfg: RunnerConfig, run_id: str) -> bool:
    result = shell.run(['gcloud', 'compute', 'instances', 'list', f'--project={cfg.project}',
                        f'--filter=labels.arcforge-run={run_id}', '--format=value(name,zone,status)'], timeout=120)
    left = result.stdout.strip()
    print(f'instances left with arcforge-run={run_id}: {left or "none"}')
    return result.ok and not left


def cmd_rates(args: argparse.Namespace) -> int:
    shell = SubprocessShell()
    cfg = RunnerConfig(shape=args.shape)
    cards = billing.rate_cards(billing.fetch_skus(shell), cfg, fetched_utc=utc_now())
    print(json.dumps({k: v.to_json() for k, v in cards.items()}, indent=2))
    return 0


def _session(args: argparse.Namespace, run_id: str) -> RunnerSession:
    overrides = {'service_account': args.service_account} if args.service_account else {}
    if args.on_demand:
        overrides['provisioning'] = 'on_demand'
    cfg = RunnerConfig(**overrides)
    return RunnerSession(cfg, run_id=run_id, code_sha=_git_sha(), shell=SubprocessShell(), poll_seconds=args.poll)


def cmd_smoke(args: argparse.Namespace) -> int:
    from arcforge.runner.bootstrap import Job

    image = None if args.host_only else pins.load_image().ref
    if not args.host_only and not image:
        print('no pinned image digest; run `python -m arcforge.runner image build` or pass --host-only')
        return 2
    job = Job(host_script=SMOKE_HOST, image=image, entrypoint='python' if image else None,
              argv=('-c', SMOKE_CONTAINER) if image else ())
    run_id = 'smoke-' + time.strftime('%Y%m%d%H%M%S', time.gmtime())
    ssh_tries: list[int] = []

    def on_poll(sess, inst, status):
        # A fresh instance-level SSH key takes a few polls to reach the guest agent: retry.
        if not args.ssh or len(ssh_tries) >= 4 or 0 in ssh_tries or not status or status.get('phase') == 'booting':
            return
        result = sess.shell.run(ssh_argv(sess.cfg, inst.name, inst.zone, 'echo iap-ssh-ok; uptime'), timeout=180)
        ssh_tries.append(result.returncode)
        print(f'iap ssh (try {len(ssh_tries)}): exit {result.returncode}: {(result.stdout or result.stderr).strip()[-200:]}')

    with _session(args, run_id) as session:
        result = session.run(job, on_poll=on_poll)
        _print_job_log(session)
        report = {'run_id': run_id, 'outcome': result.outcome, 'exit_code': result.exit_code, 'vm': session.vm_report()}
        if args.ssh:
            report['iap_ssh'] = 'ok' if 0 in ssh_tries else f'failed (exit codes {ssh_tries})'

    report['all_deleted'] = _confirm_gone(session.shell, session.cfg, run_id)
    print(json.dumps(report, indent=2))
    return 0 if result.ok and report['all_deleted'] else 1


def cmd_drill(args: argparse.Namespace) -> int:
    from arcforge.runner import drill

    image = pins.load_image().ref
    if not image:
        print('no pinned image digest; run `python -m arcforge.runner image build` first')
        return 2
    drill_id = 'drill-' + time.strftime('%Y%m%d%H%M%S', time.gmtime())
    with _session(args, drill_id) as session, tempfile.TemporaryDirectory() as tmp:
        report = drill.run_drill(session, image=image, drill_id=drill_id, steps=args.steps, kill_after=args.kill_after,
                                 step_seconds=args.step_seconds, workdir=Path(tmp))
        _print_job_log(session)
    report['all_deleted'] = _confirm_gone(session.shell, session.cfg, drill_id)
    print(json.dumps(report, indent=2))
    ok = report['byte_identical'] and len(report['instances']) >= 2 and report['all_deleted']
    return 0 if ok else 1


def cmd_image(args: argparse.Namespace) -> int:
    from arcforge.commands.version import commit
    from arcforge.runner import image

    sha = commit()
    if sha.endswith('-dirty') and not args.allow_dirty:
        print('the checkout has uncommitted changes; commit first (or pass --allow-dirty for a scratch image)')
        return 2
    pin = image.build(SubprocessShell(), RunnerConfig(), commit=sha, now_utc=utc_now(), sleep=time.sleep)
    if args.no_pin:
        print(json.dumps(vars(pin), indent=2))
    else:
        pins.write_image(pin)
        print(f'pinned {pin.ref} in {pins.IMAGE_FILE}')
    return 0


def cmd_base_image(_args: argparse.Namespace) -> int:
    from arcforge.runner import baseimage

    name = baseimage.build(SubprocessShell(), RunnerConfig(), code_sha=_git_sha(), date=time.strftime('%Y%m%d', time.gmtime()))
    print(f'built {name}; pin it as RunnerConfig.boot_image (boot_image_project = the runner project)')
    return 0


def cmd_iam(_args: argparse.Namespace) -> int:
    print('# Owner, once: create the runner service account and grant it exactly what a run needs.')
    for line in iam.setup_commands(RunnerConfig()):
        print(line)
    return 0


def ssh_argv(cfg: RunnerConfig, name: str, zone: str, command: str | None = None) -> list[str]:
    argv = ['gcloud', 'compute', 'ssh', name, f'--project={cfg.project}', f'--zone={zone}', '--tunnel-through-iap', '--quiet']
    return argv + ([f'--command={command}'] if command else [])


def cmd_ssh(args: argparse.Namespace) -> int:
    argv = ssh_argv(RunnerConfig(), args.name, args.zone, args.command)
    os.execvp(argv[0], argv)  # interactive: hand the terminal to gcloud
    return 0  # pragma: no cover


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog='python -m arcforge.runner', description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest='cmd', required=True)

    p = sub.add_parser('rates', help='print the actual spot and on-demand rates from the Billing Catalog')
    p.add_argument('--shape', default='g2-standard-8')
    p.set_defaults(func=cmd_rates)

    def vm_flags(p: argparse.ArgumentParser) -> None:
        p.add_argument('--service-account', help='override the runner service account (default: arcforge-runner@…)')
        p.add_argument('--on-demand', action='store_true', help='skip spot')
        p.add_argument('--poll', type=float, default=15.0, help='seconds between status polls')

    p = sub.add_parser('smoke', help='create a spot runner, run a trivial job (host + container), delete it')
    vm_flags(p)
    p.add_argument('--host-only', action='store_true', help='no container: host checks only')
    p.add_argument('--ssh', action='store_true', help='also run one command over IAP SSH while it runs')
    p.set_defaults(func=cmd_smoke)

    p = sub.add_parser('drill', help='the spot-preemption drill: delete the VM mid-stage, recreate, resume')
    vm_flags(p)
    p.add_argument('--steps', type=int, default=6)
    p.add_argument('--kill-after', type=int, default=2, help='delete the first VM once this many steps are cached')
    p.add_argument('--step-seconds', type=float, default=40.0)
    p.set_defaults(func=cmd_drill)

    p = sub.add_parser('image', help='build the runner container with Cloud Build and pin its digest')
    p.add_argument('action', choices=['build'])
    p.add_argument('--allow-dirty', action='store_true')
    p.add_argument('--no-pin', action='store_true', help='print the result instead of writing pinned/image.json')
    p.set_defaults(func=cmd_image)

    p = sub.add_parser('base-image', help='bake the runner boot image (DLVM + Docker + NVIDIA container toolkit)')
    p.add_argument('action', choices=['build'])
    p.set_defaults(func=cmd_base_image)

    p = sub.add_parser('iam', help="print the owner's one-time commands for the runner service account")
    p.set_defaults(func=cmd_iam)

    p = sub.add_parser('ssh', help='IAP SSH into a runner VM (debugging only)')
    p.add_argument('name')
    p.add_argument('--zone', required=True)
    p.add_argument('--command')
    p.set_defaults(func=cmd_ssh)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args) or 0)


if __name__ == '__main__':
    sys.exit(main())
