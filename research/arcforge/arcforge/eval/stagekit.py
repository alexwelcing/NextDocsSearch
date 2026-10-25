"""Stage declarations that work with dag.Stage before and after the M2 scaffold.

INTERFACES-M2 A: dag.Stage gains `replay`, `large` and `publish`. Until m2-runtime's scaffold
lands, `stage()` drops the fields the installed dag.Stage does not know and keeps them in
STAGE_META, so the verdict stages declare their full M2 contract today and register unchanged
once the scaffold adds the fields.
"""

from __future__ import annotations

import dataclasses
from typing import Any

from arcforge.core.dag import Stage

STAGE_META: dict[str, dict[str, Any]] = {}


def stage(**fields: Any) -> Stage:
    known = {f.name for f in dataclasses.fields(Stage)}
    extra = {k: v for k, v in fields.items() if k not in known}
    STAGE_META[fields['name']] = extra
    return Stage(**{k: v for k, v in fields.items() if k in known})


def meta(name: str, key: str, default: Any = None) -> Any:
    return STAGE_META.get(name, {}).get(key, default)
