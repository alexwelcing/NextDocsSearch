"""Adversarial graphs, including the policy boundaries this static check must not overclaim."""

from types import SimpleNamespace

import pytest

from arcforge.contract import isolation
from arcforge.contract.lint import lint


def stage(name, inputs=(), outputs=(), **declarations):
    return SimpleNamespace(name=name, inputs=inputs, outputs=outputs, **declarations)


def reader_graph(*downstream):
    reader = stage('P1', outputs=('c_open.jsonl', 'new_reader_output.json'))
    return {s.name: s for s in (reader, *downstream)}


@pytest.mark.parametrize('sink', isolation.TRAINING_OR_SELECTION_STAGES)
def test_new_reader_output_names_are_tainted_by_default(sink):
    graph = reader_graph(
        stage(sink, ('P1',), ('model',), consumes={'P1': ('new_reader_output.json',)})
    )
    assert isolation.tainted_outputs(graph)['P1'] == set(graph['P1'].outputs)
    assert any(f.code == 'reader-in-training' and f.stage == sink for f in isolation.check(graph))


def test_transitive_taint_is_independent_of_declaration_order():
    graph = reader_graph(stage('relay', ('P1',), ('copy',)), stage('S9', ('relay',), ('model',)))
    assert isolation.tainted_outputs(graph)['relay'] == {'copy'}
    assert isolation.check(graph) == isolation.check(dict(reversed(list(graph.items()))))
    assert any(f.stage == 'S9' for f in isolation.check(graph))


def test_s7_s6b_exception_is_scoped_to_the_exact_registered_edge():
    graph = reader_graph(stage('S6b', ('P1',), ('bench',)), stage('S7', ('S6b',), ('train',)))
    assert isolation.check(graph) == []  # Deliberately trusted removal-only edge.
    graph['S9'] = stage('S9', ('S6b',), ('model',))
    assert {f.stage for f in isolation.check(graph)} == {'S9'}
    graph['relay'] = stage('relay', ('S6b',), ('copy',))
    graph['S7'] = stage('S7', ('relay',), ('train',))
    assert {'S7', 'S9'} <= {f.stage for f in isolation.check(graph)}


def test_screening_exception_does_not_clear_an_independent_tainted_input():
    graph = reader_graph(stage('S6b', ('P1',), ('bench',)), stage('S7', ('S6b', 'P1'), ('train',)))
    assert any(f.stage == 'S7' and 'reads P1/' in f.message for f in isolation.check(graph))


def test_explicit_reader_outputs_remain_a_trusted_semantic_declaration():
    graph = reader_graph(
        stage('relay', ('P1',), ('copy', 'clean'), reader_outputs=('copy',)),
        stage('S9', ('relay',), ('model',), consumes={'relay': ('clean',)}),
    )
    assert isolation.check(graph) == []
    graph['S9'].consumes = {'relay': ('copy',)}
    assert any(f.stage == 'S9' for f in isolation.check(graph))
    # An intentionally false declaration cannot be detected by graph analysis alone.
    graph['relay'].reader_outputs = ()
    assert isolation.check(graph) == []


@pytest.mark.parametrize('kind', ['cycle', 'missing'])
def test_invalid_dependency_graphs_fail_closed(kind):
    graph = reader_graph(
        stage('relay', ('P1', 'S9' if kind == 'cycle' else 'missing'), ('copy',)),
        stage('S9', ('relay',), ('model',)),
    )
    assert any(f.code == 'reader-graph-invalid' for f in isolation.check(graph))


def test_unavailable_registry_cannot_pass_signoff_lint():
    report = lint(stages=None)
    assert any(f.code == 'reader-isolation' for f in report.errors)


def test_legacy_live_registry_is_reported_as_incomplete():
    from arcforge.core.stages import REGISTRY

    assert 'P1' not in REGISTRY and 'S6b' not in REGISTRY
    report = lint()
    assert any(f.code == 'reader-isolation-incomplete' for f in report.warnings)
