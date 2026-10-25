"""Toy mode: deterministic synthetic upstream artifacts in the INTERFACES-M2 schemas.

`toy_inputs()` returns {stage: {output name: bytes}} for every stage the verdict stages read (S0,
S1, S2p, S12q, S6b, S9, S10, S11, S12a, S12b, S12r, gate, X1, X2, P1), shaped like the real ones
and small enough for a test: 40 records, every stratum, eight registered systems plus the
students, five seeds and three folds, probes of every type, the I1b/I1d/I5 frames, the open and
Claude reference legs and a Fable gold audit. Nothing here is a measurement: relevance is planted,
and each system's skill is a fixed number, so the judges agree and the systems separate.
"""

from __future__ import annotations

import hashlib
import json
import random
import struct
from typing import Any

from arcforge.contract.ids import PROBE_EXPECT
from arcforge.eval import io
from arcforge.eval.i1 import REGISTERED_SYSTEMS, pair_id

SEEDS = (1729, 1730, 1731, 1732, 1733)
STUDENTS = ('B5', 'hyb(B5)', 'champ', 'hyb(champ)')
SKILL = {
    'B0': 0.6, 'B1': 1.2, 'B2': 1.5, 'B4': 0.3, 'B3.potion8m': 0.9, 'hyb(B4)': 1.8,
    'hyb(B3.potion8m)': 2.1, 'B6.embeddinggemma-2-768': 2.6, 'B5': 1.4, 'hyb(B5)': 2.3,
    'champ': 1.45, 'hyb(champ)': 2.35, 'B6.wai-qwen3-embedding-0.6b': 2.0,
}  # fmt: skip
N_RECORDS = 40


def _rng(*labels: object) -> random.Random:
    digest = hashlib.sha256('|'.join(map(str, labels)).encode()).digest()
    return random.Random(int.from_bytes(digest[:8], 'big'))


def _sha(*labels: object) -> str:
    return hashlib.sha256('|'.join(map(str, labels)).encode()).hexdigest()


def _qid(stratum: str, key: str, text: str) -> str:
    return f'{stratum}:' + hashlib.sha256(f'{stratum}\t{key}\t{text}'.encode()).hexdigest()[:16]


def records() -> list[str]:
    return [f'rec-{i:02d}' for i in range(N_RECORDS)]


def _fold(slug: str) -> int:
    return int(_sha('fold', slug)[:8], 16) % 3 + 1


def bench() -> tuple[list[dict[str, Any]], dict[str, dict[str, int]], list[dict[str, Any]]]:
    """(bench_queries, true relevance {qid: {slug: grade}}, qrels_fixed rows)."""
    recs = records()
    queries: list[dict[str, Any]] = []
    truth: dict[str, dict[str, int]] = {}
    fixed: list[dict[str, Any]] = []

    def add(stratum: str, n: int, *, family: str | None = None, quarantined: bool = False,
            frontier: bool = False) -> None:  # fmt: skip
        for i in range(n):
            r = _rng('q', stratum, family, i)
            source = recs[(i * 7 + len(stratum)) % N_RECORDS]
            text = f'{stratum} {family or ""} query {i}'
            qid = _qid(stratum, f'{source}#{i}' if stratum == 'A' else source, text)
            row = {
                'query_id': qid, 'stratum': stratum, 'family': family, 'text': text,
                'pointer': None, 'source_slug': source, 'frontier': frontier,
                'quarantined': quarantined, 'registered': not quarantined,
                'test_fold': _fold(source), 'exploratory': False,
            }  # fmt: skip
            others = [s for s in recs if s != source]
            rel: dict[str, int] = {}
            if stratum in ('A', 'B'):
                for t in r.sample(others, 1 if stratum == 'A' or i % 3 else 2):
                    rel[t] = 3
                    fixed.append({'query_id': qid, 'slug': t, 'grade': 3,
                                  'source': 'rationale' if stratum == 'A' else 'link'})  # fmt: skip
            elif stratum in ('C', 'E'):
                rel[source] = 3
                row['intent_slug'] = source
                for t in r.sample(others, 2):
                    rel[t] = r.choice((1, 2))
                if stratum == 'C':
                    fixed.append({'query_id': qid, 'slug': source, 'grade': 3, 'source': 'intent'})
            elif stratum in ('D', 'T'):
                for t in r.sample(recs, 3):
                    rel[t] = r.choice((1, 2, 3))
            elif stratum == 'F':
                if i % 2 == 0:
                    t = r.choice(recs)
                    rel[t] = 3
                    fixed.append({'query_id': qid, 'slug': t, 'grade': 3, 'source': 'ghost_rename'})
            elif stratum == 'G':
                key = f'lex:{i:02d}'
                rel[key] = 3
                fixed.append({'query_id': qid, 'slug': key, 'grade': 3, 'source': 'glossary'})
            queries.append(row)
            truth[qid] = rel

    add('A', 36)
    add('B', 36)
    add('C', 14, family='open')
    add('C', 4, family='frontier', frontier=True)
    add('E', 30)
    for family in ('entity', 'coinage', 'negation', 'era'):
        add('D', 12, family=family)
    add('D', 4, family='entity', quarantined=True)
    add('F', 10)
    add('G', 20)
    add('T', 10)
    queries.sort(key=lambda q: q['query_id'])
    return queries, truth, sorted(fixed, key=lambda r: (r['query_id'], r['slug']))


