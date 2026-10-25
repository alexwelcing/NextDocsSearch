"""The expression language of rules.yaml: a safe, statically analysable subset of Python.

Every verdict is written in rules.yaml as a boolean expression, so a reader (and Fable's blind
pass) can recompute it from that file alone:

    c1.ci_hi_raw < 0.02 or FIRES(g1)

The grammar is a whitelist over Python's `ast`: `and`/`or`/`not`, comparisons (including `in`),
`+ - * /`, unary minus, numbers, strings, True/False/None, tuples and lists, `a if c else b`,
attribute access on known names, and calls to a fixed set of functions. Nothing else parses, so a
rule can never reach into Python.

Names:
- a row alias of the rule (`c1`, `g1`, ...) or `x` inside a macro or row-level expression;
  `<row>.<field>` reads a VerdictRow field;
- a namespace of verdicts.json: `run`, `vault`, `gates_inputs`, `gates_summary`, `signoff_inputs`;
  `vault.sign` reads that field;
- a `let` of the rule, which names a sub-expression (H1's active family F);
- `status` and `in_scope` in gates_summary and derive expressions.

Functions: the macros defined in rules.yaml (`PASS`, `BETTER`), each applied to every row of its
arguments and true only if it holds for all of them; `FIRES(row)`, the row's own `fires`
expression; `OUT_OF_SCOPE('H1', ...)`; and `min`, `max`, `abs`.

Two passes walk the same tree:
- `reads()` lists, statically, every field an expression can read, over both arms of every
  branch. The verdict function resolves all of them before it evaluates anything, so a null makes
  an in-scope rule NOT_COMPUTABLE whatever the short-circuit order, and the lint checks exactly
  the same set against the report schema and the run plan.
- `evaluate()` computes the value. Reads go through callbacks, so the same expression runs on a
  full verdicts.json, on a blind (stripped) one, and inside the lint.
"""

from __future__ import annotations

import ast
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field, replace
from typing import Any, NamedTuple

NAMESPACES: tuple[str, ...] = ('run', 'vault', 'gates_inputs', 'gates_summary', 'signoff_inputs')
BUILTINS: dict[str, Callable[..., Any]] = {'min': min, 'max': max, 'abs': abs}
SPECIAL_FUNCTIONS: tuple[str, ...] = ('FIRES', 'OUT_OF_SCOPE')
CONTEXT_NAMES: tuple[str, ...] = ('status', 'in_scope')

_ALLOWED_NODES = (
    ast.Expression, ast.BoolOp, ast.And, ast.Or, ast.UnaryOp, ast.Not, ast.USub, ast.UAdd,
    ast.BinOp, ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Compare, ast.Eq, ast.NotEq, ast.Lt,
    ast.LtE, ast.Gt, ast.GtE, ast.In, ast.NotIn, ast.Name, ast.Load, ast.Attribute, ast.Constant,
    ast.Tuple, ast.List, ast.Call, ast.IfExp,
)  # fmt: skip


class ExprError(ValueError):
    """An expression that does not parse, names something unknown, or misuses a value."""


class Read(NamedTuple):
    """One field an expression reads: a VerdictRow field, or a dotted path in verdicts.json."""

    row: str | None  # comparison id, or None for a verdicts-doc path
    path: str  # the row field, or e.g. 'vault.sign'

    def __str__(self) -> str:
        return f'{self.row}.{self.path}' if self.row else self.path


class NullRead(Exception):
    """Raised by `evaluate` when a read resolves to null (or a row is absent)."""

    def __init__(self, read: Read):
        super().__init__(str(read))
        self.read = read


@dataclass(frozen=True)
class RowValue:
    """A row used as a value, e.g. the argument of PASS(c1)."""

    comparison_id: str


@dataclass(frozen=True)
class Env:
    """What names mean while analysing or evaluating one expression.

    The static part (rows, lets, macros, fires, x, names) is enough for `reads()`; `evaluate()`
    also needs the callbacks.
    """

    rows: Mapping[str, str] = field(default_factory=dict)  # alias -> comparison id
    lets: Mapping[str, Expr] = field(default_factory=dict)
    macros: Mapping[str, Expr] = field(default_factory=dict)
    fires: Mapping[str, Expr] = field(default_factory=dict)  # comparison id -> its fires expr
    x: str | None = None  # comparison id bound to `x`
    names: frozenset[str] = frozenset()  # allowed CONTEXT_NAMES
    # Static analysis: when known, `... if in_scope else ...` reads only the arm that applies.
    in_scope_known: bool | None = None
    # Evaluation callbacks.
    get_row: Callable[[str], Mapping[str, Any] | None] | None = None
    get_doc: Callable[[str], Any] | None = None
    rule_in_scope: Callable[[str], bool] | None = None
    context: Mapping[str, Any] = field(default_factory=dict)  # values of `status`, `in_scope`


