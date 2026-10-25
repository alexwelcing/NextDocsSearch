"""Model pins for the arc, verified on the Hub, and the M1 gates that choose between them.

Every model the pipeline loads is pinned by repo and commit SHA here; the GCS mirror
(gs://witching-606c6-arcforge/models) and the run container read these. The two LLM choices
are pre-registered gates measured once in M1 on an L4 (python -m arcforge.models llm-check):

- Qwen3.5-9B serves S5 (training queries) and the 25% audit judge if it decodes at least
  1,000 tokens/s aggregate at 64-way concurrency; otherwise Qwen3.5-4B (bf16) is pinned for
  the whole arc before R00.
- Ministral-3-8B serves S6 (eval queries) if it loads text-only and returns schema-valid JSON
  on at least 99% of the 200-prompt fixture; otherwise Ministral-3-3B is pinned. Throughput is
  reported, not gated.

M1_MEASURED holds what M1 measured; llm_pins() derives the pins from it with the gate
functions, so a pin cannot drift from its evidence. M1's result: Qwen3.5-9B decodes 679 tok/s at
64-way, so Qwen3.5-4B is pinned (it measures 751 tok/s, also under 1,000, which lengthens S5
rather than changing the pin); Ministral-3-8B returns 199/200 schema-valid and is kept.
"""

from __future__ import annotations

from dataclasses import dataclass, field

QWEN_MIN_TOKENS_PER_S = 1000.0
QWEN_CONCURRENCY = 64
MINISTRAL_MIN_JSON_VALID = 0.99
MINISTRAL_FIXTURE_PROMPTS = 200


@dataclass(frozen=True)
class ModelPin:
    repo: str
    revision: str
    license: str
    # Files to mirror (fnmatch patterns); empty means the whole repo.
    allow_patterns: tuple[str, ...] = ()
    # Extra `vllm serve` arguments (LLMs only).
    vllm_args: tuple[str, ...] = ()
    note: str = ''

    @property
    def id(self) -> str:
        return f'{self.repo}@{self.revision[:12]}'


TEACHER = ModelPin(
    repo='google/embeddinggemma-2',
    revision='914f7f89142e33e77833254d9c9b90c3cef7303b',
    license='apache-2.0',
    note=(
        'Exists on the Hub (2026-10-06, ungated, 744M multimodal; 270M text path). No substitution '
        'for google/embeddinggemma-300m was needed. Load text-only (vision_config=None, '
        'audio_config=None) in bf16 (fp16 gives NaNs); mean pooling with include_prompt, '
        'Normalize, no Dense; needs sentence-transformers>=6.1 and transformers>=5.18 '
        '(M1 ran 6.2.0 / 5.19.0: 271.0M text-path parameters).'
    ),
)