def rankings(queries: list[dict[str, Any]], truth: dict[str, dict[str, int]]) -> list[dict[str, Any]]:
    recs = records()
    lexemes = [f'lex:{i:02d}' for i in range(20)] + [f'lex:x{i:02d}' for i in range(20)]
    out = []
    for q in queries:
        pool = lexemes if q['stratum'] == 'G' else recs
        rel = truth[q['query_id']]
        for system, skill in sorted(SKILL.items()):
            slots = [(f, s) for f in (1, 2, 3) for s in SEEDS] if system in STUDENTS else [(None, None)]
            for fold, seed in slots:
                r = _rng('rank', q['query_id'], system, fold, seed)
                scored = sorted(
                    ((round(skill * rel.get(c, 0) + r.gauss(0, 2.0), 6), c) for c in pool),
                    key=lambda x: (-x[0], x[1]),
                )[:50]
                out.append({'query_id': q['query_id'], 'system_id': system, 'fold': fold,
                            'seed': seed, 'ranked': [[c, s] for s, c in scored]})  # fmt: skip
    return out


def _noisy(grade: int, *labels: object, p: float = 0.08) -> int:
    r = _rng('noise', *labels)
    if r.random() < p:
        return max(0, min(3, grade + r.choice((-1, 1))))
    return grade