class Expr:
    """One parsed, validated expression. `source` is the whitespace-normalised text."""

    def __init__(self, source: str):
        if not isinstance(source, str) or not source.strip():
            raise ExprError('empty expression')
        self.source = ' '.join(source.split())
        try:
            tree = ast.parse(self.source, mode='eval')
        except SyntaxError as error:
            raise ExprError(f'{self.source!r}: {error.msg}') from None
        for node in ast.walk(tree):
            if not isinstance(node, _ALLOWED_NODES):
                raise ExprError(f'{self.source!r}: {type(node).__name__} is not allowed')
            if isinstance(node, ast.Constant) and not (
                node.value is None or isinstance(node.value, (bool, int, float, str))
            ):
                raise ExprError(f'{self.source!r}: constant {node.value!r} is not allowed')
            if isinstance(node, ast.Call) and (
                node.keywords or not isinstance(node.func, ast.Name)
            ):
                raise ExprError(f'{self.source!r}: only plain calls f(a, b) are allowed')
            if isinstance(node, ast.Attribute) and not isinstance(
                node.value, (ast.Name, ast.Attribute)
            ):
                raise ExprError(f'{self.source!r}: attributes apply to names only')
        self.tree: ast.expr = tree.body

    def __repr__(self) -> str:
        return f'Expr({self.source!r})'

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Expr) and other.source == self.source

    def __hash__(self) -> int:
        return hash(self.source)

    # ---- static analysis -------------------------------------------------------------------

    def reads(self, env: Env) -> set[Read]:
        """Every field this expression can read, over all branches. Raises ExprError on misuse."""
        out: set[Read] = set()
        _Analyzer(self, env, out).visit(self.tree, ())
        return out

    def rows(self, env: Env) -> set[str]:
        """Comparison ids of every row that can flow through this expression as a value."""
        return _Analyzer(self, env, set()).row_values(self.tree, ())

    def context_names(self, env: Env) -> set[str]:
        """The CONTEXT_NAMES (`status`, `in_scope`) the expression uses, as `reads()` walks it."""
        names: set[str] = set()
        _Analyzer(self, env, set(), names).visit(self.tree, ())
        return names

    # ---- evaluation ------------------------------------------------------------------------

    def evaluate(self, env: Env) -> Any:
        """The value. Raises NullRead on a null read and ExprError on a type error."""
        return _Evaluator(self, env).eval(self.tree, ())


def _chain(node: ast.expr) -> tuple[str, list[str]]:
    attrs: list[str] = []
    while isinstance(node, ast.Attribute):
        attrs.append(node.attr)
        node = node.value
    if not isinstance(node, ast.Name):  # excluded by Expr's validation
        raise ExprError('attribute on a non-name')
    return node.id, attrs[::-1]


