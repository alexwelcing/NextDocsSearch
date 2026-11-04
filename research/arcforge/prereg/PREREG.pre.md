# PREREG — RE-MEANING: The Calibration Runs (model arc-lexeme)

**PREREG.pre.md: the pre-sign-off template.** Its sha256 and the sha256 of rules.yaml are
committed in the s0 witness entry before S0. At the end of R00 the tail fills every
double-braced placeholder with the number R00 measured (and nothing else), writes PREREG.md, freezes
rules.yaml (only `mde_r00` changes), lints it, and hands both to Fable for the sign-off. Only a
signed PREREG.md is hashed and witnessed (kind 'prereg').

- Design record: the approved research program (Fable's sign-off) AS AMENDED BY PREREG Amendment
  A0 (zero owner time), which is amendments[0]: prereg/amendments/PREREG-A0.json, sha256
  {{a0_sha256}}, the earliest entry under configs/witness.pub (Rekor logIndex
  {{witness_a0}}).
- The contract: rules.yaml (sha256 {{rules_sha256}}, frozen at R00) and
  schemas/arc-report-1.json, schema 1.1 (sha256 {{schema_sha256}}), at code {{code_sha}}
  (s0 entry {{witness_s0}}).
- Every rule below is generated from rules.yaml; where this text and rules.yaml differ, rules.yaml
  governs. Every verdict is a pure function of verdicts.json under rules.yaml, recomputed by
  `arcforge verdict` from the per-query score files.
- Nothing in this document was written from results: its prose is the program's and A0's text,
  and its numbers are the R00 placeholders.

## 1. What is registered

- Ten runs (R00..R10, with the K variants of the kill ladder), each about $20 or less, one change
  each, each tied to a hypothesis. Plans are at most $17 per run ($20 at R00) under a $20 cap.
- Every rule carries applies_to {runs, branches}. In scope, a rule reads its fields and a null
  makes it NOT_COMPUTABLE, which fails the run and is never a verdict. Out of scope it reads
  nothing and is NOT_APPLICABLE. NOT_TESTED is arc-level only (H4 on S-F).
- PASS(x) := x.point >= x.tau and x.ci_lo_adj > 0 and x.point > x.seed_sd, where tau =
  max(tau_floor, MDE_R00). CIs are 95% two-way pigeonhole bootstraps over source and target
  records (10,000 resamples) on seed-averaged per-query scores; ratio rows use the
  record-clustered bootstrap, P@100 rows the 5-refit pooled bootstrap; p-values are paired
  randomization tests (10,000 sign flips); Holm step-down within each hypothesis's family.
- Strata of 40 queries or fewer are exploratory. The R04 interim look is futility-only.
- No rule reads an owner-sourced field, no published proxy-reader output enters a training or
  selection input, no rule reads per-query proxy-vault values before R10, and no registered row
  reads production traffic: `arcforge prereg lint` proves each (A0 rule 12).

## 2. Strata, and what the A and B links are

- Counts (unchanged by A0): A 177 (165 + 12 FRONTIER), B 181 (171), 336 main-line A+B queries;
  C_open 30 and frontier C 8 from the proxy reader; 70 fresh queries per proxy-vault read.
- A and B are corpus-intrinsic links written in owner-directed Claude Code sessions and merged by
  the owner: 177 'For <rationale>, see …' sentences and the link lists of 181 source records. Git
  blame at the S0 commit gives every item's provenance (owner, Claude session, Copilot agent or
  other), published per item. They are a silver standard, like anchor-text qrels, not human
  relevance judgments; the arc has no human relevance anchor of any kind.
- The rows scored on them (H1 c1, c3 and g1, FUT, H4 c1, K1 k1) are judge-free. judge-free: no pipeline judge produced or graded them and they predate the arc; the family that wrote them, Claude, also appears as Fable and as one of three reference families; no system under test is a Claude model.
- Two descriptive rows that no rule reads: B restricted to the 6 owner-authored source records,
  and B restricted to the 5 Copilot-authored ones.
- C is written by a proxy reader, allenai/OLMo-2-1124-13B base (or its registered M1 fallback),
  from short seeded exposures after mechanical forgetting; CE = C_open + E. D, E, F, T and the
  generated FRONTIER items are model-written, as approved. POST_S0 may be empty (n_queries 0);
  no rule reads it alone.

## 3. Hypotheses and their rows

