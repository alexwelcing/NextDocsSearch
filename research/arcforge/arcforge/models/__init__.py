"""arc-lexeme model code: the lexeme tokenizer, the static model bundle, and the M1 model checks.

The query side runs in TypeScript (lib/archive/lexemeEmbed.ts); this package is the Python
twin that builds the lexicon and the bundle, tokenizes the corpus for the teacher, and
produces the parity fixtures that keep the two sides identical:

- fold.py       NFKD folding and the site's word split (lib/retrieval/tokenize.ts)
- lexicon.py    lexicon.bin: a front-coded sorted key table, read in place by the TS side
- tokenizer.py  greedy longest-match lexeme tokenizer (multiword > entity/word > n-gram buckets)
- bundle.py     the model bundle (int8 rows, fp16 scales, weights, prompt biases) and embed()
- fixtures.py   the toy bundle, the 10k parity strings and the golden vectors
- payload.py    bundle size + gzip measurement at the planned shape
- pins.py       teacher and LLM pins with their M1 gates
- prompts.py    the Ministral JSON fixture and the Qwen audit-judge prompt
- teacher.py    EmbeddingGemma-2 token states and the context-sum reconstruction check (gpu)
- llm.py        text-only vLLM loads, throughput and JSON-validity checks (vllm)

Everything except teacher.py and llm.py is standard library only, like the rest of the core.
Run `python -m arcforge.models --help` for the commands.
"""
