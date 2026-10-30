# The verdict contract

`arc-report/1` is what every run emits: `report.json`, and `verdicts.json` (= `report.verdicts_doc`,
under 25 KB). `schemas/arc-report-1.json` is the JSON Schema; `rules.yaml` holds every registered
rule. Both are hashed into PREREG at R00, and every later run names their sha256
(`run.rules_sha256`, `run.schema_sha256`).

## Amendment A0 (schema 1.1)

The contract is the approved program's as amended by PREREG Amendment A0 (zero owner time):

- **Schema 1.1** (`schema_version: '1.1'` in report.json and verdicts.json): no owner-sourced field
  is left (`kappa_qw_owner`, `n_owner_pairs`, `owner_overrides_fable`, `collisions.owner_checked`,
  the manual sign `owner_signed`); `gates.I1` is the A0 form (`probes`, `ref`, `kendall`, `diff`,
  `author_kendall`, `author_disagrees_fable`, `null_fp_rate`, `components`); `gates.I6` is new;
  `vault` is now `proxy_vault` (the just-in-time proxy vault, with `basis`, the sticky
  `compromised` and `reads[]`); new blocks `panel`, `provenance`, `contamination`, `witness`,
  `claude_plan_tokens` and `ship` (`production_branch_touched` is always false); `fable[]` gains
  `repair_cycle` and `refusals` and the status `halted`; cost lines name the M2 stage ids.
- **rules.yaml**: I1.pass := I1a and I1b and I1c and I1d with the A0 thresholds (probes >= 0.90
  per gated type; kappa_qw(primary, family median) >= 0.6 and ordinal alpha >= 0.5; Kendall CI
  lower bound >= 0.6 per judge pair; ci95_hi(delta) <= 0.30); I5's reference is
  'ref150+fable150'; I6 (label reliability) applies exactly where H3 does and H3 can be neither
  supported nor falsified unless it passes; `vault.read` is renamed `proxy_vault.read` and every
  `vault.sign` read is `proxy_vault.sign`; the sign-off carries the A0 preconditions. The
  judge-free gloss stands verbatim in the rule comments (`ids.JUDGE_FREE_GLOSS`).
- **The verdict function** also enforces the proxy vault's invariants: a compromised read has
  sign 'unavailable' (and only then), and the registered value's `basis` is 'intent_only' exactly
  when I1_pass_effective is false.
