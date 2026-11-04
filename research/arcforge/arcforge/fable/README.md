# Fable packets: the orchestrator handoff

Fable (`claude-fable-5-1`) judges RE-MEANING at both ends of the arc, and only through the
orchestrator: Claude Code workflow agents running on Fable. There is no API key, no Message
Batches, no server-side fallback. arcforge's side of the interface is this package:

| Call | Run | Packet kind | Role (`report.fable[].role`) |
| --- | --- | --- | --- |
| Gold audit #1, 60 queries x 12 candidates, during the R00 gate (A0: the unattended reference + gold gate) | R00 | `gold_audit` | `gold_audit_1` |
| PREREG sign-off, after `arcforge prereg lint --frozen` | R00 | `prereg_signoff` | `signoff` |
| Gold audit #2 | R10 / R10K | `gold_audit` | `gold_audit_2` |
| End review, pass 1: blind recomputation of every verdict | R10 / R10K | `blind_recompute` | `end_review` |
| End review, pass 2: mismatches and the write-up | R10 / R10K | `mismatch_review` | `end_review` |

Every call has the same shape: arcforge writes a content-addressed **packet**, the orchestrator
runs **one fresh agent** in the packet's isolated working directory, arcforge **checks** what the
agent wrote. A schema-invalid output or a refusal is retried **once**, in a fresh agent and a fresh
directory; a second failure **fails the stage closed**. Nothing ever stands in for Fable.

## The handoff, step by step

All commands run from `research/arcforge` as `uv run python -m arcforge.fable …` (standard library
plus jsonschema; no network). Each prints one JSON object on stdout.

### 1. arcforge packs

```bash
uv run python -m arcforge.fable pack gold-audit --pairs pairs.json --rubric rubric.md
uv run python -m arcforge.fable pack signoff --prereg PREREG.md --rules rules.yaml \
    --schema arcforge/schemas/arc-report-1.json --lint lint.json \
    --report runs/r00/report.json --verdicts runs/r00/verdicts.json --bench-card bench-card.md \
    --amendment-a0 prereg/amendments/PREREG-A0.json --witness witness-index.json \
    --model-choice prereg/model-choice-a0.json --contamination contamination.json \
    --provenance provenance.json --panel panel-summary.json --quarantine quarantine.json
uv run python -m arcforge.fable pack blind --prereg PREREG.md --rules rules.yaml \
    --verdicts runs/r00/verdicts.json runs/r01/verdicts.json … runs/r10/verdicts.json
uv run python -m arcforge.fable pack mismatch --prereg PREREG.md --rules rules.yaml \
    --writeup writeup.md --comparison comparison.json --reports runs/*/report.json
```

Output:

```json
{"packet_root": "~/.cache/arcforge/fable/prereg_signoff-r00-3f2a…", "packet_sha256": "3f2a…",
 "kind": "prereg_signoff", "role": "signoff", "repair_cycle": 0, "workdir": "…/attempt-1",
 "status": null}
```

The packet root defaults to `$ARCFORGE_FABLE_DIR`, else `~/.cache/arcforge/fable`, and is refused
inside a git work tree (an agent there could read the unstripped run files next to it). Packing is
idempotent: the same inputs give the same `packet_sha256` and the same directory, and nothing new
is opened.

### 2. The orchestrator runs a fresh Fable agent

- Model: Fable (`claude-fable-5-1`). Any other model's output is rejected at check time.
- A **new** session for every attempt; never resume an earlier one.
- Working directory: the printed `workdir`, and nothing else: restrict file access to it, no
  network. It holds exactly `packet.json`, `INSTRUCTIONS.md`, `output.schema.json` and `inputs/…`.
- Prompt (verbatim):

  > You are Fable. Your working directory holds one task packet. Read INSTRUCTIONS.md and do exactly
  > what it says, using only the files in this directory. Write your answer to output.json, valid
  > against output.schema.json, and write no other file. If you cannot or will not do the task,
  > write the refusal form that INSTRUCTIONS.md gives.

- When the agent stops, note its session id and the model id the harness reports for it.

### 3. arcforge checks

```bash
uv run python -m arcforge.fable check <packet_root> --session <agent session id> --model <reported model>
```

| Exit | `decision` | What happened | The orchestrator then |
| --- | --- | --- | --- |
| 0 | `accepted` | Valid, complete, from Fable, inputs untouched, status `ok`. Copied byte for byte to `<packet_root>/output.json`. | proceeds (step 4). |
| 10 | `retry` | Attempt 1 was invalid or refused. Its output moved to `rejected/`, its directory deleted; `workdir` is a fresh copy (`attempt-2`). | runs a **new** agent in the printed `workdir` (step 2), then checks again. |
| 20 | `failed_closed` | Attempt 2 failed too: `status` is `failed` (invalid) or `refused`; or a sign-off was refused (`refused`, at once). | stops this stage, or repairs a refused sign-off (below). |
| 30 | `failed_closed` | The third refusal of the sign-off: `status` is `halted`. | halts the arc at R00. |
| 1 | — | Not a packet, already final, unreadable input (message on stderr). | fixes the call; nothing was recorded. |
| 3 | — | jsonschema is missing: run under `uv run`. | — |

The JSON on stdout also carries `attempt`, `outcome` (`ok` / `invalid` / `refused`), `status` and
the `errors` that made an attempt invalid.

