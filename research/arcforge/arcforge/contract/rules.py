"""rules.yaml (arc-rules/1): load, validate and query the registered verdict rules.

The loader is strict and complete: it collects every problem it finds (a rule without applies_to,
an unknown status, a row field typo inside an expression, a reference to a row nobody defines)
and raises them together as one RulesError, so `arcforge prereg lint` can print them all.

YAML parsing needs PyYAML, which is imported lazily (arcforge/commands/__init__.py); everything
after parsing is standard library, so `parse_rules()` also accepts an already-loaded mapping.
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.contract.expr import CONTEXT_NAMES, NAMESPACES, Env, Expr, ExprError, Read
from arcforge.contract.ids import (
    BRANCHES,
    ESTIMATORS,
    GATE_SUMMARY_KEYS,
    NOT_APPLICABLE,
    NOT_COMPUTABLE,
    ROW_KINDS,
    RULE_IDS,
    RULES_SCHEMA,
    RUN_IDS,
    STATUSES,
    UNITS,
)

TEMPLATE_PATH = Path(__file__).with_name('rules.yaml')
MDE_KEYS: tuple[str, ...] = ('AB', 'D', 'CE', 'G', 'vault', 'frontier')
WILDCARD = '*'
_IDENT = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
_MACRO = re.compile(r'^[A-Z][A-Z0-9_]*$')
_TOP_KEYS = frozenset(
    {'schema', 'stats', 'sets', 'branch_table', 'decisions', 'proxy_vault_read_budget', 'mde_r00',
     'defines', 'rules'}
)  # fmt: skip
_RULE_KEYS = frozenset(
    {'id', 'title', 'applies_to', 'rows', 'let', 'defines', 'outcomes', 'else', 'status', 'reads',
     'provisional', 'gates_summary', 'derive', 'adopt', 'arc_fallback'}
)  # fmt: skip
_ROW_KEYS = frozenset(
    {'kind', 'arm_a', 'arm_b', 'stratum', 'metric', 'unit', 'tau_floor', 'mde', 'holm',
     'registered', 'fires', 'passes', 'prediction', 'estimator'}
)  # fmt: skip
# A rule's outcome may be NOT_COMPUTABLE (proxy_vault.read's missing read) but never NOT_APPLICABLE,
# which only scope decides.
_OUTCOME_STATUSES = frozenset(STATUSES) - {NOT_APPLICABLE} | {NOT_COMPUTABLE}
# Row fields no expression may read: they are outcomes (and the blind pass strips some of them).
UNREADABLE_ROW_FIELDS = frozenset(
    {'verdict_component', 'prediction_met', 'registered', 'provisional'}
)


class RulesError(ValueError):
    """rules.yaml is malformed. `problems` lists every issue found."""

    def __init__(self, problems: list[str]):
        self.problems = problems
        super().__init__('rules.yaml is invalid:\n  - ' + '\n  - '.join(problems))


@dataclass(frozen=True)
class Stats:
    alpha: float
    resamples: int
    permutations: int
    refit_resamples: int


@dataclass(frozen=True)
class Clause:
    """One {runs, branches} clause of applies_to. None means '*' (every run, every branch)."""

    runs: frozenset[str] | None
    branches: frozenset[str] | None

    def matches(self, run_id: str, branch: str) -> bool:
        return (self.runs is None or run_id in self.runs) and (
            self.branches is None or branch in self.branches
        )

    @property
    def wildcard(self) -> bool:
        return self.runs is None or self.branches is None

    def describe(self) -> str:
        runs = WILDCARD if self.runs is None else ', '.join(sorted(self.runs, key=RUN_IDS.index))
        branches = (
            WILDCARD
            if self.branches is None
            else ', '.join(sorted(self.branches, key=BRANCHES.index))
        )
        return f'{{{runs}; {branches}}}'


@dataclass(frozen=True)
class RowSpec:
    """A VerdictRow as rules.yaml defines it. Its comparison_id is '<owner rule>.<alias>'."""

    comparison_id: str
    hypothesis: str
    kind: str
    arm_a: str
    arm_b: str | None
    stratum: str
    metric: str
    unit: str
    estimator: str
    tau_floor: float | None
    mde: str | None
    holm: bool
    registered: bool | Expr
    fires: Expr | None
    passes: Expr | None
    prediction: Expr | None


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    applies_to: tuple[Clause, ...]
    rows: Mapping[str, str]  # alias -> comparison id
    lets: Mapping[str, Expr]
    defines: Mapping[str, Expr]
    outcomes: tuple[tuple[str, Expr], ...]
    else_status: str | None
    status: str | None  # a constant status (REPORTED, DONE)
    reads: tuple[str, ...]  # extra verdicts-doc paths the rule requires non-null
    provisional: Expr | None
    gates_summary: Mapping[str, Expr]
    derive: Mapping[str, Expr]  # report.json path -> value
    adopt: Mapping[str, Any] | None
    arc_fallback: str | None

    def statuses(self) -> tuple[str, ...]:
        """Every status this rule can emit in scope (NOT_COMPUTABLE excluded)."""
        found = [self.status] if self.status else [s for s, _ in self.outcomes]
        if self.else_status:
            found.append(self.else_status)
        return tuple(dict.fromkeys(s for s in found if s and s != NOT_COMPUTABLE))


@dataclass(frozen=True)
class Decision:
    """Where the branch paths fork: after `after` on `branch`, `rule`'s status picks the paths."""

    after: str
    branch: str
    rule: str
    outcomes: Mapping[str, tuple[str, ...]]


