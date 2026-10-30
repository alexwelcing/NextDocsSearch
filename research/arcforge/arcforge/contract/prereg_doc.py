"""PREREG.pre.md and PREREG.md: the pre-registration document, rendered from rules.yaml.

Two files, one renderer:

- prereg/PREREG.pre.md (the template) is committed before S0 and hashed into the s0 witness entry
  together with rules.yaml (`s0_hashes()`). Its rule tables are generated from the rules template
  by `render_pre()`, so they cannot drift from it (a test asserts the committed file equals the
  render); its prose is the program's and Amendment A0's text, never anything read from results.
  Every number R00 measures is a `{{placeholder}}`.
- PREREG.md (the final document) is the template with its placeholders filled by the R00 tail
  (`fill()`): the MDEs, every tau = max(tau_floor, MDE_R00), the verdict-probability table, the
  I1 outcome (with the registered fallback and the R01 re-judge line when I1 fails), the hashes.
  `fill()` refuses an unknown placeholder or a placeholder left unfilled.

Standard library only (PyYAML is reached only through rules.load_rules).
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from arcforge.contract.ids import JUDGE_FREE_GLOSS
from arcforge.contract.rules import MDE_KEYS, Rules

ARCFORGE_ROOT = Path(__file__).resolve().parents[2]
PREREG_DIR = ARCFORGE_ROOT / 'prereg'
PRE_PATH = PREREG_DIR / 'PREREG.pre.md'
A0_PATH = PREREG_DIR / 'amendments' / 'PREREG-A0.json'
PLACEHOLDER = re.compile(r'\{\{([A-Za-z0-9_.\[\]-]+)\}\}')


class PreregError(ValueError):
    """A commitment mismatch, invalid freeze or invalid placeholder value."""


def sha256_file(path: str | Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def s0_hashes(
    rules_path: str | Path | None = None,
    pre_path: str | Path | None = None,
    schema_path: str | Path | None = None,
) -> dict[str, str]:
    """What the s0 commitment records of the contract (A0 VJ-2): rules.yaml and PREREG.pre.md,
    plus the schema they are read against."""
    from arcforge.contract.rules import TEMPLATE_PATH
    from arcforge.contract.schema import REPORT_SCHEMA_PATH

    return {
        'rules_sha256': sha256_file(rules_path or TEMPLATE_PATH),
        'prereg_pre_sha256': sha256_file(pre_path or PRE_PATH),
        'schema_sha256': sha256_file(schema_path or REPORT_SCHEMA_PATH),
    }


def verify_s0_hashes(expected: Mapping[str, Any], **paths: Any) -> None:
    """Compare all three files with the previously witnessed s0 hashes, never new hashes.

    Accept s0_hashes()'s flat mapping or `prereg hash --json`'s {path, sha256} entries.
    The caller is responsible for authenticating this commitment against the public witness;
    this function checks local bytes, not Rekor/OpenTimestamps signatures or chronology.
    """
    actual = s0_hashes(**paths)
    if not isinstance(expected, Mapping):
        raise PreregError('s0 hashes must be a mapping with all three contract hashes')
    for key, digest in actual.items():
        wanted = expected.get(key)
        if isinstance(wanted, Mapping):
            wanted = wanted.get('sha256')
        if not isinstance(wanted, str) or not re.fullmatch(r'[0-9a-f]{64}', wanted):
            raise PreregError(f's0 commitment has no valid {key}')
        if wanted != digest:
            raise PreregError(f's0 commitment mismatch for {key}: expected {wanted}, got {digest}')


# ---- placeholders -----------------------------------------------------------------------------


def placeholders(text: str) -> list[str]:
    return list(dict.fromkeys(PLACEHOLDER.findall(text)))


def expected_placeholders(rules: Rules) -> list[str]:
    names = [f'mde_r00.{k}' for k in MDE_KEYS]
    names += [f'tau.{cid}' for cid, spec in rules.rows.items() if spec.tau_floor is not None]
    names += list(STATIC_PLACEHOLDERS)
    return names


STATIC_PLACEHOLDERS: dict[str, str] = {
    'a0_sha256': 'sha256 of prereg/amendments/PREREG-A0.json (amendments[0])',
    'rules_sha256': 'sha256 of the frozen rules.yaml',
    'schema_sha256': 'sha256 of schemas/arc-report-1.json (schema 1.1)',
    'code_sha': 'the git SHA of the s0 commitment',
    'witness_a0': 'the Rekor logIndex of the a0 entry',
    'witness_s0': 'the Rekor logIndex of the s0 entry',
    'witness_r00_sets': 'the Rekor logIndex of the r00-sets entry',
    'power_table': 'the R00 verdict-probability table (tail/power.json)',
    'i1_r00': 'the R00 I1 outcome, its components, and the registered fallback when it fails',
    'contamination_r00': 'the R00 contamination outcome (the six pre-cutoff records)',
    'quarantine_r00': 'the quarantined person clusters (Q1-Q3), from S12q',
    'panel_r00': "the proxy reader's realized variant and its R00 sets",
}


def values_for(rules: Rules, extra: Mapping[str, Any]) -> dict[str, str]:
    """Placeholder values for a FROZEN rules file: the MDEs and taus, plus `extra`."""
    if not rules.frozen:
        raise PreregError('PREREG.md is filled from the frozen rules (arcforge prereg freeze)')
    if not isinstance(extra, Mapping):
        raise PreregError('R00 values must be a mapping')
    values = {f'mde_r00.{k}': _num(v) for k, v in rules.mde_r00.items()}
    for cid, spec in rules.rows.items():
        if spec.tau_floor is not None:
            values[f'tau.{cid}'] = _num(rules.tau(spec))
    from arcforge.contract.schema import REPORT_SCHEMA_PATH

    values['rules_sha256'] = rules.sha256
    values['schema_sha256'] = sha256_file(REPORT_SCHEMA_PATH)
    overridden = sorted(set(extra) & set(values))
    if overridden:
        raise PreregError(f'R00 values cannot override contract-derived placeholders: {overridden}')
    unknown = sorted(set(extra) - set(STATIC_PLACEHOLDERS))
    if unknown:
        raise PreregError(f'unknown R00 placeholders: {unknown}')
    for key, value in extra.items():
        values[key] = str(value)
    return values


def _num(value: float | None) -> str:
    if value is None:
        raise PreregError('a frozen rules file has every MDE and tau')
    # The registered value must round-trip; four decimal places can turn a small MDE into zero.
    return repr(float(value))


def fill(template: str, values: Mapping[str, str]) -> str:
    """PREREG.md from PREREG.pre.md: every placeholder filled, none unknown, none left."""
    wanted = set(placeholders(template))
    unknown = sorted(set(values) - wanted)
    if unknown:
        raise PreregError(f'values for placeholders the template does not have: {unknown}')
    missing = sorted(wanted - set(values))
    if missing:
        raise PreregError(f'placeholders left unfilled: {missing}')
    final = PLACEHOLDER.sub(lambda m: values[m.group(1)], template)
    if placeholders(final):
        raise PreregError(
            f'placeholders left unfilled in substituted values: {placeholders(final)}'
        )
    return final


# ---- the template -----------------------------------------------------------------------------


def _scope(rules: Rules, rule_id: str) -> str:
    return '; '.join(c.describe() for c in rules.rule(rule_id).applies_to)


def _row_table(rules: Rules, rule_id: str) -> list[str]:
    rule = rules.rule(rule_id)
    if not rule.rows:
        return []
    lines = [
        '| Row | Kind | arm_a − arm_b | Stratum | Metric | tau | Decides |',
        '| --- | --- | --- | --- | --- | --- | --- |',
    ]
    for alias, cid in rule.rows.items():
        spec = rules.rows[cid]
        arms = f'`{spec.arm_a}` − `{spec.arm_b}`' if spec.arm_b else f'`{spec.arm_a}`'
        if spec.tau_floor is not None:
            tau = f'max({spec.tau_floor:g}, MDE_{spec.mde}) = {{{{tau.{cid}}}}}' if spec.mde else (
                f'{spec.tau_floor:g} = {{{{tau.{cid}}}}}'
            )
        else:
            tau = '—'
        expr = spec.fires or spec.passes or spec.prediction
        decides = (
            f'fires: `{spec.fires.source}`'
            if spec.fires
            else f'passes: `{spec.passes.source}`'
            if spec.passes
            else f'prediction: `{expr.source}`'
            if expr
            else 'reported'
        )
        registered = spec.registered
        if registered is False:
            decides += ' (exploratory)'
        elif not isinstance(registered, bool):
            decides += f' (registered while `{registered.source}`)'
        shared = '' if spec.hypothesis == rule_id else f' (= {cid})'
        lines.append(
            f'| {alias}{shared} | {spec.kind} | {arms} | {spec.stratum} | {spec.metric} | {tau} | {decides} |'
        )
    return lines


def _rule_block(rules: Rules, rule_id: str) -> list[str]:
    rule = rules.rule(rule_id)
    lines = [f'### {rule.id}: {rule.title}', '', f'- In scope: {_scope(rules, rule_id)}.']
    for name, expr in rule.lets.items():
        lines.append(f'- Let `{name}` := `{expr.source}`.')
    for status, expr in rule.outcomes:
        lines.append(f'- **{status}** if `{expr.source}`.')
    if rule.else_status:
        lines.append(f'- Otherwise **{rule.else_status}**.')
    if rule.status:
        lines.append(f'- Status: **{rule.status}** (reported).')
    for key, expr in rule.gates_summary.items():
        lines.append(f'- gates_summary.{key} := `{expr.source}`.')
    if rule.provisional is not None:
        lines.append(f'- Provisional while `{rule.provisional.source}`.')
    if rule.adopt is not None:
        params = ', '.join(f'{k} {v}' for k, v in rule.adopt.items() if k != 'method')
        lines.append(f'- Adoption method `{rule.adopt["method"]}` ({params}).')
    if rule.arc_fallback:
        lines.append(f'- If its slot never frees, its arc status is {rule.arc_fallback}\'s.')
    table = _row_table(rules, rule_id)
    if table:
        lines += ['', *table]
    return [*lines, '']


def _branch_lines(rules: Rules) -> list[str]:
    lines = ['| Path | Runs (run/branch) | Proxy-vault reads |', '| --- | --- | --- |']
    for name, seq in rules.branch_table.items():
        runs = ' '.join(f'{r}/{b}' for r, b in seq)
        reads = [r for r, b in seq if rules.in_scope('proxy_vault.read', r, b)]
        lines.append(
            f'| {name} | {runs} | {rules.proxy_vault_read_budget[name]}: {", ".join(reads)} |'
        )
    lines.append('')
    for d in rules.decisions:
        routes = '; '.join(f'{s} → {", ".join(p)}' for s, p in d.outcomes.items())
        lines.append(f'- After {d.after}/{d.branch}, {d.rule} decides: {routes}.')
    return lines


H_RULES = ('FUT', 'H1.F', 'H1', 'H2', 'H3', 'H3a', 'H3b', 'H4', 'H5', 'H6', 'H7', 'H7.report', 'K1')
GATE_RULES = ('I1', 'I2', 'I3', 'I4', 'I5', 'I6')
OTHER_RULES = ('proxy_vault.read', 'adoption.default', 'adoption.squeeze', 'signoff')


def render_pre(rules: Rules) -> str:
    """The PREREG.pre.md template for `rules` (the unfrozen rules template)."""
    assert set(H_RULES + GATE_RULES + OTHER_RULES) == {r.id for r in rules.rules}
    out: list[str] = [HEADER, '']
    out += [SECTION_REGISTERED, '']
    out += [SECTION_STRATA, '']
    out += ['## 3. Hypotheses and their rows', '', HYPOTHESES_INTRO, '']
    for rule_id in H_RULES:
        out += _rule_block(rules, rule_id)
    out += ['## 4. Instrument gates', '', GATES_INTRO, '']
    for rule_id in GATE_RULES:
        out += _rule_block(rules, rule_id)
    out += ['## 5. The proxy vault, adoption and the R00 sign-off', '', VAULT_INTRO, '']
    for rule_id in OTHER_RULES:
        out += _rule_block(rules, rule_id)
    out += ['## 6. Branch table, decisions and read budget', '', BRANCH_INTRO, '']
    out += [*_branch_lines(rules), '', KILL_LADDER, '']
    out += [SECTION_TAUS, '']
    out += [
        '| MDE | R00 value |',
        '| --- | --- |',
        *(f'| MDE_{k} | {{{{mde_r00.{k}}}}} |' for k in MDE_KEYS),
        '',
        '{{power_table}}',
        '',
    ]
    out += [SECTION_EXCLUSIONS, '']
    out += [SECTION_AMENDMENTS, '']
    out += [SECTION_FAMILY, '']
    out += [SECTION_DEFAULTS, '']
    out += [SECTION_R00, '']
    text = '\n'.join(out).rstrip('\n') + '\n'
    found = set(placeholders(text))
    expected = set(expected_placeholders(rules))
    if found != expected:
        raise PreregError(
            f'template placeholders differ: extra {sorted(found - expected)}, '
            f'missing {sorted(expected - found)}'
        )
    return text


HEADER = f"""# PREREG — RE-MEANING: The Calibration Runs (model arc-lexeme)

