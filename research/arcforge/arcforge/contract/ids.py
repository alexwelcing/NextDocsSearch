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

# Every rule in rules.yaml, in the order verdicts.json lists them.
RULE_IDS: tuple[str, ...] = (
    'FUT', 'H1.F', 'H1', 'H2', 'H3', 'H3a', 'H3b', 'H4', 'H5', 'H6', 'H7', 'H7.report', 'K1',
    'I1', 'I2', 'I3', 'I4', 'I5', 'vault.read', 'adoption.default', 'adoption.squeeze', 'signoff',
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
GATE_SUMMARY_KEYS: tuple[str, ...] = ('I1_pass', 'I1_pass_effective', 'I4_pass', 'futility_fired')

VERDICTS_SCHEMA = 'arc-verdicts/1'
REPORT_SCHEMA = 'arc-report/1'
SCORES_SCHEMA = 'arc-scores/1'
RULES_SCHEMA = 'arc-rules/1'
PRODUCES_SCHEMA = 'arc-produces/1'

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
