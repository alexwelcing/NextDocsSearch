"""`arcforge owner` — the Owner Desk at http://127.0.0.1:8765, and its progress in the terminal.

Stdlib only; arcforge.owner is imported inside each action, as the command rules ask.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

DESCRIPTION = """\
The Owner Desk is a local page for your R00 checklist: Queries, Voices, Settings, People,
Registers, Audit, Adjudicate and Re-meaning. It works offline, autosaves every edit, and saves
only to ~/arc-owner/ on this laptop: never to the repo, the VM, GCS or HF.

  arcforge owner            start the desk and open it in your browser
  arcforge owner status     the checklist with time left, in the terminal (--json for scripts)

Start it from research/arcforge with `uv run arcforge owner`, or with no uv at all:
`python3 -m arcforge owner`.
"""

PORT = 8765  # arcforge.owner.server.DEFAULT_PORT (a test keeps the two equal)
STATUS_MARK = {'done': '✓', 'active': '›', 'todo': '·', 'waiting': '…', 'manual': '$', 'info': ' '}


def _desk(args):
    from arcforge.owner.desk import Desk
    from arcforge.owner.paths import find_repo_root

    repo = Path(args.repo).resolve() if args.repo else find_repo_root()
    return Desk(repo)


def _minutes(m: float) -> str:
    """'30 s', '82 min', '2 h 27 min' (halves round up, as on the page)."""
    if m <= 0:
        return '0 min'
    if m < 1:
        return f'{math.floor(m * 60 + 0.5)} s'
    whole = math.floor(m + 0.5)
    return f'{whole // 60} h {whole % 60:02d} min' if whole >= 90 else f'{whole} min'


def render_status(state: dict) -> str:
    progress = state['progress']
    lines = [
        f'ARC OWNER DESK · {state["owner_dir"]}',
        f'{_minutes(progress["minutes_left"])} left of about {_minutes(progress["minutes"])}',
    ]
    for key, section in progress['sections'].items():
        lines.append('')
        lines.append(
            f'{key}  {section["title"]:<30} {_minutes(section["minutes"]):>9} · '
            f'{_minutes(section["minutes_left"])} left'
        )
        for step in (s for s in progress['steps'] if s['section'] == key):
            count = f'{step["done"]}/{step["total"]}' if step['total'] else step['status']
            left = (
                '' if step['status'] in ('done', 'info') else f'≈ {_minutes(step["minutes_left"])}'
            )
            note = f'  ({step["note"]})' if step['note'] else ''
            lines.append(
                f' {step["number"]:>2} {STATUS_MARK.get(step["status"], " ")} {step["title"]:<44} '
                f'{count:>9}  {left}{note}'.rstrip()
            )
    lines.append('')
    if progress['ready']:
        lines.append('Ready to launch R00.')
    else:
        lines.append('Before launch:')
        lines.extend(f'  - {blocker}' for blocker in progress['blockers'])
    return '\n'.join(lines)


def _run(args) -> int:
    if args.action == 'status':
        state = _desk(args).state()
        if args.json:
            print(
                json.dumps(
                    {
                        'owner_dir': state['owner_dir'],
                        'progress': state['progress'],
                        'lock': state['lock'],
                    },
                    indent=2,
                )
            )
        else:
            print(render_status(state))
        return 0
    from arcforge.owner.server import serve

    return serve(_desk(args), args.port, open_browser=not args.no_browser)


def register(subparsers) -> None:
    parser = subparsers.add_parser(
        'owner',
        help=f'the Owner Desk at http://127.0.0.1:{PORT} (offline; saves only to ~/arc-owner/)',
        description=DESCRIPTION,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        'action', nargs='?', choices=('serve', 'status'), default='serve', help='default: serve'
    )
    parser.add_argument('--port', type=int, default=PORT, help=f'default {PORT}')
    parser.add_argument('--no-browser', action='store_true', help='do not open a browser tab')
    parser.add_argument(
        '--repo', help='the NextDocsSearch checkout to read records from (default: found from here)'
    )
    parser.add_argument('--json', action='store_true', help='status as JSON')
    parser.set_defaults(func=_run)
