# Tokenizer parity fixtures

Written by `python -m arcforge.models parity-fixtures` from `arcforge/models/fixtures.py`;
`tests/models/test_fixtures.py` fails when they are stale.

- `toy/`: a small arc-lexeme bundle in the production format (lexicon.bin, vectors16.i8,
  scales.f16, weights.f16, bias.f16, arc-lexeme.meta.json): archive-flavoured lexemes,
  multiwords, people and shared names, general words that share rows, 257 n-gram buckets.
- `parity.jsonl.gz`: 10,000 deterministic strings and the Python token stream of each, in query
  and document mode (a digest per string; full streams for the first 300 strings and for every
  string whose document stream differs).
- `golden.json`: the Python embeddings of the first 120 strings in both modes.

`lib/archive/lexemeEmbed.test.ts` (vitest) reproduces every token stream and every golden vector
bit for bit with the TypeScript runtime.
