
## Ground rules

- This directory is the whole task. Read only the files packet.json lists (they are all here, and
  their sha256 are in packet.json). Use no network, no tools outside this directory, and no memory
  of other runs.
- Write exactly one file: `output.json`, valid against `output.schema.json`. Write nothing else,
  and change no input file (inputs are re-hashed when you finish).
- If you cannot or will not do the task, write a refusal instead:
  `{"schema": "arc-fable-output/1", "kind": "{{kind}}", "status": "refused", "reason": "<why>", "result": null}`.
- An invalid output is retried once, in a fresh session that does not see this one, and so is a
  refusal (except the PREREG sign-off, whose refusals go to repair or halt). A second failure
  fails the stage closed: nothing is substituted for your judgment.
