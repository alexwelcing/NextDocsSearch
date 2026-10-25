import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from arcforge.models import llm, pins, prompts

CARDS = prompts.synthetic_cards(20)


def result(i, ok=True, start=0.0, end=1.0, completion=100, text='{}'):
    return llm.RequestResult(f'c{i}', ok, 200 if ok else 500, text, 50, completion, start, end)


def test_throughput_is_completion_tokens_over_wall_time():
    results = [result(i, start=i * 0.5, end=i * 0.5 + 2.0) for i in range(4)]
    t = llm.throughput(results)
    assert t['wall_s'] == 3.5 and t['completion_tokens'] == 400
    assert t['decode_tokens_per_s'] == round(400 / 3.5, 1)
    assert t['prefill_tokens_per_s'] == round(200 / 3.5, 1)
    assert llm.throughput([result(0, ok=False)])['decode_tokens_per_s'] == 0.0


def test_chat_body():
    case = prompts.training_query_case(CARDS[0], 0)
    body = llm.chat_body('m', case, {'temperature': 0.7, 'seed': 3}, guided=True, thinking=False)
    assert body['response_format']['json_schema']['schema'] == case.schema
    assert body['chat_template_kwargs'] == {'enable_thinking': False}
    assert body['seed'] == 3
    assert 'chat_template_kwargs' not in llm.chat_body('m', case, {}, guided=False, thinking=None)


def test_serve_command_uses_the_pin(tmp_path):
    command = llm.serve_command(pins.QWEN_9B, tmp_path, 'qwen3.5-9b', 8011)
    assert command[1:3] == ['serve', str(tmp_path)]
    assert command[-len(pins.QWEN_9B.vllm_args) :] == list(pins.QWEN_9B.vllm_args)
    assert '--max-num-seqs' in command and '64' in command


class FakeOpenAI(BaseHTTPRequestHandler):
    """Answers chat completions with schema-shaped JSON; refuses images like a text-only load."""

    def log_message(self, *_args):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        content = body['messages'][-1]['content']
        if isinstance(content, list):
            self._send(
                400, {'error': {'message': 'At most 0 image(s) may be provided in one prompt.'}}
            )
            return
        schema = body['response_format']['json_schema']['schema']
        if 'grades' in schema['properties']:
            k = schema['properties']['grades']['minItems']
            answer = {'grades': [{'id': i, 'grade': 1} for i in range(1, k + 1)]}
        elif (
            'items' in schema['properties']['queries']
            and schema['properties']['queries']['items'].get('type') == 'string'
        ):
            answer = {'queries': ['query text'] * 6}
        else:
            family = schema['properties']['queries']['items']['properties']['family']['enum'][0]
            # Every tenth seed answers off-schema, so validity is measured, not assumed.
            n = 2 if body['seed'] % 10 == 0 else 3
            answer = {'queries': [{'text': 'abc', 'family': family, 'grade_hint': 2}] * n}
        self._send(
            200,
            {
                'choices': [{'message': {'content': json.dumps(answer)}}],
                'usage': {'prompt_tokens': 10, 'completion_tokens': 20},
            },
        )

    def _send(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class Server(ThreadingHTTPServer):
    # The default backlog (5) resets connections under 16-way concurrency.
    request_queue_size = 256
    daemon_threads = True


@pytest.fixture
def server():
    httpd = Server(('127.0.0.1', 0), FakeOpenAI)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f'http://127.0.0.1:{httpd.server_address[1]}'
    httpd.shutdown()


def test_fixture_round_trip_against_an_openai_compatible_server(server):
    fixture = prompts.ministral_fixture(CARDS)
    send = llm.make_sender(
        server,
        'm',
        lambda i: {'temperature': 0.8, 'seed': llm.SEED + i},
        guided=True,
        thinking=None,
    )
    results = llm.run_concurrent(send, fixture, 16)
    assert [r.id for r in results] == [c.id for c in fixture]
    validity = llm.json_validity(results, fixture)
    # Seeds 1729 + i with (1729 + i) % 10 == 0: i = 1, 11, ..., 191.
    assert all(r.ok for r in results), [r.error for r in results if not r.ok][:3]
    assert validity['total'] == 200 and validity['valid'] == 180
    gate = pins.ministral_gate(True, validity['valid'], validity['total'])
    assert gate.pin is pins.MINISTRAL_3B
    assert llm.throughput(results)['completion_tokens'] == 4000


def test_audit_round_trip(server):
    audit = prompts.audit_fixture(CARDS, 8)
    send = llm.make_sender(
        server, 'm', lambda i: {'temperature': 0, 'seed': 1}, guided=True, thinking=False
    )
    validity = llm.json_validity(llm.run_concurrent(send, audit, 4), audit)
    assert validity['valid'] == 8 and validity['expectation_problems'] == []


def test_image_probe(server):
    probe = llm.probe_image_refused(server, 'm')
    assert probe['refused'] and probe['status'] == 400


def test_request_errors_are_results_not_exceptions():
    case = prompts.training_query_case(CARDS[0], 0)
    send = llm.make_sender(
        'http://127.0.0.1:9', 'm', lambda i: {}, guided=False, thinking=None, timeout=2
    )
    failed = send(0, case)
    assert not failed.ok and failed.status == 0 and failed.error
    assert llm.json_validity([failed], [case])['valid'] == 0
