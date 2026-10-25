"""The runner: one self-deleting spot L4 VM per run, in witching-606c6 / us-central1.

`execute_remote(spec)` is the entry point arcforge/core/executor.py calls for `arcforge run
--executor vm` (contract arc-vm-request/1; see remote.py).

Modules (all standard library; Google Cloud is reached through the gcloud CLI):
- config     RunnerConfig — the `compute:` block of a run config, defaulting to the program's
             g2-standard-8 + 1x L4, SPOT, zones a → b → c, on-demand fallback, 3 h ceiling
- lifecycle  create (zone × provisioning ladder) / describe / delete / operations of one VM
- bootstrap  the VM's startup-script: pulls the pinned container by digest, runs the Job,
             reports status through GCS, and deletes (or powers off) the VM on exit
- session    RunnerSession — runs one Job to completion: polls, recreates after a preemption
             (spot once more, then on-demand), deletes everything in its exit trap, books cost
- remote     execute_remote, the runtime's VM executor hook
- billing    actual SKU rates from the Cloud Billing Catalog API; per-instance booking
- gc         the janitor behind `arcforge gc`
- mirror     HF → GCS model mirror behind `arcforge mirror`; pins.py holds the pinned revisions
- doctor     the preflight behind `arcforge doctor`
- iam        the runner service account's roles, as owner commands
- image      Cloud Build of container/Dockerfile, pinning the digest
- baseimage  the runner boot image: Deep Learning VM + Docker + the NVIDIA container toolkit
- drill      the spot-preemption drill (M1 exit criterion)

`python -m arcforge.runner --help` lists the operator commands (rates, smoke, drill, image,
base-image, iam, ssh) that exercise these against the real project.
"""

from __future__ import annotations

from typing import Any


def execute_remote(spec: dict[str, Any]) -> dict[str, Any]:
    """Run the VM part of a run on a runner VM; see arcforge.runner.remote."""
    from arcforge.runner.remote import execute_remote as run

    return run(spec)
