"""The desk's HTTP shell: one page and a small JSON API on 127.0.0.1 only.

Routes:
  GET  /                  the page (static/desk.html, with this session's token filled in)
  GET  /api/state         everything the page renders
  GET  /api/ping          the cheap poll (prep files, lock, vault recipient)
  GET  /api/records       the record index for the autocomplete
  PUT  /api/docs/<name>   save one document: {"rev": <base rev>, "data": {...}}
        -> 200 {doc, derived, derived_all, progress} | 400 invalid | 403 frozen at S0
           | 409 {current} stale rev, another window saved first

Other web pages open in the same browser must not be able to read or write the owner's files:
- the server binds 127.0.0.1, and a Host header other than 127.0.0.1/localhost:<port> is refused,
  which defeats DNS rebinding;
- every /api call needs this session's random token in X-Arc-Token. The token is written only
  into the page this server serves, and a custom header forces a CORS preflight that the server
  never answers, so a cross-site request cannot carry it;
- writes must be application/json, and a present Origin must be this server's own.
"""

from __future__ import annotations

import hmac
import json
import re
import secrets
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from urllib.parse import urlsplit

from arcforge.owner import model
from arcforge.owner.desk import Desk, Locked
from arcforge.owner.store import Conflict

DEFAULT_PORT = 8765
MAX_BODY = 2 * 1024 * 1024
TOKEN_PLACEHOLDER = '__ARC_DESK_TOKEN__'
_DOC_RE = re.compile(r'^/api/docs/([a-z]+)$')


def page_html(token: str) -> bytes:
    html = resources.files('arcforge.owner').joinpath('static/desk.html').read_text('utf-8')
    return html.replace(TOKEN_PLACEHOLDER, token).encode('utf-8')


class DeskServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False  # a second desk on the same port must fail loudly, not share it

    def __init__(self, desk: Desk, port: int = DEFAULT_PORT, token: str | None = None) -> None:
        self.desk = desk
        self.token = token or secrets.token_urlsafe(32)
        super().__init__(('127.0.0.1', port), DeskHandler)
        self.port = self.server_address[1]
        self.page = page_html(self.token)

    @property
    def url(self) -> str:
        return f'http://127.0.0.1:{self.port}/'

    def allowed_hosts(self) -> set[str]:
        return {f'127.0.0.1:{self.port}', f'localhost:{self.port}'}


