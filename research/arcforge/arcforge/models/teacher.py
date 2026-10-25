"""EmbeddingGemma-2 as the teacher: token states with character offsets, and the context-sum
reconstruction check (H2's exactness unit test, M1 exit criterion: cosine > 0.9999).

EmbeddingGemma-2 pools by plain mean over every token, prompt included (include_prompt=true),
then normalizes; there is no Dense module. So its pre-normalization sentence vector is exactly
(1/n) Σ_t h_t, and partitioning the tokens (the prompt, each lexeme occurrence, the rest) and
summing each part must give the sentence vector back, up to bf16 rounding. That identity is
what context-sum initialization rests on: a lexeme row is the mean over occurrences of the sum
of the states inside the occurrence, b_query / b_doc the expected prompt sums.

The check, per text: one forward pass through the sentence-transformers pipeline, which
returns both the token states and the model's own pooled sentence embedding; the tokenizer's
offsets assign each token to a part; the parts are summed in float64 and the sum's cosine
with the sentence embedding must exceed 0.9999. A second cosine compares against model.encode
on the padded batch, the path production code uses.

Only the pure helpers (assign_tokens, sum_parts, cosine) are importable without the gpu
extra; everything touching the model imports torch and sentence-transformers inside.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from arcforge.models.pins import TEACHER, ModelPin

QUERY_PROMPT = 'task: search result | query: '
MIN_RECONSTRUCTION_COSINE = 0.9999
PROMPT = -1  # prompt and special tokens
OTHER = -2  # text tokens outside every lexeme occurrence


def doc_prompt(title: str | None) -> str:
    return f'title: {title or "none"} | text: '


def assign_tokens(
    offsets: Sequence[tuple[int, int]], prompt_chars: int, spans: Sequence[tuple[int, int]]
) -> list[int]:
    """The part of each teacher token.

    offsets index prompt + text; spans (lexeme occurrences, sorted, non-overlapping) index the
    text. Special tokens (empty offsets) and tokens ending inside the prompt are PROMPT; a token
    overlapping occurrence k is k (the first one when it straddles two); the rest are OTHER.
    """
    out: list[int] = []
    k = 0
    for start, end in offsets:
        if end <= start or end <= prompt_chars:
            out.append(PROMPT)
            continue
        a, b = max(start, prompt_chars) - prompt_chars, end - prompt_chars
        while k < len(spans) and spans[k][1] <= a:
            k += 1
        out.append(k if k < len(spans) and spans[k][0] < b else OTHER)
    return out


def sum_parts(states: Sequence[Sequence[float]], assignment: Sequence[int]) -> dict[int, list[float]]:
    """Σ of the token states in each part, in float64."""
    if len(states) != len(assignment):
        raise ValueError('sum_parts: one part per token')
    parts: dict[int, list[float]] = {}
    for state, part in zip(states, assignment):
        acc = parts.setdefault(part, [0.0] * len(state))
        for d, value in enumerate(state):
            acc[d] += float(value)
    return parts


def add(vectors: Sequence[Sequence[float]]) -> list[float]:
    out = [0.0] * len(vectors[0])
    for v in vectors:
        for d, value in enumerate(v):
            out[d] += value
    return out


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = na = nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    return dot / math.sqrt(na * nb) if na > 0 and nb > 0 else 0.0


@dataclass
class Case:
    kind: str  # 'query' | 'document'
    prompt: str
    text: str


def corpus_cases(records_dir: Path, n_docs: int, n_queries: int, max_chars: int = 1200) -> list[Case]:
    """Documents: the opening paragraphs of the first records by slug, under the titled document
    prompt. Queries: record descriptions, under the query prompt."""
    import json

    cases: list[Case] = []
    paths = sorted(Path(records_dir).glob('*.json'))
    for path in paths[:n_docs]:
        record = json.loads(path.read_text())
        body = ' '.join(b['x'] for b in record.get('blocks', []) if isinstance(b, dict) and b.get('t') == 'p')
        cases.append(Case('document', doc_prompt(record.get('title')), body[:max_chars]))
    for path in paths[:n_queries]:
        record = json.loads(path.read_text())
        cases.append(Case('query', QUERY_PROMPT, str(record.get('description') or record.get('title'))))
    return cases


def load_teacher(pin: ModelPin = TEACHER, device: str = 'cuda'):
    """Text-only, bf16 (fp16 returns NaNs), pinned revision."""
    import torch
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(
        pin.repo,
        revision=pin.revision,
        device=device,
        model_kwargs={'torch_dtype': torch.bfloat16},
        config_kwargs={'vision_config': None, 'audio_config': None},
    )


def _text_tokenizer(model):
    tokenizer = getattr(model, 'tokenizer', None)
    return getattr(tokenizer, 'tokenizer', tokenizer)  # a processor wraps the text tokenizer


def forward_one(model, full_text: str):
    """(token states [n, d] float32 on CPU, pooled sentence embedding [d], offsets [n])."""
    import torch

    tokenizer = _text_tokenizer(model)
    features = model.preprocess([full_text]) if hasattr(model, 'preprocess') else model.tokenize([full_text])
    encoded = tokenizer(full_text, return_offsets_mapping=True, add_special_tokens=True)
    ids = features['input_ids'][0].tolist()
    if ids != encoded['input_ids']:
        raise RuntimeError('teacher: offsets tokenization differs from the pipeline tokenization')
    features = {k: (v.to(model.device) if hasattr(v, 'to') else v) for k, v in features.items()}
    with torch.inference_mode():
        out = model(features)
    mask = out['attention_mask'][0].bool()
    states = out['token_embeddings'][0][mask].float().cpu()
    sentence = out['sentence_embedding'][0].float().cpu()
    return states, sentence, [tuple(o) for o in encoded['offset_mapping']]


def reconstruction_check(model, cases: list[Case], tokenizer=None) -> dict:
    """Per-case cosines of the summed parts against the model's pooled vector; see module doc."""
    import torch

    t0 = time.time()
    encoded = {}
    for kind in ('query', 'document'):
        group = [c for c in cases if c.kind == kind]
        if group:
            vectors = model.encode([c.prompt + c.text for c in group], batch_size=16, convert_to_tensor=True)
            for case, vector in zip(group, vectors):
                encoded[id(case)] = vector.float().cpu()
    rows = []
    for case in cases:
        states, sentence, offsets = forward_one(model, case.prompt + case.text)
        spans = [(t.start, t.end) for t in _dedupe(tokenizer.tokenize(case.text, 'document'))] if tokenizer else []
        assignment = assign_tokens(offsets, len(case.prompt), spans)
        parts = sum_parts(states.tolist(), assignment)
        total = add(list(parts.values()))
        lexeme_only = add([v for k, v in parts.items() if k >= 0 or k == PROMPT])
        rows.append(
            {
                'kind': case.kind,
                'tokens': len(assignment),
                'prompt_tokens': assignment.count(PROMPT),
                'other_tokens': assignment.count(OTHER),
                'lexeme_occurrences': len(spans),
                'cos_parts_vs_pooled': cosine(total, sentence.tolist()),
                'cos_parts_vs_encode': cosine(total, encoded[id(case)].tolist()),
                'cos_prompt_plus_lexemes': cosine(lexeme_only, sentence.tolist()),
                'finite': bool(torch.isfinite(states).all()),
            }
        )
    worst = min(min(r['cos_parts_vs_pooled'], r['cos_parts_vs_encode']) for r in rows)
    return {
        'cases': len(rows),
        'min_cos_parts_vs_pooled': min(r['cos_parts_vs_pooled'] for r in rows),
        'min_cos_parts_vs_encode': min(r['cos_parts_vs_encode'] for r in rows),
        'mean_cos_prompt_plus_lexemes': sum(r['cos_prompt_plus_lexemes'] for r in rows) / len(rows),
        'all_finite': all(r['finite'] for r in rows),
        'threshold': MIN_RECONSTRUCTION_COSINE,
        'pass': worst > MIN_RECONSTRUCTION_COSINE and all(r['finite'] for r in rows),
        'seconds': round(time.time() - t0, 1),
        'rows': rows,
    }


def _dedupe(tokens):
    """One span per lexeme occurrence (an unknown word's n-gram buckets share one span)."""
    seen = set()
    for token in tokens:
        if (token.w0, token.w1) not in seen:
            seen.add((token.w0, token.w1))
            yield token