@dataclass(frozen=True)
class Rules:
    sha256: str
    path: str | None
    stats: Stats
    sets: Mapping[str, tuple[str, ...]]
    branch_table: Mapping[str, tuple[tuple[str, str], ...]]
    decisions: tuple[Decision, ...]
    proxy_vault_read_budget: Mapping[str, int]
    mde_r00: Mapping[str, float | None]
    defines: Mapping[str, Expr]
    rules: tuple[Rule, ...]
    rows: Mapping[str, RowSpec]
    _by_id: Mapping[str, Rule] = field(default_factory=dict, repr=False)

    # ---- lookup ----------------------------------------------------------------------------

    def rule(self, rule_id: str) -> Rule:
        return self._by_id[rule_id]

    def in_scope(self, rule_id: str, run_id: str, branch: str) -> bool:
        return any(c.matches(run_id, branch) for c in self.rule(rule_id).applies_to)

    def realizable(self) -> set[tuple[str, str]]:
        """Every (run, branch) pair some PREREG path reaches."""
        return {pair for path in self.branch_table.values() for pair in path}

    def scope_pairs(self, rule_id: str) -> list[tuple[str, str]]:
        """The realizable (run, branch) pairs where `rule_id` is in scope, in run order."""
        pairs = [p for p in self.realizable() if self.in_scope(rule_id, *p)]
        return sorted(pairs, key=lambda p: (RUN_IDS.index(p[0]), BRANCHES.index(p[1])))

    @property
    def frozen(self) -> bool:
        """True once R00 has written every MDE."""
        return all(v is not None for v in self.mde_r00.values())

    def mde_value(self, spec: RowSpec) -> float | None:
        return None if spec.mde is None else self.mde_r00.get(spec.mde)

    def tau(self, spec: RowSpec) -> float | None:
        """tau = max(tau_floor, mde_r00) (review 3); tau_floor alone when the row has no MDE."""
        if spec.tau_floor is None:
            return None
        mde = self.mde_value(spec)
        if spec.mde is not None and mde is None:
            return None  # not frozen yet
        return spec.tau_floor if mde is None else max(spec.tau_floor, mde)

    # ---- expression environments -----------------------------------------------------------

    def macros_for(self, rule: Rule) -> dict[str, Expr]:
        macros = dict(self.defines)
        for cid in rule.rows.values():
            owner = self._by_id.get(self.rows[cid].hypothesis)
            if owner is not None:
                macros.update(owner.defines)
        macros.update(rule.defines)
        return macros

    def rule_env(self, rule: Rule, **kwargs: Any) -> Env:
        fires = {
            cid: expr for cid in rule.rows.values() if (expr := self.rows[cid].fires) is not None
        }
        return Env(
            rows=dict(rule.rows),
            lets=dict(rule.lets),
            macros=self.macros_for(rule),
            fires=fires,
            **kwargs,
        )

    def row_env(self, comparison_id: str, **kwargs: Any) -> Env:
        spec = self.rows[comparison_id]
        owner = self._by_id[spec.hypothesis]
        macros = {**self.defines, **owner.defines}
        fires = {comparison_id: spec.fires} if spec.fires else {}
        return Env(macros=macros, fires=fires, x=comparison_id, **kwargs)

    def row_exprs(self, comparison_id: str) -> list[Expr]:
        spec = self.rows[comparison_id]
        exprs = [e for e in (spec.fires, spec.passes, spec.prediction) if e is not None]
        if isinstance(spec.registered, Expr):
            exprs.append(spec.registered)
        return exprs

    def rule_reads(self, rule: Rule) -> set[Read]:
        """Every field the rule reads in scope: conditions, lets, extra reads and its rows."""
        env = self.rule_env(rule)
        reads: set[Read] = {Read(None, path) for path in rule.reads}
        for _, expr in rule.outcomes:
            reads |= expr.reads(env)
        if rule.provisional is not None:
            reads |= rule.provisional.reads(env)
        for cid in rule.rows.values():
            reads.add(Read(cid, 'point'))  # a declared row must be present
            for expr in self.row_exprs(cid):
                reads |= expr.reads(self.row_env(cid))
        if rule.adopt is not None:
            reads.add(Read(None, 'adoption'))
        return reads


