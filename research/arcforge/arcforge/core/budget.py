"""`arcforge plan`: price every stage of a run and apply the budget guard.

Inputs: the resolved config (its `plan` workload block and `budget` block) and the pinned price
table it names (budget.prices). Output: a Plan with one priced row per stage of the DAG, the
cost lines in report.cost.lines form, and the guard's verdict.

    subtotal     every non-dividend line, unrounded
    contingency  budget.contingency x subtotal
    dividend     budget.dividend items, by budget.dividend_priority, in whole units, while the
                 planned total stays within the limit (the benchmark dividend, R01 onward;
                 R00 has none)
    plan_usd     subtotal + contingency + dividend
    limit        min(plan_ceiling, cap, --budget): $20 at R00, where the ceiling equals the
                 cap, and $17 for every later run (config.validate enforces both)

A plan above the limit is not ok: `arcforge plan` exits non-zero and `arcforge run` refuses
to start, naming budget.first_cut (R00's pre-named cut) and what it would save.

Workload line kinds (config plan.<stage>: [lines]):
    vm            runner-VM minutes, priced at the shape's ON-DEMAND rate (never spot)
    llm           Vertex tokens, priced per model from the table
    workers_ai    Cloudflare Workers AI neurons (thousands)
    storage       GCS GB-months (the cache and the model mirror, pro rata)
    orchestrator  Fable via the orchestrator: $0 cash, tokens logged
    laptop/owner  minutes on the laptop or of the owner's time: $0, no cost line
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_FLOOR, Decimal
from typing import Any

from arcforge.core.config import Config, ConfigError
from arcforge.core.dag import Stage
from arcforge.core.prices import PriceTable, cents, dec

PLAN_SCHEMA = 'arc-plan/1'
KINDS = ('vm', 'llm', 'workers_ai', 'storage', 'orchestrator', 'laptop', 'owner')


@dataclass
class Line:
    stage: str
    item: str
    provider: str
    usd: Decimal
    id: str | None = None
    endpoint: str | None = None
    model: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    gpu_min: Decimal = Decimal(0)
    cached: bool = False
    dividend: bool = False

    def to_json(self) -> dict[str, Any]:
        return {
            'stage': self.stage,
            'item': self.item,
            'provider': self.provider,
            'endpoint': self.endpoint,
            'model': self.model,
            'tokens_in': self.tokens_in,
            'tokens_out': self.tokens_out,
            'gpu_min': float(self.gpu_min),
            'usd': float(cents(self.usd)),
            'cached': self.cached,
            'dividend': self.dividend,
        }


@dataclass
class StageRow:
    stage: str
    title: str
    phase: str
    platform: str
    implemented: bool
    usd: Decimal = Decimal(0)
    vm_min: Decimal = Decimal(0)
    laptop_min: Decimal = Decimal(0)
    owner_min: Decimal = Decimal(0)

    def to_json(self) -> dict[str, Any]:
        return {
            'stage': self.stage,
            'title': self.title,
            'phase': self.phase,
            'platform': self.platform,
            'implemented': self.implemented,
            'usd': float(cents(self.usd)),
            'vm_min': float(self.vm_min),
            'laptop_min': float(self.laptop_min),
            'owner_min': float(self.owner_min),
        }


@dataclass
class Plan:
    run_id: str
    branch: str
    config_sha256: str
    prices: PriceTable
    shape: str
    lines: list[Line]
    stages: list[StageRow]
    contingency_rate: Decimal
    ceiling: Decimal
    cap: Decimal
    budget: Decimal | None
    first_cut: dict[str, Any] | None = None
    notes: list[str] = field(default_factory=list)

    # Totals are booked in cents: the subtotal is the cent-rounded sum of the unrounded lines,
    # contingency is the cent-rounded rate x subtotal, and the plan is their sum, so the printed
    # figures always add up (10.24 + 1.54 = 11.78 at R00).
    @property
    def subtotal(self) -> Decimal:
        return cents(sum((line.usd for line in self.lines if not line.dividend), Decimal(0)))

    @property
    def contingency(self) -> Decimal:
        return cents(self.subtotal * self.contingency_rate)

    @property
    def dividend(self) -> Decimal:
        return cents(sum((line.usd for line in self.lines if line.dividend), Decimal(0)))

    @property
    def total(self) -> Decimal:
        return self.subtotal + self.contingency + self.dividend

    @property
    def limit(self) -> Decimal:
        bounds = [self.ceiling, self.cap] + ([self.budget] if self.budget is not None else [])
        return min(bounds)

    @property
    def ok(self) -> bool:
        return self.total <= self.limit

    @property
    def vm_minutes(self) -> Decimal:
        return sum((line.gpu_min for line in self.lines if line.provider == 'gcp'), Decimal(0))

    def to_json(self) -> dict[str, Any]:
        on_demand = self.prices.vm_rate(self.shape, 'on_demand')
        spot = self.prices.vm_rate(self.shape, 'spot')
        return {
            'schema': PLAN_SCHEMA,
            'run': {'id': self.run_id, 'branch': self.branch, 'config_sha256': self.config_sha256},
            'prices': {
                'id': self.prices.id,
                'path': self.prices.path.name,
                'sha256': self.prices.sha256,
            },
            'vm': {
                'shape': self.shape,
                'minutes': float(self.vm_minutes),
                'priced_at': 'on_demand',
                'rate_usd_per_h': float(on_demand),
                'usd': float(cents(self.vm_minutes * on_demand / 60)),
                'spot_rate_usd_per_h': float(spot),
                'spot_estimate_usd': float(cents(self.vm_minutes * spot / 60)),
            },
            'stages': [row.to_json() for row in self.stages],
            'lines': [line.to_json() for line in self.lines],
            'subtotal_usd': float(cents(self.subtotal)),
            'contingency': {
                'rate': float(self.contingency_rate),
                'usd': float(cents(self.contingency)),
            },
            'dividend_usd': float(cents(self.dividend)),
            'plan_usd': float(cents(self.total)),
            'ceiling_usd': float(self.ceiling),
            'cap_usd': float(self.cap),
            'budget_usd': float(self.budget) if self.budget is not None else None,
            'limit_usd': float(self.limit),
            'headroom_usd': float(cents(self.limit - self.total)),
            'ok': self.ok,
            'first_cut': self.first_cut,
            'verify_at_launch': self.prices.verify_at_launch(),
            'notes': self.notes,
        }


def _int(entry: dict[str, Any], name: str) -> int:
    value = entry.get(name, 0)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ConfigError(f'plan line {entry.get("item")!r}: {name} must be a whole number >= 0')
    return value


def price_line(
    stage: str, entry: dict[str, Any], prices: PriceTable, config: Config
) -> tuple[Line | None, str | None, Decimal]:
    """One workload entry -> (cost line or None, minutes bucket, minutes)."""
    kind = entry.get('kind')
    if kind not in KINDS:
        raise ConfigError(f'plan.{stage}: line kind {kind!r} not in {KINDS}')
    item = entry.get('item')
    if not isinstance(item, str) or not item:
        raise ConfigError(f'plan.{stage}: every line needs an item')
    minutes = dec(entry.get('minutes', 0))
    common = {
        'stage': stage,
        'item': item,
        'id': entry.get('id'),
        'cached': bool(entry.get('cached', False)),
    }
    if kind in ('laptop', 'owner'):
        return None, kind, minutes
    if kind == 'vm':
        shape = config.get('compute.shape')
        model = entry.get('model')
        if model is not None and prices.llm(model)['provider'] != 'vllm':
            raise ConfigError(f'plan.{stage}: {model} is not a vLLM model on the runner')
        line = Line(
            provider='gcp',
            endpoint=config.get('compute.region'),
            model=model,
            tokens_in=_int(entry, 'tokens_in'),
            tokens_out=_int(entry, 'tokens_out'),
            gpu_min=minutes,
            usd=prices.vm_usd(shape, minutes, 'on_demand'),
            **common,
        )
        return line, 'vm', minutes
    if kind == 'llm':
        model = entry.get('model')
        if not isinstance(model, str):
            raise ConfigError(f'plan.{stage}: llm line {item!r} needs a model')
        price = prices.llm(model)
        if price['provider'] != 'vertex':
            raise ConfigError(
                f'plan.{stage}: {model} is not a Vertex model (provider {price["provider"]})'
            )
        tokens_in, tokens_out = _int(entry, 'tokens_in'), _int(entry, 'tokens_out')
        usd = Decimal(0) if common['cached'] else prices.llm_usd(model, tokens_in, tokens_out)
        line = Line(
            provider='vertex',
            endpoint=entry.get('endpoint', price.get('endpoint')),
            model=model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            usd=usd,
            **common,
        )
        return line, None, minutes
    if kind == 'workers_ai':
        return (
            Line(
                provider='workers_ai',
                usd=prices.workers_ai_usd(entry.get('neurons_k', 0)),
                **common,
            ),
            None,
            minutes,
        )
    if kind == 'storage':
        return (
            Line(provider='gcp', usd=prices.storage_usd(entry.get('gb_month', 0)), **common),
            None,
            minutes,
        )
    return (
        Line(
            provider='orchestrator',
            model=entry.get('model', 'claude-fable-5-1'),
            tokens_in=_int(entry, 'tokens_in'),
            tokens_out=_int(entry, 'tokens_out'),
            usd=Decimal(0),
            **common,
        ),
        None,
        minutes,
    )


def _check_dividend(config: Config, prices: PriceTable, stages: dict[str, Stage]) -> None:
    for item in config.get('budget.dividend') or []:
        if item['stage'] not in stages:
            raise ConfigError(f'dividend item {item["item"]!r}: unknown stage {item["stage"]!r}')
        if prices.llm(item['model'])['provider'] != 'vertex':
            raise ConfigError(f'dividend item {item["item"]!r}: {item["model"]} is not on Vertex')


def _dividend_lines(config: Config, prices: PriceTable, room: Decimal) -> list[Line]:
    budget = config.get('budget')
    items = budget.get('dividend') or []
    lines = []
    for priority in budget['dividend_priority']:
        for item in (i for i in items if i['priority'] == priority):
            per_in, per_out = _int(item, 'tokens_in_per_unit'), _int(item, 'tokens_out_per_unit')
            unit_usd = prices.llm_usd(item['model'], per_in, per_out)
            if unit_usd <= 0:
                raise ConfigError(f'dividend item {item["item"]!r} costs nothing per unit')
            units = min(
                _int(item, 'max_units'), int((room / unit_usd).to_integral_value(ROUND_FLOOR))
            )
            if units <= 0:
                continue
            usd = unit_usd * units
            room -= usd
            lines.append(
                Line(
                    stage=item['stage'],
                    item=f'{item["item"]} ({units} x {item["unit"]})',
                    id=f'dividend.{priority}',
                    provider='vertex',
                    endpoint=prices.llm(item['model']).get('endpoint'),
                    model=item['model'],
                    tokens_in=per_in * units,
                    tokens_out=per_out * units,
                    usd=usd,
                    dividend=True,
                )
            )
    return lines


def make_plan(
    config: Config, prices: PriceTable, stages: dict[str, Stage], budget_usd: float | None = None
) -> Plan:
    workload = config.get('plan', {}) or {}
    unknown = sorted(set(workload) - set(stages))
    if unknown:
        raise ConfigError(f'plan names unknown stages {unknown} (known: {", ".join(stages)})')
    budget = config.get('budget')
    _check_dividend(config, prices, stages)
    rows: list[StageRow] = []
    lines: list[Line] = []
    for name, stage in stages.items():
        row = StageRow(name, stage.title, stage.phase, stage.platform, stage.implemented)
        for entry in workload.get(name) or []:
            line, bucket, minutes = price_line(name, entry, prices, config)
            if line is not None:
                lines.append(line)
                row.usd += line.usd
            if bucket:
                setattr(row, f'{bucket}_min', getattr(row, f'{bucket}_min') + minutes)
        rows.append(row)
    ids = [(line.stage, line.id) for line in lines if line.id]
    if len(ids) != len(set(ids)):
        raise ConfigError('plan line ids must be unique within a stage')

    plan = Plan(
        run_id=config.run_id,
        branch=config.branch,
        config_sha256=config.sha256,
        prices=prices,
        shape=config.get('compute.shape'),
        lines=lines,
        stages=rows,
        contingency_rate=dec(budget['contingency']),
        ceiling=dec(budget['plan_ceiling']),
        cap=dec(budget['cap']),
        budget=dec(budget_usd) if budget_usd is not None else None,
    )
    # Whole cents only, so a cent-rounded dividend can never lift the plan over the limit.
    room = (plan.limit - plan.total).quantize(Decimal('0.01'), rounding=ROUND_FLOOR)
    if room > 0:
        dividend = _dividend_lines(config, prices, room)
        plan.lines.extend(dividend)
        by_stage = {row.stage: row for row in rows}
        for line in dividend:
            by_stage[line.stage].usd += line.usd

    cut = budget.get('first_cut')
    if cut:
        stage, _, line_id = cut['line'].partition('.')
        matches = [line for line in lines if line.stage == stage and line.id == line_id]
        if not matches:
            raise ConfigError(f'budget.first_cut names no plan line {cut["line"]!r}')
        saving = matches[0].usd * (1 - dec(cut['scale']))
        plan.first_cut = {
            'line': cut['line'],
            'note': cut.get('note'),
            'scale': float(dec(cut['scale'])),
            'saving_usd': float(cents(saving)),
            'plan_saving_usd': float(cents(saving * (1 + plan.contingency_rate))),
        }
    return plan


def _usd(value: Decimal) -> str:
    return f'{float(cents(value)):>8.2f}'


def render(plan: Plan) -> str:
    """The plan as a fixed-width table for the terminal."""
    doc = plan.to_json()
    prices = plan.prices
    out = [
        f'arcforge plan {plan.run_id} (branch {plan.branch}) · prices {prices.id} '
        f'({prices.path.name}, sha256 {prices.sha256[:12]}) · config {plan.config_sha256[:12]}',
        '',
        f'{"stage":6}{"phase":6}{"platform":19}{"":44}{"usd":>8}',
        f'{"":6}{"- line":44}{"provider":13}{"model":30}'
        f'{"tokens in":>11}{"out":>10}{"min":>6}{"usd":>8}',
    ]
    by_stage: dict[str, list[Line]] = {}
    for line in plan.lines:
        by_stage.setdefault(line.stage, []).append(line)
    for row in plan.stages:
        title = row.title + ('' if row.implemented else ' [stub]')
        free = [
            f'{kind} {minutes:g} min'
            for kind, minutes in (('laptop', row.laptop_min), ('owner', row.owner_min))
            if minutes
        ]
        if free:
            title += f' ({", ".join(free)})'
        out.append(f'{row.stage:6}{row.phase:6}{row.platform:19}{title[:43]:44}{_usd(row.usd)}')
        for line in by_stage.get(row.stage, []):
            label = ('[dividend] ' if line.dividend else '') + line.item
            minutes = f'{line.gpu_min:g}' if line.gpu_min else ''
            out.append(
                f'{"":6}- {label[:41]:42}{line.provider:13}{(line.model or "-")[:29]:30}'
                f'{line.tokens_in or "":>11}{line.tokens_out or "":>10}{minutes:>6}{_usd(line.usd)}'
            )
    vm = doc['vm']
    budget = f', --budget ${doc["budget_usd"]:.2f}' if doc['budget_usd'] is not None else ''
    verdict = 'OK' if doc['ok'] else 'OVER THE LIMIT'
    out += [
        '',
        f'runner VM  {vm["shape"]}: {vm["minutes"]:g} min priced at on-demand '
        f'${vm["rate_usd_per_h"]:.2f}/h = ${vm["usd"]:.2f}  '
        f'(spot ${vm["spot_rate_usd_per_h"]:.2f}/h would be about '
        f'${vm["spot_estimate_usd"]:.2f}; not planned)',
        f'subtotal          ${doc["subtotal_usd"]:>7.2f}   (the unrounded lines, summed in cents)',
        f'contingency {doc["contingency"]["rate"]:.0%}   ${doc["contingency"]["usd"]:>7.2f}',
        f'dividend          ${doc["dividend_usd"]:>7.2f}',
        f'PLAN              ${doc["plan_usd"]:>7.2f}',
        '',
        f'limit ${doc["limit_usd"]:.2f} = min(ceiling ${doc["ceiling_usd"]:.2f}, '
        f'cap ${doc["cap_usd"]:.2f}{budget})  ->  {verdict} (headroom ${doc["headroom_usd"]:.2f})',
    ]
    if not doc['ok'] and doc['first_cut']:
        cut = doc['first_cut']
        out.append(
            f'pre-named first cut: {cut["note"]} ({cut["line"]}): -${cut["saving_usd"]:.2f} on the '
            f'line, -${cut["plan_saving_usd"]:.2f} on the plan with contingency'
        )
    out += ['', 'verify at launch (third-party or volatile prices in this table):']
    for flag in doc['verify_at_launch']:
        note = f'  ({flag["note"]})' if flag['note'] else ''
        out.append(f'  {flag["entry"]}.{flag["field"]} = {flag["value"]}{note}')
    return '\n'.join(out)
