"""The runner's identity: a dedicated service account with only what a run needs.

arcforge-runner@witching-606c6 gets:
- roles/aiplatform.user on the project — Gemini judges and glosses on Vertex AI;
- roles/secretmanager.secretAccessor on the two secrets it reads, not on the project, so a
  runner can never read the project's other secrets;
- roles/storage.objectAdmin on the arcforge bucket only — cache, model mirror, run status;
- roles/artifactregistry.reader on the arcforge repository only — the container;
- roles/logging.logWriter on the project — guest-agent and startup-script logs.

Granting roles changes the project's IAM policy, which is the owner's call (and needs
resourcemanager.projects.setIamPolicy, which the automation accounts do not hold), so arcforge
never grants anything itself: `arcforge doctor` checks the bindings and prints these commands.
"""

from __future__ import annotations

from arcforge.runner.config import AR_REPOSITORY, RunnerConfig

SECRETS = ('hf-write-token', 'cf-workers-ai-token')
PROJECT_ROLES = ('roles/aiplatform.user', 'roles/logging.logWriter')
SECRET_ROLE = 'roles/secretmanager.secretAccessor'


def setup_commands(cfg: RunnerConfig) -> list[str]:
    sa = cfg.service_account
    member = f'serviceAccount:{sa}'
    name = sa.split('@', 1)[0]
    cmds = [
        f'gcloud iam service-accounts create {name} --project={cfg.project} '
        "--display-name='arcforge runner VM' --description='RE-MEANING runner VMs (arc-run-*)'",
    ]
    cmds += [
        f'gcloud projects add-iam-policy-binding {cfg.project} --member={member} --role={role} --condition=None'
        for role in PROJECT_ROLES
    ]
    cmds += [
        f'gcloud secrets add-iam-policy-binding {secret} --project={cfg.project} --member={member} --role={SECRET_ROLE}'
        for secret in SECRETS
    ]
    cmds += [
        f'gcloud storage buckets add-iam-policy-binding gs://{cfg.bucket} --member={member} --role=roles/storage.objectAdmin',
        f'gcloud artifacts repositories add-iam-policy-binding {AR_REPOSITORY} --project={cfg.project} '
        f'--location={cfg.region} --member={member} --role=roles/artifactregistry.reader',
    ]
    return cmds
