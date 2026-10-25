import http.client
import json
import socket
import threading

import pytest

from arcforge.commands import owner as owner_command
from arcforge.owner import server
from arcforge.owner.server import DeskServer, serve


@pytest.fixture
def live(desk):
    srv = DeskServer(desk, port=0, token='t0ken')
    thread = threading.Thread(target=srv.serve_forever, kwargs={'poll_interval': 0.05}, daemon=True)
    thread.start()
    yield srv
    srv.shutdown()
    srv.server_close()


def call(srv, method, path, body=None, *, token='t0ken', host=None, headers=None):
    conn = http.client.HTTPConnection('127.0.0.1', srv.port, timeout=5)
    sent = {'Host': host or f'127.0.0.1:{srv.port}'}
    if token is not None:
        sent['X-Arc-Token'] = token
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        sent['Content-Type'] = 'application/json'
    sent.update(headers or {})
    conn.request(method, path, body=data, headers=sent)
    res = conn.getresponse()
    raw = res.read()
    conn.close()
    try:
        payload = json.loads(raw)
    except ValueError:
        payload = raw.decode()
    return res.status, payload, dict(res.getheaders())


def test_the_page_carries_the_token_and_strict_headers(live):
    status, html, headers = call(live, 'GET', '/', token=None)
    assert status == 200 and 't0ken' in html and server.TOKEN_PLACEHOLDER not in html
    assert "default-src 'none'" in headers['Content-Security-Policy']
    assert headers['Cache-Control'] == 'no-store' and headers['X-Frame-Options'] == 'DENY'


def test_api_needs_the_token(live):
    assert call(live, 'GET', '/api/state', token=None)[0] == 401
    assert call(live, 'GET', '/api/state', token='wrong')[0] == 401
    status, state, _ = call(live, 'GET', '/api/state')
    assert status == 200 and state['records']['count'] == 8


def test_other_hosts_are_refused(live):
    # DNS rebinding: evil.example resolving to 127.0.0.1 still sends its own Host header.
    assert call(live, 'GET', '/', host='evil.example:8765')[0] == 421
    assert call(live, 'GET', '/api/state', host='evil.example')[0] == 421
    assert call(live, 'GET', '/api/state', host=f'localhost:{live.port}')[0] == 200


def test_records_and_ping(live):
    status, body, _ = call(live, 'GET', '/api/records')
    assert status == 200 and body['source'] == 'test' and len(body['records']) == 8
    assert {'slug', 'title', 'frontier'} <= set(body['records'][0])
    status, ping, _ = call(live, 'GET', '/api/ping')
    assert status == 200 and ping['locked'] is False and ping['prep']['people'] == 'missing'


def test_save_round_trip_and_conflict(live, home):
    body = {'rev': 0, 'data': {'queries': [{'id': 'q-0001', 'text': 'the fossil'}]}}
    status, result, _ = call(live, 'PUT', '/api/docs/queries', body)
    assert status == 200 and result['doc']['rev'] == 1
    assert (home / 'arc-owner' / 'queries.json').exists()
    status, result, _ = call(live, 'PUT', '/api/docs/queries', body)
    assert status == 409 and result['current']['rev'] == 1


def test_invalid_saves_are_400_and_change_nothing(live, home):
    body = {'rev': 0, 'data': {'queries': [{'id': 'q-0001', 'text': 'x' * 61}]}}
    status, result, _ = call(live, 'PUT', '/api/docs/queries', body)
    assert status == 400 and 'limit is 60' in result['error']
    assert not (home / 'arc-owner' / 'queries.json').exists()
    assert call(live, 'PUT', '/api/docs/queries', {'data': {}})[0] == 400  # no rev


def test_locked_documents_are_403(live, home):
    (home / 'arc-owner').mkdir(exist_ok=True)
    (home / 'arc-owner' / 's0-lock.json').write_text('{"locked_utc": "2026-10-24T00:00:00Z"}')
    status, result, _ = call(live, 'PUT', '/api/docs/settings', {'rev': 0, 'data': {}})
    assert status == 403 and 'frozen at S0' in result['error']


def test_writes_must_be_same_origin_json(live):
    body = {'rev': 0, 'data': {}}
    assert (
        call(live, 'PUT', '/api/docs/settings', body, headers={'Origin': 'https://evil.example'})[0]
        == 403
    )
    assert (
        call(live, 'PUT', '/api/docs/settings', body, headers={'Content-Type': 'text/plain'})[0]
        == 415
    )
    ok = call(
        live, 'PUT', '/api/docs/settings', body, headers={'Origin': f'http://127.0.0.1:{live.port}'}
    )
    assert ok[0] == 200


def test_a_bug_answers_500_with_a_reason(live, monkeypatch, capsys):
    def boom():
        raise RuntimeError('kaput')

    monkeypatch.setattr(live.desk, 'state', boom)
    status, body, _ = call(live, 'GET', '/api/state')
    assert status == 500 and body['error'] == 'desk error: RuntimeError: kaput'
    assert 'kaput' in capsys.readouterr().err


def test_unknown_routes_and_methods(live):
    assert call(live, 'PUT', '/api/docs/passwd', {'rev': 0, 'data': {}})[0] == 404
    assert call(live, 'PUT', '/api/docs/../queries', {'rev': 0, 'data': {}})[0] == 404
    assert call(live, 'GET', '/api/nope')[0] == 404
    assert call(live, 'GET', '/etc/passwd')[0] == 404
    assert call(live, 'POST', '/api/docs/queries', {'rev': 0})[0] == 405
    status, _, headers = call(
        live, 'OPTIONS', '/api/docs/queries', token=None, headers={'Origin': 'https://evil.example'}
    )
    assert status == 405 and not any(h.lower().startswith('access-control') for h in headers)


def test_oversized_bodies_are_refused(live):
    conn = http.client.HTTPConnection('127.0.0.1', live.port, timeout=5)
    conn.putrequest('PUT', '/api/docs/queries', skip_host=True)
    for name, value in (
        ('Host', f'127.0.0.1:{live.port}'),
        ('X-Arc-Token', 't0ken'),
        ('Content-Type', 'application/json'),
        ('Content-Length', str(server.MAX_BODY + 1)),
    ):
        conn.putheader(name, value)
    conn.endheaders()
    assert conn.getresponse().status == 413
    conn.close()


def test_serve_reports_a_busy_port(desk, capsys):
    with socket.socket() as busy:
        busy.bind(('127.0.0.1', 0))
        busy.listen()
        port = busy.getsockname()[1]
        assert serve(desk, port, open_browser=False) == 1
    assert 'already be running' in capsys.readouterr().err


def test_the_token_survives_a_restart(desk, home):
    first = DeskServer(desk, port=0)
    second = DeskServer(desk, port=0)
    try:
        assert first.token == second.token and len(first.token) >= 32
        token_file = home / 'arc-owner' / server.TOKEN_FILE
        assert token_file.read_text() == first.token
        assert token_file.stat().st_mode & 0o777 == 0o600
    finally:
        first.server_close()
        second.server_close()


def test_the_command_and_the_server_agree_on_the_port():
    assert owner_command.PORT == server.DEFAULT_PORT == 8765