def judging(queries, truth, ranks, fable_noise=0.02):  # noqa: ANN001, ANN201 - toy plumbing
    """(pools, judgments, probes, frames, ref_open, ref_claude, fable_gold)."""
    judged_strata = {'C', 'D', 'E', 'T'}
    by_q = {q['query_id']: q for q in queries}
    pools, judgments = [], []
    pairs: dict[str, tuple[str, str, int]] = {}
    ranks_by_q: dict[str, list[dict[str, Any]]] = {}
    for row in ranks:
        ranks_by_q.setdefault(row['query_id'], []).append(row)
    for q in queries:
        if q['stratum'] not in judged_strata:
            continue
        by_system: dict[str, list[str]] = {}
        for row in ranks_by_q.get(q['query_id'], []):
            if row['fold'] in (None, q['test_fold']) and row['seed'] in (None, SEEDS[0]):
                by_system[row['system_id']] = [c for c, _ in row['ranked'][:10]]
        slugs = sorted({s for v in by_system.values() for s in v})
        pools.append({'query_id': q['query_id'], 'depth': 10, 'slugs': slugs, 'by_system': by_system})
        for slug in slugs:
            true = truth[q['query_id']].get(slug, 0)
            pid = pair_id(q['query_id'], slug)
            pairs[pid] = (q['query_id'], slug, true)
    # probes: four gated types (24 each) and one ungated (12), on extra judged pairs
    probes = []
    recs = records()
    for n_type, ptype in enumerate(PROBE_EXPECT):
        count = 12 if ptype == 'P3' else 24
        for i in range(count):
            q = queries[(i * 5 + n_type * 3) % len(queries)]
            slug = recs[(i + n_type * 11) % N_RECORDS]
            true = 3 if PROBE_EXPECT[ptype] == 'ge2' else 0
            pid = pair_id(q['query_id'], slug)
            probes.append({'probe_id': f'{ptype}:' + _sha('probe', ptype, i)[:16], 'type': ptype,
                           'query_id': q['query_id'], 'slug': slug, 'expect': PROBE_EXPECT[ptype],
                           'gated': count >= 20})  # fmt: skip
            pairs.setdefault(pid, (q['query_id'], slug, true))
            pairs[pid] = (q['query_id'], slug, true)
    order = sorted(pairs)
    for pid in order:
        qid, slug, true = pairs[pid]
        judgments.append({'pair_id': pid, 'query_id': qid, 'slug': slug, 'role': 'primary',
                          'model': 'gemini-3.1-flash-lite', 'grade': _noisy(true, pid, 'p', p=0.03),
                          'uncertainty': 0.1, 'flag': None, 'call_id': _sha('call', pid)[:32]})  # fmt: skip
        if int(pid[:2], 16) % 4 == 0 or by_q[qid]['stratum'] in ('D',):
            judgments.append({'pair_id': pid, 'query_id': qid, 'slug': slug, 'role': 'audit',
                              'model': 'qwen3.5-9b', 'grade': _noisy(true, pid, 'a', p=0.05),
                              'uncertainty': 0.1, 'flag': None, 'call_id': _sha('callq', pid)[:32]})  # fmt: skip
    d_e = [p for p in order if by_q[pairs[p][0]]['stratum'] in ('D', 'E') and not by_q[pairs[p][0]]['quarantined']]
    i1b = d_e[:150]
    dense_only, bm25_only = d_e[150:190], d_e[190:230]
    gold_queries = sorted({pairs[p][0] for p in d_e})[:40]
    gold_pairs = []
    for q in gold_queries:
        gold_pairs += [p for p in order if pairs[p][0] == q][:12]
    ref_fable = [p for p in gold_pairs if p not in set(i1b)][:150]
    frames = {
        'schema': 'arc-frames/1',
        'gold': [{'query_id': q, 'slugs': sorted(pairs[p][1] for p in gold_pairs if pairs[p][0] == q)[:12]} for q in gold_queries],
        'i1b': i1b,
        'i1d': {'dense_only': dense_only, 'bm25_only': bm25_only},
        'i5': {'ref_i1b': i1b, 'ref_fable': ref_fable},
        'tune_check': {'tune': i1b[::2], 'check': i1b[1::2]},
    }  # fmt: skip
    for role, model, p in (('i5_flashlite', 'gemini-3.1-flash-lite', 0.12), ('i5_qwen', 'qwen3.5-9b', 0.14),
                           ('i5_ministral', 'ministral-3-8b', 0.15)):  # fmt: skip
        for pid in [*i1b, *ref_fable]:
            qid, slug, true = pairs[pid]
            judgments.append({'pair_id': pid, 'query_id': qid, 'slug': slug, 'role': role, 'model': model,
                              'grade': _noisy(true, pid, role, p=p), 'uncertainty': 0.1, 'flag': None,
                              'call_id': _sha(role, pid)[:32]})  # fmt: skip
    ref_open, ref_claude = [], []
    for pid in [*i1b, *dense_only, *bm25_only]:
        true = pairs[pid][2]
        for family in ('olmo-instruct', 'phi-4'):
            ref_open.append({'pair_id': pid, 'family': family, 'grade': _noisy(true, pid, family, p=0.06),
                             'call_id': _sha(family, pid)[:32]})  # fmt: skip
        ref_claude.append({'pair_id': pid, 'family': 'claude', 'grade': _noisy(true, pid, 'claude', p=0.04),
                           'packet_sha256': _sha('claude-packet')})  # fmt: skip
    fable_gold = [
        {'query_id': pairs[p][0], 'slug': pairs[p][1], 'grade': _noisy(pairs[p][2], p, 'fable', p=fable_noise),
         'note': None, 'packet_sha256': _sha('gold-packet')}
        for p in gold_pairs
    ]  # fmt: skip
    judgments.sort(key=lambda j: (j['pair_id'], j['role']))
    return pools, judgments, probes, frames, ref_open, ref_claude, fable_gold


