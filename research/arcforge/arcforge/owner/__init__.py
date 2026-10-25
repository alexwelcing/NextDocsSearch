"""The Owner Desk: a local, offline page for the owner's R00 checklist (stdlib only).

`arcforge owner` serves it at http://127.0.0.1:8765 and saves only to ~/arc-owner/.

- paths.py     where owner data lives, and how the repo is found
- store.py     atomic JSON writes and the revisioned document store
- records.py   the record index (autocomplete, FRONTIER series)
- model.py     the documents: validation and derived flags (the 60-char limit, the re-tag,
               the copy check)
- prep.py      what the pipeline hands the owner in ~/arc-owner/prep/
- progress.py  the checklist with live progress and time left
- desk.py      the application core; server.py is its HTTP shell; static/desk.html the page

Nothing in this package imports outside the standard library, so it runs under a bare python3.
"""
