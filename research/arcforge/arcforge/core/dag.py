"""The stage DAG and its content-addressed keys.

A stage's outputs are cached under its KEY, the sha256 of the canonical JSON of:

    stage    the stage name ('S0'..'S14', 'S13b', 'gate', 'tail')
    code     sha256 of the source files of the modules that compute it (`Stage.code`), plus
             the interpreter's major.minor and Unicode version
    config   the config SUBTREE it reads: {dotted path: value} for `Stage.config_keys`
    inputs   the output digest of every upstream stage, plus the fingerprint of each external
             input (the corpus files for S0)
    model    the pinned model revisions it loads: {dotted path: value} for `Stage.model_keys`
    prompts  sha256 of its prompt templates (config values and files), or null
    seed     the run seed for seeded stages, null for seed-free ones (a snapshot does not
             depend on the training seed, so changing the seed must not invalidate it)

(program.training_recipe: 'sha256(stage, code hash, config subtree, input hashes, model
revision, prompt sha, seed)'.) Inputs enter as OUTPUT digests, not upstream keys, so a
recomputed upstream stage that reproduces its bytes leaves every downstream key unchanged.

A stage reads its config only through `StageContext.cfg`, which refuses any path outside
`config_keys`: a value that is not in the key cannot change the output.
"""

from __future__ import annotations

import importlib.util
import json
import sys
import unicodedata
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.core.config import ARCFORGE_ROOT, Config, get_path
from arcforge.core.hashing import digest_of, sha256_bytes, sha256_file

KEY_SCHEMA = 'arc-stage-key/1'
PHASES = ('prep', 'vm', 'gate', 'tail')
# Modules whose bytes every stage's output depends on (the artifact serialization).
BASE_CODE = ('arcforge.core.hashing',)


class StageError(RuntimeError):
    """A stage that cannot produce its outputs from its inputs."""


class StageNotImplemented(NotImplementedError):
    """Raised by a stub stage. The message lists what the stage reads and must produce."""


@dataclass(frozen=True)
class RunEnv:
    """Where a run reads from. Not part of any key: content enters keys through fingerprints."""

    repo_root: Path


@dataclass(frozen=True)
class External:
    """A non-stage input (for S0, the corpus files). `load` returns (fingerprint, payload)."""

    name: str
    load: Callable[[StageContext, RunEnv], tuple[str, Any]]


@dataclass(frozen=True)
class Stage:
    name: str
    title: str
    phase: str
    platform: str
    inputs: tuple[str, ...] = ()
    outputs: tuple[str, ...] = ()
    config_keys: tuple[str, ...] = ()
    model_keys: tuple[str, ...] = ()
    prompt_keys: tuple[str, ...] = ()
    prompt_files: tuple[str, ...] = ()
    seeded: bool = False
    external: tuple[External, ...] = ()
    code: tuple[str, ...] = ()
    run: Callable[[StageContext], Mapping[str, bytes]] | None = None
    # Documentation for stubs and partial stages: what lands later, and where.
    pending: tuple[str, ...] = ()
    notes: str = ''

    def __post_init__(self) -> None:
        if self.phase not in PHASES:
            raise ValueError(f'{self.name}: phase {self.phase!r} not in {PHASES}')
        if len(set(self.outputs)) != len(self.outputs):
            raise ValueError(f'{self.name}: duplicate output names')

    @property
    def implemented(self) -> bool:
        return self.run is not None

    def describe(self) -> str:
        inputs = ', '.join(self.inputs) or 'none'
        if self.external:
            inputs += ' + ' + ', '.join(f'external:{e.name}' for e in self.external)
        lines = [
            f'{self.name} {self.title} [{self.phase}, {self.platform}]',
            f'  inputs:  {inputs}',
            f'  outputs: {", ".join(self.outputs) or "none"}',
        ]
        lines += [f'  pending: {item}' for item in self.pending]
        if self.notes:
            lines.append(f'  notes:   {self.notes}')
        return '\n'.join(lines)


@dataclass
class StageContext:
    stage: Stage
    config: Config
    seed: int | None
    inputs: Mapping[str, Mapping[str, bytes]] = field(default_factory=dict)
    external: dict[str, Any] = field(default_factory=dict)

    def cfg(self, dotted: str) -> Any:
        if not any(dotted == k or dotted.startswith(k + '.') for k in self.stage.config_keys):
            raise StageError(
                f'{self.stage.name} read config {dotted!r}, which is not in its key '
                f'(config_keys: {", ".join(self.stage.config_keys) or "none"})'
            )
        return self.config.get(dotted)

    def input_bytes(self, stage: str, name: str) -> bytes:
        if stage not in self.stage.inputs:
            raise StageError(f'{self.stage.name} read {stage}/{name}, but {stage} is not an input')
        try:
            return self.inputs[stage][name]
        except KeyError as error:
            raise StageError(f'{self.stage.name}: input {stage}/{name} is missing') from error

    def input_json(self, stage: str, name: str) -> Any:
        return json.loads(self.input_bytes(stage, name))

    def input_jsonl(self, stage: str, name: str) -> list[Any]:
        return [json.loads(line) for line in self.input_bytes(stage, name).splitlines() if line]


