"""The verdict function: verdicts.json as a pure function of rules.yaml and the run's inputs.

`evaluate(rules, doc)` takes a verdicts document whose statuses may be present or stripped (the
blind form Fable receives is enough) and returns the complete document: every rule exactly once,
in rules.yaml order, with

- NOT_APPLICABLE and no rows for a rule out of scope at (run.id, run.branch); it reads nothing,
  so its fields may be null or absent;
- for a rule in scope, every field it reads resolved first (see Rules.rule_reads). A null makes it
  NOT_COMPUTABLE, which is reported in `Outcome.not_computable`, fails the run and is never
  written as a verdict; otherwise its outcomes decide;
- gates_summary, every row's verdict_component and prediction_met, the adoption choices, and at
  R10/R10K the arc_summary over the realized branch path.

It also checks the document's own consistency (rows that rules.yaml defines and an in-scope rule
reads, row metadata and taus as rules.yaml fixes them, Holm ranks from p_raw, a proxy-vault read
only at a read point, a compromised read only with sign 'unavailable', the registered value's
basis as I1_pass_effective decides it). Those problems are `Outcome.errors`; like NOT_COMPUTABLE
they fail the run.
"""

from __future__ import annotations

import copy
import json
import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from arcforge.contract import stats
from arcforge.contract.branches import PathError, Step, follow
from arcforge.contract.expr import CONTEXT_NAMES, ExprError, NullRead, Read
from arcforge.contract.ids import (
    GATE_SUMMARY_KEYS,
    NOT_APPLICABLE,
    NOT_COMPUTABLE,
    NOT_TESTED,
    PROXY_VAULT_AGGREGATE,
    SCHEMA_VERSION,
    VERDICTS_SCHEMA,
)
from arcforge.contract.rules import Rule, Rules

ROW_FIELDS: tuple[str, ...] = (
    'comparison_id', 'hypothesis', 'registered', 'kind', 'arm_a', 'arm_b', 'stratum', 'metric',
    'unit', 'n_queries', 'n_clusters', 'point', 'ci_lo_raw', 'ci_hi_raw', 'holm_family', 'holm_m',
    'holm_rank', 'alpha_adj', 'ci_lo_adj', 'ci_hi_adj', 'p_raw', 'p_holm', 'tau', 'tau_floor',
    'mde_r00', 'seed_sd', 'n_seeds', 'nested', 'proxy_vault_read', 'provisional', 'prediction',
    'prediction_met', 'verdict_component', 'scores_file', 'scores_sha256',
)  # fmt: skip
GATE_INPUT_KEYS: tuple[str, ...] = ('I1', 'I1_prior_pass', 'I2', 'I3', 'I4', 'I5', 'I6')
FINAL_RUNS: tuple[str, ...] = ('r10', 'r10K')
TOLERANCE = 1e-9
# The blind pass (ids.STRIPPED_FIELDS): the whole gates_summary, and these keys of these lists.
STRIP_MAP: dict[str, tuple[str, ...]] = {
    'hypotheses': ('status',),
    'rows': ('verdict_component', 'prediction_met'),
    'arc_summary': ('final_status',),
    'adoption': ('chosen_arm', 'adopted'),
}
STRIP_WHOLE: tuple[str, ...] = ('gates_summary',)


@dataclass(frozen=True)
class NotComputable:
    """An in-scope rule that read a null: the run fails."""

    rule: str
    fields: tuple[str, ...]

    def __str__(self) -> str:
        return f'{self.rule}: NOT_COMPUTABLE (reads null {", ".join(self.fields)})'


@dataclass
class Outcome:
    doc: dict[str, Any]
    not_computable: list[NotComputable] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    derived: dict[str, Any] = field(default_factory=dict)  # report.json path -> value

    @property
    def ok(self) -> bool:
        return not self.not_computable and not self.errors

    def problems(self) -> list[str]:
        return [*self.errors, *(str(n) for n in self.not_computable)]


def close(a: Any, b: Any) -> bool:
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=0.0, abs_tol=TOLERANCE)
    return a == b


