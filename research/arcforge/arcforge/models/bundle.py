"""The arc-lexeme model bundle: what the site loads once per isolate, and the reference embed().

Files, beside arc-lexeme.meta.json (all little-endian):

    lexicon.bin        the lexicon (lexicon.py)
    vectors<D>.i8      Int8[rows × D], per-row symmetric int8
    scales.f16         float16[rows]: row r is scales[r] × vectors[r]; 0 marks an empty row
    weights.f16        float16[rows]: the learned per-row weight w_v (absent: every w_v = 1)
    bias.f16           float16[2 × D]: b_query, then b_doc (the prompt-as-bias vectors)

The meta file names each file with its byte size and sha256, the tokenizer spec hash, and the
provenance (run_id, corpus_id, verdict_status) a runtime checks before serving.

embed() is the program's s(x) = normalize(b + Σ_t p_t · w_t · e_t): p_t is the token's
weight (1/k for each of an unknown word's k n-gram buckets), w_t its row weight, e_t the
dequantized row, b the query or document bias. pooling 'mean' divides the sum by Σ p_t before
the bias is added. A text with no contributing token embeds to all zeros: no dense signal,
which lib/retrieval answers lexical-only. The arithmetic is float64 in token, then dimension,
order, rounded to float32 at the end, exactly as lexemeEmbed.ts does it, so the two agree to
the bit on the same bundle.
"""

from __future__ import annotations

import hashlib
import json
import math
import struct
from array import array
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Sequence

from arcforge.models.lexicon import TOKENIZER_VERSION, Kind, Lexicon
from arcforge.models.tokenizer import LexemeTokenizer, Mode, Token

SCHEMA = 'arc-lexeme-bundle/1'
META_NAME = 'arc-lexeme.meta.json'
Pooling = Literal['sum', 'mean']


def f16_round(value: float) -> float:
    """value rounded to the nearest float16 (±inf when it overflows)."""
    try:
        return struct.unpack('<e', struct.pack('<e', value))[0]
    except OverflowError:
        return math.copysign(math.inf, value)


def pack_f16(values: Sequence[float]) -> bytes:
    return struct.pack(f'<{len(values)}e', *values)


def unpack_f16(data: bytes) -> list[float]:
    return list(struct.unpack(f'<{len(data) // 2}e', data))


def quantize_row(values: Sequence[float]) -> tuple[list[int], float]:
    """Symmetric int8 with a float16 scale: q = round(v / scale), scale = f16(max|v| / 127).

    The int8 values are computed against the rounded scale, so scale × q is the row the bundle
    actually holds. An all-zero row gets scale 0 (an empty row, which never contributes). A
    non-finite row, or one whose scale overflows float16 (max|v| > ~8.3e6), is a bug upstream
    and raises rather than silently becoming empty.
    """
    peak = 0.0
    for v in values:
        if not math.isfinite(v):
            raise ValueError('quantize_row: non-finite value')
        peak = max(peak, abs(v))
    if peak == 0:
        return [0] * len(values), 0.0
    scale = f16_round(peak / 127)
    if not math.isfinite(scale):
        raise ValueError(f'quantize_row: max |v| {peak:.3g} overflows a float16 scale')
    if scale == 0:
        # Below float16's smallest subnormal: the row is numerically empty.
        return [0] * len(values), 0.0
    return [max(-127, min(127, round(v / scale))) for v in values], scale