# ---- loading ---------------------------------------------------------------------------------


def load_yaml(text: str) -> Any:
    try:
        import yaml
    except ImportError as error:  # pragma: no cover - pyyaml is a core dependency
        raise RulesError([f'PyYAML is needed to read rules.yaml ({error}); use `uv run`']) from None
    try:
        return yaml.safe_load(text)
    except yaml.YAMLError as error:
        raise RulesError([f'not valid YAML: {error}']) from None


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_rules(path: str | Path | None = None) -> Rules:
    """Load and validate a rules file (default: the packaged template)."""
    path = Path(path) if path is not None else TEMPLATE_PATH
    data = path.read_bytes()
    return parse_rules(load_yaml(data.decode('utf-8')), sha256=sha256_bytes(data), path=str(path))


def loads_rules(text: str, path: str | None = None) -> Rules:
    return parse_rules(load_yaml(text), sha256=sha256_bytes(text.encode('utf-8')), path=path)


class _Problems:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, where: str, message: str) -> None:
        self.items.append(f'{where}: {message}')


def _number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _expr(value: Any, where: str, problems: _Problems) -> Expr | None:
    if not isinstance(value, str):
        problems.add(where, f'expected an expression string, got {value!r}')
        return None
    try:
        return Expr(value)
    except ExprError as error:
        problems.add(where, str(error))
        return None


def _expand(
    values: Any, vocab: tuple[str, ...], sets: Mapping[str, tuple[str, ...]], where: str,
    problems: _Problems,
) -> frozenset[str] | None:  # fmt: skip
    if values == WILDCARD:
        return None
    if not isinstance(values, list) or not values:
        problems.add(where, f"expected '*' or a non-empty list, got {values!r}")
        return frozenset()
    out: set[str] = set()
    for value in values:
        if isinstance(value, str) and value in sets:
            members = sets[value]
            bad = [m for m in members if m not in vocab]
            if bad:
                problems.add(where, f'set {value!r} holds {bad}, which do not belong here')
            out.update(m for m in members if m in vocab)
        elif isinstance(value, str) and value in vocab:
            out.add(value)
        else:
            problems.add(where, f'unknown id {value!r}')
    return frozenset(out)


def parse_rules(data: Any, sha256: str = '', path: str | None = None) -> Rules:
    problems = _Problems()
    if not isinstance(data, dict):
        raise RulesError(['the top level must be a mapping'])
    for key in sorted(set(data) - _TOP_KEYS):
        problems.add('rules.yaml', f'unknown top-level key {key!r}')
    if data.get('schema') != RULES_SCHEMA:
        problems.add('schema', f'must be {RULES_SCHEMA!r}, got {data.get("schema")!r}')

    stats = _parse_stats(data.get('stats'), problems)
    sets = _parse_sets(data.get('sets') or {}, problems)
    branch_table = _parse_branch_table(data.get('branch_table'), problems)
    vault_budget = _parse_budget(data.get('proxy_vault_read_budget'), branch_table, problems)
    mde = _parse_mde(data.get('mde_r00'), problems)
    defines = _parse_defines(data.get('defines') or {}, 'defines', problems)

    raw_rules = data.get('rules')
    if not isinstance(raw_rules, list) or not raw_rules:
        problems.add('rules', 'must be a non-empty list')
        raw_rules = []
    rules: list[Rule] = []
    rows: dict[str, RowSpec] = {}
    references: list[tuple[str, str, str]] = []  # (rule, alias, comparison id)
    for index, raw in enumerate(raw_rules):
        rule = _parse_rule(raw, index, sets, rows, references, problems)
        if rule is not None:
            rules.append(rule)

    ids = [r.id for r in rules]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        problems.add(dup, 'defined more than once')
    missing = [i for i in RULE_IDS if i not in ids]
    if missing:
        problems.add(
            'rules', f'missing rules {missing} (verdicts.json lists every rule exactly once)'
        )
    for rule_id, alias, cid in references:
        if cid not in rows:
            problems.add(rule_id, f'row {alias}: {cid!r} is not defined by any rule')
    by_id = {r.id: r for r in rules}
    for rule in rules:
        if rule.arc_fallback is not None and rule.arc_fallback not in by_id:
            problems.add(rule.id, f'arc_fallback {rule.arc_fallback!r} is not a rule')

    decisions = _parse_decisions(data.get('decisions') or [], by_id, branch_table, problems)
    result = Rules(
        sha256=sha256,
        path=path,
        stats=stats,
        sets=sets,
        branch_table=branch_table,
        decisions=decisions,
        proxy_vault_read_budget=vault_budget,
        mde_r00=mde,
        defines=defines,
        rules=tuple(sorted(rules, key=lambda r: RULE_IDS.index(r.id) if r.id in RULE_IDS else 99)),
        rows=rows,
        _by_id=by_id,
    )
    if not problems.items:
        _check_expressions(result, problems)
        _check_summaries(result, problems)
    if problems.items:
        raise RulesError(problems.items)
    return result