Every claim, row, tau or tau floor, falsifier and Holm family below is
the approved program's, unchanged by A0, except that H3 now needs I6 (A0 rule 4) and every rule
that read vault.sign reads proxy_vault.sign (a rename). The H1 headline adds '...and agrees in
sign with a just-in-time proxy-reader vault'. The D entity family has three Adaezes.

### FUT: Futility look at R04 (futility-only, no alpha spent)

- In scope: {r04; N}.
- **FIRED** if `FIRES(c1) and proxy_vault.sign in (-1, 0)`.
- Otherwise **NOT_FIRED**.
- gates_summary.futility_fired := `status == 'FIRED'`.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | guard | `hyb(champ)` − `B2` | AB | mrr@10 | — | fires: `x.point < -0.02 and x.ci_hi_raw < 0` |

### H1.F: H1 kill-only checkpoint at R05K (it can falsify, never support)

- In scope: {r05K; S}.
- **FALSIFIED** if `c1.ci_hi_raw < 0.02 or FIRES(g1)`.
- Otherwise **NOT_FALSIFIED**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 (= H1.c1) | superiority | `hyb(champ)` − `B2` | AB | mrr@10 | max(0.04, MDE_AB) = {{tau.H1.c1}} | passes: `PASS(x)` |
| g1 (= H1.g1) | guard | `champ` − `B2` | AB | mrr@10 | — | fires: `x.point < -0.02 and x.ci_hi_raw < 0` |

### H1: The lexicon is the model (headline and kill criterion) ...and agrees in sign with a just-in-time proxy-reader vault

- In scope: {r06; N}; {r07; S-C}; {r10; N, S-C}; {r10K; N-F, S-F, S-C-F}.
- Let `F` := `[c1, c2, c3, c4] if gates_summary.I1_pass_effective else [c1, c3]`.
- **FALSIFIED** if `c1.ci_hi_raw < 0.02 or FIRES(g1)`.
- **SUPPORTED** if `PASS(F) and proxy_vault.sign == 1`.
- **FUSION_ONLY** if `PASS(c1) and (PASS(c2) or not gates_summary.I1_pass_effective) and proxy_vault.sign == 1`.
- Otherwise **INCONCLUSIVE**.
- Provisional while `run.id not in ("r10", "r10K")`.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | superiority | `hyb(champ)` − `B2` | AB | mrr@10 | max(0.04, MDE_AB) = {{tau.H1.c1}} | passes: `PASS(x)` |
| c2 | superiority | `hyb(champ)` − `B2` | D | ndcg@10 | max(0.04, MDE_D) = {{tau.H1.c2}} | passes: `PASS(x)` (registered while `gates_summary.I1_pass_effective`) |
| c3 | superiority | `hyb(champ)` − `hyb(B4)` | AB | mrr@10 | max(0.04, MDE_AB) = {{tau.H1.c3}} | passes: `PASS(x)` |
| c4 | superiority | `hyb(champ)` − `hyb(B4)` | D | ndcg@10 | max(0.04, MDE_D) = {{tau.H1.c4}} | passes: `PASS(x)` (registered while `gates_summary.I1_pass_effective`) |
| g1 | guard | `champ` − `B2` | AB | mrr@10 | — | fires: `x.point < -0.02 and x.ci_hi_raw < 0` |

### H2: Context-sum initialization

- In scope: {r02; N}; {r10; N, S-C}; {r10K; N-F, S-F, S-C-F}.
- **FALSIFIED** if `c3.ci_hi_raw < 0.02 or c2.ci_hi_raw < 0.03`.
- **SUPPORTED** if `PASS(c1, c2, c3)`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | superiority | `arm:context_sum_bias.untrained` − `arm:isolated.untrained` | AB | mrr@10 | max(0.05, MDE_AB) = {{tau.H2.c1}} | passes: `PASS(x)` |
| c2 | superiority | `arm:context_sum_bias.untrained` − `arm:isolated.untrained` | G | mrr | max(0.08, MDE_G) = {{tau.H2.c2}} | passes: `PASS(x)` |
| c3 | superiority | `arm:context_sum_bias` − `arm:isolated` | AB | mrr@10 | max(0.035, MDE_AB) = {{tau.H2.c3}} | passes: `PASS(x)` |

### H3: Re-meaning, primary (P@100 on the three-family 're-meant' label, gated by I6)