**PREREG.pre.md: the pre-sign-off template.** Its sha256 and the sha256 of rules.yaml are
committed in the s0 witness entry before S0. At the end of R00 the tail fills every
double-braced placeholder with the number R00 measured (and nothing else), writes PREREG.md, freezes
rules.yaml (only `mde_r00` changes), lints it, and hands both to Fable for the sign-off. Only a
signed PREREG.md is hashed and witnessed (kind 'prereg').

- Design record: the approved research program (Fable's sign-off) AS AMENDED BY PREREG Amendment
  A0 (zero owner time), which is amendments[0]: prereg/amendments/PREREG-A0.json, sha256
  {{{{a0_sha256}}}}, the earliest entry under configs/witness.pub (Rekor logIndex
  {{{{witness_a0}}}}).
- The contract: rules.yaml (sha256 {{{{rules_sha256}}}}, frozen at R00) and
  schemas/arc-report-1.json, schema 1.1 (sha256 {{{{schema_sha256}}}}), at code {{{{code_sha}}}}
  (s0 entry {{{{witness_s0}}}}).
- Every rule below is generated from rules.yaml; where this text and rules.yaml differ, rules.yaml
  governs. Every verdict is a pure function of verdicts.json under rules.yaml, recomputed by
  `arcforge verdict` from the per-query score files.
- Nothing in this document was written from results: its prose is the program's and A0's text,
  and its numbers are the R00 placeholders."""

SECTION_REGISTERED = """## 1. What is registered

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
  reads production traffic: `arcforge prereg lint` proves each (A0 rule 12)."""

SECTION_STRATA = f"""## 2. Strata, and what the A and B links are

- Counts (unchanged by A0): A 177 (165 + 12 FRONTIER), B 181 (171), 336 main-line A+B queries;
  C_open 30 and frontier C 8 from the proxy reader; 70 fresh queries per proxy-vault read.
- A and B are corpus-intrinsic links written in owner-directed Claude Code sessions and merged by
  the owner: 177 'For <rationale>, see …' sentences and the link lists of 181 source records. Git
  blame at the S0 commit gives every item's provenance (owner, Claude session, Copilot agent or
  other), published per item. They are a silver standard, like anchor-text qrels, not human
  relevance judgments; the arc has no human relevance anchor of any kind.
