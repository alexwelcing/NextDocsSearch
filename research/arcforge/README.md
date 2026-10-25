# arcforge

The run pipeline behind **RE-MEANING: The Calibration Runs** — a pre-registered research arc
that builds **arc-lexeme**, a corpus-native *static* embedding model (token lookup + pooling, no
transformer at query time) for the alexwelcing.com archive, and tests whether a lexicon mined
from an odd, self-referential corpus beats BM25 and generic embedders on the author's own
relevance judgments.

- One run = one command, about $20 or less, about 1–2 hours on a self-deleting spot L4.
- Ten runs form the arc; each changes one thing and is tied to a pre-registered hypothesis.
- Production never depends on the experiment: the site ships full-text BM25F first
  (`lib/retrieval`), and the static model only ever runs fused with it, behind a flag set by
  the registered verdicts.

The design record lives outside the repo for now (`/Volumes/Forge/plans/research-program-final.json`
on the operator's machine); `PREREG.md` is written and hashed at R00.

## Layout and ownership

Commands are discovered from `arcforge/commands/*.py` (each module exposes
`register(subparsers)`), so workstreams add files instead of editing a shared list.

| Path | Owns |
| --- | --- |
| `arcforge/cli.py`, `arcforge/commands/{plan,run,verify,diff,bench}.py`, `arcforge/core/` | runtime: config, stage DAG, content-addressed cache, budget guard, price table |
| `arcforge/contract/`, `arcforge/commands/{verdict,prereg}.py` | the verdict contract: `arc-report-1` schema, `rules.yaml`, verdict function, PREREG lint |
| `arcforge/runner/`, `arcforge/commands/{doctor,gc,mirror}.py`, `container/` | runner VM lifecycle, container, model mirror, billing |
| `arcforge/owner/`, `arcforge/vault/`, `arcforge/commands/{owner,vault}.py` | the Owner Desk (stdlib-only local page) and the age vault |
| `arcforge/models/`, `../../lib/archive/lexemeEmbed.ts` | model serving, tokenizer, embedder, TS/Python parity |
| `arcforge/fable/` | the orchestrator packet interface for Fable's audits |

## Running

```bash
cd research/arcforge
uv run arcforge --help
uv run --extra dev pytest
```

The Owner Desk and vault are stdlib-only so they also run with a plain `python3 -m arcforge.cli`.
