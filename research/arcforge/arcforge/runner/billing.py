"""Actual VM rates from the Cloud Billing Catalog API, and the per-instance cost booking.

`arcforge plan` prices every VM-minute at the on-demand rate so a spot stockout can never break
a plan (that is the runtime's price table). This module books what a run actually cost: the
billed minutes of each instance it created, times the SKU rate of the provisioning model it got
(spot or on-demand), read from the catalog when the run starts. A preempted run books both VMs.

A g2 instance bills as three SKUs plus its boot disk: vCPU-hours, RAM GiB-hours and the attached
L4, each with separate spot and on-demand SKUs, and pd-balanced GiB-months. The catalog quotes
each in its own usage unit; `baseUnitConversionFactor` converts the unit to the base unit
(seconds, or byte-seconds), which is what makes the per-hour rate exact rather than assumed (the
catalog's GiB-month is 31 days, not 730 h).
"""

from __future__ import annotations

import json
import math
import re
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

from arcforge.runner.config import RunnerConfig
from arcforge.runner.shell import Shell, check

COMPUTE_SERVICE = 'services/6F81-5844-456A'  # Compute Engine in the Billing Catalog
CATALOG_URL = 'https://cloudbilling.googleapis.com/v1/{service}/skus'
GIB = 1024**3

# Exact SKU descriptions per component and provisioning model; the region is matched separately
# through serviceRegions. Families other than G2 are added here when the program allows them.
_FAMILY = {'g2': 'G2'}
_GPU = {'nvidia-l4': 'Nvidia L4 GPU'}
_DISK = {'pd-balanced': 'Balanced PD Capacity'}


class BillingError(RuntimeError):
    pass


@dataclass(frozen=True)
class Component:
    item: str  # 'vcpu' | 'ram' | 'gpu' | 'disk'
    sku_id: str
    description: str
    quantity: float  # vCPUs, GiB of RAM, GPUs or GiB of disk
    usd_per_unit_hour: float

    @property
    def usd_per_hour(self) -> float:
        return self.quantity * self.usd_per_unit_hour


@dataclass(frozen=True)
class RateCard:
    """The hourly rate of one machine shape under one provisioning model, with its provenance."""

    shape: str
    region: str
    provisioning: str  # 'spot' | 'on_demand'
    components: tuple[Component, ...]
    effective_time: str  # the catalog's pricingInfo.effectiveTime (spot prices move monthly)
    fetched_utc: str

    @property
    def usd_per_hour(self) -> float:
        return sum(c.usd_per_hour for c in self.components)

    def to_json(self) -> dict[str, Any]:
        out = asdict(self)
        out['components'] = [
            {**asdict(c), 'usd_per_hour': round(c.usd_per_hour, 6)} for c in self.components
        ]
        out['usd_per_hour'] = round(self.usd_per_hour, 6)
        return out


def _price(sku: Mapping[str, Any]) -> tuple[float, float, str]:
    """(price per usage unit, base units per usage unit, effectiveTime) of a SKU's current price.

    Takes the tier with the highest startUsageAmount: the marginal rate, which is the only tier
    for every SKU the runner uses.
    """
    info = sku['pricingInfo'][0]
    expr = info['pricingExpression']
    tier = max(expr['tieredRates'], key=lambda t: float(t.get('startUsageAmount', 0)))
    unit = tier['unitPrice']
    price = int(unit.get('units') or 0) + int(unit.get('nanos') or 0) / 1e9
    return price, float(expr['baseUnitConversionFactor']), info.get('effectiveTime', '')


def _usd_per_unit_hour(sku: Mapping[str, Any]) -> float:
    """Price of one vCPU/GPU-hour or one GiB-hour, whatever the SKU's usage unit."""
    price, factor, _ = _price(sku)
    base = sku['pricingInfo'][0]['pricingExpression']['baseUnit']
    per_base = price / factor
    if base == 's':
        return per_base * 3600
    if base == 'By.s':
        return per_base * GIB * 3600
    raise BillingError(f'unexpected base unit {base!r} for SKU {sku.get("skuId")}')


def _descriptions(shape: str, gpu: str, disk_type: str, provisioning: str) -> dict[str, str]:
    family = _FAMILY.get(shape.split('-')[0])
    if not family or gpu not in _GPU or disk_type not in _DISK:
        raise BillingError(f'no SKU mapping for {shape} / {gpu} / {disk_type}')
    spot = provisioning == 'spot'
    prefix = 'Spot Preemptible ' if spot else ''
    return {
        'vcpu': rf'{prefix}{family} Instance Core running in \w[\w ]*',
        'ram': rf'{prefix}{family} Instance Ram running in \w[\w ]*',
        'gpu': (
            rf'{_GPU[gpu]} attached to Spot Preemptible VMs running in \w[\w ]*'
            if spot
            else rf'{_GPU[gpu]} running in \w[\w ]*'
        ),
        'disk': re.escape(_DISK[disk_type]),
    }