def not_implemented(stage: Stage) -> StageNotImplemented:
    return StageNotImplemented(
        f'{stage.name} ({stage.title}) is not implemented yet.\n{stage.describe()}'
    )


# --- ordering ----------------------------------------------------------------------------------


def toposort(stages: Mapping[str, Stage]) -> list[str]:
    """Kahn's algorithm; ties break by declaration order, so the order is deterministic."""
    order = list(stages)
    for stage in stages.values():
        for upstream in stage.inputs:
            if upstream not in stages:
                raise ValueError(f'{stage.name} depends on unknown stage {upstream!r}')
    remaining = {name: set(stages[name].inputs) for name in order}
    done: list[str] = []
    while remaining:
        ready = [name for name in order if name in remaining and not remaining[name]]
        if not ready:
            raise ValueError(f'stage cycle among: {", ".join(sorted(remaining))}')
        name = ready[0]
        done.append(name)
        del remaining[name]
        for deps in remaining.values():
            deps.discard(name)
    return done


def closure(stages: Mapping[str, Stage], targets: Iterable[str]) -> list[str]:
    """The targets plus everything upstream of them, in topological order."""
    wanted: set[str] = set()
    stack = list(targets)
    while stack:
        name = stack.pop()
        if name not in stages:
            raise ValueError(f'unknown stage {name!r} (known: {", ".join(stages)})')
        if name not in wanted:
            wanted.add(name)
            stack.extend(stages[name].inputs)
    return [name for name in toposort(stages) if name in wanted]


# --- keys --------------------------------------------------------------------------------------


def runtime_fingerprint() -> dict[str, str]:
    """The interpreter is part of the code: Unicode tables (NFKD folding) change with Python."""
    return {
        'python': f'{sys.version_info.major}.{sys.version_info.minor}',
        'unicode': unicodedata.unidata_version,
    }


def code_hash(modules: Iterable[str]) -> str:
    """sha256 over {module: sha256(source file)} plus the runtime fingerprint."""
    files: dict[str, str] = {}
    for name in sorted(set(modules)):
        spec = importlib.util.find_spec(name)
        if spec is None or not spec.origin or not Path(spec.origin).is_file():
            raise StageError(f'cannot hash code of module {name!r}')
        files[name] = sha256_file(Path(spec.origin))
    return digest_of({'modules': files, 'runtime': runtime_fingerprint()})


def stage_code_hash(stage: Stage) -> str:
    modules = list(BASE_CODE) + list(stage.code)
    if stage.run is not None and getattr(stage.run, '__module__', None):
        modules.append(stage.run.__module__)
    return code_hash(modules)


def prompt_sha(stage: Stage, config: Config, root: Path = ARCFORGE_ROOT) -> str | None:
    if not stage.prompt_keys and not stage.prompt_files:
        return None
    prompts: dict[str, Any] = {f'config:{k}': config.get(k) for k in stage.prompt_keys}
    for rel in stage.prompt_files:
        path = root / rel
        if not path.is_file():
            raise StageError(f'{stage.name}: prompt template {rel} not found')
        prompts[f'file:{rel}'] = sha256_bytes(path.read_bytes())
    return digest_of(prompts)


def config_subtree(stage: Stage, config: Config) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for dotted in stage.config_keys:
        try:
            out[dotted] = get_path(config.data, dotted)
        except KeyError as error:
            raise StageError(f'{stage.name}: config has no {dotted!r}') from error
    return out


def key_material(
    stage: Stage,
    config: Config,
    input_digests: Mapping[str, str],
    external_fingerprints: Mapping[str, str],
    *,
    code: str | None = None,
) -> dict[str, Any]:
    missing = [name for name in stage.inputs if name not in input_digests]
    if missing:
        raise StageError(f'{stage.name}: no digest for inputs {missing}')
    inputs = {name: input_digests[name] for name in stage.inputs}
    inputs.update({f'external:{k}': v for k, v in external_fingerprints.items()})
    return {
        'schema': KEY_SCHEMA,
        'stage': stage.name,
        'code': code if code is not None else stage_code_hash(stage),
        'config': config_subtree(stage, config),
        'inputs': inputs,
        'model': {k: config.get(k) for k in stage.model_keys},
        'prompts': prompt_sha(stage, config),
        'seed': config.seed if stage.seeded else None,
    }


def stage_key(material: Mapping[str, Any]) -> str:
    return digest_of(dict(material))


def outputs_digest(outputs: Mapping[str, Mapping[str, Any]]) -> str:
    """The digest downstream keys see: sha256 of {artifact: {sha256, bytes}}."""
    return digest_of({name: dict(meta) for name, meta in outputs.items()})