QWEN_9B = ModelPin(
    repo='Qwen/Qwen3.5-9B',
    revision='c202236235762e1c871ad0ccb60c8ee5ba337b9a',
    license='apache-2.0',
    vllm_args=('--language-model-only', '--quantization', 'fp8', '--max-model-len', '8192'),
    note='Qwen3_5ForConditionalGeneration; text-only, fp8 on the fly, thinking disabled.',
)
QWEN_4B = ModelPin(
    repo='Qwen/Qwen3.5-4B',
    revision='851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a',
    license='apache-2.0',
    vllm_args=('--language-model-only', '--dtype', 'bfloat16', '--max-model-len', '8192'),
    note='The pre-registered fallback: bf16, same family and chat template.',
)
# An fp8 KV cache on an L4 (Ada) rules out FlashAttention, and vLLM's next pick, FlashInfer,
# JIT-compiles its kernels (no cubins in the lock, no C++ toolchain on the runner): Triton it is.
_MINISTRAL_ARGS = (
    '--tokenizer-mode',
    'mistral',
    '--kv-cache-dtype',
    'fp8',
    '--attention-backend',
    'TRITON_ATTN',
    '--max-model-len',
    '8192',
    '--limit-mm-per-prompt',
    '{"image":0}',
)
# consolidated.safetensors duplicates the HF shards; only the HF-format files are mirrored.
_MINISTRAL_FILES = (
    'config.json',
    'generation_config.json',
    'model*.safetensors*',
    'params.json',
    'processor_config.json',
    'tekken.json',
    'tokenizer*',
    'chat_template.jinja',
    'SYSTEM_PROMPT.txt',
)
MINISTRAL_8B = ModelPin(
    repo='mistralai/Ministral-3-8B-Instruct-2512',
    revision='5b26027e7b19eeb4b7352e1fed3926375dd2cb4d',
    license='apache-2.0',
    allow_patterns=_MINISTRAL_FILES,
    vllm_args=_MINISTRAL_ARGS,
    note='Mistral3ForConditionalGeneration, static FP8 as published (vision tower unquantized).',
)
MINISTRAL_3B = ModelPin(
    repo='mistralai/Ministral-3-3B-Instruct-2512',
    revision='b35d4dfe56c142746f54dbd64f579faab2744308',
    license='apache-2.0',
    allow_patterns=_MINISTRAL_FILES,
    vllm_args=_MINISTRAL_ARGS,
    note='The pre-registered fallback, same family.',
)
RERANKER = ModelPin(
    repo='Qwen/Qwen3-Reranker-0.6B',
    revision='e61197ed45024b0ed8a2d74b80b4d909f1255473',
    license='apache-2.0',
    note='B7 ceiling, R00 only.',
)
R08_TEACHERS = (
    ModelPin(
        'Qwen/Qwen3-Embedding-0.6B',
        '97b0c614be4d77ee51c0cef4e5f07c00f9eb65b3',
        'apache-2.0',
        note='R08 swap teacher (last-token pooling).',
    ),
    ModelPin(
        'BAAI/bge-base-en-v1.5',
        'a5beb1e3e68b9ab74eb54cfd186867f64f240e1a',
        'mit',
        note='R08 control teacher (CLS pooling).',
    ),
)


@dataclass(frozen=True)
class GateResult:
    pin: ModelPin
    passed: bool | None  # None: not measured
    reason: str
    evidence: dict = field(default_factory=dict)


def qwen_gate(tokens_per_s: float | None, concurrency: int = QWEN_CONCURRENCY) -> GateResult:
    """Qwen3.5-9B if it decodes >= 1,000 tok/s aggregate at 64-way, else Qwen3.5-4B."""
    evidence = {'decode_tokens_per_s': tokens_per_s, 'concurrency': concurrency}
    if tokens_per_s is None:
        return GateResult(
            QWEN_9B, None, 'not measured: primary kept until M1 measures it', evidence
        )
    if concurrency != QWEN_CONCURRENCY:
        raise ValueError(f'qwen gate is defined at {QWEN_CONCURRENCY}-way concurrency')
    if tokens_per_s >= QWEN_MIN_TOKENS_PER_S:
        return GateResult(
            QWEN_9B, True, f'{tokens_per_s:.0f} >= {QWEN_MIN_TOKENS_PER_S:.0f} tok/s', evidence
        )
    return GateResult(
        QWEN_4B,
        False,
        f'{tokens_per_s:.0f} < {QWEN_MIN_TOKENS_PER_S:.0f} tok/s: 4B pinned',
        evidence,
    )


