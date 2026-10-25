"""Closed vocabularies of arc-report/1.

They mirror the enums in schemas/arc-report-1.json; tests/contract/test_schema.py asserts that
each tuple equals the schema's enum, so the Python side and the JSON Schema cannot drift apart.
"""

from __future__ import annotations

RUN_IDS: tuple[str, ...] = (
    'r00', 'r01', 'r02', 'r03', 'r04', 'r05', 'r05K', 'r06', 'r07', 'r07K',
    'r08', 'r08K', 'r09', 'r09K', 'r10', 'r10K',
)  # fmt: skip

# run.branch takes exactly these values (run-07's variants are branch 'N' plus h1_provisional).
BRANCHES: tuple[str, ...] = ('N', 'N-F', 'S', 'S-F', 'S-C', 'S-C-F')

# Every rule in rules.yaml, in the order verdicts.json lists them. Amendment A0 adds I6 (label
# reliability for H3) and renames vault.read to proxy_vault.read (a rename only).
RULE_IDS: tuple[str, ...] = (
    'FUT', 'H1.F', 'H1', 'H2', 'H3', 'H3a', 'H3b', 'H4', 'H5', 'H6', 'H7', 'H7.report', 'K1',
    'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'proxy_vault.read', 'adoption.default',
    'adoption.squeeze', 'signoff',
)  # fmt: skip

NOT_APPLICABLE = 'NOT_APPLICABLE'
# NOT_COMPUTABLE is never a verdict: an in-scope rule that reads a null fails the run. It is
# deliberately absent from STATUSES and from the schema's status enum.
NOT_COMPUTABLE = 'NOT_COMPUTABLE'
# NOT_TESTED is arc-level only (arc_summary at R10/R10K).
NOT_TESTED = 'NOT_TESTED'

STATUSES: tuple[str, ...] = (
    'SUPPORTED', 'FUSION_ONLY', 'FALSIFIED', 'INCONCLUSIVE', 'NOT_FALSIFIED', 'REPORTED',
    'FIRED', 'NOT_FIRED', 'PASS', 'FAIL', 'DONE', NOT_APPLICABLE,
)  # fmt: skip
ARC_STATUSES: tuple[str, ...] = (*STATUSES, NOT_TESTED)

H1_PROVISIONAL: tuple[str, ...] = (
    'SUPPORTED', 'FUSION_ONLY', 'INCONCLUSIVE', 'FALSIFIED', 'NOT_FALSIFIED',
)  # fmt: skip

COMPONENTS: tuple[str, ...] = ('PASS', 'FAIL', 'FIRES', 'CLEAR', 'REPORTED')
ROW_KINDS: tuple[str, ...] = ('superiority', 'guard', 'bound', 'ratio', 'report')
UNITS: tuple[str, ...] = ('fraction', 'ratio', 'rho')

# How a row's numbers are recomputed from its per-query score file (see contract/stats.py).
ESTIMATORS: tuple[str, ...] = ('pigeonhole', 'cluster_ratio', 'refit_pooled')

# gates_summary keys; each is produced by exactly one rule's `gates_summary` block.
GATE_SUMMARY_KEYS: tuple[str, ...] = (
    'I1_pass', 'I1_pass_effective', 'I4_pass', 'I6_pass', 'futility_fired',
)  # fmt: skip

VERDICTS_SCHEMA = 'arc-verdicts/1'
REPORT_SCHEMA = 'arc-report/1'
# arc-report/1 revision 1.1 = Amendment A0 (zero owner time). Both report.json and verdicts.json
# carry it as `schema_version`; the JSON Schema accepts no other value.
SCHEMA_VERSION = '1.1'
SCORES_SCHEMA = 'arc-scores/1'
RULES_SCHEMA = 'arc-rules/1'
PRODUCES_SCHEMA = 'arc-produces/1'

# The proxy vault's registered aggregate: the only proxy_vault fields a rule may read before R10
# (A0 rule 5, VJ-6). Per-query vault values are public from each read on, but no rule reads them
# until the confirmatory runs.
PROXY_VAULT_AGGREGATE: tuple[str, ...] = (
    'read_this_run', 'read_index', 'hybrid_minus_b2_ndcg10', 'sign', 'basis', 'compromised',
)  # fmt: skip
CONFIRMATORY_RUNS: tuple[str, ...] = ('r10', 'r10K')

# The I1 probe types (A0 rule 1, I1a) and what each must be graded: P1 verbatim >= 2,
# P2 entity-distinct <= 1, P3 era-disjoint <= 1, P4 negation <= 1, P5 coinage-direct >= 2.
PROBE_TYPES: tuple[str, ...] = ('P1', 'P2', 'P3', 'P4', 'P5')
PROBE_EXPECT: dict[str, str] = {'P1': 'ge2', 'P2': 'le1', 'P3': 'le1', 'P4': 'le1', 'P5': 'ge2'}

# Fields Amendment A0 removed because their source was the owner (owner labels, the owner's
# person-map checks, the manual sign). The lint fails if any rule reads one, or if the schema
# still defines one (as a property name or, for owner_signed, as an enum value).
OWNER_FIELDS: tuple[str, ...] = (
    'kappa_qw_owner', 'n_owner_pairs', 'owner_overrides_fable', 'owner_checked', 'owner_signed',
)  # fmt: skip
# Fields of the withdrawn owner-held age vault (A0 VJ-0): no seal, no key, no pre-written set.
WITHDRAWN_VAULT_FIELDS: tuple[str, ...] = (
    'vault_sealed', 'sealed_sha256', 'queries_commitment_sha256',
)  # fmt: skip

# The judge-free gloss, verbatim (A0 replacements[0]; Fable's sentence). PREREG and the rule
# comments carry exactly this text wherever they say what judge-free means.
JUDGE_FREE_GLOSS = (
    'judge-free: no pipeline judge produced or graded them and they predate the arc; the family '
    'that wrote them, Claude, also appears as Fable and as one of three reference families; no '
    'system under test is a Claude model.'
)

# Fields the blind pass removes (report_schema, BLIND PASS; review 3, required change 2). The
# first four are the program's list; prediction_met, adoption[].chosen_arm and adoption[].adopted
# are outcomes too, so they go as well. Everything a rule reads stays.
STRIPPED_FIELDS: tuple[str, ...] = (
    'hypotheses[].status',
    'rows[].verdict_component',
    'rows[].prediction_met',
    'gates_summary',
    'arc_summary[].final_status',
    'adoption[].chosen_arm',
    'adoption[].adopted',
)
