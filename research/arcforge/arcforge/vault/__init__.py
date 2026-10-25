"""The owner's age vault (stdlib only; the crypto is the `age` CLI).

- age.py         age and age-keygen through subprocess; secrets only ever travel through pipes
- digest.py      canonical bytes and the salted sha256 commitments
- keygen.py      the owner's one-time key ceremony (writes configs/vault.recipient)
- split.py       S0: the salted-hash split of the owner's 100 queries into 70 vault / 30 open-dev
- seal.py        seal the vault queries (and qrels) to the owner's recipient; shred plaintext
- readpoints.py  the registered read points per branch and the read rule
- readlog.py     the hash-chained read log
- host.py        "laptop only": refuse on runner VMs, CI and containers
- read.py        the read itself: gate, decrypt in memory, score, release the rounded aggregate
"""