class Context:
    """Lazy, memoised evaluation of one verdicts document under one rules file."""

    def __init__(self, rules: Rules, doc: Mapping[str, Any]):
        self.rules = rules
        self.doc = doc
        run = doc.get('run') or {}
        self.run_id: str = run.get('id', '')
        self.branch: str = run.get('branch', '')
        self.rows: dict[str, Mapping[str, Any]] = {}
        for row in doc.get('rows') or []:
            if isinstance(row, Mapping) and isinstance(row.get('comparison_id'), str):
                self.rows.setdefault(row['comparison_id'], row)
        self._status: dict[str, str] = {}
        self._active: set[str] = set()
        self._summary: dict[str, bool | None] = {}
        self.not_computable: dict[str, NotComputable] = {}
        self.errors: list[str] = []
        self.adoption: dict[str, dict[int, str]] = {}  # rule id -> fold -> chosen arm

    # ---- resolution ------------------------------------------------------------------------

    def in_scope(self, rule_id: str) -> bool:
        return self.rules.in_scope(rule_id, self.run_id, self.branch)

    def get_row(self, comparison_id: str) -> Mapping[str, Any] | None:
        return self.rows.get(comparison_id)

    def get_doc(self, path: str) -> Any:
        head, _, rest = path.partition('.')
        if head == 'gates_summary':
            return self.summary(rest)
        node: Any = self.doc
        for part in path.split('.'):
            if not isinstance(node, Mapping):
                return None
            node = node.get(part)
        return node

    def resolve(self, read: Read) -> Any:
        if read.row is None:
            return self.get_doc(read.path)
        row = self.get_row(read.row)
        return None if row is None else row.get(read.path)

    def env(self, rule: Rule, **context: Any):
        return self.rules.rule_env(
            rule,
            get_row=self.get_row,
            get_doc=self.get_doc,
            rule_in_scope=self.in_scope,
            names=frozenset(CONTEXT_NAMES) if context else frozenset(),
            context=context,
        )

    def row_env(self, comparison_id: str):
        return self.rules.row_env(
            comparison_id, get_row=self.get_row, get_doc=self.get_doc, rule_in_scope=self.in_scope
        )

    # ---- statuses --------------------------------------------------------------------------

    def status(self, rule_id: str) -> str:
        if rule_id in self._status:
            return self._status[rule_id]
        if rule_id in self._active:
            self.errors.append(f'{rule_id}: its status depends on itself (a gates_summary cycle)')
            return NOT_COMPUTABLE
        self._active.add(rule_id)
        try:
            status = self._compute(self.rules.rule(rule_id))
        finally:
            self._active.discard(rule_id)
        self._status[rule_id] = status
        return status

    def _not_computable(self, rule_id: str, fields: Sequence[str]) -> str:
        self.not_computable[rule_id] = NotComputable(rule_id, tuple(fields))
        return NOT_COMPUTABLE

    def _compute(self, rule: Rule) -> str:
        if not self.in_scope(rule.id):
            return NOT_APPLICABLE
        try:
            reads = self.rules.rule_reads(rule)
        except ExprError as error:
            self.errors.append(f'{rule.id}: {error}')
            return NOT_COMPUTABLE
        nulls = sorted(str(r) for r in reads if self.resolve(r) is None)
        if nulls:
            return self._not_computable(rule.id, nulls)
        if rule.adopt is not None:
            missing = self._adopt(rule)
            if missing:
                return self._not_computable(rule.id, missing)
        if rule.status is not None:
            return rule.status
        env = self.env(rule)
        for status, expr in rule.outcomes:
            try:
                value = expr.evaluate(env)
            except NullRead as null:  # cannot happen after the pre-check; fail closed anyway
                return self._not_computable(rule.id, [str(null.read)])
            except ExprError as error:
                self.errors.append(f'{rule.id}: {error}')
                return NOT_COMPUTABLE
            if not isinstance(value, bool):
                self.errors.append(f'{rule.id}: {expr.source!r} gave {value!r}, not true/false')
                return NOT_COMPUTABLE
            if value:
                return self._terminal(rule, status, f'condition {expr.source!r} holds')
        assert rule.else_status is not None
        return self._terminal(rule, rule.else_status, 'no outcome condition holds')

    def _terminal(self, rule: Rule, status: str, why: str) -> str:
        if status == NOT_COMPUTABLE:
            # proxy_vault.read: in scope, a missing read is NOT_COMPUTABLE.
            return self._not_computable(rule.id, [why])
        return status

    def summary(self, key: str) -> bool | None:
        if key in self._summary:
            return self._summary[key]
        producer = next((r for r in self.rules.rules if key in r.gates_summary), None)
        value: bool | None = None
        if producer is not None:
            in_scope = self.in_scope(producer.id)
            status = self.status(producer.id) if in_scope else None
            if not (in_scope and status == NOT_COMPUTABLE):
                env = self.env(producer, status=status, in_scope=in_scope)
                try:
                    result = producer.gates_summary[key].evaluate(env)
                except NullRead:
                    result = None
                if result is not None and not isinstance(result, bool):
                    self.errors.append(f'{producer.id}: gates_summary.{key} gave {result!r}')
                    result = None
                value = result
        self._summary[key] = value
        return value

    def derived(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for rule in self.rules.rules:
            if not rule.derive or not self.in_scope(rule.id):
                continue
            status = self.status(rule.id)
            if status == NOT_COMPUTABLE:
                continue
            env = self.env(rule, status=status, in_scope=True)
            for path, expr in rule.derive.items():
                try:
                    out[path] = expr.evaluate(env)
                except NullRead:
                    out[path] = None
        return out

    def provisional(self, rule: Rule) -> bool:
        if rule.provisional is None:
            return False
        try:
            value = rule.provisional.evaluate(self.env(rule))
        except NullRead:
            return False
        return value is True

    # ---- rows ------------------------------------------------------------------------------

    def registered(self, comparison_id: str) -> bool | None:
        spec = self.rules.rows[comparison_id]
        if isinstance(spec.registered, bool):
            return spec.registered
        try:
            value = spec.registered.evaluate(self.row_env(comparison_id))
        except NullRead:
            return None
        return value if isinstance(value, bool) else None

    def in_holm(self, comparison_id: str) -> bool | None:
        registered = self.registered(comparison_id)
        return None if registered is None else self.rules.rows[comparison_id].holm and registered

    def component(self, comparison_id: str) -> str | None:
        spec = self.rules.rows[comparison_id]
        registered = self.registered(comparison_id)
        if spec.kind == 'report' or registered is False:
            return 'REPORTED'
        if registered is None or comparison_id not in self.rows:
            return None
        expr = spec.fires or spec.passes
        assert expr is not None
        try:
            value = expr.evaluate(self.row_env(comparison_id))
        except NullRead:
            return None
        if spec.fires is not None:
            return 'FIRES' if value else 'CLEAR'
        return 'PASS' if value else 'FAIL'

    def prediction_met(self, comparison_id: str) -> bool | None:
        spec = self.rules.rows[comparison_id]
        if spec.prediction is None:
            return None
        try:
            value = spec.prediction.evaluate(self.row_env(comparison_id))
        except NullRead:
            return None
        return value if isinstance(value, bool) else None

    def row_provisional(self, comparison_id: str) -> bool:
        return self.provisional(self.rules.rule(self.rules.rows[comparison_id].hypothesis))

    # ---- adoption --------------------------------------------------------------------------

    def _adopt(self, rule: Rule) -> list[str]:
        """Decide every fold under `rule`'s adopt block; return the null reads, if any."""
        assert rule.adopt is not None
        method = rule.adopt['method']
        entries = [e for e in self.doc.get('adoption') or [] if e.get('rule') == method]
        folds = sorted((e.get('fold') for e in entries), key=str)
        if folds != [1, 2, 3]:
            return [f'adoption: one {method} decision per fold (got folds {folds})']
        decisions: dict[int, str] = {}
        missing: list[str] = []
        for entry in entries:
            arms = [a for a in entry.get('arms') or [] if not a.get('control')]
            for arm in arms:
                for key in ('gain_lfo', 'guard_ok'):
                    if arm.get(key) is None:
                        missing.append(f'adoption[fold={entry["fold"]}].{arm.get("arm_id")}.{key}')
                if method == 'squeeze' and arm.get('bundle_raw') is None:
                    missing.append(f'adoption[fold={entry["fold"]}].{arm.get("arm_id")}.bundle_raw')
            if missing:
                continue
            decisions[entry['fold']] = (
                _choose_default(arms, rule.adopt['min_gain'])
                if method == 'default'
                else _choose_squeeze(arms, rule.adopt['within'], rule.adopt['max_bundle_raw'])
            )
        self.adoption[rule.id] = decisions
        return missing


def _choose_default(arms: Sequence[Mapping[str, Any]], min_gain: float) -> str:
    qualifying = [a for a in arms if a['guard_ok'] and a['gain_lfo'] >= min_gain]
    if not qualifying:
        return 'parent'
    return min(qualifying, key=lambda a: (-a['gain_lfo'], a['arm_id']))['arm_id']


def _choose_squeeze(arms: Sequence[Mapping[str, Any]], within: float, max_bundle: int) -> str:
    if not arms:
        return 'parent'
    best = max(a['gain_lfo'] for a in arms)
    # Rounded so that 'within 0.01' is not lost to float noise in the subtraction.
    feasible = [
        a
        for a in arms
        if a['bundle_raw'] <= max_bundle and round(best - a['gain_lfo'], 12) <= within
    ]
    if not feasible:
        return 'parent'
    return min(feasible, key=lambda a: (a['bundle_raw'], -a['gain_lfo'], a['arm_id']))['arm_id']


# ---- the verdict function ---------------------------------------------------------------------


def evaluate(
    rules: Rules, doc: Mapping[str, Any], history: Sequence[Mapping[str, Any]] | None = None
) -> Outcome:
    """The complete verdicts document for `doc` (statuses present or stripped).

    `history` is the full verdicts.json of every earlier run of the realized path, in order; it
    is required at R10/R10K, where it feeds arc_summary.
    """
    ctx = Context(rules, doc)
    errors = check_structure(ctx)

    hypotheses = []
    for rule in rules.rules:
        status = ctx.status(rule.id)
        in_scope = ctx.in_scope(rule.id)
        hypotheses.append(
            {
                'id': rule.id,
                'status': status,
                'in_scope': in_scope,
                'provisional': ctx.provisional(rule) if in_scope else False,
                'rule_id': rule.id,
                'row_ids': list(rule.rows.values()) if in_scope else [],
            }
        )
    summary = {key: ctx.summary(key) for key in GATE_SUMMARY_KEYS}

    rows = []
    for comparison_id in rules.rows:
        row = ctx.rows.get(comparison_id)
        if row is None:
            continue
        out = {key: row.get(key) for key in ROW_FIELDS}
        out['prediction_met'] = ctx.prediction_met(comparison_id)
        out['verdict_component'] = ctx.component(comparison_id)
        rows.append(out)

    adoption = None
    if doc.get('adoption') is not None:
        adoption = []
        for entry in sorted(
            doc['adoption'], key=lambda e: (str(e.get('rule')), e.get('fold') or 0)
        ):
            rule_id = f'adoption.{entry.get("rule")}'
            chosen = ctx.adoption.get(rule_id, {}).get(entry.get('fold'))
            adoption.append(
                {
                    'fold': entry.get('fold'),
                    'rule': entry.get('rule'),
                    'arms': [
                        {
                            k: arm.get(k)
                            for k in ('arm_id', 'gain_lfo', 'guard_ok', 'control', 'bundle_raw')
                        }
                        for arm in entry.get('arms') or []
                    ],
                    'chosen_arm': chosen,
                    'adopted': None if chosen is None else chosen != 'parent',
                }
            )

    run = doc.get('run') or {}
    vault = doc.get('proxy_vault') or {}
    gates_inputs = doc.get('gates_inputs') or {}
    out_doc: dict[str, Any] = {
        'schema': VERDICTS_SCHEMA,
        'schema_version': SCHEMA_VERSION,
        'run': {
            k: run.get(k)
            for k in ('id', 'branch', 'h1_provisional', 'prereg_sha256', 'rules_sha256')
        },
        'proxy_vault': {k: vault.get(k) for k in PROXY_VAULT_AGGREGATE},
        'gates_inputs': {k: gates_inputs.get(k) for k in GATE_INPUT_KEYS},
        'gates_summary': summary,
        'rows': rows,
        'hypotheses': hypotheses,
        'arc_summary': None,
        'adoption': adoption,
        'signoff_inputs': doc.get('signoff_inputs'),
    }
    if ctx.run_id in FINAL_RUNS:
        if history is None:
            errors.append(f'{ctx.run_id}: arc_summary needs the verdicts.json of every earlier run')
        else:
            try:
                out_doc['arc_summary'] = arc_summary(rules, [*history, out_doc])
            except PathError as error:
                errors.append(f'arc_summary: {error}')

    return Outcome(
        doc=out_doc,
        not_computable=list(ctx.not_computable.values()),
        errors=[*errors, *ctx.errors],
        derived=ctx.derived(),
    )


def check_structure(ctx: Context) -> list[str]:
    """Consistency of the document itself with rules.yaml (independent of the statuses)."""
    rules, doc = ctx.rules, ctx.doc
    errors: list[str] = []
    if doc.get('schema') != VERDICTS_SCHEMA:
        errors.append(f'schema must be {VERDICTS_SCHEMA!r}, got {doc.get("schema")!r}')
    if doc.get('schema_version', SCHEMA_VERSION) != SCHEMA_VERSION:
        errors.append(
            f'schema_version must be {SCHEMA_VERSION!r} (A0), got {doc.get("schema_version")!r}'
        )
    if (ctx.run_id, ctx.branch) not in rules.realizable():
        errors.append(f'run {ctx.run_id}/{ctx.branch} is on no PREREG branch path')
    rules_sha = (doc.get('run') or {}).get('rules_sha256')
    if rules.sha256 and rules_sha != rules.sha256:
        errors.append(
            f'run.rules_sha256 is {rules_sha}, but the rules file in use hashes to {rules.sha256}'
        )

    read_by_scope: set[str] = set()
    for rule in rules.rules:
        if ctx.in_scope(rule.id):
            read_by_scope.update(rule.rows.values())
    seen: list[str] = []
    for row in doc.get('rows') or []:
        cid = row.get('comparison_id') if isinstance(row, Mapping) else None
        if cid not in rules.rows:
            errors.append(f'row {cid!r} is not defined in rules.yaml')
            continue
        if cid in seen:
            errors.append(f'row {cid} appears twice')
            continue
        seen.append(cid)
        if cid not in read_by_scope:
            errors.append(
                f'row {cid} is present, but no rule in scope at {ctx.run_id}/{ctx.branch} reads it'
            )
        errors.extend(_check_row_metadata(ctx, row))
    errors.extend(_check_holm(ctx))

    errors.extend(_check_proxy_vault(ctx))
    for entry in doc.get('adoption') or []:
        rule_id = f'adoption.{entry.get("rule")}'
        if rule_id not in (r.id for r in rules.rules) or not ctx.in_scope(rule_id):
            errors.append(
                f'an adoption decision under {rule_id} is recorded, which is not in scope'
            )
    return errors


def _check_proxy_vault(ctx: Context) -> list[str]:
    """The proxy vault's own invariants (A0 rule 5, VJ-5, VJ-7).

    - a read only at a registered read point (`arcforge vault freeze` refuses any other);
    - without a read this run, no read_index, value, sign or basis;
    - a compromised read has sign 'unavailable' (sticky: the flag stays set for every later read);
    - the registered value's basis is 'intent_only' exactly when I1_pass_effective is false.
    """
    vault = ctx.doc.get('proxy_vault') or {}
    errors: list[str] = []
    reading = bool(vault.get('read_this_run'))
    if reading and not ctx.in_scope('proxy_vault.read'):
        errors.append(
            f'a proxy-vault read is recorded at {ctx.run_id}/{ctx.branch}, which is not a '
            'registered read point (vault freeze refuses such a read)'
        )
    if not reading:
        released = [
            k
            for k in ('read_index', 'hybrid_minus_b2_ndcg10', 'sign', 'basis')
            if vault.get(k) is not None
        ]
        if released:
            errors.append(
                f'proxy_vault.{", proxy_vault.".join(released)} given without a read this run'
            )
        return errors
    if vault.get('compromised') is True and vault.get('sign') != 'unavailable':
        errors.append(
            f"proxy_vault.compromised is set, so the sign must be 'unavailable', got {vault.get('sign')!r}"
        )
    if vault.get('sign') == 'unavailable' and vault.get('compromised') is not True:
        errors.append("proxy_vault.sign 'unavailable' needs proxy_vault.compromised (VJ-7)")
    effective = ctx.summary('I1_pass_effective')
    if effective is not None and vault.get('basis') is not None:
        expected = 'judged' if effective else 'intent_only'
        if vault['basis'] != expected:
            errors.append(
                f'proxy_vault.basis is {vault["basis"]!r}, but I1_pass_effective is {effective}, '
                f'so the registered value is {expected!r}'
            )
    return errors


def _check_row_metadata(ctx: Context, row: Mapping[str, Any]) -> list[str]:
    rules = ctx.rules
    cid = row['comparison_id']
    spec = rules.rows[cid]
    expected = {
        'hypothesis': spec.hypothesis,
        'holm_family': spec.hypothesis,
        'kind': spec.kind,
        'arm_a': spec.arm_a,
        'arm_b': spec.arm_b,
        'stratum': spec.stratum,
        'metric': spec.metric,
        'unit': spec.unit,
        'tau_floor': spec.tau_floor,
        'mde_r00': rules.mde_value(spec),
        'tau': rules.tau(spec),
        'prediction': spec.prediction.source if spec.prediction else None,
        'provisional': ctx.row_provisional(cid),
    }
    registered = ctx.registered(cid)
    if registered is not None:
        expected['registered'] = registered
    errors = []
    for key, value in expected.items():
        if not close(row.get(key), value):
            errors.append(f'row {cid}: {key} is {row.get(key)!r}, rules.yaml gives {value!r}')
    return errors


def _check_holm(ctx: Context) -> list[str]:
    """holm_m, holm_rank, alpha_adj and p_holm follow from the family's p_raw (report_schema)."""
    alpha = ctx.rules.stats.alpha
    families: dict[str, dict[str, float]] = {}
    outside: list[Mapping[str, Any]] = []
    for cid, row in ctx.rows.items():
        if cid not in ctx.rules.rows or not isinstance(row.get('p_raw'), (int, float)):
            continue
        member = ctx.in_holm(cid)
        if member is None:
            continue  # registered unknown: the reading rule is NOT_COMPUTABLE anyway
        if member:
            families.setdefault(ctx.rules.rows[cid].hypothesis, {})[cid] = row['p_raw']
        else:
            outside.append(row)
    errors = []
    expected: dict[str, tuple[int, int, float, float]] = {}
    for family in families.values():
        expected.update(stats.holm(family, alpha))
    for cid, (rank, m, alpha_adj, p_holm) in expected.items():
        row = ctx.rows[cid]
        for key, value in (
            ('holm_rank', rank),
            ('holm_m', m),
            ('alpha_adj', alpha_adj),
            ('p_holm', p_holm),
        ):
            if not close(row.get(key), value):
                errors.append(
                    f'row {cid}: {key} is {row.get(key)!r}, Holm over its family gives {value!r}'
                )
    for row in outside:
        cid = row['comparison_id']
        m = len(families.get(ctx.rules.rows[cid].hypothesis, {}))
        for key, value in (
            ('holm_rank', 0),
            ('holm_m', m),
            ('alpha_adj', alpha),
            ('p_holm', row.get('p_raw')),
            ('ci_lo_adj', row.get('ci_lo_raw')),
            ('ci_hi_adj', row.get('ci_hi_raw')),
        ):
            if not close(row.get(key), value):
                errors.append(
                    f'row {cid} (outside its Holm family): {key} is {row.get(key)!r}, expected {value!r}'
                )
    return errors


def arc_summary(rules: Rules, docs: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Final status of every rule over the realized path (`docs` in run order, final last).

    The governing run is the latest run where the rule was in scope (so R10/R10K governs where it
    re-decides); NOT_TESTED where no run of the path applied it; `arc_fallback` (H7 -> H7.report)
    where the slot never freed.
    """
    follow(rules, [Step.from_doc(d) for d in docs])  # the history must be a PREREG path
    by_id: list[dict[str, dict[str, Any]]] = [{h['id']: h for h in d['hypotheses']} for d in docs]

    def governing(rule_id: str) -> tuple[str, str] | None:
        found = None
        for doc, entries in zip(docs, by_id, strict=True):
            entry = entries.get(rule_id)
            if entry is not None and entry.get('in_scope'):
                found = (entry.get('status'), doc['run']['id'])
        return found

    out = []
    for rule in rules.rules:
        found = governing(rule.id)
        if found is None and rule.arc_fallback is not None:
            found = governing(rule.arc_fallback)
        out.append(
            {
                'id': rule.id,
                'final_status': found[0] if found else NOT_TESTED,
                'governing_run': found[1] if found else None,
            }
        )
    return out


# ---- blind form and comparison ----------------------------------------------------------------


def strip(doc: Mapping[str, Any]) -> dict[str, Any]:
    """The blind form of a verdicts document: STRIPPED_FIELDS removed, everything else kept."""
    out = copy.deepcopy(dict(doc))
    for key in STRIP_WHOLE:
        out.pop(key, None)
    for list_key, keys in STRIP_MAP.items():
        for entry in out.get(list_key) or []:
            for key in keys:
                entry.pop(key, None)
    return out


def stripped_keys_present(doc: Any) -> list[str]:
    """Where a blind document still carries a stripped field (empty when it is clean)."""
    if not isinstance(doc, Mapping):
        return []
    found = [key for key in STRIP_WHOLE if key in doc]
    for list_key, keys in STRIP_MAP.items():
        for n, entry in enumerate(doc.get(list_key) or []):
            found.extend(
                f'{list_key}[{n}].{key}'
                for key in keys
                if isinstance(entry, Mapping) and key in entry
            )
    return found


def stripped_field_names() -> tuple[str, ...]:
    """STRIP_MAP and STRIP_WHOLE spelled like ids.STRIPPED_FIELDS (a test keeps them equal)."""
    return (*STRIP_WHOLE, *(f'{k}[].{f}' for k, fields in STRIP_MAP.items() for f in fields))


def dumps_doc(doc: Mapping[str, Any]) -> str:
    """The canonical bytes of a verdicts.json (key order as built, one-space indent)."""
    return json.dumps(doc, indent=1, ensure_ascii=False) + '\n'


def diff(expected: Any, actual: Any, path: str = '') -> list[str]:
    """Human-readable differences, numbers compared to TOLERANCE."""
    if isinstance(expected, Mapping) and isinstance(actual, Mapping):
        out = []
        for key in list(expected) + [k for k in actual if k not in expected]:
            where = f'{path}.{key}' if path else str(key)
            if key not in actual:
                out.append(f'{where}: missing (expected {expected[key]!r})')
            elif key not in expected:
                out.append(f'{where}: unexpected {actual[key]!r}')
            else:
                out.extend(diff(expected[key], actual[key], where))
        return out
    if isinstance(expected, list) and isinstance(actual, list):
        if len(expected) != len(actual):
            return [f'{path}: {len(actual)} entries, expected {len(expected)}']
        out = []
        for n, (e, a) in enumerate(zip(expected, actual, strict=True)):
            label = e.get('comparison_id') or e.get('id') if isinstance(e, Mapping) else None
            out.extend(diff(e, a, f'{path}[{label if label else n}]'))
        return out
    if not close(expected, actual):
        return [f'{path}: {actual!r}, recomputed {expected!r}']
    return []