def _parse_stats(raw: Any, problems: _Problems) -> Stats:
    if not isinstance(raw, dict):
        problems.add('stats', 'must be a mapping')
        raw = {}
    alpha = raw.get('alpha')
    if not _number(alpha) or not 0 < alpha < 1:
        problems.add('stats.alpha', f'must be in (0, 1), got {alpha!r}')
        alpha = 0.05
    counts = {}
    for key in ('resamples', 'permutations', 'refit_resamples'):
        value = raw.get(key)
        if not isinstance(value, int) or isinstance(value, bool) or value < 1:
            problems.add(f'stats.{key}', f'must be a positive integer, got {value!r}')
            value = 1
        counts[key] = value
    for key in sorted(set(raw) - {'alpha', 'resamples', 'permutations', 'refit_resamples'}):
        problems.add('stats', f'unknown key {key!r}')
    return Stats(alpha=float(alpha), **counts)


def _parse_sets(raw: Any, problems: _Problems) -> dict[str, tuple[str, ...]]:
    if not isinstance(raw, dict):
        problems.add('sets', 'must be a mapping')
        return {}
    out: dict[str, tuple[str, ...]] = {}
    for name, members in raw.items():
        if not isinstance(name, str) or name in RUN_IDS or name in BRANCHES or name == WILDCARD:
            problems.add('sets', f'{name!r} cannot name a set (it is an id or a wildcard)')
            continue
        if not isinstance(members, list) or not all(isinstance(m, str) for m in members):
            problems.add(f'sets.{name}', 'must be a list of run ids or branch names')
            continue
        if not (all(m in RUN_IDS for m in members) or all(m in BRANCHES for m in members)):
            problems.add(f'sets.{name}', 'must hold only run ids or only branch names')
        out[name] = tuple(members)
    return out


def _parse_branch_table(raw: Any, problems: _Problems) -> dict[str, tuple[tuple[str, str], ...]]:
    if not isinstance(raw, dict) or not raw:
        problems.add('branch_table', 'must map each branch path to its [run, branch] sequence')
        return {}
    table: dict[str, tuple[tuple[str, str], ...]] = {}
    for name, seq in raw.items():
        where = f'branch_table.{name}'
        if name not in BRANCHES:
            problems.add(where, f'{name!r} is not a branch name')
        if not isinstance(seq, list) or not seq:
            problems.add(where, 'must be a non-empty list of [run, branch] pairs')
            continue
        pairs: list[tuple[str, str]] = []
        for item in seq:
            if (
                not isinstance(item, list)
                or len(item) != 2
                or item[0] not in RUN_IDS
                or item[1] not in BRANCHES
            ):
                problems.add(where, f'{item!r} is not a [run id, branch] pair')
                continue
            pairs.append((item[0], item[1]))
        runs = [p[0] for p in pairs]
        if len(set(runs)) != len(runs):
            problems.add(where, 'a run appears twice')
        if runs != sorted(runs, key=RUN_IDS.index):
            problems.add(where, 'runs are out of order')
        if pairs and pairs[-1][1] != name:
            problems.add(where, f'the path must end on branch {name!r}')
        table[str(name)] = tuple(pairs)
    return table