- In scope: {r03; N}; {r10; N, S-C}; {r10K; N-F, S-F, S-C-F}.
- **FALSIFIED** if `c1.ci_hi_raw < 0.05 and gates_summary.I6_pass`.
- **SUPPORTED** if `PASS(c1) and PASS(c2) and gates_summary.I6_pass`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | superiority | `arm:residualized` − `arm:logodds` | POOL.remeaning | p@100 | 0.15 = {{tau.H3.c1}} | passes: `PASS(x)` |
| c2 | superiority | `arm:residualized` − `arm:raw_displacement` | POOL.remeaning | p@100 | 0.1 = {{tau.H3.c2}} | passes: `PASS(x)` |

### H3a: Two-world prior x residualized displacement (arm 3 - arm 2)

- In scope: {r03; N}.
- **FALSIFIED** if `a1.ci_hi_raw < 0.02`.
- **SUPPORTED** if `PASS(a1)`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| a1 | superiority | `arm:two_world_x_disp` − `arm:two_world` | AB | mrr@10 | max(0.035, MDE_AB) = {{tau.H3a.a1}} | passes: `PASS(x)` |

### H3b: Whose map is it (stronger web teacher, all teachers under isolated init)

- In scope: {r08; N, N-F, S-F, S-C}; {r08K; S-C-F}.
- **FALSIFIED** if `BETTER(b2) or b1.ci_lo_raw > 0`.
- **SUPPORTED** if `b1.ci_hi_adj < 0 and not BETTER(b2)`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| b1 | superiority | `arm:teacher.qwen3-embedding-0.6b` − `arm:teacher.embeddinggemma-2.isolated` | POOL.lexicon | displacement@20 | — | passes: `x.ci_hi_adj < 0` |
| b2 | bound | `arm:teacher.qwen3-embedding-0.6b` − `arm:teacher.embeddinggemma-2.isolated` | AB | mrr@10 | — | fires: `BETTER(x)` |

### H4: The author's structure teaches, not pair volume

- In scope: {r05; N}; {r06; S-C}.
- **FALSIFIED** if `c1.ci_hi_raw < 0.02 or FIRES(g1)`.
- **SUPPORTED** if `PASS(c1)`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | superiority | `arm:real_edges` − `arm:rewired_edges` | AB | mrr@10 | max(0.04, MDE_AB) = {{tau.H4.c1}} | passes: `PASS(x)` |
| g1 | guard | `arm:real_edges` − `arm:rewired_edges` | CE | ndcg@10 | — | fires: `x.point <= -0.03 and x.ci_hi_raw < 0` |

### H5: Constraints, not voices

- In scope: {r06; N, S-F}; {r07; S-C}.
- **FALSIFIED** if `FIRES(b1) or c1.ci_hi_raw < 0.02`.
- **SUPPORTED** if `PASS(c1)`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | superiority | `arm:bank.constraint` − `arm:bank.generic` | CE | ndcg@10 | max(0.05, MDE_CE) = {{tau.H5.c1}} | passes: `PASS(x)` |
| b1 | bound | `arm:bank.persona` − `arm:bank.constraint` | CE | ndcg@10 | — | fires: `x.point >= 0.05 and x.ci_lo_raw > 0` |

### H6: Growth without retraining (simulated, by owner ruling 3)

- In scope: {r09; N, S-C}; {r09K; N-F, S-F, S-C-F}.
- **FALSIFIED** if `min(r1.point, r2.point) < 0.80 or r1.ci_hi_raw < 0.90 or r2.ci_hi_raw < 0.90`.
- **SUPPORTED** if `r1.point >= 0.90 and r2.point >= 0.90 and r1.ci_lo_raw >= 0.80 and r2.ci_lo_raw >= 0.80 and g1.point >= -0.01`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| r1 | ratio | `arm:hot_add` − `arm:retrain` | FRONTIER | mrr@10 | — | passes: `x.point >= 0.90 and x.ci_lo_raw >= 0.80` |
| r2 | ratio | `arm:hot_add` − `arm:retrain` | FRONTIER | ndcg@10 | — | passes: `x.point >= 0.90 and x.ci_lo_raw >= 0.80` |
| g1 | guard | `arm:retrain` − `arm:frozen` | V1_CORE | mrr@10 | — | fires: `x.point < -0.01` |

### H7: Static attributions are a faithful surrogate (registered only on the kill path)

