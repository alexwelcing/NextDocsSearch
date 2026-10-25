"""The expression language of rules.yaml: what parses, what it reads, how it evaluates."""

from __future__ import annotations

import pytest

from arcforge.contract.expr import Env, Expr, ExprError, NullRead, Read

ROWS = {'c1': 'H1.c1', 'g1': 'H1.g1', 'c2': 'H1.c2'}
PASS = Expr('x.point >= x.tau and x.ci_lo_adj > 0 and x.point > x.seed_sd')
FIRES = {'H1.g1': Expr('x.point < -0.02 and x.ci_hi_raw < 0')}


def env(rows=None, doc=None, **kwargs) -> Env:
    rows = rows if rows is not None else {}
    doc = doc if doc is not None else {}

    def get_doc(path):
        node = doc
        for part in path.split('.'):
            node = node.get(part) if isinstance(node, dict) else None
        return node

    defaults = dict(
        rows=ROWS,
        macros={'PASS': PASS},
        fires=FIRES,
        get_row=rows.get,
        get_doc=get_doc,
        rule_in_scope=lambda rule_id: rule_id == 'H5',
    )
    defaults.update(kwargs)
    return Env(**defaults)


@pytest.mark.parametrize(
    'source',
    [
        "__import__('os')",
        'c1.point.real.imag',
        'lambda: 1',
        '[x for x in c1]',
        'c1.point ** 2',
        'c1.point if c1 else 0; 1',
        "f'{c1}'",
        'c1[0]',
        'min(c1.point, key=abs)',
        'PASS(*F)',
        '(lambda: 0)()',
        '{1: 2}',
        "b'bytes'",
    ],
)
def test_unsafe_or_unsupported_syntax_does_not_parse(source):
    with pytest.raises(ExprError):
        Expr(source).reads(env())


def test_reads_cover_every_branch_and_macro():
    expr = Expr('c1.ci_hi_raw < 0.02 or FIRES(g1) or (PASS(c2) and proxy_vault.sign == 1)')
    assert expr.reads(env()) == {
        Read('H1.c1', 'ci_hi_raw'),
        Read('H1.g1', 'point'),
        Read('H1.g1', 'ci_hi_raw'),
        Read('H1.c2', 'point'),
        Read('H1.c2', 'tau'),
        Read('H1.c2', 'ci_lo_adj'),
        Read('H1.c2', 'seed_sd'),
        Read(None, 'proxy_vault.sign'),
    }


def test_lets_contribute_their_reads_and_rows():
    lets = {'F': Expr('[c1, c2] if gates_summary.I1_pass_effective else [c1]')}
    expr = Expr('PASS(F)')
    e = env(lets=lets)
    assert Read(None, 'gates_summary.I1_pass_effective') in expr.reads(e)
    assert Read('H1.c2', 'tau') in expr.reads(e)
    assert Expr('F').rows(e) == {'H1.c1', 'H1.c2'}


def test_in_scope_known_reads_only_the_arm_that_applies():
    expr = Expr("status == 'PASS' if in_scope else gates_inputs.I1_prior_pass")
    names = frozenset({'status', 'in_scope'})
    assert expr.reads(Env(names=names, in_scope_known=True)) == set()
    assert expr.reads(Env(names=names, in_scope_known=False)) == {
        Read(None, 'gates_inputs.I1_prior_pass')
    }
    assert expr.context_names(Env(names=names, in_scope_known=True)) == {'status'}
    assert expr.reads(Env(names=names)) == {Read(None, 'gates_inputs.I1_prior_pass')}


@pytest.mark.parametrize(
    ('source', 'message'),
    [
        ('c9.point > 0', "unknown name 'c9'"),
        ('proxy_vault > 0', 'is a namespace'),
        ('c1.point.x > 0', 'a row has fields, not paths'),
        ('NOPE(c1)', "unknown function 'NOPE'"),
        ('PASS(proxy_vault.sign)', 'is not a row'),
        ('FIRES(c1)', 'has no `fires` expression'),
        ('OUT_OF_SCOPE(c1)', 'takes rule ids as strings'),
        ('x.point > 0', '`x` is only defined'),
        ('status == 1', "unknown name 'status'"),
    ],
)
def test_misuse_is_reported(source, message):
    with pytest.raises(ExprError, match=message):
        Expr(source).reads(env())


ROW = {'point': 0.12, 'tau': 0.045, 'ci_lo_adj': 0.1, 'seed_sd': 0.001, 'ci_hi_raw': 0.14}
GUARD = {'point': -0.03, 'ci_hi_raw': -0.001}


def test_evaluation():
    rows = {'H1.c1': ROW, 'H1.g1': GUARD, 'H1.c2': {**ROW, 'ci_lo_adj': 0.0}}
    e = env(rows, {'proxy_vault': {'sign': 1}})
    assert Expr('PASS(c1)').evaluate(e) is True
    assert Expr('PASS(c1, c2)').evaluate(e) is False
    assert Expr('PASS([c1, [c1]])').evaluate(e) is True
    assert Expr('FIRES(g1)').evaluate(e) is True
    assert Expr('proxy_vault.sign in (-1, 0)').evaluate(e) is False
    assert Expr('proxy_vault.sign == 1 and not FIRES(g1)').evaluate(e) is False
    assert Expr('min(c1.point, g1.point) < 0').evaluate(e) is True
    assert Expr('abs(g1.point) - 0.03 == 0').evaluate(e) is True
    assert Expr('0 < c1.point < 1').evaluate(e) is True
    assert Expr("OUT_OF_SCOPE('H1', 'H2')").evaluate(e) is True
    assert Expr("OUT_OF_SCOPE('H5')").evaluate(e) is False


def test_a_null_read_raises_null_read():
    e = env({'H1.c1': {**ROW, 'tau': None}}, {'proxy_vault': {'sign': None}})
    with pytest.raises(NullRead) as caught:
        Expr('PASS(c1)').evaluate(e)
    assert caught.value.read == Read('H1.c1', 'tau')
    with pytest.raises(NullRead):
        Expr('proxy_vault.sign == 1').evaluate(e)
    with pytest.raises(NullRead):
        Expr('c2.point > 0').evaluate(e)  # an absent row reads as null


def test_types_are_strict():
    e = env({'H1.c1': ROW}, {'proxy_vault': {'sign': 'unavailable', 'read_this_run': True}})
    with pytest.raises(ExprError, match='needs a number'):
        Expr('proxy_vault.sign < 0').evaluate(e)
    with pytest.raises(ExprError, match='needs true/false'):
        Expr('c1.point and True').evaluate(e)
    with pytest.raises(ExprError, match='needs a number'):
        Expr('proxy_vault.read_this_run + 1 > 0').evaluate(e)
    # true never equals 1, and 'unavailable' is just a value
    assert Expr('proxy_vault.read_this_run == 1').evaluate(e) is False
    assert Expr("proxy_vault.sign == 'unavailable'").evaluate(e) is True


def test_context_names_are_null_when_absent():
    expr = Expr("status == 'PASS'")
    with pytest.raises(NullRead):
        expr.evaluate(Env(names=frozenset({'status'})))
    assert expr.evaluate(Env(names=frozenset({'status'}), context={'status': 'PASS'})) is True


def test_source_is_normalised():
    assert Expr('  a.b\n   and  c ').source == 'a.b and c'
    assert Expr('a.b') == Expr(' a.b ')