class _Analyzer:
    def __init__(self, expr: Expr, env: Env, out: set[Read], names: set[str] | None = None):
        self.expr, self.env, self.out = expr, env, out
        self.names = names if names is not None else set()

    def sub(self, expr: Expr, env: Env) -> _Analyzer:
        return _Analyzer(expr, env, self.out, self.names)

    def fail(self, message: str) -> ExprError:
        return ExprError(f'{self.expr.source!r}: {message}')

    def row_id(self, name: str) -> str | None:
        if name == 'x':
            if self.env.x is None:
                raise self.fail('`x` is only defined inside macros and row expressions')
            return self.env.x
        return self.env.rows.get(name)

    def visit(self, node: ast.expr, stack: tuple[str, ...]) -> None:
        if isinstance(node, ast.Attribute):
            base, attrs = _chain(node)
            row = self.row_id(base) if base == 'x' or base in self.env.rows else None
            if row is not None:
                if len(attrs) != 1:
                    raise self.fail(f'{base}.{".".join(attrs)}: a row has fields, not paths')
                self.out.add(Read(row, attrs[0]))
            elif base in NAMESPACES:
                self.out.add(Read(None, '.'.join([base, *attrs])))
            else:
                raise self.fail(f'unknown name {base!r}')
            return
        if isinstance(node, ast.Name):
            self.name(node.id, stack)
            return
        if isinstance(node, ast.Call):
            self.call(node, stack)
            return
        if isinstance(node, ast.IfExp) and self.is_in_scope_test(node.test):
            arm = node.body if self.env.in_scope_known else node.orelse
            self.visit(arm, stack)
            return
        for child in ast.iter_child_nodes(node):
            if isinstance(child, ast.expr):
                self.visit(child, stack)

    def is_in_scope_test(self, test: ast.expr) -> bool:
        return (
            self.env.in_scope_known is not None
            and isinstance(test, ast.Name)
            and test.id == 'in_scope'
        )

    def name(self, name: str, stack: tuple[str, ...]) -> None:
        if name == 'x' or name in self.env.rows:
            self.row_id(name)  # a row used as a value reads nothing by itself
        elif name in self.env.lets:
            if name in stack:
                raise self.fail(f'let {name!r} refers to itself')
            let = self.env.lets[name]
            self.sub(let, self.env).visit(let.tree, (*stack, name))
        elif name in self.env.names:
            self.names.add(name)
        elif name in NAMESPACES:
            raise self.fail(f'{name!r} is a namespace; read a field such as {name}.<field>')
        else:
            raise self.fail(f'unknown name {name!r}')

    def call(self, node: ast.Call, stack: tuple[str, ...]) -> None:
        assert isinstance(node.func, ast.Name)
        fn = node.func.id
        if fn in self.env.macros:
            macro = self.env.macros[fn]
            if not node.args:
                raise self.fail(f'{fn}() needs at least one row')
            for arg in node.args:
                self.visit(arg, stack)
                for row in sorted(self.row_values(arg, stack)):
                    inner = replace(self.env, x=row, rows={}, lets={})
                    self.sub(macro, inner).visit(macro.tree, ())
        elif fn == 'FIRES':
            if not node.args:
                raise self.fail('FIRES() needs at least one row')
            for arg in node.args:
                self.visit(arg, stack)
                for row in sorted(self.row_values(arg, stack)):
                    if row not in self.env.fires:
                        raise self.fail(f'FIRES({row}): that row has no `fires` expression')
                    fires = self.env.fires[row]
                    inner = replace(self.env, x=row, rows={}, lets={})
                    self.sub(fires, inner).visit(fires.tree, ())
        elif fn == 'OUT_OF_SCOPE':
            if not node.args or not all(
                isinstance(a, ast.Constant) and isinstance(a.value, str) for a in node.args
            ):
                raise self.fail("OUT_OF_SCOPE() takes rule ids as strings, e.g. 'H1'")
        elif fn in BUILTINS:
            for arg in node.args:
                self.visit(arg, stack)
        else:
            raise self.fail(f'unknown function {fn!r}')

    def row_values(self, node: ast.expr, stack: tuple[str, ...]) -> set[str]:
        if isinstance(node, ast.Name):
            if node.id == 'x' or node.id in self.env.rows:
                row = self.row_id(node.id)
                assert row is not None
                return {row}
            if node.id in self.env.lets:
                if node.id in stack:
                    raise self.fail(f'let {node.id!r} refers to itself')
                let = self.env.lets[node.id]
                return _Analyzer(let, self.env, set()).row_values(let.tree, (*stack, node.id))
        if isinstance(node, (ast.List, ast.Tuple)):
            return (
                set().union(*(self.row_values(e, stack) for e in node.elts)) if node.elts else set()
            )
        if isinstance(node, ast.IfExp):
            return self.row_values(node.body, stack) | self.row_values(node.orelse, stack)
        raise self.fail(f'{ast.unparse(node)!r} is not a row, a list of rows or a let of rows')


