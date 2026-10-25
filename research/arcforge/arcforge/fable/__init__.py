"""The orchestrator packet interface for Fable's audits (see README.md in this directory).

Fable runs only as Claude Code workflow agents through the orchestrator: there is no API key.
arcforge writes a content-addressed PACKET (packer.py), the orchestrator runs a fresh agent in the
packet's isolated working directory, and arcforge validates what it wrote (ledger.py): accepted,
retried once in a fresh directory, or failed closed. blind.py compares the end review's blind
recomputation with the reported verdicts.
"""
