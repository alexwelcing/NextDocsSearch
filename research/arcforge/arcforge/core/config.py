"""configs/rNN.yaml: load, inherit, override, validate, hash.

A run config is one YAML file. A later run is normally `extends: r00.yaml` plus its one change:
`extends` deep-merges mappings (the child wins key by key) and replaces lists and scalars
whole, so a child never appends to a parent's list by accident. The resolved config is
validated against configs/arc-config-1.schema.json and a few cross-field rules the schema
cannot express (the budget guard's ceilings), then hashed: config_sha256 is the sha256 of its
canonical JSON, which is what report.run.config_sha256 records.

Only plain JSON values survive loading. YAML timestamps and other tagged types are rejected
rather than coerced, since they would not hash the same way everywhere.
"""

from __future__ import annotations

import copy
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from arcforge.core.hashing import digest_of

ARCFORGE_ROOT = Path(__file__).resolve().parents[2]
CONFIGS_DIR = ARCFORGE_ROOT / 'configs'
SCHEMA_PATH = CONFIGS_DIR / 'arc-config-1.schema.json'

CONFIG_REF = re.compile(r'^r\d\d[A-Za-z]?$')

# The budget guard (program milestone M1): every run is capped at $20; R00's plan ceiling
# equals that cap, and every later run plans to at most $17, which keeps a $3 reserve.
HARD_CAP_USD = 20
R00_CEILING_USD = 20
LATER_CEILING_USD = 17

_MISSING = object()


class ConfigError(ValueError):
    """A config that cannot be loaded or that breaks the config surface's rules."""


@dataclass(frozen=True)
class Config:
    data: dict[str, Any]
    path: Path | None = None
    sha256: str = field(default='')

    @property
    def run_id(self) -> str:
        return self.data['run']['id']

    @property
    def branch(self) -> str:
        return self.data['run']['branch']

    @property
    def seed(self) -> int:
        return self.data['run']['seed']

    def get(self, dotted: str, default: Any = _MISSING) -> Any:
        return get_path(self.data, dotted, default)


def get_path(data: Any, dotted: str, default: Any = _MISSING) -> Any:
    node = data
    for part in dotted.split('.'):
        if isinstance(node, dict) and part in node:
            node = node[part]
        elif default is _MISSING:
            raise KeyError(dotted)
        else:
            return default
    return node


def set_path(data: dict[str, Any], dotted: str, value: Any) -> None:
    parts = dotted.split('.')
    node = data
    for part in parts[:-1]:
        child = node.get(part)
        if not isinstance(child, dict):
            child = {}
            node[part] = child
        node = child
    node[parts[-1]] = value


def deep_merge(base: dict[str, Any], child: dict[str, Any]) -> dict[str, Any]:
    """Mappings merge key by key (child wins); lists and scalars are replaced whole."""
    merged = copy.deepcopy(base)
    for key, value in child.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def resolve_config_path(ref: str | Path, configs_dir: Path = CONFIGS_DIR) -> Path:
    """'r00' means configs/r00.yaml; anything else is a path."""
    text = str(ref)
    if CONFIG_REF.match(text):
        return configs_dir / f'{text}.yaml'
    return Path(text).expanduser()


def _plain(value: Any, where: str) -> None:
    if value is None or isinstance(value, (bool, int, float, str)):
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            _plain(item, f'{where}[{index}]')
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise ConfigError(f'{where}: key {key!r} is not a string (quote it in the YAML)')
            _plain(item, f'{where}.{key}')
        return
    raise ConfigError(
        f'{where}: {type(value).__name__} is not a plain JSON value (quote dates and timestamps)'
    )


def read_yaml(path: Path) -> Any:
    import yaml  # noqa: PLC0415 — lazy: see arcforge/commands/__init__.py

    try:
        with open(path, encoding='utf-8') as handle:
            return yaml.safe_load(handle)
    except FileNotFoundError as error:
        raise ConfigError(f'config not found: {path}') from error
    except yaml.YAMLError as error:
        raise ConfigError(f'{path}: invalid YAML: {error}') from error


