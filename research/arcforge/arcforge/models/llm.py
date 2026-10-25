"""Text-only vLLM loads of the two open-weight LLM families, and their M1 gate measurements.

`python -m arcforge.models llm-check <model>` (run in the vllm environment, on an L4):

1. fetches the pinned revision (HF shards only for Ministral) and starts `vllm serve` with the
   pin's arguments: text-only (Qwen --language-model-only, Ministral image limit 0), Qwen fp8
   on the fly, Ministral FP8 as published with an fp8 KV cache, max-model-len 8192;
2. proves the load is text-only: a request with an image must be refused;
3. Qwen: 256 training-query requests (S5's shape) at 64-way concurrency, thinking disabled;
   the gate reads aggregate decode tokens/s (completion tokens over wall time). It also runs
   the audit-judge prompt at temperature 0 and reports its schema validity.
   Ministral: the 200-prompt fixture at 64-way, temperature 0.8 with a per-prompt seed,
   structured outputs (guided JSON); the gate reads how many answers validate. Throughput is
   reported.

Requests go through the OpenAI-compatible HTTP API with the standard library (threads +
urllib), so this module needs nothing beyond the server itself. The environment's Python must
ship its headers (Triton JIT-compiles a C helper): use a uv-managed interpreter, e.g.
`uv sync --locked --extra gpu --extra vllm --managed-python`, not a distro python3 without -dev.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from arcforge.models import pins, prompts
from arcforge.models.pins import ModelPin

MODELS: dict[str, ModelPin] = {
    'qwen3.5-9b': pins.QWEN_9B,
    'qwen3.5-4b': pins.QWEN_4B,
    'ministral-3-8b': pins.MINISTRAL_8B,
    'ministral-3-3b': pins.MINISTRAL_3B,
}
SEED = 1729
# A 1×1 PNG: the text-only probe.
_PIXEL = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)


@dataclass
class RequestResult:
    id: str
    ok: bool
    status: int
    text: str
    prompt_tokens: int
    completion_tokens: int
    start: float
    end: float
    error: str = ''


def throughput(results: list[RequestResult]) -> dict:
    """Aggregate decode and prefill tokens/s over the wall time of the whole run."""
    done = [r for r in results if r.ok]
    if not done:
        return {'requests': len(results), 'ok': 0, 'decode_tokens_per_s': 0.0}
    wall = max(r.end for r in done) - min(r.start for r in done)
    latencies = sorted(r.end - r.start for r in done)
    completion = sum(r.completion_tokens for r in done)
    prompt = sum(r.prompt_tokens for r in done)
    return {
        'requests': len(results),
        'ok': len(done),
        'completion_tokens': completion,
        'prompt_tokens': prompt,
        'wall_s': round(wall, 3),
        'decode_tokens_per_s': round(completion / wall, 1) if wall > 0 else 0.0,
        'prefill_tokens_per_s': round(prompt / wall, 1) if wall > 0 else 0.0,
        'mean_completion_tokens': round(completion / len(done), 1),
        'p50_latency_s': round(latencies[len(latencies) // 2], 2),
        'p95_latency_s': round(latencies[min(len(latencies) - 1, int(0.95 * len(latencies)))], 2),
    }


def json_validity(results: list[RequestResult], cases: list[prompts.PromptCase]) -> dict:
    by_id = {c.id: c for c in cases}
    valid = 0
    invalid = []
    extra = []
    for r in results:
        ok, why = prompts.validate(r.text, by_id[r.id]) if r.ok else (False, f'request: {r.error}')
        if ok:
            valid += 1
            problems = prompts.expectation_problems(r.text, by_id[r.id])
            if problems:
                extra.append({'id': r.id, 'problems': problems})
        else:
            invalid.append({'id': r.id, 'reason': why[:300]})
    return {
        'valid': valid,
        'total': len(results),
        'invalid': invalid,
        'expectation_problems': extra,
    }


Sender = Callable[[int, prompts.PromptCase], RequestResult]


def run_concurrent(
    send: Sender, cases: list[prompts.PromptCase], concurrency: int
) -> list[RequestResult]:
    """Results in case order; send gets each case's index (its seed offset)."""
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        return list(pool.map(send, range(len(cases)), cases))