def _parse_budget(raw: Any, table: Mapping[str, Any], problems: _Problems) -> dict[str, int]:
    if not isinstance(raw, dict):
        problems.add(
            'proxy_vault_read_budget', 'must map each branch path to its number of reads'
        )
        return {}
    out = {}
    for name, value in raw.items():
        if name not in table:
            problems.add('proxy_vault_read_budget', f'{name!r} is not a branch path')
        if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 3:
            problems.add(
                f'proxy_vault_read_budget.{name}', f'must be 0..3 (reads_max 3), got {value!r}'
            )
            continue
        out[str(name)] = value
    for name in table:
        if name not in out:
            problems.add('proxy_vault_read_budget', f'no budget for path {name!r}')
    return out


def _parse_mde(raw: Any, problems: _Problems) -> dict[str, float | None]:
    if not isinstance(raw, dict):
        problems.add('mde_r00', f'must map {list(MDE_KEYS)} to numbers (null in the template)')
        return dict.fromkeys(MDE_KEYS)
    if set(raw) != set(MDE_KEYS):
        problems.add('mde_r00', f'keys must be exactly {list(MDE_KEYS)}, got {sorted(raw)}')
    out: dict[str, float | None] = {}
    for key in MDE_KEYS:
        value = raw.get(key)
        if value is not None and (not _number(value) or value < 0):
            problems.add(f'mde_r00.{key}', f'must be null or a number >= 0, got {value!r}')
            value = None
        out[key] = None if value is None else float(value)
    return out


def _parse_defines(raw: Any, where: str, problems: _Problems) -> dict[str, Expr]:
    if not isinstance(raw, dict):
        problems.add(where, 'must map macro names to expressions over x')
        return {}
    out: dict[str, Expr] = {}
    for name, source in raw.items():
        if not isinstance(name, str) or not _MACRO.match(name) or name in ('FIRES', 'OUT_OF_SCOPE'):
            problems.add(where, f'{name!r} must be an UPPERCASE name that is not a built-in')
            continue
        expr = _expr(source, f'{where}.{name}', problems)
        if expr is None:
            continue
        try:  # a macro body may read only x
            expr.reads(Env(x='x'))
        except ExprError as error:
            problems.add(f'{where}.{name}', str(error))
            continue
        out[name] = expr
    return out