def _load_raw(path: Path, chain: tuple[Path, ...] = ()) -> dict[str, Any]:
    path = path.resolve()
    if path in chain:
        cycle = ' -> '.join(p.name for p in (*chain, path))
        raise ConfigError(f'extends cycle: {cycle}')
    data = read_yaml(path)
    if not isinstance(data, dict):
        raise ConfigError(f'{path}: a config is a mapping, got {type(data).__name__}')
    _plain(data, path.name)
    parent = data.pop('extends', None)
    if parent is None:
        return data
    if not isinstance(parent, str):
        raise ConfigError(f'{path}: extends must be one relative path')
    base = _load_raw(path.parent / parent, (*chain, path))
    return deep_merge(base, data)


def validate(data: dict[str, Any], schema_path: Path = SCHEMA_PATH) -> None:
    """The JSON Schema plus the cross-field rules of the budget guard."""
    import jsonschema  # noqa: PLC0415

    schema = json.loads(schema_path.read_text(encoding='utf-8'))
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: list(map(str, e.absolute_path)))
    if errors:
        lines = [
            f'  {".".join(map(str, e.absolute_path)) or "<root>"}: {e.message}' for e in errors[:20]
        ]
        raise ConfigError('config does not match arc-config/1:\n' + '\n'.join(lines))

    run_id = data['run']['id']
    budget = data['budget']
    if budget['cap'] > HARD_CAP_USD:
        raise ConfigError(f'budget.cap {budget["cap"]} exceeds the ${HARD_CAP_USD} hard cap')
    if budget['plan_ceiling'] > budget['cap']:
        raise ConfigError('budget.plan_ceiling exceeds budget.cap')
    policy = R00_CEILING_USD if run_id == 'r00' else LATER_CEILING_USD
    if budget['plan_ceiling'] > policy:
        raise ConfigError(
            f'budget.plan_ceiling {budget["plan_ceiling"]} exceeds the {run_id} ceiling ${policy} '
            '(R00 plans to the $20 cap; every later run plans to $17)'
        )
    if run_id != 'r00' and budget['plan_ceiling'] + budget['reserve'] > budget['cap']:
        raise ConfigError('budget.plan_ceiling + budget.reserve exceeds budget.cap')
    known = set(budget['dividend_priority'])
    for item in budget.get('dividend', []):
        if item['priority'] not in known:
            raise ConfigError(
                f'budget.dividend item {item["item"]!r}: priority {item["priority"]!r} '
                f'is not in dividend_priority {sorted(known)}'
            )


def parse_override(text: str) -> tuple[str, Any]:
    """'run.seed=7' -> ('run.seed', 7). The value is parsed as JSON, else kept as a string."""
    if '=' not in text:
        raise ConfigError(f'override {text!r} is not path=value')
    dotted, raw = text.split('=', 1)
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        value = raw
    return dotted.strip(), value


def load_config(
    ref: str | Path,
    overrides: dict[str, Any] | None = None,
    *,
    configs_dir: Path = CONFIGS_DIR,
    schema_path: Path = SCHEMA_PATH,
) -> Config:
    path = resolve_config_path(ref, configs_dir)
    data = _load_raw(path)
    for dotted, value in (overrides or {}).items():
        set_path(data, dotted, value)
    _plain(data, path.name)
    validate(data, schema_path)
    return Config(data=data, path=path, sha256=digest_of(data))


def flatten(data: Any, prefix: str = '') -> dict[str, Any]:
    """Dotted leaves of a config, for `arcforge diff`. Lists are leaves."""
    if isinstance(data, dict) and data:
        out: dict[str, Any] = {}
        for key in sorted(data):
            out.update(flatten(data[key], f'{prefix}{key}.'))
        return out
    return {prefix.rstrip('.'): data}
