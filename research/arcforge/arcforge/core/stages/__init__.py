"""The stage registry: S0..S14, S13b, the owner gate and the R00 tail, as the program names them.

Real stages carry a `run` function. Every other stage is an explicit stub (`run=None`): it is
declared with the inputs it reads, the outputs it must produce and its config subtree, so the
DAG, `arcforge plan` and the key derivation are complete today, and running it raises
StageNotImplemented with that description instead of silently doing nothing.

Phases: 'prep' runs on the laptop before launch (`arcforge run r00 --prep`); 'vm' runs on the
runner VM (`arcforge run r00`); 'gate' is the owner gate (the VM is already deleted); 'tail' is
the laptop tail (`arcforge run r00 --resume`).
"""

from __future__ import annotations

from arcforge.core.dag import External, Stage
from arcforge.core.stages import graph, snapshot

STAGES: tuple[Stage, ...] = (
    Stage(
        name='S0',
        title='Snapshot',
        phase='prep',
        platform='laptop',
        outputs=('snapshot.json', 'corpus.jsonl'),
        config_keys=('corpus.git_sha', 'corpus.mdx_dir', 'corpus.records_dir', 'corpus.frontier'),
        external=(External('corpus', snapshot.load_external),),
        code=('arcforge.core.corpus',),
        run=snapshot.run,
        pending=(
            'vault/C_open split by salted hash + the vault-query commitment (needs the Owner '
            "Desk's queries; arcforge.owner and arcforge.vault)",
            "from R01, the diff against the parent's snapshot as an output (diff_snapshots)",
        ),
    ),
    Stage(
        name='S1',
        title='Clean, chunk, graph',
        phase='prep',
        platform='laptop',
        inputs=('S0',),
        outputs=('graph.json', 'rationales.json', 'counts.json'),
        config_keys=('corpus.rename_map', 'corpus.ghosts_by_default', 'lexicon.min_count'),
        code=('arcforge.core.corpus',),
        run=graph.run,
        pending=(
            'chunks.jsonl via lib/retrieval chunker v2 (scripts/generate-search-index.ts '
            '--embed-input), with chrome moved to its own field (M0)',
            'twin and collision graph, collisions.md, register proposals (need S2)',
        ),
    ),
    Stage(
        name='S2',
        title='Glossary and entity cards',
        phase='prep',
        platform='vertex',
        inputs=('S0', 'S1'),
        outputs=('cards.jsonl', 'glossary.json', 'person_map.proposed.json'),
        config_keys=('llm.vertex', 'corpus.frontier'),
        notes='gemini-3-flash over every record, with person roles; builds the proposed person '
        'map. The owner then confirms People and Registers in the Owner Desk.',
    ),
    Stage(
        name='S3',
        title='Lexicon and tokenizer',
        phase='vm',
        platform='cpu',
        inputs=('S1', 'S2'),
        outputs=('lexicon.json', 'tokenizer.trie.json', 'parity.golden.jsonl'),
        config_keys=('lexicon', 'corpus.person_map_sha256'),
        notes='corpus word types + multiword lexemes (npmi, min_count) + entity tokens with '
        'document-local alias rewriting + 10k general words + 4,096 n-gram buckets; a greedy '
        'longest-match trie with Python/TypeScript golden parity tests (arcforge.models).',
    ),
    Stage(
        name='S4',
        title='Teacher featurization',
        phase='vm',
        platform='l4',
        inputs=('S1', 'S3'),
        outputs=(
            'token_states.safetensors',
            'spans.jsonl',
            'anchors.safetensors',
            'isolated.safetensors',
        ),
        config_keys=('teacher',),
        model_keys=('teacher.revision',),
        prompt_keys=('teacher.prompts',),
        notes='EmbeddingGemma-2 bf16: corpus token states with character offsets, about 60k '
        'spans, 100k FineWeb-Edu anchors (cached per teacher revision), the isolated vocabulary '
        "pass; S0⁻ reuses the chunk states and recomputes only its aggregates and the null's "
        'spans.',
    ),
    Stage(
        name='S5',
        title='Training queries',
        phase='vm',
        platform='l4',
        inputs=('S1',),
        outputs=('train_queries.jsonl',),
        config_keys=('queries',),
        seeded=True,
        notes='vLLM Qwen3.5-9B (or the pinned 4B): 6 per chunk across families plus 2 bridge '
        'queries per edge, about 14k; the lab notebook, withheld records and briefs excluded.',
    ),
    Stage(
        name='S6',
        title='Eval queries',
        phase='vm',
        platform='l4',
        inputs=('S1', 'S2'),
        outputs=('eval_queries.jsonl',),
        config_keys=('eval_queries', 'eval.strata'),
        seeded=True,
        notes='vLLM Ministral-3-8B: D with the negation family, E 200, T, F invented titles '
        'and the generated frontier items; cached at R00.',
    ),
    Stage(
        name='S7',
        title='Mining',
        phase='vm',
        platform='l4',
        inputs=('S4', 'S5'),
        outputs=('mined.jsonl',),
        config_keys=('supervision.masks',),
        notes='teacher top-30 per training query; positive-aware masks drop the same record, '
        'link neighbours, seriesOrder +-1 and chunks with cosine > 0.95 x the positive.',
    ),
    Stage(
        name='S8',
        title='Initialization',
        phase='vm',
        platform='l4',
        inputs=('S3', 'S4', 'S5'),
        outputs=('pca256.npz', 'init_rows.npz', 'weights.npz'),
        config_keys=('init', 'weights'),
        notes='PCA to 256 fit on spans, queries and 50k anchors; rows and weights per config.',
    ),
    Stage(
        name='S9',
        title='Student training',
        phase='vm',
        platform='l4',
        inputs=('S7', 'S8'),
        outputs=('students.tar', 'train_log.jsonl'),
        config_keys=('train', 'supervision'),
        seeded=True,
        notes='normalize(b_type + sum_v w_v e_v) in PyTorch; Tokenlearn, contrastive (R04+) '
        'and the anchor penalty; train.device cpu is the pre-committed determinism fallback.',
    ),
    Stage(
        name='S10',
        title='Compression',
        phase='vm',
        platform='cpu',
        inputs=('S9',),
        outputs=('bundle.d128.bin', 'bundle.d256.bin', 'bundle.d64.bin', 'sizes.json'),
        config_keys=('compress',),
        notes='per-row symmetric int8 with fp16 scales; fails if the model bundle exceeds '
        'compress.model_bundle_max_mb raw.',
    ),
    Stage(
        name='S11',
        title='Index',
        phase='vm',
        platform='cpu',
        inputs=('S1', 'S10'),
        outputs=('arc-lexeme.d128.json', 'arc-lexeme.d128.bin', 'register_classifier.json'),
        config_keys=('index',),
        notes='a lib/retrieval VectorSourceManifest (int8-row, float32 scales, chunk-hash '
        'order, mrl true); record aggregation max + 0.1 x top-3 sum; the register classifier.',
    ),
    Stage(
        name='S12',
        title='Baselines and judging',
        phase='vm',
        platform='l4+vertex',
        inputs=('S1', 'S6', 'S11'),
        outputs=('scores.jsonl', 'pools.jsonl', 'judgments.jsonl'),
        config_keys=('eval',),
        notes='the thinned zoo and floors, the B7 ceiling, Flash-Lite listwise judging, '
        'gemini-3-flash adjudication, the Qwen 25% audit, the I5 re-grade and the I3 rows.',
    ),
    Stage(
        name='S13',
        title='Eval and report',
        phase='vm',
        platform='cpu',
        inputs=('S11', 'S12'),
        outputs=('report.json', 'verdicts.json'),
        config_keys=('run', 'eval'),
        notes='held-out-fold scoring, the nested adoption decisions, report.json and '
        'verdicts.json against arc-report/1 (arcforge.contract); `arcforge verdict` must '
        'reproduce it.',
    ),
    Stage(
        name='S13b',
        title='Growth briefs',
        phase='vm',
        platform='vertex',
        inputs=('S2', 'S11'),
        outputs=('proposals.md',),
        config_keys=('growth',),
        notes='gemini-3.1-flash-lite: one paragraph per largest 5-NN gap and most-referenced '
        'ghost, from titles and S2 cards only; never into the corpus, the scene or any prompt.',
    ),
    Stage(
        name='S14',
        title='Publish and delete the VM',
        phase='vm',
        platform='cpu',
        inputs=('S13', 'S13b'),
        outputs=('publish.json',),
        config_keys=('compute', 'ship'),
        notes='mirror publishable artifacts to arc-bench, then delete the VM in an exit trap '
        '(arcforge.runner).',
    ),
    Stage(
        name='gate',
        title='Owner gate',
        phase='gate',
        platform='owner+orchestrator',
        inputs=('S12',),
        outputs=('owner_audit.jsonl', 'adjudications.jsonl', 'fable_gold.json'),
        config_keys=('eval.gold',),
        notes='the VM is already deleted: the owner audits 150 pairs and adjudicates up to 30 '
        '(Owner Desk) while the orchestrator runs Fable gold audit #1.',
    ),
    Stage(
        name='tail',
        title='R00 laptop tail',
        phase='tail',
        platform='laptop',
        inputs=('S13', 'gate'),
        outputs=('PREREG.md', 'rules.yaml', 'power.json', 'vault.sealed.sha256', 'signoff.json'),
        config_keys=('run', 'vault'),
        notes='I1 (then its fallback if needed), the power analysis, PREREG, `arcforge prereg '
        'lint`, vault sealing, the Fable sign-off and the hash into arc-bench.',
    ),
)

REGISTRY: dict[str, Stage] = {stage.name: stage for stage in STAGES}