def _parse_rule(
    raw: Any, index: int, sets: Mapping[str, tuple[str, ...]], rows: dict[str, RowSpec],
    references: list[tuple[str, str, str]], problems: _Problems,
) -> Rule | None:  # fmt: skip
    if not isinstance(raw, dict) or not isinstance(raw.get('id'), str):
        problems.add(f'rules[{index}]', 'must be a mapping with a string id')
        return None
    rule_id = raw['id']
    if rule_id not in RULE_IDS:
        problems.add(rule_id, f'unknown rule id (arc-report/1 allows {list(RULE_IDS)})')
    for key in sorted(set(raw) - _RULE_KEYS):
        problems.add(rule_id, f'unknown key {key!r}')

    applies_to: list[Clause] = []
    raw_scope = raw.get('applies_to')
    if not isinstance(raw_scope, list) or not raw_scope:
        problems.add(rule_id, 'lacks applies_to (every rule carries a list of {runs, branches})')
    else:
        for n, clause in enumerate(raw_scope):
            where = f'{rule_id}.applies_to[{n}]'
            if not isinstance(clause, dict) or set(clause) != {'runs', 'branches'}:
                problems.add(where, 'must be exactly {runs, branches}')
                continue
            applies_to.append(
                Clause(
                    runs=_expand(clause['runs'], RUN_IDS, sets, f'{where}.runs', problems),
                    branches=_expand(
                        clause['branches'], BRANCHES, sets, f'{where}.branches', problems
                    ),
                )
            )

    defines = _parse_defines(raw.get('defines') or {}, f'{rule_id}.defines', problems)
    lets: dict[str, Expr] = {}
    for name, source in (raw.get('let') or {}).items():
        if not isinstance(name, str) or not _IDENT.match(name) or name in (*NAMESPACES, 'x'):
            problems.add(f'{rule_id}.let', f'{name!r} is not a usable name')
            continue
        expr = _expr(source, f'{rule_id}.let.{name}', problems)
        if expr is not None:
            lets[name] = expr

    aliases: dict[str, str] = {}
    raw_rows = raw.get('rows') or {}
    if not isinstance(raw_rows, dict):
        problems.add(rule_id, 'rows must map aliases to row definitions or comparison ids')
        raw_rows = {}
    for alias, body in raw_rows.items():
        where = f'{rule_id}.rows.{alias}'
        if (
            not isinstance(alias, str)
            or not _IDENT.match(alias)
            or alias in (*NAMESPACES, *CONTEXT_NAMES, 'x')
            or alias in lets
        ):
            problems.add(where, 'is not a usable row alias')
            continue
        if isinstance(body, str):
            aliases[alias] = body
            references.append((rule_id, alias, body))
            continue
        spec = _parse_row(body, f'{rule_id}.{alias}', rule_id, where, problems)
        if spec is not None:
            if spec.comparison_id in rows:
                problems.add(where, f'{spec.comparison_id} is defined twice')
            rows[spec.comparison_id] = spec
            aliases[alias] = spec.comparison_id

    outcomes: list[tuple[str, Expr]] = []
    for n, item in enumerate(raw.get('outcomes') or []):
        where = f'{rule_id}.outcomes[{n}]'
        if not isinstance(item, list) or len(item) != 2:
            problems.add(where, 'must be a [status, condition] pair')
            continue
        status, source = item
        if status not in _OUTCOME_STATUSES:
            problems.add(where, f'unknown status {status!r}')
            continue
        expr = _expr(source, where, problems)
        if expr is not None:
            outcomes.append((status, expr))
    else_status = raw.get('else')
    if else_status is not None and else_status not in _OUTCOME_STATUSES:
        problems.add(rule_id, f'else: unknown status {else_status!r}')
    constant = raw.get('status')
    if constant is not None and constant not in _OUTCOME_STATUSES:
        problems.add(rule_id, f'status: unknown status {constant!r}')
    if constant is not None and (outcomes or else_status is not None):
        problems.add(rule_id, 'give either a constant status or outcomes + else, not both')
    if constant is None and else_status is None:
        problems.add(rule_id, 'needs a constant status, or outcomes with an else')

    reads = raw.get('reads') or []
    if not isinstance(reads, list) or not all(
        isinstance(p, str) and p.split('.')[0] in NAMESPACES for p in reads
    ):
        problems.add(rule_id, f'reads must be verdicts.json paths under {list(NAMESPACES)}')
        reads = []

    provisional = None
    if raw.get('provisional') is not None:
        provisional = _expr(raw['provisional'], f'{rule_id}.provisional', problems)

    summaries: dict[str, Expr] = {}
    for key, source in (raw.get('gates_summary') or {}).items():
        if key not in GATE_SUMMARY_KEYS:
            problems.add(f'{rule_id}.gates_summary', f'{key!r} is not a gates_summary field')
            continue
        expr = _expr(source, f'{rule_id}.gates_summary.{key}', problems)
        if expr is not None:
            summaries[key] = expr
    derive: dict[str, Expr] = {}
    for key, source in (raw.get('derive') or {}).items():
        expr = _expr(source, f'{rule_id}.derive.{key}', problems)
        if expr is not None:
            derive[str(key)] = expr

    adopt = raw.get('adopt')
    if adopt is not None:
        adopt = _parse_adopt(adopt, rule_id, problems)
        if constant != 'DONE':
            problems.add(rule_id, 'an adoption rule has the constant status DONE')

    arc_fallback = raw.get('arc_fallback')
    if arc_fallback is not None and not isinstance(arc_fallback, str):
        problems.add(rule_id, 'arc_fallback must be a rule id')
        arc_fallback = None

    return Rule(
        id=rule_id,
        title=str(raw.get('title') or rule_id),
        applies_to=tuple(applies_to),
        rows=aliases,
        lets=lets,
        defines=defines,
        outcomes=tuple(outcomes),
        else_status=else_status,
        status=constant,
        reads=tuple(reads),
        provisional=provisional,
        gates_summary=summaries,
        derive=derive,
        adopt=adopt,
        arc_fallback=arc_fallback,
    )


