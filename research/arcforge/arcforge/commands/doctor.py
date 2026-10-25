"""`arcforge doctor` — preflight: gcloud, Vertex, Secret Manager, quota, bucket, image, mirror, age, uv."""

from __future__ import annotations

import argparse


def run(args: argparse.Namespace) -> int:
    from arcforge.runner import doctor
    from arcforge.runner.config import RunnerConfig
    from arcforge.runner.shell import SubprocessShell

    ctx = doctor.Context(shell=SubprocessShell(), cfg=RunnerConfig(project=args.project))
    checks = doctor.run_checks(ctx, cloud=not args.local)
    print(doctor.to_json(checks) if args.json else doctor.render(checks))
    return 1 if any(c.status == doctor.FAIL for c in checks) else 0


def register(subparsers) -> None:
    from arcforge.runner.config import PROJECT

    parser = subparsers.add_parser(
        'doctor',
        help='preflight checks before a launch (read-only)',
        description=(
            'Check that this machine and the project can launch a run: gcloud auth and project, '
            'Vertex AI access, the Secret Manager entries (presence only; values are never read), '
            'regional quota, the GCS bucket, the pinned container and boot image, the runner '
            'service account, IAP SSH, the model mirror, age and uv. Read-only: it creates and '
            'grants nothing, and prints the fix for anything missing. Exits 1 on any FAIL.'
        ),
    )
    parser.add_argument('--local', action='store_true', help='only the local tools (no cloud calls)')
    parser.add_argument('--json', action='store_true', help='machine-readable output (the Owner Desk reads this)')
    parser.add_argument('--project', default=PROJECT, help=f'GCP project (default: {PROJECT})')
    parser.set_defaults(func=run)