- **The lint** adds: no rule reads an owner field (and the schema defines none); no published
  reader output enters a training or selection input (`isolation.py`, over the stage registry's
  edges and each stage's declared `reader_outputs` / `consumes`); no rule reads per-query
  proxy-vault values, and no row is scored on a vault set, before R10; no registered row reads
  production traffic; no row is scored on POST_S0 alone.
- **PREREG.pre.md** (`prereg/PREREG.pre.md`) is rendered from the rules template by
  `arcforge prereg render --pre` (a test keeps the committed file equal to the render) and is
  hashed with rules.yaml into the s0 commitment (`prereg_doc.s0_hashes()`). The R00 tail fills its
  placeholders into PREREG.md (`arcforge prereg render --values`); `arcforge prereg freeze`
  refuses a frozen copy whose diff against the template touches anything but `mde_r00`.

## s0 integrity and the R00 commands

Before S0, retain the output of `arcforge prereg hash --json` as `s0-hashes.json` in the s0
witness payload. At R00, supply those original hashes to both commands:

```sh
arcforge prereg freeze --s0-hashes s0-hashes.json --mde-json tail/mde.json --out prereg/rules.yaml
arcforge prereg render --s0-hashes s0-hashes.json --rules prereg/rules.yaml --values tail/values.json --out prereg/PREREG.md
arcforge prereg lint --frozen --rules prereg/rules.yaml
```

Both commands verify the rules **template**, PREREG.pre.md and report schema against the s0
hashes. A custom registered template uses `freeze --rules`, `render --registered-rules`, and
the corresponding `--prereg-pre` / `--template` path. Final rendering also checks the frozen
rules against that template: only the six numeric MDE scalar tokens may differ, with comments,
spacing and line endings preserved. MDEs and taus retain their numeric precision in PREREG.md.
`values.json` supplies the non-rule R00 observations and witness metadata; it must not contain
`mde_r00.*`, `tau.*`, `rules_sha256` or `schema_sha256`. The renderer derives those values.

The JSON may be the flat `prereg_doc.s0_hashes()` mapping or the full CLI hash output. Its
authenticity must come from the original public witness. Comparing local bytes with a newly
regenerated JSON file does not establish a prior commitment. This change adds local verification;
the X2 witness stage and Rekor/OpenTimestamps verification are not implemented in this checkout.

Reader isolation is a static check of the supplied registry, with trusted output declarations
and the registered S7←S6b screening exception. Missing registry imports fail lint. The legacy
live registry lacks P1 and S6b, so template lint reports incomplete coverage and `--frozen` fails
until the M2 reader runtime is registered. A passing synthetic-graph test does not verify the
runtime's screening implementation. See [the independent PR #212 review](../../reviews/PR212-independent-review.md)
for the traced dependencies, regressions and research decisions still needed.

## The pieces

- **rules.yaml** (template): every rule — FUT, H1.F, H1–H7, H7.report, K1, I1–I6,
  proxy_vault.read, adoption.default, adoption.squeeze, signoff — with
  `applies_to: [{runs, branches}]`, its rows, and
  its outcomes as expressions (`c1.ci_hi_raw < 0.02 or FIRES(g1)`). The file's header explains how
  to read it; it also carries the PREREG branch table, the decisions that fork it, the vault-read
  budget per path (`proxy_vault_read_budget`), the statistics settings and `mde_r00` (null until
  R00 freezes it).
- **The verdict function** (`verdicts.evaluate`): a pure function of the rows, gates_inputs,
  proxy_vault, run.id and run.branch. Out of scope a rule is NOT_APPLICABLE and reads nothing; in scope every
  field it reads is resolved first, and a null makes it NOT_COMPUTABLE, which fails the run and is
  never written as a verdict.
- **The row statistics** (`stats.py`, `build.py`): each row recomputed from its per-query score file
  (`schemas/arc-scores-1.json`) — the two-way pigeonhole bootstrap, the record-clustered ratio
  bootstrap, the refit-pooled P@100 bootstrap, paired randomization p-values and Holm.
- **`arcforge verdict rNN`** (`check.py`): recompute and diff; any mismatch fails.
- **`arcforge prereg lint`** (`lint.py`): expands every applies_to over the branch table and proves
  each in-scope rule computable against the schema and the run plan (`produces.yaml`).

## Producing verdicts.json (the S13 stage)

Write each row's score file into the run directory, then build the document from an inputs object:

```python
from arcforge.contract.build import build_verdicts
from arcforge.contract.rules import load_rules
from arcforge.contract.verdicts import dumps_doc

rules = load_rules('prereg/rules.yaml')  # the frozen, hashed copy
inputs = {
    'schema': 'arc-verdicts/1',
    'run': {'id': 'r06', 'branch': 'N', 'h1_provisional': None, 'prereg_sha256': '…', 'rules_sha256': rules.sha256},
    'proxy_vault': {'read_this_run': True, 'read_index': 2, 'hybrid_minus_b2_ndcg10': 0.03, 'sign': 1,
                    'basis': 'judged', 'compromised': False},
    'gates_inputs': {'I1': None, 'I1_prior_pass': True, 'I2': None, 'I3': {...}, 'I4': {'flip_rate': 0.02},
                     'I5': None, 'I6': None},
    'adoption': [{'fold': 1, 'rule': 'default', 'arms': [{'arm_id': 'arm:constraint', 'gain_lfo': 0.02,
                  'guard_ok': True, 'control': False, 'bundle_raw': None}, …]}, …],
    'signoff_inputs': None,  # R00 only
    'rows': [{'comparison_id': 'H1.c1', 'scores_file': 'scores/H1.c1.json', 'nested': True, 'proxy_vault_read': False}, …],
}
outcome = build_verdicts(rules, inputs, run_dir, history=None)  # history: earlier verdicts.json at R10/R10K
if not outcome.ok:
    raise SystemExit('\n'.join(outcome.problems()))  # NOT_COMPUTABLE or a contract error fails the run
(run_dir / 'verdicts.json').write_text(dumps_doc(outcome.doc))
```

Every other row field comes from rules.yaml, the score file or the Holm family. `outcome.derived`
holds the report fields the rules decide (`remeaning.label`, `gates.I1.pass`,
`gates.I2.prediction_met`, `gates.I5.prediction_met`, `gates.I6.pass`); `arcforge verdict` checks report.json
against them. `synth.py` writes complete synthetic runs and is the reference for the report around
the verdicts.

## Extensions to the program's text

The program's report_schema is the source; the schema adds what its own rules need:
- `gates_inputs` also carries I2 (`inflation_ratio`), I3 (the four shortcut masses), I5
  (`kappa_drop`) and I6 (`fleiss_kappa`, `placebo_rerate`, `random_rerate`), so every rule's
  inputs are in verdicts.json, as the blind pass requires; I1's are the A0 projection of
  `gates.I1` (`check.project_i1`).
- verdicts.json carries the adoption decisions' inputs (`adoption[]`: arms with `gain_lfo`,
  `guard_ok`, `control`, `bundle_raw`) and the R00 sign-off preconditions (`signoff_inputs`), so
  adoption.default, adoption.squeeze and signoff are recomputable from it too; report.adoption's
  arms gain `control` and `bundle_raw`.
- The blind pass also strips `prediction_met` and the adoption choices (`chosen_arm`, `adopted`).
- `report.fable` is a list of calls (R00 and R10 each make more than one).
- `rows[].stratum` may name a non-query pool: `POOL.remeaning` (H3), `POOL.lexicon` (H3b's b1),
  `POOL.trace` (H7); `density.proposals_md_sha256` is null when the optional S13b did not run.