def _parse_row(
    raw: Any, comparison_id: str, owner: str, where: str, problems: _Problems
) -> RowSpec | None:
    if not isinstance(raw, dict):
        problems.add(where, 'must be a mapping (or a comparison id string)')
        return None
    for key in sorted(set(raw) - _ROW_KEYS):
        problems.add(where, f'unknown key {key!r}')
    kind = raw.get('kind')
    if kind not in ROW_KINDS:
        problems.add(where, f'kind must be one of {list(ROW_KINDS)}, got {kind!r}')
        return None
    for key in ('arm_a', 'stratum', 'metric'):
        if not isinstance(raw.get(key), str) or not raw[key]:
            problems.add(where, f'{key} must be a non-empty string')
    arm_b = raw.get('arm_b')
    if arm_b is not None and not isinstance(arm_b, str):
        problems.add(where, 'arm_b must be a system id or null')
    unit = raw.get('unit')
    if unit not in UNITS:
        problems.add(where, f'unit must be one of {list(UNITS)}, got {unit!r}')
    estimator = raw.get('estimator', 'pigeonhole')
    if estimator not in ESTIMATORS:
        problems.add(where, f'estimator must be one of {list(ESTIMATORS)}, got {estimator!r}')
    if (kind == 'ratio') != (estimator == 'cluster_ratio'):
        problems.add(where, 'ratio rows (and only they) use the cluster_ratio estimator')
    tau_floor = raw.get('tau_floor')
    if tau_floor is not None and not _number(tau_floor):
        problems.add(where, f'tau_floor must be a number, got {tau_floor!r}')
        tau_floor = None
    mde = raw.get('mde')
    if mde is not None and mde not in MDE_KEYS:
        problems.add(where, f'mde must be one of {list(MDE_KEYS)}, got {mde!r}')
        mde = None

    registered: bool | Expr = True
    raw_registered = raw.get('registered', True)
    if isinstance(raw_registered, bool):
        registered = raw_registered
    else:
        expr = _expr(raw_registered, f'{where}.registered', problems)
        registered = expr if expr is not None else True
    if kind == 'report' and registered is not False:
        problems.add(where, 'a report row is exploratory: registered must be false')

    fires = _expr(raw['fires'], f'{where}.fires', problems) if 'fires' in raw else None
    passes = _expr(raw['passes'], f'{where}.passes', problems) if 'passes' in raw else None
    if kind == 'superiority' and passes is None:
        passes = Expr('PASS(x)')
    if kind in ('guard', 'bound') and (fires is None or passes is not None):
        problems.add(where, f'a {kind} row has a `fires` expression and no `passes`')
    if kind in ('superiority', 'ratio') and (passes is None or fires is not None):
        problems.add(where, f'a {kind} row has a `passes` expression and no `fires`')
    if kind == 'report' and (fires is not None or passes is not None):
        problems.add(where, 'a report row has neither `fires` nor `passes`')
    prediction = (
        _expr(raw['prediction'], f'{where}.prediction', problems) if 'prediction' in raw else None
    )
    holm = raw.get('holm', kind == 'superiority' and registered is not False)
    if not isinstance(holm, bool):
        problems.add(where, 'holm must be true or false')
        holm = False
    if holm and registered is False:
        problems.add(where, 'an unregistered row cannot be in a Holm family')
    return RowSpec(
        comparison_id=comparison_id,
        hypothesis=owner,
        kind=kind,
        arm_a=str(raw.get('arm_a')),
        arm_b=arm_b,
        stratum=str(raw.get('stratum')),
        metric=str(raw.get('metric')),
        unit=str(unit),
        estimator=str(estimator),
        tau_floor=None if tau_floor is None else float(tau_floor),
        mde=mde,
        holm=holm,
        registered=registered,
        fires=fires,
        passes=passes,
        prediction=prediction,
    )


def _parse_adopt(raw: Any, rule_id: str, problems: _Problems) -> dict[str, Any] | None:
    where = f'{rule_id}.adopt'
    if not isinstance(raw, dict) or raw.get('method') not in ('default', 'squeeze'):
        problems.add(where, 'must be {method: default | squeeze, ...}')
        return None
    expected = {
        'default': {'method', 'min_gain'},
        'squeeze': {'method', 'within', 'max_bundle_raw'},
    }
    keys = expected[raw['method']]
    if set(raw) != keys:
        problems.add(where, f'{raw["method"]} takes exactly {sorted(keys)}')
        return None
    for key in keys - {'method'}:
        if not _number(raw[key]) or raw[key] < 0:
            problems.add(where, f'{key} must be a number >= 0')
            return None
    return dict(raw)


def _parse_decisions(
    raw: Any, rules: Mapping[str, Rule], table: Mapping[str, tuple[tuple[str, str], ...]],
    problems: _Problems,
) -> tuple[Decision, ...]:  # fmt: skip
    if not isinstance(raw, list):
        problems.add('decisions', 'must be a list')
        return ()
    out: list[Decision] = []
    for n, item in enumerate(raw):
        where = f'decisions[{n}]'
        if not isinstance(item, dict) or set(item) != {'after', 'branch', 'rule', 'outcomes'}:
            problems.add(where, 'must be {after, branch, rule, outcomes}')
            continue
        if item['after'] not in RUN_IDS or item['branch'] not in BRANCHES:
            problems.add(where, f'unknown run or branch {item["after"]!r}/{item["branch"]!r}')
            continue
        if item['rule'] not in rules:
            problems.add(where, f'unknown rule {item["rule"]!r}')
            continue
        outcomes = item['outcomes']
        if not isinstance(outcomes, dict) or not outcomes:
            problems.add(where, 'outcomes must map statuses to lists of branch paths')
            continue
        parsed: dict[str, tuple[str, ...]] = {}
        for status, paths in outcomes.items():
            if not isinstance(paths, list) or not paths or any(p not in table for p in paths):
                problems.add(where, f'{status}: {paths!r} is not a list of branch paths')
                continue
            parsed[str(status)] = tuple(paths)
        out.append(Decision(item['after'], item['branch'], item['rule'], parsed))
    return tuple(out)


