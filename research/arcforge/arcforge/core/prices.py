"""The pinned price table (prices/2026-10.yaml) and the arithmetic every plan line uses.

Money is computed in Decimal from the table's decimal strings, so a plan is exact and the same
on every machine; it is rounded to cents only for display and for report fields.

Entries carry `verify_at_launch`, the list of their fields that are third-party or volatile
(both Gemini prices, the spot rate): `arcforge plan` prints them on every run, and the owner
re-checks them before a launch. Plans never read the spot rate: runner-VM minutes are priced at
the on-demand rate, so a spot stockout and the on-demand fallback cannot break a plan.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any

from arcforge.core.config import ARCFORGE_ROOT, ConfigError, read_yaml
from arcforge.core.hashing import sha256_file

SCHEMA = 'arc-prices/1'
MILLION = Decimal(1_000_000)
CENT = Decimal('0.01')


def dec(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ConfigError(f'price {value!r} is not a number')
    return Decimal(str(value))


def cents(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class PriceTable:
    path: Path
    sha256: str
    data: dict[str, Any]

    @property
    def id(self) -> str:
        return str(self.data['id'])

    def compute(self, shape: str) -> dict[str, Any]:
        try:
            return self.data['compute'][shape]
        except KeyError as error:
            raise ConfigError(f'price table {self.id} has no compute shape {shape!r}') from error

    def vm_rate(self, shape: str, provisioning: str = 'on_demand') -> Decimal:
        field = {'on_demand': 'on_demand_usd_per_h', 'spot': 'spot_usd_per_h'}[provisioning]
        return dec(self.compute(shape)[field])

    def vm_usd(self, shape: str, minutes: Any, provisioning: str = 'on_demand') -> Decimal:
        return dec(minutes) * self.vm_rate(shape, provisioning) / 60

    def llm(self, model: str) -> dict[str, Any]:
        try:
            return self.data['llm'][model]
        except KeyError as error:
            raise ConfigError(f'price table {self.id} has no model {model!r}') from error

    def llm_usd(self, model: str, tokens_in: int, tokens_out: int) -> Decimal:
        entry = self.llm(model)
        return (
            dec(tokens_in) * dec(entry['usd_per_m_in'])
            + dec(tokens_out) * dec(entry['usd_per_m_out'])
        ) / MILLION

    def workers_ai_usd(self, neurons_k: Any) -> Decimal:
        return dec(neurons_k) * dec(self.data['workers_ai']['usd_per_k_neurons'])

    def storage_usd(self, gb_month: Any) -> Decimal:
        return dec(gb_month) * dec(self.data['storage']['gcs_standard_usd_per_gb_month'])

    def verify_at_launch(self) -> list[dict[str, Any]]:
        """Every flagged price: [{entry, field, value, note}] in table order."""
        entries: list[tuple[str, dict[str, Any]]] = [
            (f'{section}.{name}', entry)
            for section in ('compute', 'llm')
            for name, entry in self.data[section].items()
        ]
        entries += [(section, self.data[section]) for section in ('workers_ai', 'storage')]
        return [
            {'entry': name, 'field': field, 'value': entry[field], 'note': entry.get('note')}
            for name, entry in entries
            for field in entry.get('verify_at_launch') or []
        ]


def _check(data: Any, path: Path) -> None:
    if not isinstance(data, dict) or data.get('schema') != SCHEMA:
        raise ConfigError(f'{path}: not an {SCHEMA} price table')
    for section in ('compute', 'llm', 'workers_ai', 'storage'):
        if not isinstance(data.get(section), dict):
            raise ConfigError(f'{path}: missing section {section!r}')
    required = {
        'compute': ('on_demand_usd_per_h', 'spot_usd_per_h'),
        'llm': ('provider', 'usd_per_m_in', 'usd_per_m_out'),
    }
    for section, fields in required.items():
        for name, entry in data[section].items():
            missing = [f for f in fields if f not in entry]
            if missing:
                raise ConfigError(f'{path}: {section}.{name} lacks {missing}')
    flaggable = [*data['compute'].items(), *data['llm'].items()]
    flaggable += [('workers_ai', data['workers_ai']), ('storage', data['storage'])]
    for name, entry in flaggable:
        for field in entry.get('verify_at_launch') or []:
            if field not in entry:
                raise ConfigError(f'{path}: {name} flags unknown field {field!r}')
    dec(data['workers_ai'].get('usd_per_k_neurons'))
    dec(data['storage'].get('gcs_standard_usd_per_gb_month'))


def load_prices(ref: str | Path, root: Path = ARCFORGE_ROOT) -> PriceTable:
    path = Path(ref)
    if not path.is_absolute():
        path = root / path
    data = read_yaml(path)
    _check(data, path)
    return PriceTable(path=path, sha256=sha256_file(path), data=data)
