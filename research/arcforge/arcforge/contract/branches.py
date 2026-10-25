"""The PREREG branch table: which runs follow which, and how verdicts choose the path.

rules.yaml carries the table (every path's [run, branch] sequence) and the decisions that fork
it. These helpers turn a run history into the set of paths it is consistent with, and say which
run comes next. They are pure functions of rules.yaml and the statuses in earlier verdicts.json
files, so the orchestrator, the runtime and Fable's blind pass all derive the same path.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from arcforge.contract.rules import Rules


class PathError(ValueError):
    """A run history that no PREREG branch path explains."""


@dataclass(frozen=True)
class Step:
    """One run of a history: its id, its branch and the statuses its verdicts.json reports."""

    run_id: str
    branch: str
    statuses: Mapping[str, str]

    @classmethod
    def from_doc(cls, doc: Mapping) -> Step:
        return cls(
            run_id=doc['run']['id'],
            branch=doc['run']['branch'],
            statuses={h['id']: h.get('status') for h in doc.get('hypotheses', [])},
        )


def paths_through(rules: Rules, run_id: str, branch: str) -> list[str]:
    """The branch paths that contain (run_id, branch)."""
    return [name for name, seq in rules.branch_table.items() if (run_id, branch) in seq]


def follow(rules: Rules, history: Sequence[Step]) -> list[str]:
    """The paths consistent with `history` (in run order), honouring every decision in it."""
    candidates = list(rules.branch_table)
    for index, step in enumerate(history):
        candidates = [
            name
            for name in candidates
            if index < len(rules.branch_table[name])
            and rules.branch_table[name][index] == (step.run_id, step.branch)
        ]
        if not candidates:
            raise PathError(
                f'run {index + 1} of the history is {step.run_id}/{step.branch}, which no PREREG '
                'branch path has at that position'
            )
        for decision in rules.decisions:
            if (decision.after, decision.branch) != (step.run_id, step.branch):
                continue
            status = step.statuses.get(decision.rule)
            if status not in decision.outcomes:
                raise PathError(
                    f'{step.run_id}/{step.branch}: the decision rule {decision.rule} has status '
                    f'{status!r}, which the branch table does not route'
                )
            allowed = set(decision.outcomes[status])
            candidates = [name for name in candidates if name in allowed]
            if not candidates:
                raise PathError(
                    f'{step.run_id}/{step.branch}: {decision.rule} = {status} leads to '
                    f'{sorted(allowed)}, which this history cannot be on'
                )
    return candidates


def next_step(rules: Rules, history: Sequence[Step]) -> tuple[str, str] | None:
    """The (run, branch) that follows `history`, or None when the arc is complete."""
    candidates = follow(rules, history)
    index = len(history)
    nexts = {rules.branch_table[name][index] for name in candidates if index < len(rules.branch_table[name])}
    if not nexts:
        return None
    if len(nexts) > 1:
        raise PathError(f'the next run is undetermined after {len(history)} runs: {sorted(nexts)}')
    return nexts.pop()


def path_of_final(rules: Rules, run_id: str, branch: str) -> tuple[str, list[tuple[str, str]]]:
    """For a run on exactly one path, that path and the runs before it."""
    names = paths_through(rules, run_id, branch)
    if len(names) != 1:
        raise PathError(f'{run_id}/{branch} lies on {len(names)} branch paths, not exactly one')
    seq = list(rules.branch_table[names[0]])
    return names[0], seq[: seq.index((run_id, branch))]
