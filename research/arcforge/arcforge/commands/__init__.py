"""Subcommand modules, discovered by arcforge/cli.py.

Rules for modules in this package:
- A public module (no leading underscore) must expose `register(subparsers)`; a module that
  lacks it is a load error. Put shared helpers in `_private.py` modules or in other packages.
- Import only the standard library at module top level. Import optional dependencies (yaml,
  torch, google.cloud, ...) inside the command's run function, so `arcforge --help`, the owner
  desk and the vault work under a bare system python3 without the extras installed.
"""
