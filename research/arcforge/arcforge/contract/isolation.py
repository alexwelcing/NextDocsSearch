"""Reader isolation (Amendment A0, lint addition 2): no published reader output enters any training
or selection input.

The proxy reader (OLMo-2-1124-13B base) writes C_open, the frontier C set and, at each registered
read, a fresh vault set. Those queries and their qrels are published, so anything that trains,
tunes, mines or selects training data must never read them (A0 rule 12; VJ-6: 'no published vault
set, or its qrels, ever enters training, tuning, adoption or screening-exemption inputs').

The check reads the stage registry's edges (`stage.inputs`) and what each stage declares:

- `reader_outputs` (optional): the outputs of that stage that carry reader-derived content. A stage
  that declares it is trusted to list every such output. A stage that does not declare it, and
  consumes a tainted output, is tainted as a whole (every output), which is the conservative
  reading. The reader's own stage (P1) is tainted by default even if it declares nothing.
- `consumes` (optional): {input stage: (output names it reads)}. Without it a stage is taken to
  read every output of every input.

Taint flows downstream along every edge except the registered screen-only edges: a stage that reads
eval queries only to REMOVE training data near them (leakage control 3, training queries screened
against every eval query) does not inherit their taint, because nothing of the eval query enters
what it emits. Adoption guards (CE, which holds C_open) are scored on held-out folds and are not a
selection input in this sense: A0 keeps C_open in CE (H4 g1, H5, the guards) by design.

The function is duck-typed over any objects with `name`, `inputs` and `outputs` (core.dag.Stage
today), so it runs on the live registry and on test fixtures alike. Standard library only.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any

# The stages that train, tune or select training data (the M2 DAG names, INTERFACES-M2 B).
TRAINING_OR_SELECTION_STAGES: dict[str, str] = {
    'S5': 'training-query generation',
    'S7': 'mining, screening and the training banks',
    'S8': 'initialization',
    'S9': 'student training',
}
# The reader's own outputs, used when the registry's P1 declares no reader_outputs.
DEFAULT_READER_OUTPUTS: dict[str, tuple[str, ...]] = {
    'P1': (
        'c_open.jsonl',
        'c_frontier.jsonl',
        'panel_publication.json.gz',
        'panel_diagnostics.json',
        'continuation.json',
    ),
}
# (downstream, upstream): the downstream stage reads the upstream's reader-carrying outputs only to
# screen its own training data away from them (leakage control 3). Taint does not cross these.
SCREEN_ONLY_EDGES: frozenset[tuple[str, str]] = frozenset({('S7', 'S6b')})


@dataclass(frozen=True)
class IsolationFinding:
    code: str
    stage: str
    message: str


def _toposort(stages: Mapping[str, Any]) -> list[str]:
    order = list(stages)
    remaining = {name: {u for u in stages[name].inputs if u in stages} for name in order}
    done: list[str] = []
    while remaining:
        ready = [n for n in order if n in remaining and not remaining[n]]
        if not ready:
            raise ValueError(f'stage cycle among: {", ".join(sorted(remaining))}')
        name = ready[0]
        done.append(name)
        del remaining[name]
        for deps in remaining.values():
            deps.discard(name)
    return done


def tainted_outputs(stages: Mapping[str, Any]) -> dict[str, set[str]]:
    """{stage: the outputs that carry reader-derived content}, propagated along the edges."""
    tainted: dict[str, set[str]] = {}
    for name in _toposort(stages):
        stage = stages[name]
        outputs = set(getattr(stage, 'outputs', ()) or ())
        declared_attr = getattr(stage, 'reader_outputs', None)
        defaults = set(DEFAULT_READER_OUTPUTS.get(name, ()))
        # The reader is a source, including new/renamed artifacts. The list of known filenames
        # must not make an undeclared new reader output appear safe.
        declared = (
            outputs
            if declared_attr is None and name in DEFAULT_READER_OUTPUTS
            else set(declared_attr or ()) | (defaults & outputs)
        )
        inherits = False
        for upstream in stage.inputs:
            if upstream not in stages or (name, upstream) in SCREEN_ONLY_EDGES:
                continue
            if _consumed(stage, upstream, stages) & tainted.get(upstream, set()):
                inherits = True
        if declared_attr is not None:
            tainted[name] = declared & outputs if outputs else declared
        elif inherits:
            tainted[name] = outputs | declared
        else:
            tainted[name] = declared
    return tainted


def _consumed(stage: Any, upstream: str, stages: Mapping[str, Any]) -> set[str]:
    consumes = getattr(stage, 'consumes', None) or {}
    if upstream in consumes:
        return set(consumes[upstream])
    return set(getattr(stages[upstream], 'outputs', ()) or ())


def check(stages: Iterable[Any] | Mapping[str, Any]) -> list[IsolationFinding]:
    """Every training or selection stage that reads a reader output (or declares a bad name)."""
    if not isinstance(stages, Mapping):
        stages = {s.name: s for s in stages}
    findings: list[IsolationFinding] = []
    for name, stage in stages.items():
        missing = sorted(set(stage.inputs) - set(stages))
        if missing:
            findings.append(
                IsolationFinding(
                    'reader-graph-invalid', name, f'depends on unknown stages {missing}'
                )
            )
        if stage.name != name:
            findings.append(
                IsolationFinding(
                    'reader-graph-invalid',
                    name,
                    f'registry key differs from stage name {stage.name!r}',
                )
            )
    try:
        _toposort(stages)
    except ValueError as error:
        findings.append(IsolationFinding('reader-graph-invalid', '', str(error)))
    if findings:
        return findings
    for name, stage in stages.items():
        declared = getattr(stage, 'reader_outputs', None)
        outputs = set(getattr(stage, 'outputs', ()) or ())
        unknown = sorted(set(declared or ()) - outputs)
        if unknown:
            findings.append(
                IsolationFinding(
                    'reader-outputs-unknown',
                    name,
                    f'declares reader_outputs {unknown}, which are not among its outputs',
                )
            )
        consumes = getattr(stage, 'consumes', None) or {}
        for upstream, names in consumes.items():
            if upstream not in stage.inputs:
                findings.append(
                    IsolationFinding(
                        'consumes-unknown', name, f'consumes {upstream}, which is not an input'
                    )
                )
            elif upstream in stages:
                missing = sorted(set(names) - set(getattr(stages[upstream], 'outputs', ()) or ()))
                if missing:
                    findings.append(
                        IsolationFinding(
                            'consumes-unknown',
                            name,
                            f'consumes {upstream}/{missing}, which {upstream} does not output',
                        )
                    )
    tainted = tainted_outputs(stages)
    for name, role in TRAINING_OR_SELECTION_STAGES.items():
        stage = stages.get(name)
        if stage is None:
            continue
        own = sorted(tainted.get(name, set()) & set(DEFAULT_READER_OUTPUTS.get(name, ())))
        if own:
            findings.append(
                IsolationFinding('reader-in-training', name, f'({role}) emits reader outputs {own}')
            )
        for upstream in stage.inputs:
            if upstream not in stages or (name, upstream) in SCREEN_ONLY_EDGES:
                continue
            hit = sorted(_consumed(stage, upstream, stages) & tainted.get(upstream, set()))
            if hit:
                findings.append(
                    IsolationFinding(
                        'reader-in-training',
                        name,
                        f'({role}) reads {upstream}/{", ".join(hit)}, which carry published '
                        'proxy-reader output; only a screen-only edge may read them',
                    )
                )
    return findings


def live_registry() -> Mapping[str, Any] | None:
    """The runtime's stage registry, or None when it cannot be imported (bare python3)."""
    try:
        from arcforge.core import stages as registry
    except Exception:  # noqa: BLE001 - the lint must run even where the runtime cannot import
        return None
    found = getattr(registry, 'REGISTRY', None)
    if isinstance(found, Mapping):
        return found
    listed = getattr(registry, 'STAGES', None)
    if listed is not None:
        return {s.name: s for s in listed}
    return None