def _file_entry(path: Path) -> dict:
    data = path.read_bytes()
    return {'path': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def write_bundle(
    out_dir: Path,
    *,
    lexicon: bytes,
    dims: int,
    int8_rows: bytes,
    scales: Sequence[float],
    b_query: Sequence[float],
    b_doc: Sequence[float],
    weights: Sequence[float] | None = None,
    run_id: str,
    corpus_id: str,
    verdict_status: str,
    pooling: Pooling = 'sum',
    mrl: bool = True,
) -> dict:
    """Write a bundle from already-quantized rows; returns the meta written beside it."""
    lex = Lexicon(lexicon)
    rows = lex.rows
    if len(int8_rows) != rows * dims:
        raise ValueError(f'bundle: {len(int8_rows)} int8 values for {rows} rows × {dims} dims')
    if len(scales) != rows or (weights is not None and len(weights) != rows):
        raise ValueError(f'bundle: scales/weights must have {rows} entries')
    if len(b_query) != dims or len(b_doc) != dims:
        raise ValueError(f'bundle: biases must have {dims} dims')
    if pooling not in ('sum', 'mean'):
        raise ValueError(f'bundle: unknown pooling {pooling!r}')
    out_dir.mkdir(parents=True, exist_ok=True)
    names = {
        'lexicon': 'lexicon.bin',
        'vectors': f'vectors{dims}.i8',
        'scales': 'scales.f16',
        'bias': 'bias.f16',
    }
    (out_dir / names['lexicon']).write_bytes(lexicon)
    (out_dir / names['vectors']).write_bytes(bytes(int8_rows))
    (out_dir / names['scales']).write_bytes(pack_f16(scales))
    (out_dir / names['bias']).write_bytes(pack_f16([*b_query, *b_doc]))
    if weights is not None:
        names['weights'] = 'weights.f16'
        (out_dir / names['weights']).write_bytes(pack_f16(weights))
    meta = {
        'schema': SCHEMA,
        'model': f'arc-lexeme@{run_id}',
        'run_id': run_id,
        'corpus_id': corpus_id,
        'verdict_status': verdict_status,
        'dims': dims,
        'rows': rows,
        'quant': 'int8-row-f16',
        'pooling': pooling,
        'mrl': mrl,
        'tokenizer': {'version': TOKENIZER_VERSION, 'spec_sha256': lex.spec.sha256()},
        'files': {key: _file_entry(out_dir / name) for key, name in sorted(names.items())},
    }
    (out_dir / META_NAME).write_text(json.dumps(meta, indent=2, sort_keys=True) + '\n')
    return meta


def quantize_rows(rows: Sequence[Sequence[float]]) -> tuple[bytes, list[float]]:
    """Quantize float rows into (Int8[rows × dims] bytes, float16-exact scales)."""
    data = array('b')
    scales: list[float] = []
    for row in rows:
        q, scale = quantize_row(row)
        data.extend(q)
        scales.append(scale)
    return data.tobytes(), scales


@dataclass
class Embedding:
    vector: list[float]
    tokens: list[Token]
    # A bare shared name matched in query mode: lib/retrieval's ALIAS PROMPT asks which person.
    alias_prompt: bool


class Bundle:
    """A loaded bundle; every file is checked against the sizes and hashes in the meta."""

    def __init__(self, meta_path: Path):
        meta_path = Path(meta_path)
        self.meta = json.loads(meta_path.read_text())
        if self.meta.get('schema') != SCHEMA:
            raise ValueError(f'bundle: unsupported schema {self.meta.get("schema")!r}')
        files: dict[str, bytes] = {}
        for key, entry in self.meta['files'].items():
            data = (meta_path.parent / entry['path']).read_bytes()
            if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise ValueError(f'bundle: {entry["path"]} does not match its meta entry')
            files[key] = data
        self.dims: int = self.meta['dims']
        self.rows: int = self.meta['rows']
        self.pooling: Pooling = self.meta['pooling']
        self.lexicon = Lexicon(files['lexicon'])
        if self.lexicon.spec.sha256() != self.meta['tokenizer']['spec_sha256']:
            raise ValueError('bundle: lexicon spec does not match the meta tokenizer hash')
        if self.lexicon.rows != self.rows:
            raise ValueError('bundle: lexicon rows do not match the meta')
        self.tokenizer = LexemeTokenizer(self.lexicon)
        self.vectors = array('b', files['vectors'])
        self.scales = unpack_f16(files['scales'])
        self.weights = unpack_f16(files['weights']) if 'weights' in files else None
        bias = unpack_f16(files['bias'])
        self.b_query, self.b_doc = bias[: self.dims], bias[self.dims :]
        if len(self.vectors) != self.rows * self.dims or len(self.scales) != self.rows:
            raise ValueError('bundle: vector or scale file has the wrong size')
        if self.weights is not None and len(self.weights) != self.rows:
            raise ValueError('bundle: weight file has the wrong size')
        if len(self.b_doc) != self.dims:
            raise ValueError('bundle: bias file has the wrong size')

    def embed(self, text: str, mode: Mode = 'query', aliases: dict[int, int] | None = None) -> Embedding:
        tokens = self.tokenizer.tokenize(text, mode, aliases)
        dims, vectors, scales, weights = self.dims, self.vectors, self.scales, self.weights
        acc = [0.0] * dims
        total = 0.0
        contributing = False
        for token in tokens:
            total += token.weight
            scale = scales[token.row]
            if scale == 0 or token.weight == 0:
                continue
            factor = token.weight * (weights[token.row] if weights is not None else 1.0) * scale
            base = token.row * dims
            for d in range(dims):
                acc[d] += factor * vectors[base + d]
            contributing = True
        alias_prompt = any(t.kind == Kind.ALIAS for t in tokens)
        if not contributing:
            return Embedding([0.0] * dims, tokens, alias_prompt)
        if self.pooling == 'mean':
            acc = [a / total for a in acc]
        bias = self.b_query if mode == 'query' else self.b_doc
        squares = 0.0
        for d in range(dims):
            acc[d] += bias[d]
            # A plain left-to-right sum, as in JS (Python 3.12+ sum() compensates floats).
            squares += acc[d] * acc[d]
        norm = math.sqrt(squares)
        vector = [a / norm for a in acc] if norm > 0 else [0.0] * dims
        # Round to float32 like the Float32Array the TS side returns.
        packed = struct.pack(f'<{dims}f', *vector)
        return Embedding(list(struct.unpack(f'<{dims}f', packed)), tokens, alias_prompt)