- The rows scored on them (H1 c1, c3 and g1, FUT, H4 c1, K1 k1) are judge-free. {JUDGE_FREE_GLOSS}
- Two descriptive rows that no rule reads: B restricted to the 6 owner-authored source records,
  and B restricted to the 5 Copilot-authored ones.
- C is written by a proxy reader, allenai/OLMo-2-1124-13B base (or its registered M1 fallback),
  from short seeded exposures after mechanical forgetting; CE = C_open + E. D, E, F, T and the
  generated FRONTIER items are model-written, as approved. POST_S0 may be empty (n_queries 0);
  no rule reads it alone."""

HYPOTHESES_INTRO = """Every claim, row, tau or tau floor, falsifier and Holm family below is
the approved program's, unchanged by A0, except that H3 now needs I6 (A0 rule 4) and every rule
that read vault.sign reads proxy_vault.sign (a rename). The H1 headline adds '...and agrees in
sign with a just-in-time proxy-reader vault'. The D entity family has three Adaezes."""

GATES_INTRO = """I1 is rebuilt by A0 (rule 1): I1.pass := I1a and I1b and I1c and I1d. I1a is
known-answer probes mixed into the ordinary judging groups (40 per type by HMAC('probe'); a type
with fewer than 20 is reported, not gated). I1b is a three-family reference (claude-opus-5-5 as an
orchestrator agent, OLMo-2-1124-13B-Instruct, phi-4) on 150 pairs; the reference grade is the
family median, and reliability is gated across families, never across replicas. I1c is unchanged.
I1d bounds the Google-lineage judge/teacher bias: delta between dense-only and BM25-only pairs,
ref = mean(Claude, phi-4). Report-only: Kendall against the author links over the 8 systems,
author_disagrees_fable, the null false-positive rate and the IPW kappa. Qrel precedence: the
corpus-intrinsic A/B targets and the reader-intent labels are fixed by construction; then Fable
gold > gemini-3-flash adjudication > primary; reference grades never enter qrels. I5's reference
is 'ref150+fable150' (disjoint samples; Claude appears in both). I6 (new) gates H3's labels."""

