"""`arcforge prereg lint`: prove every rule is computable on every branch before PREREG is hashed.

The lint expands each rule's applies_to over the PREREG branch table (rules.yaml) and, for every
(run, branch) a path reaches where the rule is in scope, checks that every field the rule reads
- exists in schemas/arc-report-1.json, and
- is produced non-null by the planned stages of that run (contract/produces.yaml),
so no in-scope rule can come out NOT_COMPUTABLE by design. It also checks the scoping itself
(no rule without applies_to, no clause that reaches no run, no explicit pair no path reaches),
the branch decisions, the vault-read budget per path, the review-3 fixes, and with --frozen that
every tau = max(tau_floor, mde_r00) is computable because R00 wrote every MDE.

Findings are 'error' (the lint fails) or 'warning'. `LintReport.to_json()` is the lint.json the
R00 tail hands to Fable's sign-off packet.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.contract import schema as report_schema
from arcforge.contract.expr import CONTEXT_NAMES, Read
from arcforge.contract.ids import BRANCHES, PRODUCES_SCHEMA, RUN_IDS
from arcforge.contract.rules import TEMPLATE_PATH, Rule, Rules, RulesError, load_rules, load_yaml, sha256_bytes

PRODUCES_PATH = Path(__file__).with_name('produces.yaml')
DOC = 'verdicts_doc'
# Nullable VerdictRow fields whose presence rules.yaml itself decides.
_RULE_DECIDED_ROW_FIELDS = frozenset({'tau', 'tau_floor', 'mde_r00', 'prediction'})
_KILL_RULES = ('FUT', 'H1.F', 'H1', 'H2', 'H3', 'H3a', 'H3b', 'H4', 'H5', 'H6', 'H7', 'H7.report', 'K1')


@dataclass(frozen=True)
class Finding:
    level: str  # 'error' | 'warning'
    code: str
    message: str
    rule: str | None = None
    run: str | None = None
    branch: str | None = None

    def __str__(self) -> str:
        where = self.rule or ''
        if self.run:
            where += f' @ {self.run}/{self.branch}'
        prefix = f'{where}: ' if where else ''
        return f'{self.level.upper():7} {self.code:22} {prefix}{self.message}'


@dataclass(frozen=True)
class Plan:
    """produces.yaml, flattened: (run, branch) -> (fields promised non-null, rows produced)."""

    sha256: str
    path: str
    entries: Mapping[tuple[str, str], tuple[frozenset[str], tuple[str, ...]]]


@dataclass
class LintReport:
    rules_path: str
    rules_sha256: str | None
    schema_sha256: str
    plan_path: str
    plan_sha256: str | None
    frozen: bool
    findings: list[Finding] = field(default_factory=list)
    scope: dict[str, list[str]] = field(default_factory=dict)  # rule -> ['r06/N', ...]

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.level == 'error']

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.level == 'warning']

    @property
    def ok(self) -> bool:
        return not self.errors

    def add(self, level: str, code: str, message: str, rule: str | None = None,
            pair: tuple[str, str] | None = None) -> None:  # fmt: skip
        run, branch = pair if pair else (None, None)
        self.findings.append(Finding(level, code, message, rule, run, branch))

    def to_json(self) -> dict[str, Any]:
        return {
            'schema': 'arc-lint/1',
            'ok': self.ok,
            'frozen': self.frozen,
            'rules': {'path': self.rules_path, 'sha256': self.rules_sha256},
            'schema_sha256': self.schema_sha256,
            'plan': {'path': self.plan_path, 'sha256': self.plan_sha256},
            'errors': [f.__dict__ for f in self.errors],
            'warnings': [f.__dict__ for f in self.warnings],
            'scope': self.scope,
        }


def _flatten(values: Any) -> list[Any]:
    if isinstance(values, list):
        return [v for item in values for v in _flatten(item)]
    return [values]


def load_plan(path: str | Path, rules: Rules, schema: Mapping[str, Any], report: LintReport) -> Plan | None:
    raw_bytes = Path(path).read_bytes()
    try:
        data = load_yaml(raw_bytes.decode('utf-8'))
    except RulesError as error:
        report.add('error', 'plan', f'{path}: {"; ".join(error.problems)}')
        return None
    if not isinstance(data, dict) or data.get('schema') != PRODUCES_SCHEMA:
        report.add('error', 'plan', f'{path}: expected a mapping with schema {PRODUCES_SCHEMA!r}')
        return None
    runs = data.get('runs')
    if not isinstance(runs, dict):
        report.add('error', 'plan', f'{path}: runs must map run ids to branches')
        return None
    realizable = rules.realizable()
    entries: dict[tuple[str, str], tuple[frozenset[str], tuple[str, ...]]] = {}
    for run_id, by_branch in runs.items():
        if run_id not in RUN_IDS or not isinstance(by_branch, dict):
            report.add('error', 'plan', f'{run_id!r} is not a run id mapping branches to plans')
            continue
        for branch, body in by_branch.items():
            pair = (str(run_id), str(branch))
            if branch not in BRANCHES:
                report.add('error', 'plan', f'unknown branch {branch!r}', pair=pair)
                continue
            if pair not in realizable:
                report.add('error', 'plan-unreachable', 'no PREREG path reaches this pair', pair=pair)
                continue
            if not isinstance(body, dict) or set(body) - {'fields', 'rows'}:
                report.add('error', 'plan', 'a plan entry is {fields, rows}', pair=pair)
                continue
            fields = [f for f in _flatten(body.get('fields') or []) if f is not None]
            rows = [r for r in _flatten(body.get('rows') or []) if r is not None]
            for name in fields:
                if not isinstance(name, str) or not report_schema.lookup(schema, f'{DOC}.{name}').exists:
                    report.add('error', 'plan-field', f'{name!r} is not a verdicts.json field', pair=pair)
            for row in rows:
                if row not in rules.rows:
                    report.add('error', 'plan-row', f'{row!r} is not a row of rules.yaml', pair=pair)
            entries[pair] = (frozenset(f for f in fields if isinstance(f, str)), tuple(rows))
    for pair in sorted(realizable, key=_pair_key):
        if pair not in entries:
            report.add('error', 'plan-missing', 'the plan says nothing about this (run, branch)', pair=pair)
    return Plan(sha256=sha256_bytes(raw_bytes), path=str(path), entries=entries)


def _pair_key(pair: tuple[str, str]) -> tuple[int, int]:
    return RUN_IDS.index(pair[0]), BRANCHES.index(pair[1])


def _label(pair: tuple[str, str]) -> str:
    return f'{pair[0]}/{pair[1]}'


class _Computability:
    """Is a field (or a rule, or a gates_summary value) non-null at a (run, branch)?"""

    def __init__(self, rules: Rules, schema: Mapping[str, Any], plan: Plan, frozen: bool):
        self.rules, self.schema, self.plan, self.frozen = rules, schema, plan, frozen

    def in_scope(self, rule_id: str, pair: tuple[str, str]) -> bool:
        return self.rules.in_scope(rule_id, *pair)

    def read(self, read: Read, pair: tuple[str, str], stack: tuple[str, ...] = ()) -> str | None:
        """None when produced; otherwise why not."""
        fields, rows = self.plan.entries.get(pair, (frozenset(), ()))
        if read.row is not None:
            if read.row not in rows:
                return f'reads {read}, but the plan does not produce row {read.row}'
            found = report_schema.lookup(self.schema, f'{DOC}.rows[].{read.path}')
            if not found.exists:
                return f'reads {read}, which is not a VerdictRow field'
            if f'{DOC}.rows[].{read.path}' not in found.nullable_prefixes:
                return None
            spec = self.rules.rows[read.row]
            if read.path in ('tau', 'tau_floor') and spec.tau_floor is None:
                return f'reads {read}, but the row has no tau_floor, so its tau is null'
            if read.path in ('tau', 'mde_r00') and spec.mde is not None and self.frozen:
                if self.rules.mde_r00.get(spec.mde) is None:
                    return f'reads {read}, but mde_r00.{spec.mde} is null'
            if read.path == 'mde_r00' and spec.mde is None:
                return f'reads {read}, but the row names no mde, so mde_r00 is null'
            if read.path == 'prediction' and spec.prediction is None:
                return f'reads {read}, but the row has no prediction'
            if read.path not in _RULE_DECIDED_ROW_FIELDS:
                return f'reads {read}, which may be null and nothing promises it'
            return None
        head, _, rest = read.path.partition('.')
        if head == 'gates_summary':
            return self.summary(rest, pair, stack)
        found = report_schema.lookup(self.schema, f'{DOC}.{read.path}')
        if not found.exists:
            return f'reads {read.path}, which is not a verdicts.json field'
        for prefix in found.nullable_prefixes:
            relative = prefix[len(DOC) + 1 :]
            if relative not in fields:
                return f'reads {read.path}, but the plan does not promise {relative} non-null'
        return None

    def rule(self, rule: Rule, pair: tuple[str, str], stack: tuple[str, ...] = ()) -> list[str]:
        if rule.id in stack:
            return [f'{rule.id} depends on itself through gates_summary']
        problems = []
        for read in sorted(self.rules.rule_reads(rule), key=str):
            why = self.read(read, pair, (*stack, rule.id))
            if why:
                problems.append(why)
        return problems

    def summary(self, key: str, pair: tuple[str, str], stack: tuple[str, ...]) -> str | None:
        producer = next((r for r in self.rules.rules if key in r.gates_summary), None)
        if producer is None:
            return f'reads gates_summary.{key}, which no rule produces'
        in_scope = self.in_scope(producer.id, pair)
        expr = producer.gates_summary[key]
        env = self.rules.rule_env(producer, names=frozenset(CONTEXT_NAMES), in_scope_known=in_scope)
        if 'status' in expr.context_names(env):
            if not in_scope:
                return f'reads gates_summary.{key}, but {producer.id} is out of scope here'
            inner = self.rule(producer, pair, stack)
            if inner:
                return f'reads gates_summary.{key}, but {producer.id} is not computable ({inner[0]})'
        for read in sorted(expr.reads(env), key=str):
            why = self.read(read, pair, stack)
            if why:
                return f'reads gates_summary.{key}, which {why}'
        return None


def lint(
    rules_path: str | Path | None = None,
    plan_path: str | Path | None = None,
    schema_path: str | Path | None = None,
    frozen: bool = False,
) -> LintReport:
    rules_path = Path(rules_path) if rules_path else TEMPLATE_PATH
    plan_path = Path(plan_path) if plan_path else PRODUCES_PATH
    schema_path = Path(schema_path) if schema_path else report_schema.REPORT_SCHEMA_PATH
    schema = report_schema.load(schema_path)
    report = LintReport(
        rules_path=str(rules_path),
        rules_sha256=None,
        schema_sha256=report_schema.sha256(schema_path),
        plan_path=str(plan_path),
        plan_sha256=None,
        frozen=frozen,
    )
    try:
        rules = load_rules(rules_path)
    except RulesError as error:
        for problem in error.problems:
            report.add('error', 'rules', problem)
        return report
    report.rules_sha256 = rules.sha256
    plan = load_plan(plan_path, rules, schema, report)
    if plan is not None:
        report.plan_sha256 = plan.sha256

    _check_scope(rules, report)
    _check_fields_exist(rules, schema, report)
    _check_decisions(rules, report)
    _check_invariants(rules, report)
    _check_frozen(rules, frozen, report)
    if plan is not None:
        _check_computable(rules, schema, plan, frozen, report)
    return report


def _check_scope(rules: Rules, report: LintReport) -> None:
    realizable = rules.realizable()
    for rule in rules.rules:
        report.scope[rule.id] = [_label(p) for p in rules.scope_pairs(rule.id)]
        for clause in rule.applies_to:
            hits = {p for p in realizable if clause.matches(*p)}
            if not hits:
                report.add('error', 'dead-clause', f'{clause.describe()} reaches no run of any path', rule.id)
            elif not clause.wildcard:
                assert clause.runs is not None and clause.branches is not None
                unreachable = sorted(
                    ((r, b) for r in clause.runs for b in clause.branches if (r, b) not in realizable),
                    key=_pair_key,
                )
                if unreachable:
                    report.add(
                        'error',
                        'unreachable-pair',
                        f'{clause.describe()} names {", ".join(map(_label, unreachable))}, '
                        'which no PREREG path reaches',
                        rule.id,
                    )


def _check_fields_exist(rules: Rules, schema: Mapping[str, Any], report: LintReport) -> None:
    for rule in rules.rules:
        env = rules.rule_env(rule, names=frozenset(CONTEXT_NAMES))
        reads = set(rules.rule_reads(rule))
        for expr in (*rule.gates_summary.values(), *rule.derive.values()):
            reads |= expr.reads(env)
        for read in sorted(reads, key=str):
            path = f'{DOC}.rows[].{read.path}' if read.row else f'{DOC}.{read.path}'
            found = report_schema.lookup(schema, path)
            if not found.exists:
                report.add('error', 'field-not-in-schema', f'reads {read}, which arc-report/1 does not define ({found.missing_at})', rule.id)
        for target in rule.derive:
            found = report_schema.lookup(schema, target)
            if not found.exists:
                report.add('error', 'field-not-in-schema', f'derives {target}, which arc-report/1 does not define', rule.id)


def _check_decisions(rules: Rules, report: LintReport) -> None:
    covered: set[tuple[str, str]] = set()
    for decision in rules.decisions:
        pair = (decision.after, decision.branch)
        covered.add(pair)
        rule = rules.rule(decision.rule)
        if not rules.in_scope(rule.id, *pair):
            report.add('error', 'decision', f'{rule.id} decides here but is out of scope', rule.id, pair)
        statuses = set(rule.statuses())
        if set(decision.outcomes) != statuses:
            report.add('error', 'decision', f'routes {sorted(decision.outcomes)}, but {rule.id} can be {sorted(statuses)}', rule.id, pair)
        through = {name for name, seq in rules.branch_table.items() if pair in seq}
        routed = {p for paths in decision.outcomes.values() for p in paths}
        if routed != through:
            report.add('error', 'decision', f'routes paths {sorted(routed)}, but {sorted(through)} pass here', rule.id, pair)
        for status, paths in decision.outcomes.items():
            nexts = set()
            for name in paths:
                seq = rules.branch_table[name]
                if pair in seq and seq.index(pair) + 1 < len(seq):
                    nexts.add(seq[seq.index(pair) + 1])
            if len(nexts) > 1:
                report.add('error', 'decision', f'{status} leaves the next run open: {sorted(nexts)}', rule.id, pair)
    # Every fork of the table must be decided by some rule.
    for name, seq in rules.branch_table.items():
        for other, seq2 in rules.branch_table.items():
            if name >= other:
                continue
            common = 0
            while common < min(len(seq), len(seq2)) and seq[common] == seq2[common]:
                common += 1
            if 0 < common < min(len(seq), len(seq2)) and seq[common - 1] not in covered:
                report.add('error', 'decision', f'paths {name} and {other} fork after {_label(seq[common - 1])}, and no decision routes them')


def _check_invariants(rules: Rules, report: LintReport) -> None:
    # Review 3, required change 1: H3 falsifies only when c1's raw CI upper bound is below 0.05.
    h3 = rules.rule('H3')
    falsifiers = [expr.source for status, expr in h3.outcomes if status == 'FALSIFIED']
    if falsifiers != ['c1.ci_hi_raw < 0.05']:
        report.add('error', 'review3-h3-falsifier', f"H3's falsifier must read 'c1.ci_hi_raw < 0.05', got {falsifiers}", 'H3')
    # Review 3, required change 2b: the read budget per path, S-F's two reads, at most 3.
    for name, seq in rules.branch_table.items():
        reads = [p for p in seq if rules.in_scope('vault.read', *p)]
        budget = rules.vault_read_budget.get(name)
        if len(reads) != budget or len(reads) > 3:
            report.add(
                'error', 'vault-budget',
                f'path {name}: vault.read is in scope at {len(reads)} runs ({", ".join(map(_label, reads))}), budget {budget}',
                'vault.read',
            )  # fmt: skip
    if rules.vault_read_budget.get('S-F') != 2:
        report.add('error', 'review3-sf-reads', 'S-F takes exactly two vault reads (r04 and r10K)', 'vault.read')
    # At r00 every hypothesis rule is NOT_APPLICABLE (the sign-off requires it).
    for rule_id in _KILL_RULES:
        if rules.in_scope(rule_id, 'r00', 'N'):
            report.add('error', 'r00-hypothesis', 'in scope at r00, where every H rule must be NOT_APPLICABLE', rule_id)


def _check_frozen(rules: Rules, frozen: bool, report: LintReport) -> None:
    unfilled = [k for k, v in rules.mde_r00.items() if v is None]
    if not unfilled:
        return
    if frozen:
        report.add('error', 'not-frozen', f'mde_r00 {unfilled} are null; every tau = max(tau_floor, mde_r00) needs them (arcforge prereg freeze)')
    else:
        report.add('warning', 'template', f'mde_r00 {unfilled} are null (template); R00 freezes them')


def _check_computable(
    rules: Rules, schema: Mapping[str, Any], plan: Plan, frozen: bool, report: LintReport
) -> None:
    check = _Computability(rules, schema, plan, frozen)
    for rule in rules.rules:
        for pair in rules.scope_pairs(rule.id):
            for why in check.rule(rule, pair):
                report.add('error', 'not-computable', why, rule.id, pair)
    for pair, (_, rows) in sorted(plan.entries.items(), key=lambda item: _pair_key(item[0])):
        read = {cid for rule in rules.rules if rules.in_scope(rule.id, *pair) for cid in rule.rows.values()}
        for row in rows:
            if row in rules.rows and row not in read:
                report.add('error', 'row-unread', f'the plan produces {row}, which no rule in scope here reads', pair=pair)


def format_report(report: LintReport) -> str:
    lines = [
        f'arcforge prereg lint: {report.rules_path}'
        + (f' (sha256 {report.rules_sha256[:12]})' if report.rules_sha256 else ''),
        f'  plan {report.plan_path}' + (f' (sha256 {report.plan_sha256[:12]})' if report.plan_sha256 else ''),
        f'  schema arc-report-1.json (sha256 {report.schema_sha256[:12]}){"  [frozen]" if report.frozen else ""}',
    ]
    if report.scope:
        pairs = sum(len(v) for v in report.scope.values())
        lines.append(f'  {len(report.scope)} rules; applies_to expands to {pairs} in-scope (rule, run, branch) checks')
    lines.extend(f'  {finding}' for finding in report.findings)
    verdict = 'ok' if report.ok else 'FAILED'
    lines.append(f'lint {verdict}: {len(report.errors)} errors, {len(report.warnings)} warnings')
    return '\n'.join(lines)