def _post(url: str, body: dict, timeout: float) -> tuple[int, dict]:
    request = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b'{}')
        except json.JSONDecodeError:
            return error.code, {}


def chat_body(
    model: str, case: prompts.PromptCase, sampling: dict, guided: bool, thinking: bool | None
) -> dict:
    body: dict = {'model': model, 'messages': case.messages, **sampling}
    if guided:
        body['response_format'] = {
            'type': 'json_schema',
            'json_schema': {'name': case.id.split('-')[0], 'schema': case.schema, 'strict': True},
        }
    if thinking is not None:
        body['chat_template_kwargs'] = {'enable_thinking': thinking}
    return body


def make_sender(
    base_url: str,
    model: str,
    sampling: Callable[[int], dict],
    guided: bool,
    thinking: bool | None,
    timeout: float = 600,
) -> Sender:
    def send(i: int, case: prompts.PromptCase) -> RequestResult:
        start = time.time()
        body = chat_body(model, case, sampling(i), guided, thinking)
        try:
            status, data = _post(f'{base_url}/v1/chat/completions', body, timeout)
        except OSError as error:  # refused, reset or timed out: a failed request, not a crash
            return RequestResult(case.id, False, 0, '', 0, 0, start, time.time(), repr(error)[:300])
        end = time.time()
        if status != 200:
            return RequestResult(
                case.id, False, status, '', 0, 0, start, end, json.dumps(data)[:300]
            )
        usage = data.get('usage') or {}
        text = data['choices'][0]['message'].get('content') or ''
        return RequestResult(
            case.id,
            True,
            status,
            text,
            usage.get('prompt_tokens', 0),
            usage.get('completion_tokens', 0),
            start,
            end,
        )

    return send


def probe_image_refused(base_url: str, model: str) -> dict:
    """A text-only load must refuse an image input."""
    url = 'data:image/png;base64,' + base64.b64encode(_PIXEL).decode()
    body = {
        'model': model,
        'max_tokens': 4,
        'messages': [
            {
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': 'What is in this image?'},
                    {'type': 'image_url', 'image_url': {'url': url}},
                ],
            }
        ],
    }
    status, data = _post(f'{base_url}/v1/chat/completions', body, 120)
    return {'status': status, 'refused': status >= 400, 'message': json.dumps(data)[:300]}


def fetch_model(pin: ModelPin, root: Path) -> Path:
    """The pinned revision under root/<repo>/<revision>, HF shards only where the pin says so."""
    from huggingface_hub import snapshot_download

    target = root / pin.repo / pin.revision
    snapshot_download(
        pin.repo,
        revision=pin.revision,
        local_dir=target,
        allow_patterns=list(pin.allow_patterns) or None,
    )
    return target


def serve_command(pin: ModelPin, model_dir: Path, name: str, port: int) -> list[str]:
    vllm = Path(sys.executable).with_name('vllm')
    return [
        str(vllm),
        'serve',
        str(model_dir),
        '--served-model-name',
        name,
        '--port',
        str(port),
        '--seed',
        str(SEED),
        '--max-num-seqs',
        '64',
        *pin.vllm_args,
    ]


class Server:
    """`vllm serve` as a context manager; the log goes to log_path."""

    def __init__(self, command: list[str], port: int, log_path: Path, timeout: float = 1800):
        self.command, self.port, self.log_path, self.timeout = command, port, log_path, timeout
        self.load_seconds = 0.0

    @property
    def base_url(self) -> str:
        return f'http://127.0.0.1:{self.port}'

    def __enter__(self) -> Server:
        self.log = open(self.log_path, 'w')
        start = time.time()
        # The venv's bin first: vLLM's JIT kernels look for ninja on PATH.
        path = f'{Path(sys.executable).parent}{os.pathsep}{os.environ.get("PATH", "")}'
        env = {**os.environ, 'PATH': path, 'VLLM_NO_USAGE_STATS': '1'}
        self.process = subprocess.Popen(
            self.command, stdout=self.log, stderr=subprocess.STDOUT, env=env
        )
        while time.time() - start < self.timeout:
            if self.process.poll() is not None:
                raise RuntimeError(
                    f'vllm exited with {self.process.returncode}; see {self.log_path}'
                )
            try:
                with urllib.request.urlopen(f'{self.base_url}/health', timeout=5) as response:
                    if response.status == 200:
                        self.load_seconds = round(time.time() - start, 1)
                        return self
            except (urllib.error.URLError, ConnectionError, TimeoutError):
                pass
            time.sleep(5)
        raise TimeoutError(f'vllm not healthy after {self.timeout}s; see {self.log_path}')

    def __exit__(self, *_exc) -> None:
        self.process.terminate()
        try:
            self.process.wait(timeout=60)
        except subprocess.TimeoutExpired:
            self.process.kill()
        self.log.close()