- In scope: {r07K; N-F, S-F}; {r08K; S-C-F}.
- **FALSIFIED** if `c1.ci_hi_raw < 0`.
- **SUPPORTED** if `PASS(c1)`.
- Otherwise **INCONCLUSIVE**.
- If its slot never frees, its arc status is H7.report's.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | superiority | `arm:attribution.static` − `arm:attribution.ig` | POOL.trace | rho | 0.05 = {{tau.H7.c1}} | passes: `PASS(x)` |

### H7.report: Surrogate faithfulness, exploratory row on the normal path

- In scope: {r07; N}; {r08; S-C}.
- Status: **REPORTED** (reported).

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| c1 | report | `arm:attribution.static` − `arm:attribution.ig` | POOL.trace | rho | — | prediction: `x.point >= 0` (exploratory) |

### K1: The lexicon headline on the kill path (BM25-lexeme vs BM25-word)

- In scope: {r07K; N-F, S-F}; {r08K; S-C-F}; {r10K; N-F, S-F, S-C-F}.
- **FALSIFIED** if `k1.ci_hi_raw < 0.01`.
- **SUPPORTED** if `PASS(k1) and PASS(k2)`.
- Otherwise **INCONCLUSIVE**.

| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |
| --- | --- | --- | --- | --- | --- | --- |
| k1 | superiority | `B2` − `B2w` | AB | mrr@10 | max(0.03, MDE_AB) = {{tau.K1.k1}} | passes: `PASS(x)` |
| k2 | superiority | `B2` − `B2w` | D.coinage+entity | ndcg@10 | max(0.03, MDE_D) = {{tau.K1.k2}} | passes: `PASS(x)` |

## 4. Instrument gates

I1 is rebuilt by A0 (rule 1): I1.pass := I1a and I1b and I1c and I1d. I1a is
known-answer probes mixed into the ordinary judging groups (40 per type by HMAC('probe'); a type
with fewer than 20 is reported, not gated). I1b is a three-family reference (claude-opus-5-5 as an
orchestrator agent, OLMo-2-1124-13B-Instruct, phi-4) on 150 pairs; the reference grade is the
family median, and reliability is gated across families, never across replicas. I1c is unchanged.
I1d bounds the Google-lineage judge/teacher bias: delta between dense-only and BM25-only pairs,
ref = mean(Claude, phi-4). Report-only: Kendall against the author links over the 8 systems,
author_disagrees_fable, the null false-positive rate and the IPW kappa. Qrel precedence: the
corpus-intrinsic A/B targets and the reader-intent labels are fixed by construction; then Fable
gold > gemini-3-flash adjudication > primary; reference grades never enter qrels. I5's reference
is 'ref150+fable150' (disjoint samples; Claude appears in both). I6 (new) gates H3's labels.

### I1: Judges (A0 form - probes, three-family reference, Kendall CI, lineage differential)

- In scope: {r00, r01; N}; {r10; N, S-C}; {r10K; N-F, S-F, S-C-F}.
- Let `I1a` := `gates_inputs.I1.probe_min_acc >= 0.90`.
- Let `I1b` := `gates_inputs.I1.kappa_qw_median >= 0.6 and gates_inputs.I1.alpha_families >= 0.5`.
- Let `I1c` := `gates_inputs.I1.min_kendall_ci_lo >= 0.6`.
- Let `I1d` := `gates_inputs.I1.delta_ci_hi <= 0.30`.
- **PASS** if `I1a and I1b and I1c and I1d`.
- Otherwise **FAIL**.
- gates_summary.I1_pass := `status == 'PASS'`.
- gates_summary.I1_pass_effective := `status == 'PASS' if in_scope else gates_inputs.I1_prior_pass`.

### I2: Leakage triad (chunk-random vs record-disjoint vs C_open)

- In scope: {r04; N}.
- Status: **REPORTED** (reported).

### I3: Shortcut mass, student and teacher, chrome in and out

- In scope: {*; *}.
- Status: **REPORTED** (reported).

### I4: Drift panel (2k fixed pairs re-judged every run from R01)

- In scope: {r01, r02, r03, r04, r05, r05K, r06, r07, r07K, r08, r08K, r09, r09K, r10, r10K; *}.
- **PASS** if `gates_inputs.I4.flip_rate < 0.05`.
- Otherwise **FAIL**.
- gates_summary.I4_pass := `status == 'PASS'`.