VAULT_INTRO = """The vault is the just-in-time proxy vault (A0 rule 5, vault_custody VJ-3 to VJ-8):
at each registered read point, on the run's VM after adoption, `arcforge vault freeze` refuses an
out-of-scope, over-budget or repeated read before doing anything, hashes every fold champion and
the report, and witnesses the freeze in Rekor; the first drand round at least 180 s later seeds a
fresh 70-query proxy-reader set, which is pooled, judged, scored and published at once. While
I1_pass_effective is false the registered value uses intent-only qrels. A sticky
proxy_vault.compromised flag (a second freeze, an out-of-scope or over-budget freeze, a wrong
beacon round, a set that does not rederive, a missing read_k, an a0 or s0 entry that is not the
earliest of its kind) makes that sign and every later one 'unavailable', which no rule treats as
+1. No person holds a key, and separation of duties is not available: the protection is temporal.
Rules read only the rounded aggregate before R10."""

BRANCH_INTRO = """run.branch is 'N' for r00-r04 on every path and for r05-r07 on the N path; r05K
is 'S'. A branch name applies from the first run after the decision that creates it."""

KILL_LADDER = """Kill ladder, pre-registered for every branch:
- N-F, falsified at R06: R07K, R08, R09K, R10K.
- S-F, falsified at R05K: R06 runs H5 as planned, then R07K, R08, R09K, R10K. H4 is never in
  scope, so its arc status is NOT_TESTED.
- S-C-F, not falsified at R05K and then falsified at R07: R08K, R09K, R10K. R08K combines R08's
  teacher measurement with R07K's K1 and a registered H7, and drops the squeeze grid.
- On any falsification the dense-fusion flag goes off, the arc keeps M0's BM25F (BM25-lexeme
  replaces it only if K1 is SUPPORTED), H1's slot passes to the contingent H7, and the kill
  branch's registered headline is K1."""

