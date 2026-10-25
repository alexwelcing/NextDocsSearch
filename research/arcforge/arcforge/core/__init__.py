"""The arcforge runtime: config, stage DAG, content-addressed cache, price table and budget guard.

Every module in this package imports only the standard library at module top level (yaml,
jsonschema and google.cloud are imported inside the functions that need them), so command
modules can import from here without breaking `arcforge --help` under a bare python3.

- `hashing`  canonical JSON and sha256 helpers; the byte format of every artifact.
- `config`   configs/rNN.yaml loading (extends, overrides, schema validation, config_sha256).
- `prices`   the pinned price table (prices/2026-10.yaml) and its 'verify at launch' flags.
- `budget`   `arcforge plan`: every stage priced, contingency, dividend, ceiling and cap guard.
- `dag`      the Stage declaration, topological order and the content-addressed stage key.
- `cache`    the cache layout over a local directory or gs://witching-606c6-arcforge/cache.
- `pipeline` executes stages against the cache and writes the deterministic run manifest.
- `executor` the executor interface: in-process LOCAL, and the VM hook into arcforge.runner.
- `corpus`   reads the archive (pages/docs/articles + public/arc/records) from a worktree or git.
- `stages`   the S0..S14 registry: real stages and explicit NotImplemented stubs.
"""