def ministral_gate(text_only: bool | None, valid: int | None, total: int | None) -> GateResult:
    """Ministral-3-8B if it loads text-only and >= 99% of the 200 fixture outputs validate."""
    evidence = {'text_only_load': text_only, 'valid': valid, 'total': total}
    if text_only is None or valid is None or total is None:
        return GateResult(
            MINISTRAL_8B, None, 'not measured: primary kept until M1 measures it', evidence
        )
    if total != MINISTRAL_FIXTURE_PROMPTS:
        raise ValueError(
            f'ministral gate is defined on the {MINISTRAL_FIXTURE_PROMPTS}-prompt fixture'
        )
    if not text_only:
        return GateResult(MINISTRAL_3B, False, 'no text-only load: 3B pinned', evidence)
    fraction = valid / total
    if fraction >= MINISTRAL_MIN_JSON_VALID:
        return GateResult(MINISTRAL_8B, True, f'{valid}/{total} schema-valid', evidence)
    return GateResult(
        MINISTRAL_3B, False, f'{valid}/{total} schema-valid < 99%: 3B pinned', evidence
    )


# What M1 measured (2026-10-25) on a spot g2-standard-8 (1x L4, driver 580, CUDA 13.0) with the
# locked stack (vLLM 0.32.0, torch 2.13.0, transformers 5.19.0, sentence-transformers 6.2.0),
# from `python -m arcforge.models llm-check` and `teacher-check`. The gates read the first keys
# of each entry; the rest is the evidence the PR reports.
M1_MEASURED: dict = {
    'qwen': {
        # Qwen3.5-9B, fp8 on the fly: 256 S5 prompts × exactly 256 decoded tokens at 64-way.
        'decode_tokens_per_s': 679.4,
        'concurrency': QWEN_CONCURRENCY,
        'workload_tokens_per_s': 371.5,  # guided JSON, answers of the model's own length
        'training_json_valid': [255, 256],
        'audit_judge_json_valid': [64, 64],
        'text_only': True,  # an image input is refused (HTTP 400)
        # The pinned fallback, bf16, same protocol: it does not reach 1,000 either.
        'fallback_qwen3.5-4b': {'decode_tokens_per_s': 751.1, 'workload_tokens_per_s': 502.8},
    },
    'ministral': {
        # Ministral-3-8B, FP8 as published, fp8 KV, Triton attention, guided JSON, T = 0.8.
        'text_only_load': True,
        'valid': 199,
        'total': MINISTRAL_FIXTURE_PROMPTS,
        'decode_tokens_per_s': 585.0,
        'fallback_ministral-3-3b': {'valid': 198, 'decode_tokens_per_s': 1045.7},
    },
    'teacher': {
        # Same-pass reconstruction over 160 documents + 160 queries; the gate is > 0.9999.
        'min_reconstruction_cosine': 0.99999518,
        'cases': 320,
        'min_cosine_vs_batched_encode': 0.99989066,  # bf16 batch-padding drift, reported
        'mean_cosine_prompt_plus_lexemes': 0.98696,
    },
}


def llm_pins(measured: dict = M1_MEASURED) -> dict[str, GateResult]:
    qwen = measured['qwen']
    ministral = measured['ministral']
    return {
        'queries': qwen_gate(qwen['decode_tokens_per_s'], qwen['concurrency']),
        'eval_queries': ministral_gate(
            ministral['text_only_load'], ministral['valid'], ministral['total']
        ),
    }


def pins_report(measured: dict = M1_MEASURED) -> dict:
    """Everything pinned, as JSON: what `python -m arcforge.models pins` prints."""

    def pin(p: ModelPin) -> dict:
        return {
            'repo': p.repo,
            'revision': p.revision,
            'license': p.license,
            'allow_patterns': list(p.allow_patterns),
            'vllm_args': list(p.vllm_args),
            'note': p.note,
        }

    gates = llm_pins(measured)
    return {
        'teacher': pin(TEACHER),
        'llm': {
            role: {
                'pin': pin(g.pin),
                'passed': g.passed,
                'reason': g.reason,
                'evidence': g.evidence,
            }
            for role, g in gates.items()
        },
        'fallbacks': {'queries': pin(QWEN_4B), 'eval_queries': pin(MINISTRAL_3B)},
        'reranker': pin(RERANKER),
        'r08_teachers': [pin(p) for p in R08_TEACHERS],
        'measured': measured,
    }