### I5: Judge entanglement (keywords shown) and the Qwen self-preference check

- In scope: {r00; N}; {r10; N, S-C}; {r10K; N-F, S-F, S-C-F}.
- Status: **REPORTED** (reported).

### I6: Label reliability for H3 (three non-Claude families, paired contexts)

- In scope: {r03; N}; {r10; N, S-C}; {r10K; N-F, S-F, S-C-F}.
- **PASS** if `gates_inputs.I6.fleiss_kappa >= 0.6 and gates_inputs.I6.placebo_rerate - gates_inputs.I6.random_rerate <= 0.10`.
- Otherwise **FAIL**.
- gates_summary.I6_pass := `status == 'PASS'`.

## 5. The proxy vault, adoption and the R00 sign-off

The vault is the just-in-time proxy vault (A0 rule 5, vault_custody VJ-3 to VJ-8):
at each registered read point, on the run's VM after adoption, `arcforge vault freeze` refuses an
out-of-scope, over-budget or repeated read before doing anything, hashes every fold champion and
the report, and witnesses the freeze in Rekor; the first drand round at least 180 s later seeds a
fresh 70-query proxy-reader set, which is pooled, judged, scored and published at once. While
I1_pass_effective is false the registered value uses intent-only qrels. A sticky
proxy_vault.compromised flag (a second freeze, an out-of-scope or over-budget freeze, a wrong
beacon round, a set that does not rederive, a missing read_k, an a0 or s0 entry that is not the
earliest of its kind) makes that sign and every later one 'unavailable', which no rule treats as
+1. No person holds a key, and separation of duties is not available: the protection is temporal.
Rules read only the rounded aggregate before R10.

### proxy_vault.read: Just-in-time proxy-vault read at a registered read point

- In scope: {r04; N}; {r06; N}; {r07; S-C}; {r10; N, S-C}; {r10K; N-F, S-F, S-C-F}.
- **DONE** if `proxy_vault.read_this_run`.
- Otherwise **NOT_COMPUTABLE**.

### adoption.default: Nested cross-fitted adoption, default rule

- In scope: {r01, r02, r03, r04, r05, r06; N}; {r06; S-F, S-C}; {r07; S-C}.
- Status: **DONE** (reported).
- Adoption method `default` (min_gain 0.01).

### adoption.squeeze: Squeeze ship choice

- In scope: {r07; N}; {r08; S-C}.
- Status: **DONE** (reported).
- Adoption method `squeeze` (within 0.01, max_bundle_raw 4000000).

### signoff: R00 preconditions for Fable's PREREG sign-off (A0)

- In scope: {r00; N}.
- Let `judges_ok` := `gates_summary.I1_pass or signoff_inputs.i1_fallback_scheduled`.
- Let `witnessed` := `signoff_inputs.a0_witness_first and signoff_inputs.s0_witnessed and signoff_inputs.r00_sets_witnessed`.
- Let `a0_records` := `signoff_inputs.model_choice_present and signoff_inputs.contamination_present and signoff_inputs.precutoff_lookups_resolved and signoff_inputs.provenance_present`.
- Let `every_h_rule_not_applicable` := `OUT_OF_SCOPE('FUT', 'H1.F', 'H1', 'H2', 'H3', 'H3a', 'H3b', 'H4', 'H5', 'H6', 'H7', 'H7.report', 'K1')`.
- **PASS** if `signoff_inputs.lint_ok and signoff_inputs.report_valid and witnessed and a0_records and judges_ok and signoff_inputs.i2_scheduled and signoff_inputs.i4_scheduled and every_h_rule_not_applicable`.
- Otherwise **FAIL**.

## 6. Branch table, decisions and read budget

run.branch is 'N' for r00-r04 on every path and for r05-r07 on the N path; r05K
is 'S'. A branch name applies from the first run after the decision that creates it.

| Path | Runs (run/branch) | Proxy-vault reads |
| --- | --- | --- |
| N | r00/N r01/N r02/N r03/N r04/N r05/N r06/N r07/N r08/N r09/N r10/N | 3: r04, r06, r10 |
| N-F | r00/N r01/N r02/N r03/N r04/N r05/N r06/N r07K/N-F r08/N-F r09K/N-F r10K/N-F | 3: r04, r06, r10K |
| S-F | r00/N r01/N r02/N r03/N r04/N r05K/S r06/S-F r07K/S-F r08/S-F r09K/S-F r10K/S-F | 2: r04, r10K |
| S-C | r00/N r01/N r02/N r03/N r04/N r05K/S r06/S-C r07/S-C r08/S-C r09/S-C r10/S-C | 3: r04, r07, r10 |
| S-C-F | r00/N r01/N r02/N r03/N r04/N r05K/S r06/S-C r07/S-C r08K/S-C-F r09K/S-C-F r10K/S-C-F | 3: r04, r07, r10K |

