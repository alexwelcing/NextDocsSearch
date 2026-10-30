# Independent implementation review of PR #212

Reviewed [PR #212](https://github.com/alexwelcing/NextDocsSearch/pull/212) at
`bae74b729311abbc152d274e90975109c2cd9496`. The original suite reproduced **942 passed,
2 skipped**. The October 25 automated review did not complete; its comment is not evidence of
an approved implementation.

The changes accompanying this review fix demonstrated contract defects. They do not certify
the unfinished M2 research runtime for preparation or execution.

## Confirmed findings and corrections

| Finding | Reproduction at the reviewed head | Correction |
| --- | --- | --- |
| P1's default taint misses new artifact names | P1 emits `new_reader_output.json`; S9 consumes it. `check()` returns no finding because the source list contains only five fixed filenames. | Without an explicit declaration, every actual P1 output is a source. Existing reader filenames remain sources when explicitly declared subsets are used. |
| Isolation lint can report success without checking the reader runtime | An unavailable registry produces only a warning. The live legacy registry has no P1 or S6b, so its successful graph check is vacuous for M2. | Unavailable registries fail lint. Missing M2 reader/training registry entries warn on template lint and fail `--frozen` sign-off lint. Invalid/cyclic graphs fail closed instead of being partially analysed. |
| R00 values can replace contract-derived fields in the final document | `values_for(frozen_rules, {'tau.H1.c1': '0.001'})` replaces the registered tau; MDEs and rules/schema hashes are similarly replaceable. | R00 extras cannot contain derived fields. The renderer computes MDEs, taus and rules/schema hashes. Unknown extras and placeholders introduced by replacements are refused. |
| Freeze guards exempt entire MDE lines | A comment, indentation or newline edit on `AB:` passes `freeze_diff()`. Non-scalar and invalid numeric replacements can also pass the diff guard. | Only each finite nonnegative numeric scalar token can change; all surrounding bytes must match. Freeze preserves inline comments and line endings and rejects duplicate/malformed MDE blocks. |
| Hashing is available but R00 commands are not bound to the prior commitment | `freeze --rules changed.yaml` compares the result only with that changed template. Final rendering accepts any frozen rules or supplied pre-template without comparison with s0. No runtime caller of `s0_hashes()` exists. | Freeze and final render require the previously witnessed `--s0-hashes`. Both check the three committed files and the generated template. Final rendering compares frozen rules with the verified original template. |
| Rendering can silently lose measurement precision | An MDE `0.0450345678912345` prints as `0.045`; a sufficiently small value prints as zero. | Numeric text round-trips to the registered values. Small measurements in scientific notation also freeze correctly under PyYAML. |

These are demonstrated defects or confirmed integration gaps. The tests do not establish that
any research run was contaminated or that a witnessed commitment was altered.

## Actual registry and data dependencies

`arcforge/core/stages/__init__.py` registers 18 stages. Only S0 (snapshot) and S1 (graph) have
implementations. The rest, including training and evaluation, have `run=None` and raise
`StageNotImplemented` if executed. `core/executor.py` and `core/pipeline.py` use this registry.

| Live stage | Inputs | Declared artifacts relevant to this review |
| --- | --- | --- |
| S5: training-query generation | S1 | `train_queries.jsonl` |
| S6: evaluation-query generation | S1, S2 | `eval_queries.jsonl` |
| S7: mining | S4, S5 | `mined.jsonl` |
| S8: initialization | S3, S4, S5 | PCA, rows and weights |
| S9: training | S7, S8 | students and training log |
| S12: baselines/judging | S1, S6, S11 | scores, pools, judgments |
| S13: report/adoption | S11, S12 | report and verdicts |
| tail: R00 tail | S13, gate | PREREG, rules, power and sign-off artifacts |

There is **no P1, S6b, proxy-vault generation stage or X2 commitment stage** in that registry.
`Stage` has no `reader_outputs` or `consumes` fields, and `StageContext` does not enforce those
metadata declarations. The M2 graph in `tests/contract/test_lint.py` consists of mock objects:

- P1 publishes C_open and frontier artifacts.
- S6b combines P1 outputs with the benchmark.
- S7 reads S6b through the registered screening exception and declares its benchmark embeddings
  tainted; it declares its training bank clean.
- S8 and S9 declare consumption of that training bank only.

The static checker accepts this graph by design. There is no executable S7 screening code here
against which its removal-only claim can be verified. The absence of a reader path in the live
registry is not evidence that the intended M2 runtime is isolated.

## Adversarial graph results and research decisions

| Boundary tested | Result | Decision or evidence still needed |
| --- | --- | --- |
| P1 directly or transitively reaches S5/S7/S8/S9 | Rejected; new filenames, indirect relays and reversed registry order are covered. | Register the real reader and every prohibited consumer, including tuning and selection paths. |
| S7←S6b only | Exempt exactly as registered. S9←S6b and S7←relay←S6b are rejected. A second direct P1 input to S7 is rejected. | Decide whether the entire edge remains trusted or the exception should be limited to particular artifacts/operations. Verify real screening removes training items without copying queries, qrels or labels into training, adoption or exemption inputs. |
| Explicit `reader_outputs` and `consumes` | A listed reader artifact is rejected at training sinks; a declared clean artifact is accepted. An intentionally false empty declaration can launder a reader copy. | Confirm whether trusted declarations meet the research standard. Stronger guarantees require per-output data dependencies, enforcement of input access and implementation/perturbation tests. Static metadata cannot verify a truthful declaration. |
| Cycles, absent upstreams and missing registry | Fail closed. | The runtime already rejects invalid DAGs; lint must not independently claim a proof for them. |
| C_open adoption guards versus proxy-vault adoption inputs | Existing policy preserved. | The program deliberately permits C_open in CE/held-out guards and prohibits proxy-vault data in adoption. Decide/record artifact-level distinctions when the real adoption registry is implemented; a blanket rule forbidding all reader influence would change the research design. |

The screening exception and trust in correct declarations are **not classified as demonstrated
runtime leaks**. Their semantics require a research decision and evidence from the actual M2
implementation. No unrequested change to hypotheses, taus, branches or budgets is made here.

## s0 integrity and remaining witness integration

`s0_hashes()` correctly computes SHA-256 over file bytes. The regression tests mutate each of
the three files independently, including whitespace-only changes, and verify both hash
sensitivity and rejection against retained hashes. CLI tests cover changed templates, changed
pre-documents, changed schemas, post-freeze tau/comment/newline edits, valid freeze/render,
derived-field overrides, precision and unresolved placeholders.

The three contract files are byte-identical to the reviewed PR head:

| File | SHA-256 |
| --- | --- |
| `arcforge/contract/rules.yaml` | `ee39feb974b2588699be16325f44e730622d372886aba01464226afec037f756` |
| `prereg/PREREG.pre.md` | `9856565ec7aa3656b53f30a397d026d8b4ef1f5a3d51764cead2c9b853c53019` |
| `arcforge/schemas/arc-report-1.json` | `d49c07ef10aa42ec2850ff0cc13f8ae97e3505a05625a63d6a271a1ed8a7263d` |

The newly required hashes are an input from the original public s0 witness, not an authenticated
witness by themselves. X2, Rekor/OpenTimestamps verification, earliest-entry chronology and
runtime wiring are absent from this head. These must be implemented before claiming temporal
commitment integrity. Supplying a freshly regenerated manifest after editing the contract cannot
substitute for the original witnessed commitment. R00 observation provenance and the remaining
witness metadata are still supplied by the orchestrator/Fable process.

## Validation

Baseline: `942 passed, 2 skipped` on the reviewed head. Final full suite: **991 passed,
2 skipped in 77.32 seconds**, with 49 added regression cases. The skips are unchanged external
`age` integration tests because that binary is not installed. The focused isolation,
preregistration and lint run passed 92 tests.

The installed uv is 0.13.4, while this repository requires >=0.13.5. Tests run without changing
the project/lockfile, from the parent directory with the same core/dev dependencies:

```sh
PYTHONPATH="$PWD/NextDocsSearch/research/arcforge" uv run --no-project --no-config \
  --with pytest --with jsonschema --with pyyaml \
  python -m pytest -q NextDocsSearch/research/arcforge
```

`git diff --check` passes. Direct ESLint (`node node_modules/eslint/bin/eslint.js .`) passes.
The root `pnpm run lint` / `pnpm run build` wrapper first bootstrapped dependencies and stopped
on pnpm's ignored dependency-build scripts. Invoking the installed pnpm CLI directly reached
the build command, which stopped before its generators because tsx cannot create its IPC pipe
in this environment (`listen EPERM /tmp/tsx-0/36.pipe`). The frontend build is therefore
unverified. Package-manager-generated lockfile/workspace changes were discarded; the final
change is confined to `research/arcforge/**`.
