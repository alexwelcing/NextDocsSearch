# The verdict contract

`arc-report/1` is what every run emits: `report.json`, and `verdicts.json` (= `report.verdicts_doc`,
under 25 KB). `schemas/arc-report-1.json` is the JSON Schema; `rules.yaml` holds every registered
rule. Both are hashed into PREREG at R00, and every later run names their sha256
(`run.rules_sha256`, `run.schema_sha256`).

## The pieces

- **rules.yaml** (template): every rule — FUT, H1.F, H1–H7, H7.report, K1, I1–I5, vault.read,
  adoption.default, adoption.squeeze, signoff — with `applies_to: [{runs, branches}]`, its rows, and
  its outcomes as expressions (`c1.ci_hi_raw < 0.02 or FIRES(g1)`). The file's header explains how
  to read it; it also carries the PREREG branch table, the decisions that fork it, the vault-read
  budget per path, the statistics settings and `mde_r00` (null until R00 freezes it).
- **The verdict function** (`verdicts.evaluate`): a pure function of the rows, gates_inputs, vault,
  run.id and run.branch. Out of scope a rule is NOT_APPLICABLE and reads nothing; in scope every
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
    'vault': {'read_this_run': True, 'read_index': 2, 'hybrid_minus_b2_ndcg10': 0.03, 'sign': 1},
    'gates_inputs': {'I1': None, 'I1_prior_pass': True, 'I2': None, 'I3': {...}, 'I4': {'flip_rate': 0.02}, 'I5': None},
    'adoption': [{'fold': 1, 'rule': 'default', 'arms': [{'arm_id': 'arm:constraint', 'gain_lfo': 0.02,
                  'guard_ok': True, 'control': False, 'bundle_raw': None}, …]}, …],
    'signoff_inputs': None,  # R00 only
    'rows': [{'comparison_id': 'H1.c1', 'scores_file': 'scores/H1.c1.json', 'nested': True, 'vault_read': False}, …],
}
outcome = build_verdicts(rules, inputs, run_dir, history=None)  # history: earlier verdicts.json at R10/R10K
if not outcome.ok:
    raise SystemExit('\n'.join(outcome.problems()))  # NOT_COMPUTABLE or a contract error fails the run
(run_dir / 'verdicts.json').write_text(dumps_doc(outcome.doc))
```

Every other row field comes from rules.yaml, the score file or the Holm family. `outcome.derived`
holds the report fields the rules decide (`remeaning.label`, `gates.I1.pass`,
`gates.I2.prediction_met`, `gates.I5.prediction_met`); `arcforge verdict` checks report.json
against them. `synth.py` writes complete synthetic runs and is the reference for the report around
the verdicts.

## Extensions to the program's text

The program's report_schema is the source; the schema adds what its own rules need:
- `gates_inputs` also carries I2 (`inflation_ratio`), I3 (the four shortcut masses) and I5
  (`kappa_drop`), so every rule's inputs are in verdicts.json, as the blind pass requires.
- verdicts.json carries the adoption decisions' inputs (`adoption[]`: arms with `gain_lfo`,
  `guard_ok`, `control`, `bundle_raw`) and the R00 sign-off preconditions (`signoff_inputs`), so
  adoption.default, adoption.squeeze and signoff are recomputable from it too; report.adoption's
  arms gain `control` and `bundle_raw`.
- The blind pass also strips `prediction_met` and the adoption choices (`chosen_arm`, `adopted`).
- `report.fable` is a list of calls (R00 and R10 each make more than one).
- `rows[].stratum` may name a non-query pool: `POOL.remeaning` (H3), `POOL.lexicon` (H3b's b1),
  `POOL.trace` (H7); `density.proposals_md_sha256` is null when the optional S13b did not run.
