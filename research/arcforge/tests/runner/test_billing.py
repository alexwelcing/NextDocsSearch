import pytest

from arcforge.runner import billing
from arcforge.runner.config import RunnerConfig

FETCHED = '2026-10-24T12:00:00Z'


def test_on_demand_rate_matches_the_catalog(skus):
    card = billing.rate_card(skus, RunnerConfig(), 'on_demand', fetched_utc=FETCHED)
    by_item = {c.item: c for c in card.components}
    assert by_item['vcpu'].description == 'G2 Instance Core running in Americas'
    assert by_item['ram'].description == 'G2 Instance Ram running in Americas'
    assert by_item['gpu'].description == 'Nvidia L4 GPU running in Americas'
    assert by_item['disk'].description == 'Balanced PD Capacity'
    # 8 × 0.024988212 + 32 × 0.002927448 + 0.560040239: the program's $0.85/h plan rate.
    assert by_item['vcpu'].usd_per_hour + by_item['ram'].usd_per_hour + by_item['gpu'].usd_per_hour == pytest.approx(0.853624, abs=1e-6)
    # 200 GiB at $0.10 per GiB-month, where the catalog's month is 31 days (744 h).
    assert by_item['disk'].usd_per_hour == pytest.approx(200 * 0.1 / 744, rel=1e-9)
    assert card.usd_per_hour == pytest.approx(0.853624 + 200 * 0.1 / 744, abs=1e-6)
    assert card.effective_time == '2026-10-24T07:00:00Z'


def test_spot_rate_uses_the_spot_skus(skus):
    card = billing.rate_card(skus, RunnerConfig(), 'spot', fetched_utc=FETCHED)
    by_item = {c.item: c for c in card.components}
    assert by_item['vcpu'].description == 'Spot Preemptible G2 Instance Core running in Americas'
    assert by_item['gpu'].description == 'Nvidia L4 GPU attached to Spot Preemptible VMs running in Americas'
    assert by_item['disk'].description == 'Balanced PD Capacity'  # disks have no spot price
    compute = sum(c.usd_per_hour for c in card.components if c.item != 'disk')
    # 8 × 0.01495 + 32 × 0.001751 + 0.3352. The program's "about $0.34/h" is the GPU alone.
    assert compute == pytest.approx(0.510832, abs=1e-6)


def test_custom_and_sole_tenancy_skus_never_match(skus):
    for provisioning in ('spot', 'on_demand'):
        card = billing.rate_card(skus, RunnerConfig(), provisioning, fetched_utc=FETCHED)
        assert not any('Custom' in c.description or 'Sole Tenancy' in c.description for c in card.components)


def test_region_is_respected(skus):
    with pytest.raises(billing.BillingError, match='asia-southeast1'):
        cfg = RunnerConfig(region='asia-southeast1', zones=('asia-southeast1-a',))
        billing.rate_card(skus, cfg, 'on_demand', fetched_utc=FETCHED)


def test_g2_standard_16_scales_cpu_and_ram_not_the_gpu(skus):
    small = billing.rate_card(skus, RunnerConfig(), 'on_demand', fetched_utc=FETCHED)
    big = billing.rate_card(skus, RunnerConfig(shape='g2-standard-16'), 'on_demand', fetched_utc=FETCHED)
    gpu = {c.item: c.usd_per_hour for c in small.components}['gpu']
    assert big.usd_per_hour - gpu - small.components[-1].usd_per_hour == pytest.approx(
        2 * (small.usd_per_hour - gpu - small.components[-1].usd_per_hour))


def test_fetch_pages_through_the_catalog(shell):
    shell.on('gcloud', 'auth', 'print-access-token', then=shell.ok('tok\n'))
    seen = []

    def fetch(url, headers):
        seen.append((url, dict(headers)))
        return {'skus': [{'skuId': 'A'}], 'nextPageToken': 'p2'} if 'pageToken' not in url else {'skus': [{'skuId': 'B'}]}

    assert [s['skuId'] for s in billing.fetch_skus(shell, fetch=fetch)] == ['A', 'B']
    assert all(h['Authorization'] == 'Bearer tok' for _, h in seen)
    assert 'services/6F81-5844-456A/skus' in seen[0][0] and 'currencyCode=USD' in seen[0][0]
    assert 'pageToken=p2' in seen[1][0]


@pytest.mark.parametrize(('created', 'deleted', 'minutes'), [
    ('2026-10-24T10:00:00Z', '2026-10-24T10:00:20Z', 1.0),  # one-minute minimum
    ('2026-10-24T10:00:00Z', '2026-10-24T10:01:00Z', 1.0),
    ('2026-10-24T10:00:00Z', '2026-10-24T10:01:01Z', 1.1),  # rounded up, never down
    ('2026-10-24T10:00:00.000-07:00', '2026-10-24T17:30:00Z', 30.0),  # GCE's offset timestamps
])
def test_billed_minutes(created, deleted, minutes):
    assert billing.billed_minutes(created, deleted) == minutes


def test_book(skus):
    card = billing.rate_card(skus, RunnerConfig(), 'spot', fetched_utc=FETCHED)
    booked = billing.book('2026-10-24T10:00:00Z', '2026-10-24T11:00:00Z', card)
    assert booked == {'billed_min': 60.0, 'rate_usd_per_h': round(card.usd_per_hour, 4), 'usd': round(card.usd_per_hour, 2)}


def test_rate_card_json_is_self_describing(skus):
    out = billing.rate_cards(skus, RunnerConfig(), fetched_utc=FETCHED)['spot'].to_json()
    assert out['provisioning'] == 'spot' and out['fetched_utc'] == FETCHED
    assert {c['sku_id'] for c in out['components']} == {'59A6-9C49-BDDB', 'BF80-650A-78E6', 'AEC2-3D5C-61BF', '6AE1-525F-8B80'}
