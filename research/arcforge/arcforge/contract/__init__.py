"""The verdict contract of RE-MEANING: arc-report/1, rules.yaml, the verdict function, the lint.

- ids.py        closed vocabularies (run ids, branches, rule ids, statuses), mirrored from the schema
- rules.yaml    the registered rules (template), every one with applies_to {runs, branches}
- rules.py      loads and validates rules.yaml; scope; tau = max(tau_floor, mde_r00)
- expr.py       the safe expression language the rules are written in (static reads + evaluation)
- branches.py   the PREREG branch table: paths, decisions, the next run
- stats.py      row statistics from per-query score files (pigeonhole bootstrap, Holm, ...)
- verdicts.py   the verdict function: NOT_APPLICABLE out of scope, NOT_COMPUTABLE on in-scope nulls
- build.py      verdicts.json from a run's inputs and score files
- check.py      `arcforge verdict`: recompute and fail on any mismatch
- lint.py       `arcforge prereg lint`: applies_to expanded over the branch table, computability
- produces.yaml the run plan: what each (run, branch) produces non-null (the lint's other side)
- schema.py     arc-report-1.json loading, validation, field lookup
- synth.py      synthetic runs for tests and fixtures

Everything imports only the standard library at module level; PyYAML and jsonschema are imported
where they are needed.
"""