def _check_expressions(rules: Rules, problems: _Problems) -> None:
    """Every expression must analyse cleanly (known names, rows, fields as names, functions)."""
    for rule in rules.rules:
        try:
            reads = rules.rule_reads(rule)
            env = rules.rule_env(rule, names=frozenset(CONTEXT_NAMES))
            for expr in (*rule.gates_summary.values(), *rule.derive.values()):
                reads |= expr.reads(env)
        except ExprError as error:
            problems.add(rule.id, str(error))
            continue
        for read in sorted(reads, key=str):
            if read.row is not None and read.path in UNREADABLE_ROW_FIELDS:
                problems.add(rule.id, f'reads {read}, an outcome field no rule may read')


def _check_summaries(rules: Rules, problems: _Problems) -> None:
    producers: dict[str, list[str]] = {}
    for rule in rules.rules:
        for key in rule.gates_summary:
            producers.setdefault(key, []).append(rule.id)
    for key in GATE_SUMMARY_KEYS:
        found = producers.get(key, [])
        if len(found) != 1:
            problems.add(
                'gates_summary', f'{key} must be produced by exactly one rule, got {found}'
            )


def freeze_text(text: str, mde: Mapping[str, float]) -> str:
    """Write the R00 MDEs into a rules.yaml text, keeping its comments and layout.

    Only the values under `mde_r00:` change; the result is re-parsed to prove it is still valid.
    """
    missing = [k for k in MDE_KEYS if k not in mde]
    extra = sorted(set(mde) - set(MDE_KEYS))
    if missing or extra:
        raise RulesError(
            [f'freeze needs exactly {list(MDE_KEYS)} (missing {missing}, extra {extra})']
        )
    for key, value in mde.items():
        if not _number(value) or value < 0:
            raise RulesError([f'mde_r00.{key} must be a number >= 0, got {value!r}'])
    out: list[str] = []
    in_block = False
    seen: set[str] = set()
    for line in text.splitlines(keepends=True):
        body = line.rstrip('\r\n')
        newline = line[len(body) :]
        if re.match(r'^mde_r00:\s*(#.*)?$', body):
            in_block = True
        elif in_block:
            match = re.match(r'^(\s+)([A-Za-z]+):[^#]*(#.*)?$', body)
            if match and match.group(2) in MDE_KEYS:
                indent, key, comment = match.group(1), match.group(2), match.group(3)
                suffix = f'  {comment}' if comment else ''
                out.append(f'{indent}{key}: {float(mde[key])!r}{suffix}{newline}')
                seen.add(key)
                continue
            if body.strip() and not body.strip().startswith('#'):
                in_block = False
        out.append(line)
    if seen != set(MDE_KEYS):
        raise RulesError([f'no block-style mde_r00 with every key (found {sorted(seen)})'])
    frozen = ''.join(out)
    loads_rules(frozen)  # still valid
    return frozen


def freeze_diff(template: str, frozen: str) -> list[str] | None:
    """The mde_r00 keys a freeze changed, or None if it changed anything else.

    The R00 freeze may write the six MDEs and nothing more: every other line of the s0-committed
    rules.yaml (rules, rows, taus, falsifiers, comments) must be byte-identical.
    """
    old, new = template.splitlines(keepends=True), frozen.splitlines(keepends=True)
    if len(old) != len(new):
        return None
    changed: list[str] = []
    in_block = False
    for a, b in zip(old, new, strict=True):
        if re.match(r'^mde_r00:\s*(#.*)?$', a.rstrip('\r\n')):
            in_block = True
            if a != b:
                return None
            continue
        if in_block and a.strip() and not a.startswith((' ', '#')):
            in_block = False
        if a == b:
            continue
        key_a = re.match(r'^\s+([A-Za-z]+):', a)
        key_b = re.match(r'^\s+([A-Za-z]+):', b)
        if not (in_block and key_a and key_b and key_a.group(1) == key_b.group(1)):
            return None
        if key_a.group(1) not in MDE_KEYS:
            return None
        changed.append(key_a.group(1))
    return changed
