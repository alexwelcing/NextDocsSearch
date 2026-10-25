# The runner: boot image, container, and how a run reaches the L4

Every run is one self-deleting VM in `witching-606c6` / `us-central1`:

| Layer | What | Pinned in |
| --- | --- | --- |
| Machine | g2-standard-8 + 1x L4, SPOT, zones a → b → c, on-demand fallback, `--max-run-duration=3h` with termination action DELETE, no external address | `arcforge/runner/config.py` |
| Boot image | Google's Deep Learning VM (NVIDIA driver 580) + Docker + the NVIDIA container toolkit, baked once | `RunnerConfig.boot_image` (built by `baseimage.py`) |
| Container | CUDA 13.0 user space + uv + arcforge with the `gpu` and `cloud` extras from `uv.lock` | `arcforge/runner/pinned/image.json` (digest) |
| Models | HF revisions mirrored to `gs://witching-606c6-arcforge/models/<owner>/<name>@<sha>/` | `arcforge/runner/pinned/models.json` |

The VM runs its job from its startup-script (`arcforge/runner/bootstrap.sh`) and reports through
`gs://witching-606c6-arcforge/runs/<run>/vm/<instance>/{status,heartbeat}.json` and `job.log`; the
laptop never holds an SSH session for it. IAP SSH (`python -m arcforge.runner ssh NAME --zone Z`)
is for debugging only.

## Why the boot image is baked

A runner has no external address, so it reaches Google APIs (GCS, Artifact Registry, Vertex AI,
Secret Manager) through Private Google Access and nothing else — no apt, no PyPI, no Hub. The
Deep Learning VM image has the driver but not Docker, so `python -m arcforge.runner base-image
build` bakes Docker and the toolkit in once, from a short-lived builder VM, at the versions pinned
in `baseimage.py`. Rebuild it when Google retires the source image or a pin moves, then update
`RunnerConfig.boot_image` in the same PR.

## CUDA must match the driver

`uv.lock` pins torch 2.14.1 with CUDA 13.0 wheels; driver 580 supports CUDA up to 13.0; the
container base is `nvidia/cuda:13.0.3-base-ubuntu24.04`. `tests/runner/test_container.py` fails if
these drift apart. torch ships its own CUDA libraries, so the base only needs the user-space shim
and the NVIDIA runtime environment.

## Operator commands

Run from `research/arcforge` on the forge VM (inside us-central1). All of them are standard
library only, so a plain `python3 -m …` works as well as `uv run`.

```bash
uv run arcforge doctor                           # preflight; read-only
uv run arcforge mirror [KEY…] [--check|--list]   # HF → GCS model mirror
uv run arcforge gc [--dry-run]                   # delete arc-run-* VMs older than 3 h
python -m arcforge.runner rates                  # actual spot / on-demand rates (Billing Catalog)
python -m arcforge.runner image build            # Cloud Build → Artifact Registry → pinned digest
python -m arcforge.runner base-image build       # bake the boot image
python -m arcforge.runner smoke [--ssh]          # create a spot runner, run host + container checks, delete it
python -m arcforge.runner drill                  # the spot-preemption drill (M1 exit criterion)
python -m arcforge.runner iam                    # the owner's one-time service-account commands
```

## The runner's identity

Runners run as `arcforge-runner@witching-606c6.iam.gserviceaccount.com` with Vertex AI User on
the project, Secret Manager accessor on `hf-write-token` and `cf-workers-ai-token` only,
object admin on the arcforge bucket and reader on the arcforge Artifact Registry repository.
Granting roles is the owner's step (`python -m arcforge.runner iam` prints it; `arcforge doctor`
checks it).