- After r04/N, FUT decides: FIRED → S-F, S-C, S-C-F; NOT_FIRED → N, N-F.
- After r05K/S, H1.F decides: FALSIFIED → S-F; NOT_FALSIFIED → S-C, S-C-F.
- After r06/N, H1 decides: FALSIFIED → N-F; SUPPORTED → N; FUSION_ONLY → N; INCONCLUSIVE → N.
- After r07/S-C, H1 decides: FALSIFIED → S-C-F; SUPPORTED → S-C; FUSION_ONLY → S-C; INCONCLUSIVE → S-C.

Kill ladder, pre-registered for every branch:
- N-F, falsified at R06: R07K, R08, R09K, R10K.
- S-F, falsified at R05K: R06 runs H5 as planned, then R07K, R08, R09K, R10K. H4 is never in
  scope, so its arc status is NOT_TESTED.
- S-C-F, not falsified at R05K and then falsified at R07: R08K, R09K, R10K. R08K combines R08's
  teacher measurement with R07K's K1 and a registered H7, and drops the squeeze grid.
- On any falsification the dense-fusion flag goes off, the arc keeps M0's BM25F (BM25-lexeme
  replaces it only if K1 is SUPPORTED), H1's slot passes to the contingent H7, and the kill
  branch's registered headline is K1.

## 7. Minimum detectable effects and taus

The MDEs are fixed at R00 from the variance of the baseline paired difference B8(W1) − B2 only
(never from a treatment effect): the minimum effect detectable at 80% power and alpha 0.05 per
stratum (AB, D, CE, G), from the per-cluster variance under the two-way pigeonhole bootstrap. The
proxy-vault MDE scales C_open's variance to n = 70, and the frontier MDE is analytic, from AB's
per-cluster SD scaled to n = 22 (no withheld record is indexed at R00); both are report-only.
`arcforge prereg freeze` writes them into rules.yaml, and the freeze diff touches mde_r00 only.
Every tau above is max(tau_floor, MDE_R00).

| MDE | R00 value |
| --- | --- |
| MDE_AB | {{mde_r00.AB}} |
| MDE_D | {{mde_r00.D}} |
| MDE_CE | {{mde_r00.CE}} |
| MDE_G | {{mde_r00.G}} |
| MDE_vault | {{mde_r00.vault}} |
| MDE_frontier | {{mde_r00.frontier}} |

{{power_table}}

## 8. Exclusions

- The withheld frontier: the-echo-chamber and the-residue (10 records, 4.9% of the text) are out
  of S0⁻ and of every index until R09 / R09K; frontier readers never see core records and core
  readers never see withheld records.
- inheritance-03-the-gesture-archive is a ghost: A = 177; it is a phantom in F, with its
  nearest surviving slug reported but not scored.
- The person-map quarantine (A0 rule 6), decided before any pool is scored: clusters meeting Q1
  (same given name, surname edit distance <= 2), Q2 (a bare given name with no full name in its
  record but a full-named namesake in its series) or Q3 (a saga cluster that OLMo-2-13B-Instruct
  and phi-4 do not both call 'same') leave the registered rows: their D-entity items, and every E
  item whose target or misremembered detail involves the name, leave H1 c2/c4, H4 g1, H5 c1/b1
  and the adoption guards, and are reported as a separate QUARANTINE stratum. {{quarantine_r00}}
- The six records first committed before the proxy reader's stated cutoff (Dec. 2023): the 18
  infini-gram exact lookups are non-deferrable; until they land, those records are out of every
  exposure frame (reversible, recorded). Any exact hit removes that record from every exposure
  frame. {{contamination_r00}}
- No published proxy-vault set, or its qrels, ever enters training, tuning, adoption or
  screening-exemption inputs; a compromised vault set leaves R10's confirmatory pool.
- Without a Workers AI token the two unregistered B6.wai rows and their hyb() rows are null; no
  rule reads them. The Workers AI baselines run as the same open weights locally, disclosed.

