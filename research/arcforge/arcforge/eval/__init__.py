"""S13 and the R00 tail: the numbers the verdict contract reads, computed, never inspected.

- metrics.py    per-query retrieval metrics (MRR@k, R@k, nDCG@k, Success@k, AUROC, judged@k)
- agreement.py  judge agreement: quadratic-weighted and IPW kappa, Krippendorff's alpha, Fleiss
                kappa, Kendall tau-a / tau-b, seeded bootstrap helpers
- qrels.py      the final qrels by Amendment A0's precedence; the quarantine stratum
- strata.py     held-out-fold metrics per stratum and system, seed SD, judged@10, condensed nDCG,
                the BM25 author-link pilot replication
- i1.py         I1 in its A0 form (probes, three-family reference, Kendall CI, lineage
                differential) and the report-only rows; I5 and I6
- power.py      the R00 MDEs and the verdict-probability table
- report.py     report.pre.json (S13) and the final report / verdicts (the tail)
- toy.py        deterministic synthetic upstream artifacts for toy mode and the tests

Everything is standard library (numpy is used for the Procrustes weirdness only when present).
The RULES of the arc apply: these functions compute; nothing here reads a result to decide what
to compute, and PREREG prose never comes from here.
"""