class DeskHandler(BaseHTTPRequestHandler):
    server: DeskServer
    server_version = 'arc-owner-desk'
    sys_version = ''

    # Request lines hold no owner text, but stay quiet anyway: the terminal is the owner's.
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        return

    # ---- plumbing ------------------------------------------------------------------------------

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        if content_type.startswith('text/html'):
            self.send_header(
                'Content-Security-Policy',
                "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
                "connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; "
                "frame-ancestors 'none'",
            )
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _json(self, status: int, obj: object) -> None:
        body = json.dumps(obj, ensure_ascii=False, allow_nan=False).encode('utf-8')
        self._send(status, body, 'application/json; charset=utf-8')

    def _error(self, status: int, message: str, **extra: object) -> None:
        self._json(status, {'error': message, **extra})

    def _host_ok(self) -> bool:
        return self.headers.get('Host', '') in self.server.allowed_hosts()

    def _token_ok(self) -> bool:
        given = self.headers.get('X-Arc-Token', '')
        return hmac.compare_digest(given.encode(), self.server.token.encode())

    def _origin_ok(self) -> bool:
        origin = self.headers.get('Origin')
        if origin is None:
            return True
        parts = urlsplit(origin)
        return parts.scheme == 'http' and parts.netloc in self.server.allowed_hosts()

    def _guard(self, *, write: bool) -> bool:
        if not self._host_ok():
            self._error(HTTPStatus.MISDIRECTED_REQUEST, 'this desk answers only on 127.0.0.1')
            return False
        if not self._token_ok():
            self._error(HTTPStatus.UNAUTHORIZED, 'missing or wrong desk token; reload the page')
            return False
        if write:
            if not self._origin_ok():
                self._error(HTTPStatus.FORBIDDEN, 'cross-origin writes are refused')
                return False
            if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                self._error(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, 'send application/json')
                return False
        return True

    # ---- routes --------------------------------------------------------------------------------

    def do_GET(self) -> None:  # noqa: N802
        path = urlsplit(self.path).path
        if path in ('/', '/index.html'):
            if not self._host_ok():
                self._error(HTTPStatus.MISDIRECTED_REQUEST, 'this desk answers only on 127.0.0.1')
                return
            self._send(HTTPStatus.OK, self.server.page, 'text/html; charset=utf-8')
            return
        if path == '/favicon.ico':
            self._send(HTTPStatus.NO_CONTENT, b'', 'image/x-icon')
            return
        if not path.startswith('/api/'):
            self._error(HTTPStatus.NOT_FOUND, 'not found')
            return
        if not self._guard(write=False):
            return
        desk = self.server.desk
        if path == '/api/state':
            self._json(HTTPStatus.OK, desk.state())
        elif path == '/api/ping':
            self._json(HTTPStatus.OK, desk.ping())
        elif path == '/api/records':
            self._json(HTTPStatus.OK, {'source': desk.records.source, 'records': desk.records_json()})
        else:
            self._error(HTTPStatus.NOT_FOUND, 'not found')

    do_HEAD = do_GET

    def do_PUT(self) -> None:  # noqa: N802
        match = _DOC_RE.match(urlsplit(self.path).path)
        if not match or match.group(1) not in model.DOCS:
            self._error(HTTPStatus.NOT_FOUND, 'no such document')
            return
        if not self._guard(write=True):
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_BODY:
            self._error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, 'body too large')
            return
        try:
            body = json.loads(self.rfile.read(length) or b'{}')
        except (ValueError, UnicodeDecodeError):
            self._error(HTTPStatus.BAD_REQUEST, 'the body is not JSON')
            return
        if not isinstance(body, dict) or not isinstance(body.get('rev'), int):
            self._error(HTTPStatus.BAD_REQUEST, 'send {"rev": <int>, "data": {...}}')
            return
        try:
            result = self.server.desk.save(match.group(1), body['rev'], body.get('data'))
        except Conflict as conflict:
            self._error(HTTPStatus.CONFLICT, 'changed in another window', current=conflict.current)
        except Locked as locked:
            self._error(HTTPStatus.FORBIDDEN, str(locked))
        except model.ValidationError as invalid:
            self._error(HTTPStatus.BAD_REQUEST, str(invalid))
        else:
            self._json(HTTPStatus.OK, result)

    def do_POST(self) -> None:  # noqa: N802
        self._error(HTTPStatus.METHOD_NOT_ALLOWED, 'use PUT /api/docs/<name>')

    def do_OPTIONS(self) -> None:  # noqa: N802
        # No CORS headers, ever: a cross-origin preflight fails, so the real request never runs.
        self._error(HTTPStatus.METHOD_NOT_ALLOWED, 'no cross-origin access')


def serve(desk: Desk, port: int = DEFAULT_PORT, *, open_browser: bool = True, out=sys.stdout) -> int:
    try:
        server = DeskServer(desk, port)
    except OSError as error:
        if getattr(error, 'errno', None) in (48, 98):  # EADDRINUSE on macOS, Linux
            print(
                f'Port {port} is busy. The desk may already be running: open http://127.0.0.1:{port}/\n'
                f'(or start another with --port).',
                file=sys.stderr,
            )
            return 1
        raise
    records = desk.records
    source = f'{len(records.records)} records from {records.source}' if records.source else (
        'none found (autocomplete off; queries still save)'
    )
    print(
        'ARC OWNER DESK\n'
        f'  open     {server.url}\n'
        f'  saves    {desk.root}   (only here: nothing leaves this laptop)\n'
        f'  records  {source}\n'
        'Every edit saves as you go. Press Ctrl-C to stop.',
        file=out,
        flush=True,
    )
    if open_browser:
        import webbrowser

        webbrowser.open(server.url)
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        print('\nDesk stopped. Your work is in ' + str(desk.root), file=out)
    finally:
        server.server_close()
    return 0
