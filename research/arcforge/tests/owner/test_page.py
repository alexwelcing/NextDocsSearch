"""The desk page is one self-contained file that must work offline and never store owner data."""

import re
import shutil
import subprocess

import pytest

from arcforge.owner.server import TOKEN_PLACEHOLDER, page_html

PAGE = page_html('tok').decode('utf-8')
SCRIPT = re.search(r'<script>(.*)</script>', PAGE, re.S).group(1)


def test_page_is_packaged_and_takes_the_token():
    assert PAGE.startswith('<!doctype html>')
    assert "const TOKEN = 'tok'" in PAGE and TOKEN_PLACEHOLDER not in PAGE


def test_nothing_is_loaded_from_anywhere():
    assert not re.search(r'<(script|link|img|iframe)[^>]+(src|href)=', PAGE)
    assert '@import' not in PAGE and 'url(http' not in PAGE
    assert not re.search(r"fetch\(\s*['`]https?:", SCRIPT)


def test_no_browser_storage():
    # Owner data goes only to ~/arc-owner/ through the desk server.
    for api in ('localStorage', 'sessionStorage', 'indexedDB', 'document.cookie'):
        assert api not in SCRIPT


def test_every_tab_of_the_checklist_is_there():
    for key in (
        'overview',
        'queries',
        'voices',
        'settings',
        'people',
        'registers',
        'audit',
        'adjudicate',
        'remeaning',
    ):
        assert f"['{key}', " in SCRIPT
        assert f'VIEWS.{key} = ' in SCRIPT


def test_the_arc_terminal_palette():
    assert '--green: #70ff8f' in PAGE and 'color-scheme: dark' in PAGE


def test_owner_text_is_never_injected_as_html():
    # The only innerHTML is the banner, which only ever receives the page's own fixed strings.
    assert SCRIPT.count('innerHTML') == 1
    for call in re.findall(r'banner\(([^)]*)\)', SCRIPT):
        assert not re.search(r'\b(text|query|data|json|error)\b', call), call


@pytest.mark.skipif(shutil.which('node') is None, reason='node is not installed')
def test_the_script_parses(tmp_path):
    path = tmp_path / 'desk.js'
    path.write_text(SCRIPT)
    out = subprocess.run(['node', '--check', str(path)], capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