def rate_card(
    skus: Iterable[Mapping[str, Any]], cfg: RunnerConfig, provisioning: str, *, fetched_utc: str
) -> RateCard:
    """The rate of cfg.shape (+ boot disk) in cfg.region under `provisioning`, from catalog SKUs."""
    usage = {'spot': 'Preemptible', 'on_demand': 'OnDemand'}[provisioning]
    spec = cfg.spec
    quantity = {
        'vcpu': spec['vcpus'],
        'ram': spec['ram_gib'],
        'gpu': spec['gpus'],
        'disk': cfg.boot_disk_gb,
    }
    in_region = [s for s in skus if cfg.region in s.get('serviceRegions', ())]
    components = []
    effective = set()
    for item, pattern in _descriptions(
        cfg.shape, cfg.gpu, cfg.boot_disk_type, provisioning
    ).items():
        # Disks have no spot SKU: a spot VM's boot disk bills at the standard rate.
        want_usage = 'OnDemand' if item == 'disk' else usage
        matches = [
            s
            for s in in_region
            if re.fullmatch(pattern, s['description'])
            and s['category'].get('usageType') == want_usage
        ]
        if len(matches) != 1:
            names = sorted(s['description'] for s in matches)
            raise BillingError(
                f'expected one {provisioning} {item} SKU in {cfg.region}, found {names or "none"}'
            )
        sku = matches[0]
        effective.add(_price(sku)[2])
        components.append(
            Component(
                item, sku['skuId'], sku['description'], quantity[item], _usd_per_unit_hour(sku)
            )
        )
    return RateCard(
        cfg.shape, cfg.region, provisioning, tuple(components), max(effective), fetched_utc
    )


# --- fetching -------------------------------------------------------------------------------

Fetch = Callable[[str, Mapping[str, str]], Mapping[str, Any]]


def _urllib_fetch(url: str, headers: Mapping[str, str]) -> Mapping[str, Any]:
    request = urllib.request.Request(url, headers=dict(headers))
    with urllib.request.urlopen(request, timeout=60) as response:  # noqa: S310 — fixed https host
        return json.load(response)


def fetch_skus(
    shell: Shell, *, fetch: Fetch = _urllib_fetch, service: str = COMPUTE_SERVICE
) -> list[dict[str, Any]]:
    """Every SKU of a service, all pages, priced in USD.

    The bearer token comes from the active gcloud credential and only ever lives in this
    request's headers; it is never logged or written anywhere.
    """
    token = check(shell.run(['gcloud', 'auth', 'print-access-token'], timeout=60)).stdout.strip()
    headers = {'Authorization': f'Bearer {token}'}
    skus: list[dict[str, Any]] = []
    page = ''
    while True:
        query = {'currencyCode': 'USD', 'pageSize': '5000', **({'pageToken': page} if page else {})}
        body = fetch(
            f'{CATALOG_URL.format(service=service)}?{urllib.parse.urlencode(query)}', headers
        )
        skus.extend(body.get('skus', []))
        page = body.get('nextPageToken', '')
        if not page:
            return skus


def rate_cards(
    skus: Sequence[Mapping[str, Any]], cfg: RunnerConfig, *, fetched_utc: str
) -> dict[str, RateCard]:
    return {p: rate_card(skus, cfg, p, fetched_utc=fetched_utc) for p in ('spot', 'on_demand')}


# --- booking --------------------------------------------------------------------------------


def parse_utc(stamp: str) -> datetime:
    return datetime.fromisoformat(stamp.replace('Z', '+00:00'))


def billed_minutes(created_utc: str, deleted_utc: str) -> float:
    """Compute Engine bills per second with a one-minute minimum; reported to 0.1 min, rounded up
    so a booking never under-states the bill."""
    seconds = max(60.0, (parse_utc(deleted_utc) - parse_utc(created_utc)).total_seconds())
    return math.ceil(round(seconds, 3) / 6) / 10  # ceil to 0.1 min; round() absorbs float drift


def book(created_utc: str, deleted_utc: str, card: RateCard) -> dict[str, float]:
    """The cost fields of one report.vm.instances[] entry."""
    minutes = billed_minutes(created_utc, deleted_utc)
    rate = card.usd_per_hour
    return {
        'billed_min': minutes,
        'rate_usd_per_h': round(rate, 4),
        'usd': round(minutes / 60 * rate, 2),
    }