## 9. Amendment procedure

- Amendments are numbered PREREG-A<n>, each written before the data it governs, hashed, and
  witnessed (Rekor plus OpenTimestamps), and listed in every later run's run.amendments.
- A0 is amendments[0]: registered on 2026-10-24, before S0, when no pool, judgment or score
  existed. Its sha256 is the earliest entry under configs/witness.pub.
- PREREG-A1 is pre-registered as I1's fallback: if I1 fails at R00, A1 is written from the REF
  'tune' 75 pairs; R01 re-judges, then re-checks I1 on the 'check' 75, R01's 30 fresh REF pairs,
  the re-judged probes and I1d recomputed; H1's family is {c1, c3} until I1 passes, and the
  proxy-vault sign uses intent-only qrels.
- After the R00 freeze no claim, row, tau, falsifier, Holm family, branch, read point or read
  budget changes. A forced model change is a reported amendment and restarts the drift series.
- Fable signs PREREG.md or refuses. There is no manual sign: after a refusal the orchestrator may
  correct exactly the defects Fable lists, at most twice, and resubmit with the refusal and the
  diff; refusals are published verbatim; a third refusal halts the arc at R00.
- An owner opt-in (the A0 list) affects vN rows and the product only, never a registered
  verdict.

## 10. Families and shared lineage (A0 rule 10, leakage control 2)

| Family | Role in the arc |
| --- | --- |
| OLMo (AI2) base | C_open, frontier C, every vault set |
| OLMo-Instruct, Microsoft phi-4 | reference grades, H3 labels (with Qwen), person-map calls, TRACE, drift |
| Claude (orchestrator agents, claude-opus-5-5) | one of three REF families in I1b/I1d only |
| Claude Code sessions | the corpus and the A/B links |
| GitHub Copilot coding agent (family unknown) | 15 relatedArticles items |
| OpenAI (no pipeline role; present in two graders' post-training data) | GPT-4 Turbo and GPT-4o generations, WildChat GPT-4 conversations and a GPT-4o preference judge for OLMo-Instruct; GPT-4o and GPT-4 Turbo responses and a GPT-4o judge for phi-4 |

Documented third-party lineage of the two open graders (disclosure, not a design change):
OLMo-Instruct's preference mix lists generations from Gemma 2 (Google), GPT-4 Turbo and GPT-4o
(OpenAI), Qwen2.5 (Qwen), Mistral, and Phi-3 (Microsoft, phi-4's family), and one SFT component
(Tulu 3 Persona Python) is documented as Claude output; phi-4's report documents GPT-4o in its
post-training data and no Google-model outputs, so I1d's ref stands.

Shared-family pairs: OLMo writes C and grades D/E but never C; Claude wrote the corpus and A/B,
is Fable, and is one REF family; Gemini writes the H5 few-shots and judges CE; OLMo-Instruct
shares lineage with Gemma, Qwen and Mistral through its preference mix. No system under test is a
Claude model. Leakage control 3 is also applied in reverse at each vault read; control 4 extends
to C's own intent record (a 20-character substring rule over the whole record); control 5: the
persona few-shots are written by gemini-3-flash from voice definitions written by the
orchestrator, never from any C query.

## 11. Defaults in place of owner actions (A0)

- Owner time is zero. The orchestrator launches each run when doctor is green and the previous
  run's verdicts.json is published, within the registered caps.
- Editorial items: TRACE, GLOSSARY RESONANCE, ALIAS PROMPT, LOST RECORD, the drift glyph (while
  H3 is SUPPORTED) and the query beam ship on arc/main at their measured gates; everything else
  is off. The self-reference test is NOT_APPLICABLE without the lab notebook; leakage control 7
  is inert; shipping fallbacks 8 and 9 are 'not shipped'.
- `arcforge ship` writes the flag on arc/main only; the production branch, Cloudflare settings
  and DNS are never touched (ship.production_branch_touched is always false).
- No record text is redistributed: packets are pointer-only and published notes are
  3-gram-masked. The host of record, with no HF write token, is research/arcforge/runs/<run-id>/
  in the public repository.

## 12. What R00 measured (filled by the tail)

- The proxy reader: {{panel_r00}}
- I1 at R00: {{i1_r00}}
- The r00-sets entry (C_open, frontier and quarantine sha256s): Rekor logIndex
  {{witness_r00_sets}}.