SECTION_TAUS = """## 7. Minimum detectable effects and taus

The MDEs are fixed at R00 from the variance of the baseline paired difference B8(W1) − B2 only
(never from a treatment effect): the minimum effect detectable at 80% power and alpha 0.05 per
stratum (AB, D, CE, G), from the per-cluster variance under the two-way pigeonhole bootstrap. The
proxy-vault MDE scales C_open's variance to n = 70, and the frontier MDE is analytic, from AB's
per-cluster SD scaled to n = 22 (no withheld record is indexed at R00); both are report-only.
`arcforge prereg freeze` writes them into rules.yaml, and the freeze diff touches mde_r00 only.
Every tau above is max(tau_floor, MDE_R00)."""

SECTION_EXCLUSIONS = """## 8. Exclusions

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
  rule reads them. The Workers AI baselines run as the same open weights locally, disclosed."""

SECTION_AMENDMENTS = """## 9. Amendment procedure

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
  verdict."""

SECTION_FAMILY = """## 10. Families and shared lineage (A0 rule 10, leakage control 2)

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
orchestrator, never from any C query."""

SECTION_DEFAULTS = """## 11. Defaults in place of owner actions (A0)

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
  in the public repository."""

SECTION_R00 = """## 12. What R00 measured (filled by the tail)

- The proxy reader: {{panel_r00}}
- I1 at R00: {{i1_r00}}
- The r00-sets entry (C_open, frontier and quarantine sha256s): Rekor logIndex
  {{witness_r00_sets}}."""
