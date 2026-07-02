# Major Release File Classification

Generated from current dirty source worktree. This file is a release safety audit, not a ship list by itself.

## Top-level dirty groups

- `public`: 179 entries — needs-review
- `pages`: 153 entries — needs-review
- `components`: 43 entries — needs-review
- `scripts`: 28 entries — needs-review
- `lib`: 18 entries — needs-review
- `tests`: 7 entries — needs-review
- `.npmrc`: 1 entries — needs-review
- `next.config.js`: 1 entries — needs-review
- `package.json`: 1 entries — needs-review
- `pnpm-lock.yaml`: 1 entries — needs-review
- `tailwind.config.js`: 1 entries — needs-review
- `tsconfig.json`: 1 entries — needs-review
- `.hermes`: 1 entries — internal-plan
- `BUN_MIGRATION.md`: 1 entries — hold
- `BUN_QUICKSTART.md`: 1 entries — hold
- `COMFY_VIDEO_RESOURCES.md`: 1 entries — hold
- `FILM_BRIDGE_E2E_REPORT.md`: 1 entries — hold
- `FILM_BRIDGE_QUICKSTART.md`: 1 entries — hold
- `"alex welcing`: 1 entries — needs-review
- `articles`: 1 entries — needs-review
- `bunfig.toml`: 1 entries — hold
- `config`: 1 entries — needs-review
- `content`: 1 entries — hold
- `hill-climb-output`: 1 entries — hold
- `pipeline-output`: 1 entries — hold
- `vitest.node.config.ts`: 1 entries — needs-review

## Release rule

- Ship only files intentionally copied into the clean release worktree.
- Hold local generation systems, film bridge, hill-climb/pipeline outputs, and unreviewed generated logs.
- Review every deletion before staging it in the release worktree.