def gpu_memory_mib() -> int | None:
    try:
        out = subprocess.run(
            ['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits'],
            capture_output=True,
            text=True,
            check=True,
        )
        return int(out.stdout.split()[0])
    except (OSError, subprocess.CalledProcessError, ValueError, IndexError):
        return None


def check(
    model_key: str,
    *,
    records_dir: Path,
    models_root: Path,
    out_dir: Path,
    port: int = 8011,
    requests: int = 256,
    concurrency: int = 64,
) -> dict:
    pin = MODELS[model_key]
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    model_dir = fetch_model(pin, models_root)
    fetch_seconds = round(time.time() - t0, 1)
    cards = prompts.record_cards(records_dir, 327)
    command = serve_command(pin, model_dir, model_key, port)
    report: dict = {
        'model': model_key,
        'repo': pin.repo,
        'revision': pin.revision,
        'command': command,
        'fetch_seconds': fetch_seconds,
    }
    qwen = model_key.startswith('qwen')
    with Server(command, port, out_dir / f'{model_key}.vllm.log') as server:
        report['load_seconds'] = server.load_seconds
        report['gpu_memory_mib'] = gpu_memory_mib()
        report['image_probe'] = probe_image_refused(server.base_url, model_key)
        if qwen:
            # Qwen3.5 non-thinking sampling (model card), seeded per request.
            sampling = lambda i: {
                'temperature': 0.7,
                'top_p': 0.8,
                'top_k': 20,
                'max_tokens': 512,
                'seed': SEED + i,
            }
            send = make_sender(server.base_url, model_key, sampling, guided=True, thinking=False)
            training = [
                prompts.training_query_case(cards[i % len(cards)], i) for i in range(requests)
            ]
            run_concurrent(send, training[:concurrency], concurrency)  # warm-up wave, not measured
            results = run_concurrent(send, training, concurrency)
            report['throughput'] = throughput(results)
            report['training_json'] = _summary(json_validity(results, training))
            judge = make_sender(
                server.base_url,
                model_key,
                lambda i: {'temperature': 0.0, 'max_tokens': 256, 'seed': SEED},
                guided=True,
                thinking=False,
            )
            audit = prompts.audit_fixture(cards, 64)
            report['audit_judge_json'] = _summary(
                json_validity(run_concurrent(judge, audit, concurrency), audit)
            )
            gate = pins.qwen_gate(report['throughput']['decode_tokens_per_s'], concurrency)
        else:
            sampling = lambda i: {'temperature': 0.8, 'max_tokens': 600, 'seed': SEED + i}
            send = make_sender(server.base_url, model_key, sampling, guided=True, thinking=None)
            fixture = prompts.ministral_fixture(cards)
            results = run_concurrent(send, fixture, concurrency)
            report['throughput'] = throughput(results)
            validity = json_validity(results, fixture)
            report['fixture_json'] = _summary(validity)
            report['samples'] = [r.text for r in results[:3]]
            gate = pins.ministral_gate(
                report['image_probe']['refused'], validity['valid'], validity['total']
            )
    report['gate'] = {'pin': gate.pin.repo, 'passed': gate.passed, 'reason': gate.reason}
    (out_dir / f'{model_key}.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def _summary(validity: dict) -> dict:
    return {
        **validity,
        'invalid': validity['invalid'][:10],
        'fraction': round(validity['valid'] / max(1, validity['total']), 4),
    }