def _safetensors(tensors: dict[str, list[list[float]]], slugs: list[str]) -> bytes:
    header: dict[str, Any] = {'__metadata__': {'schema': 'arc-record-vectors/1', 'row_order': 'S1.graph.json#slug', 'slugs': json.dumps(slugs)}}
    blob = b''
    for name in sorted(tensors):
        rows = tensors[name]
        flat = [x for row in rows for x in row]
        data = struct.pack(f'<{len(flat)}e', *flat)
        header[name] = {'dtype': 'F16', 'shape': [len(rows), len(rows[0])], 'data_offsets': [len(blob), len(blob) + len(data)]}
        blob += data
    encoded = json.dumps(header).encode()
    return struct.pack('<Q', len(encoded)) + encoded + blob


def toy_inputs(*, i1_pass: bool = True, claude_leg: str = 'accepted') -> dict[str, dict[str, bytes]]:
    """Toy upstream artifacts; i1_pass=False makes Fable's gold disagree (I1c fails)."""
    queries, truth, fixed = bench()
    ranks = rankings(queries, truth)
    pools, judgments, probes, frames, ref_open, ref_claude, fable_gold = judging(
        queries, truth, ranks, fable_noise=0.02 if i1_pass else 0.6
    )
    recs = records()
    w0 = [[_rng('w0', s, d).gauss(0, 1) for d in range(8)] for s in recs]
    w1 = [[x + 0.3 * _rng('w1', s, d).gauss(0, 1) for d, x in enumerate(row)] for s, row in zip(recs, w0, strict=True)]
    ledger = lambda stage, usd, gpu: io.pretty({'schema': 'arc-ledger/1', 'lines': [  # noqa: E731
        {'stage': stage, 'item': f'{stage} toy', 'provider': 'gcp', 'endpoint': 'us-central1', 'model': None,
         'tokens_in': 0, 'tokens_out': 0, 'gpu_min': gpu, 'usd': usd, 'cached': False, 'dividend': False}],
        'gpu_min': gpu, 'claude_plan_tokens': 0})  # fmt: skip
    c_open = io.jsonl([q for q in queries if q['stratum'] == 'C' and q['family'] == 'open'], 'query_id')
    c_frontier = io.jsonl([q for q in queries if q['stratum'] == 'C' and q['family'] == 'frontier'], 'query_id')
    quarantine = {'schema': 'arc-quarantine/1', 'clusters': [
        {'cluster_id': 'q1:priya', 'name': 'Priya Chakrabarti / Chakraborty', 'rule': 'Q1',
         'calls': {'olmo-instruct': 'different', 'phi-4': 'different'}, 'quarantined': True},
        {'cluster_id': 'q3:adaeze', 'name': 'Adaeze', 'rule': 'Q3',
         'calls': {'olmo-instruct': 'same', 'phi-4': 'different'}, 'quarantined': True}],
        'quarantine_sha256': _sha('quarantine')}  # fmt: skip
    return {
        'S0': {'snapshot.json': io.pretty({'schema': 'arc-snapshot/1', 'corpus_id': _sha('corpus'),
                                           'main_corpus_id': _sha('corpus-main'), 'git_sha': _sha('git')[:40]})},
        'S1': {'provenance.json': io.pretty({'schema': 'arc-provenance/1', 'commit': _sha('git')[:40], 'items': [],
                                             'counts': {'A': {'claude': 185}, 'B_related': {'claude': 300, 'owner': 18, 'copilot': 15},
                                                        'inline_link': {'claude': 177}}})},
        'S2p': {'collisions.json': io.pretty({'schema': 'arc-collisions/1', 'names': 41, 'clusters': 12,
                                              'byline_overlaps': 3, 'spelling_variants': 2})},
        'S12q': {'quarantine.json': io.pretty(quarantine)},
        'S6b': {'bench_queries.jsonl': io.jsonl(queries, 'query_id'), 'qrels_fixed.jsonl': io.jsonl(fixed, ('query_id', 'slug'))},
        'S9': {'determinism.json': io.pretty({'schema': 'arc-determinism/1', 'rerun_identical': True,
                                              'resumed_after_preemption': False})},
        'S10': {'sizes.json': io.pretty({'schema': 'arc-sizes/1', 'model_bundle_raw': 3_970_000, 'model_bundle_gzip': 3_450_000,
                                         'vector_set_raw': 332_772, 'lexical_assets_raw': 3_800_000, 'lexical_assets_gzip': 1_210_000,
                                         'first_open_raw': 8_100_000, 'first_open_gzip': 5_000_000, 'world_payload_raw': 650_000,
                                         'world_payload_gzip': 240_000})},
        'S11': {'record_vectors.safetensors': _safetensors({'W0': w0, 'W1': w1}, recs)},
        'S12a': {'rankings.jsonl.gz': io.gz(io.jsonl(ranks, ('query_id', 'system_id', 'fold', 'seed'))),
                 'systems.json': io.pretty({'schema': 'arc-systems/1', 'systems': [{'system_id': s} for s in sorted(SKILL)]}),
                 'i3_rows.json': io.pretty({'schema': 'arc-i3/1', 'student_chrome_in': 0.21, 'student_chrome_out': 0.04,
                                            'teacher_chrome_in': 0.17, 'teacher_chrome_out': 0.05}),
                 'ledger.json': ledger('S12a', 0.2, 13.0)},
        'S12b': {'pools.jsonl': io.jsonl(pools, 'query_id'), 'probes.jsonl': io.jsonl(probes, 'probe_id'),
                 'judgments.jsonl.gz': io.gz(io.jsonl(judgments, ('pair_id', 'role'))), 'frames.json': io.pretty(frames),
                 'ledger.json': ledger('S12b', 1.9, 9.0)},
        'S12r': {'ref_open.jsonl': io.jsonl(ref_open, ('pair_id', 'family')), 'ledger.json': ledger('S12r', 0.15, 10.0)},
        'gate': {'ref_claude.jsonl': io.jsonl(ref_claude, 'pair_id'),
                 'fable_gold.json': io.pretty({'schema': 'arc-fable-gold/1', 'grades': fable_gold}),
                 'gate_receipts.json': io.pretty({'schema': 'arc-gate-receipts/1', 'claude_leg_status': claude_leg,
                                                  'witness': [{'kind': 'r00-sets', 'digest': _sha('r00-sets'), 'mode': 'dry',
                                                               'log_index': None, 'integrated_time': None}]}),
                 'fable_calls.json': io.pretty({'schema': 'arc-fable-calls/1', 'calls': []}),
                 'claude_plan_tokens.json': io.pretty({'schema': 'arc-claude-plan-tokens/1', 'tokens': 450_000})},
        'X1': {'contamination.json': io.pretty({'schema': 'arc-contam/1', 'records': [],
                                                'indices': ['v4_olmo-2-1124-13b-instruct_llama', 'v4_olmo-mix-1124_llama'],
                                                'precutoff': {'slugs': recs[:6], 'status': 'landed', 'outage': False},
                                                'totals': {'lookups': 981}})},
        'X2': {'s0.json': io.pretty({'schema': 'arc-commit-s0/1', 'code_sha': _sha('git')[:40]}),
               's0.receipt.json': io.pretty({'schema': 'arc-witness-receipt/1', 'kind': 's0', 'digest': _sha('s0'), 'mode': 'dry',
                                             'rekor': None, 'ots': None})},
        'P1': {'c_open.jsonl': c_open, 'c_frontier.jsonl': c_frontier,
               'panel_diagnostics.json': io.pretty({'schema': 'arc-panel-diagnostics/1', 'model': 'allenai/OLMo-2-1124-13B',
                                                    'revision': 'toy', 'quant': 'fp8', 'variant': '13b', 'beacon_round': 9_000_000,
                                                    'raw': 61, 'kept': 38, 'identity_rate': 1.0}),
               'ledger.json': ledger('P1', 0.19, 13.0)},
    }  # fmt: skip