class _Evaluator:
    def __init__(self, expr: Expr, env: Env):
        self.expr, self.env = expr, env

    def fail(self, message: str) -> ExprError:
        return ExprError(f'{self.expr.source!r}: {message}')

    def row(self, name: str) -> str:
        row = self.env.x if name == 'x' else self.env.rows.get(name)
        if row is None:
            raise self.fail(f'unknown row {name!r}')
        return row

    def eval(self, node: ast.expr, stack: tuple[str, ...]) -> Any:
        method = getattr(self, f'eval_{type(node).__name__}')
        return method(node, stack)

    def eval_Constant(self, node: ast.Constant, _stack) -> Any:
        return node.value

    def eval_Name(self, node: ast.Name, stack) -> Any:
        if node.id == 'x' or node.id in self.env.rows:
            return RowValue(self.row(node.id))
        if node.id in self.env.lets:
            let = self.env.lets[node.id]
            return _Evaluator(let, self.env).eval(let.tree, (*stack, node.id))
        if node.id in self.env.names:
            if self.env.context.get(node.id) is None:
                raise NullRead(Read(None, node.id))  # e.g. `status` of an out-of-scope rule
            return self.env.context[node.id]
        raise self.fail(f'unknown name {node.id!r}')

    def eval_Attribute(self, node: ast.Attribute, _stack) -> Any:
        base, attrs = _chain(node)
        if base == 'x' or base in self.env.rows:
            row_id = self.row(base)
            read = Read(row_id, attrs[0])
            if self.env.get_row is None:
                raise self.fail('no row resolver')
            row = self.env.get_row(row_id)
            value = None if row is None else row.get(attrs[0])
        elif base in NAMESPACES:
            read = Read(None, '.'.join([base, *attrs]))
            if self.env.get_doc is None:
                raise self.fail('no document resolver')
            value = self.env.get_doc(read.path)
        else:
            raise self.fail(f'unknown name {base!r}')
        if value is None:
            raise NullRead(read)
        return value

    def eval_List(self, node: ast.List, stack) -> list[Any]:
        return [self.eval(e, stack) for e in node.elts]

    eval_Tuple = eval_List

    def eval_IfExp(self, node: ast.IfExp, stack) -> Any:
        test = self.boolean(self.eval(node.test, stack), 'if')
        return self.eval(node.body if test else node.orelse, stack)

    def eval_BoolOp(self, node: ast.BoolOp, stack) -> bool:
        if isinstance(node.op, ast.And):
            return all(self.boolean(self.eval(v, stack), 'and') for v in node.values)
        return any(self.boolean(self.eval(v, stack), 'or') for v in node.values)

    def eval_UnaryOp(self, node: ast.UnaryOp, stack) -> Any:
        value = self.eval(node.operand, stack)
        if isinstance(node.op, ast.Not):
            return not self.boolean(value, 'not')
        number = self.number(value, 'unary minus')
        return -number if isinstance(node.op, ast.USub) else number

    def eval_BinOp(self, node: ast.BinOp, stack) -> float:
        left = self.number(self.eval(node.left, stack), 'arithmetic')
        right = self.number(self.eval(node.right, stack), 'arithmetic')
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if right == 0:
            raise self.fail('division by zero')
        return left / right

    def eval_Compare(self, node: ast.Compare, stack) -> bool:
        left = self.eval(node.left, stack)
        for op, comparator in zip(node.ops, node.comparators, strict=True):
            right = self.eval(comparator, stack)
            if isinstance(op, (ast.In, ast.NotIn)):
                if not isinstance(right, list):
                    raise self.fail('`in` needs a tuple or list on the right')
                found = any(_same(left, item) for item in right)
                ok = found if isinstance(op, ast.In) else not found
            elif isinstance(op, (ast.Eq, ast.NotEq)):
                ok = _same(left, right) if isinstance(op, ast.Eq) else not _same(left, right)
            else:
                a, b = self.number(left, 'comparison'), self.number(right, 'comparison')
                ok = {ast.Lt: a < b, ast.LtE: a <= b, ast.Gt: a > b, ast.GtE: a >= b}[type(op)]
            if not ok:
                return False
            left = right
        return True

    def eval_Call(self, node: ast.Call, stack) -> Any:
        assert isinstance(node.func, ast.Name)
        fn = node.func.id
        if fn in self.env.macros or fn == 'FIRES':
            rows = [r for arg in node.args for r in self.flatten(self.eval(arg, stack))]
            if not rows:
                raise self.fail(f'{fn}() got no rows')
            for row in rows:
                body = self.env.macros[fn] if fn in self.env.macros else self.env.fires.get(row)
                if body is None:
                    raise self.fail(f'FIRES({row}): that row has no `fires` expression')
                inner = replace(self.env, x=row, rows={}, lets={})
                if not self.boolean(_Evaluator(body, inner).eval(body.tree, ()), fn):
                    return False
            return True
        if fn == 'OUT_OF_SCOPE':
            if self.env.rule_in_scope is None:
                raise self.fail('no scope resolver')
            ids = [a.value for a in node.args if isinstance(a, ast.Constant)]
            if not ids or len(ids) != len(node.args) or not all(isinstance(i, str) for i in ids):
                raise self.fail("OUT_OF_SCOPE() takes rule ids as strings, e.g. 'H1'")
            return all(not self.env.rule_in_scope(rule_id) for rule_id in ids)
        if fn in BUILTINS:
            args = [self.number(self.eval(a, stack), fn) for a in node.args]
            return BUILTINS[fn](*args)
        raise self.fail(f'unknown function {fn!r}')

    def flatten(self, value: Any) -> list[str]:
        if isinstance(value, RowValue):
            return [value.comparison_id]
        if isinstance(value, list):
            return [r for item in value for r in self.flatten(item)]
        raise self.fail(f'expected rows, got {value!r}')

    def boolean(self, value: Any, where: str) -> bool:
        if not isinstance(value, bool):
            raise self.fail(f'{where} needs true/false, got {value!r}')
        return value

    def number(self, value: Any, where: str) -> float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise self.fail(f'{where} needs a number, got {value!r}')
        return value


def _same(a: Any, b: Any) -> bool:
    """Equality that never confuses true/false with 1/0 (vault.sign is an int or a string)."""
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    return a == b