**Failing closed**, by kind:
- `prereg_signoff` (Amendment A0, repair or halt; there is no manual sign): a refusal is final for
  its packet at once (exit 20, `status: refused`; no fresh-agent retry). The orchestrator corrects
  exactly the defects Fable listed in `required_changes` and resubmits with the refusal and the
  diff, at most twice:
  `python -m arcforge.fable repair <refused packet_root> --diff fix.diff --rules rules.yaml …`
  (only the corrected inputs are given; the rest are carried over). The new packet holds every
  earlier refusal verbatim under `inputs/repair/` (publish them with the run). A refusal of the
  second repair is the third refusal: `check` exits 30 with `status: halted`, and the arc halts at
  R00. Two invalid outputs (`failed`) also stop the arc; nothing is substituted.
- `blind_recompute` / `mismatch_review`: the end review is missing, never replaced:
  `python -m arcforge.fable mark-missing <packet_root> --reason "…"`.
- `gold_audit`: the stage fails closed and no other model's labels stand in as gold. I1 then
  lacks its Gemini|Fable and Qwen|Fable Kendall pairs, so I1c is not computable and the run
  fails rather than compute I1 without them.

### 4. Record it in the run's report

```bash
uv run python -m arcforge.fable record <packet_root>
```

prints the run's `report.json` `fable[]` entry (arc-report/1 `$defs/FableCall`): role, kind,
`via: orchestrator`, `packet_sha256`, `output_sha256` (of the accepted output, else null),
`agent_session`, `model_reported`, `attempts`, `repair_cycle` and `refusals` (the sha256 of every
refusal so far, sign-off only), `status` (`ok`, `refused`, `failed`, `halted`, `missing`, or null
while pending) and, for the sign-off, `lint_ok`. Orchestrator
cost lines are `$0` cash with tokens logged (`cost.lines[].provider: orchestrator`).

## The two sequences

**R00** (the VM is already deleted; Fable never blocks it):
1. In the gate stage: pack `gold-audit` from S12r's gold-frame views (`audit_index` 1; every
   candidate's entity card is record-local), run, check, record. S13 merges `output.json`'s
   grades as Fable gold (precedence: corpus links and intent labels, then Fable gold, then
   adjudication, then the primary judge; reference grades never enter qrels).
2. In the tail, after I1, the power analysis, PREREG.md and `arcforge prereg freeze`:
   `arcforge prereg lint --frozen --rules rules.yaml --out lint.json`, then pack `signoff` (with
   the A0 records), run, check, record; repair at most twice on a refusal. Only an accepted
   sign-off lets PREREG, rules.yaml and the schema be hashed and witnessed (kind 'prereg').

**R10 / R10K**:
1. Gold audit #2 as above (`audit_index` 2).
2. Pack `blind` with the verdicts.json of **every run of the realized path** (r00 … r10/r10K, full
   files: arcforge strips them, validates each against `VerdictsDocBlind`, and refuses an
   incomplete path). Run, check.
3. Compare Fable's recomputation with the reported verdicts:
   `uv run python -m arcforge.fable compare <blind packet_root> --verdicts runs/*/verdicts.json --out comparison.json`.
4. Pack `mismatch` with comparison.json, the write-up and every report.json (galleries are separate
   artifacts and never included). Run, check, record both passes.
5. Publish the accepted mismatch `output.json` verbatim as `fable-end-review.json`. M6's exit:
   every mismatch is either absent or corrected in the write-up and listed there.

## What each packet holds and what a valid output is

| Kind | `inputs/` | `result` | Checked beyond the schema |
| --- | --- | --- | --- |
| `gold_audit` | `pairs.json` (`schemas/gold-pairs-1.json`), `rubric.md` | `grades[]`: `{query_id, candidate_id, grade 0-3, note}` | exactly one grade per pair, none invented |
| `prereg_signoff` | `PREREG.md`, `rules.yaml`, `arc-report-1.json`, `lint.json`, `r00/report.json`, `r00/verdicts.json`, `bench-card.md`, `PREREG-A0.json`, `witness-index.json`, `model-choice-a0.json`, `contamination.json`, `provenance.json`, `panel-summary.json`, `quarantine.json`, and on a resubmission `repair/` | `{decision, checks[19], required_changes, statement}` | every A0 check id exactly once; `ok` means `sign` with all checks true |
| `blind_recompute` | `PREREG.md`, `rules.yaml`, `verdicts/<run>.json` (stripped) | `runs[]` (statuses, verdict components, prediction_met, gates_summary, adoption) and `arc_summary` | every run, every rule per run, every row, every adoption decision, the arc_summary |
| `mismatch_review` | `comparison.json`, `writeup.md`, `reports/<run>.json`, `PREREG.md`, `rules.yaml` | `{mismatches[], writeup_findings[], statement}` | every mismatch id exactly once |

Every output is the envelope `{"schema": "arc-fable-output/1", "kind", "status": "ok" | "refused",
"reason", "result"}`; the per-kind schemas are in `schemas/output-*.json`, the agent's briefs in
`briefs/`. The blind pass strips exactly `contract.ids.STRIPPED_FIELDS` (every status, verdict
component and prediction_met, the whole gates_summary, arc_summary's final statuses and the adoption
choices) and keeps everything the rules read.

## On disk

```
<root>/<kind>-<run>-<sha12>/
  packet/        the canonical packet; packet.json is its manifest (sha256 = the packet id)
  attempt-N/     the agent's working directory (a copy of packet/, plus its output.json)
  rejected/      outputs of rejected attempts, out of the next agent's sight
  ledger.json    every attempt (session, model, output sha256, outcome, errors) and the status
  output.json    the accepted output, byte for byte
```
