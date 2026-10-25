"""schemas/arc-report-1.json: loading, validation, and field lookup for the lint.

Validation uses `jsonschema`, imported lazily so the commands still boot under a bare python3.
Field lookup is standard library: `lookup(schema, 'verdicts_doc.rows[].tau')` walks properties,
items, $ref, anyOf/oneOf/allOf and reports whether the field exists and which prefixes of the
path may be null. The lint uses it to prove every field a rule reads is in arc-report/1 and to
know which of them the run plan must promise non-null.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

SCHEMA_DIR = Path(__file__).resolve().parents[1] / 'schemas'
REPORT_SCHEMA_PATH = SCHEMA_DIR / 'arc-report-1.json'
SCORES_SCHEMA_PATH = SCHEMA_DIR / 'arc-scores-1.json'


class SchemaUnavailable(RuntimeError):
    """jsonschema is not installed (bare python3); run under `uv run`."""


@cache
def _load(path: str) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding='utf-8'))


def load(path: str | Path = REPORT_SCHEMA_PATH) -> dict[str, Any]:
    return _load(str(Path(path).resolve()))


def sha256(path: str | Path = REPORT_SCHEMA_PATH) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def subschema(schema: Mapping[str, Any], definition: str) -> dict[str, Any]:
    """`schema` re-rooted at $defs/<definition>, keeping every $def for $ref resolution."""
    if definition not in schema.get('$defs', {}):
        raise KeyError(f'no $defs/{definition} in {schema.get("$id")}')
    return {
        '$schema': schema['$schema'],
        '$id': schema['$id'],
        '$defs': schema['$defs'],
        '$ref': f'#/$defs/{definition}',
    }


def validator(schema: Mapping[str, Any] | None = None, definition: str | None = None) -> Any:
    try:
        import jsonschema
    except ImportError as error:
        raise SchemaUnavailable(f'jsonschema is not installed ({error}); use `uv run`') from None
    schema = dict(schema if schema is not None else load())
    if definition is not None:
        schema = subschema(schema, definition)
    jsonschema.Draft202012Validator.check_schema(schema)
    return jsonschema.Draft202012Validator(schema)


def errors(instance: Any, schema: Mapping[str, Any] | None = None, definition: str | None = None) -> list[str]:
    """Every validation error as '<path>: <message>', sorted (empty when valid)."""
    found = []
    for error in validator(schema, definition).iter_errors(instance):
        where = '/'.join(str(p) for p in error.absolute_path) or '(root)'
        found.append(f'{where}: {error.message}')
    return sorted(found)


# ---- field lookup -----------------------------------------------------------------------------


@dataclass(frozen=True)
class Lookup:
    exists: bool
    nullable_prefixes: tuple[str, ...]  # prefixes of the path (itself included) that may be null
    missing_at: str | None = None  # the first segment that does not exist


def _deref(root: Mapping[str, Any], node: Mapping[str, Any]) -> Mapping[str, Any]:
    seen = 0
    while '$ref' in node:
        ref = node['$ref']
        if not ref.startswith('#/'):
            raise ValueError(f'only local $refs are supported, got {ref!r}')
        target: Any = root
        for part in ref[2:].split('/'):
            target = target[part]
        node = target
        seen += 1
        if seen > 64:
            raise ValueError(f'$ref cycle at {ref!r}')
    return node


def _branches(root: Mapping[str, Any], node: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    """The concrete alternatives a node stands for (anyOf/oneOf alternatives, allOf members)."""
    node = _deref(root, node)
    out = [node]
    for key in ('anyOf', 'oneOf', 'allOf'):
        for sub in node.get(key, []):
            out.extend(_branches(root, sub))
    return out


def _allows_null(root: Mapping[str, Any], node: Mapping[str, Any]) -> bool:
    node = _deref(root, node)
    kind = node.get('type')
    if kind == 'null' or (isinstance(kind, list) and 'null' in kind):
        return True
    if 'enum' in node and None in node['enum']:
        return True
    if 'const' in node and node['const'] is None:
        return True
    return any(_allows_null(root, sub) for key in ('anyOf', 'oneOf') for sub in node.get(key, []))


def _children(root: Mapping[str, Any], node: Mapping[str, Any], segment: str) -> list[Mapping[str, Any]]:
    out = []
    for branch in _branches(root, node):
        if segment == '[]':
            if isinstance(branch.get('items'), Mapping):
                out.append(branch['items'])
            continue
        if segment in branch.get('properties', {}):
            out.append(branch['properties'][segment])
        elif isinstance(branch.get('additionalProperties'), Mapping):
            out.append(branch['additionalProperties'])
    return out


def _segments(path: str) -> list[str]:
    out: list[str] = []
    for part in path.split('.'):
        name, brackets = part, 0
        while name.endswith('[]'):
            name, brackets = name[:-2], brackets + 1
        if name:
            out.append(name)
        out.extend(['[]'] * brackets)
    return out


def lookup(schema: Mapping[str, Any], path: str) -> Lookup:
    """Resolve a dotted path ('verdicts_doc.rows[].tau') against the report schema."""
    nodes: list[Mapping[str, Any]] = [schema]
    nullable: list[str] = []
    label = ''
    for segment in _segments(path):
        nodes = [child for node in nodes for child in _children(schema, node, segment)]
        label = f'{label}[]' if segment == '[]' else (f'{label}.{segment}' if label else segment)
        if not nodes:
            return Lookup(False, tuple(nullable), missing_at=label)
        if any(_allows_null(schema, n) for n in nodes):
            nullable.append(label)
    return Lookup(True, tuple(nullable))
