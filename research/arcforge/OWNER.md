# The Owner Desk: your guide to R00

You give RE-MEANING about **2 h 27 min** in all: about **1 h 41 min** before launch, and about
**46 min** at the R00 owner gate, about 100 minutes after launch. Nearly all of it happens in the
**Owner Desk**, a page that runs on your Mac. Two steps happen in Terminal.

The desk works offline. It saves every edit as you type, and only to `~/arc-owner/` on your
laptop. Nothing goes to the repo, the VM, GCS or Hugging Face. You can stop at any point, close
the tab, and come back days later. It picks up where you left off.

## Start the desk

In Terminal:

```bash
cd ~/path/to/NextDocsSearch/research/arcforge
python3 -m arcforge owner
```

Your browser opens **http://127.0.0.1:8765**. Leave the Terminal window open while you work, and
press `Ctrl-C` in it to stop the desk. Your work is already saved.

- This needs only the Mac's own `python3` (Homebrew's 3.14). `uv run arcforge owner` does the
  same thing if you have uv.
- `python3 -m arcforge owner status` prints the same checklist and time left in Terminal.
- If the port is busy, the desk is probably already running: open http://127.0.0.1:8765. To run
  another copy, use `--port 8766`.

## The checklist, and where each step happens

| # | Step | Where | Time |
|---|---|---|---|
| | **A. Any time before launch** | | **≈ 81 min** |
| 1 | Create the vault key | Terminal | 2 min |
| 2 | Write 100 queries from memory | Desk › Queries | 60 min |
| 3 | Write 8 frontier queries | Desk › Queries › Frontier | 4 min |
| 4 | Write 25 few-shot examples | Desk › Voices | 15 min |
| 5 | Check the inheritance-03 default | Desk › Settings | 30 s |
| | **B. After the prep pass** | | **≈ 19 min** |
| 6 | Preflight, only if something is missing | Terminal | 3 min |
| 7 | Confirm the 30 most frequent people | Desk › People | 7 min |
| 8 | Fix the register exceptions | Desk › Registers | 8 min |
| 9 | Launch R00 | Desk › Overview, or tell the orchestrator "go R00" | 1 min |
| | **C. At the R00 owner gate** | | **≈ 46 min** |
| 10 | Blind audit, 150 pairs | Desk › Audit | 40 min |
| 11 | Adjudicate, up to 30 pairs | Desk › Adjudicate | ≤ 6 min |
| 12 | Nothing else: the orchestrator finishes R00 | | |

The desk's **Overview** tab shows this list live: what is done, what is waiting on the pipeline,
and the minutes left for each step, scaled by how much of it is still to do.

## Step 1: the vault key (Terminal, 2 min)

The vault holds 70 of your 100 queries, sealed so that only you can open them. It is read at most
three times in the whole arc, on this laptop, at fixed points (R04, R06 or R07, and R10).

Run this **yourself, in your own Terminal window**. Never through Claude or any other agent:

```bash
cd ~/path/to/NextDocsSearch/research/arcforge
python3 -m arcforge vault keygen
```

1. It shows your private key, `AGE-SECRET-KEY-1…`, **once**. The key is never written to a file.
2. Save it in your password manager as **arc vault key**, and make one offline copy (on paper, or
   on a USB stick kept somewhere else).
3. Type `SAVED`.
4. Paste the key back from your password manager. The input is hidden. This proves your saved copy
   is complete.
5. The command clears the screen and the scrollback, and writes your public key to
   `configs/vault.recipient`. That file is safe to commit.

If you stop part-way (`Ctrl-C`), nothing is written, and you can run it again. The command refuses
to run through a pipe or an agent, because anything capturing its output would keep a copy of your
key.

## The tabs

### Queries (60 min, plus 4 min for the Frontier)

Write **100 queries from memory**, the way you would type them into FIND:

- 60 characters or fewer. The box stops you at 60, exactly like FIND's.
- Partial words are fine. **Don't look anything up.**
- Type a query and press **Enter**. The box clears for the next one.
- Optionally attach the record you meant with **+ record you meant**. Type a few words of its title
  and pick it from the list. It becomes a grade-3 label.
- Aim the 100 at the archive **outside The Echo Chamber and The Residue**. If you attach a record
  from one of those two series, the query is tagged **FRONTIER** automatically. It still counts,
  but it is measured at R09 instead.
- **Don't** try to decide which queries get sealed. At S0, arcforge splits them by salted hash into
  70 sealed and 30 open-dev. Nobody chooses, you included.
- The tab flags duplicates and empty rows. Delete a query with **×**. **Undo** is in the message
  that appears.
- It shows your pace once you have a few queries, and the time left at that pace.

Then switch to **Frontier · 4 + 4** and write 4 queries for The Echo Chamber and 4 for The Residue.
These two series are held out of training until R09, and these 8 queries test how the model copes
when they come back.

Once the prep pass has run (S0), the Queries and Settings tabs are **frozen** and read-only, because
the split and its commitment depend on exactly what you wrote.

### Voices (15 min)

Write **5 short queries in each of 5 voices**: literalist, mood-seeker, lost visitor, practitioner,
thread-follower. Each card has a one-line description of its voice.

Write **fresh** ones. The tab flags in red any example that copies one of your 108 queries, and in
amber any that comes close. Launch waits until no example is a copy. These 25 are frozen into
PREREG and used only for R06's persona bank.

### Settings (30 s)

There is one checkbox: *inheritance-03-the-gesture-archive was renamed to
inheritance-03-the-seed-vault*. It is **unchecked by default**, and git shows no rename. Unless you
know it was renamed, leave it unchecked and click **Keep the default**. Unchecked, the one sentence
that links to the gesture archive stays a ghost query, and stratum A has 177 entries; checked, it
has 178.

### People (7 min, after the prep pass)

Until the prep pass has run, this tab says **Available after R00 prep**. The orchestrator runs
`arcforge run r00 --prep`: about 10 minutes on this laptop, with no VM. The tab switches on by
itself when it finishes.

You then see the 30 most frequent person names, each with its proposed people: the records each
appears in, with a one-line role. For each name:

- **Confirm** it if the grouping is right.
- To **split**, move a record to another person, or to *New person 1–3*, with its menu.
- **Merge into one person** says that all of them are the same person.
- A name flagged as a possible typo, such as Priya Chakrabarti and Priya Chakraborty, has a
  *Same person as…* checkbox. Ticking it says that it is the same person.

The defaults follow your ruling that collisions are different people. The same full name inside
the saga's named series is one person unless the roles conflict, and standalone records get their
own people.

### Registers (8 min, after the prep pass)

All 327 records, grouped by the register the pipeline proposes: Chronicles, backstory, tech stubs,
mechanic essays, PM essays and 2023 posts. Scan each group, change the few that are wrong with
their menus, and click **Mark group reviewed**. A filter box finds a record by title. These labels
stratify the cross-validation folds.

### Launch (1 min)

When steps 1–8 are done, the **Launch R00** card on the Overview tab turns on. Until then it lists
exactly what is still missing. Launching only records your go-ahead in `~/arc-owner/launch.json`
for the orchestrator. You can also just tell the orchestrator "go R00". The VM part then runs
unattended for about 2 hours, on a spot VM that deletes itself.

### Audit (40 min, at the owner gate)

About 100 minutes after launch, the 150 blind audit pairs arrive. The VM is already deleted by
then, so waiting costs nothing. Click **Notify me** on the Overview tab once, and your browser tells
you when they arrive.

You see one pair at a time: the query, the record card, and two passages. Grade each one:

| Key | Grade |
|---|---|
| `0` | Not relevant, or about a different person with the same name |
| `1` | Related: on the topic, but not what the query is after |
| `2` | Relevant: answers part of it, or is a good second choice |
| `3` | Exactly it: the record the query is looking for |

The desk moves to the next ungraded pair by itself. `←` and `→` move back and forth, and `u` jumps
to the next ungraded pair. No judge grades and no system names are ever shown, and your labels win
over every model.

### Adjudicate (up to 6 min, at the owner gate)

At most 30 pairs from your own queries, where the judges disagree by 2 grades or more. Grade them
the same way. If there are none, the tab says so.

### Re-meaning (R03)

The blind re-meaning audit, about 60 minutes, opens in R03. There is nothing to do before then.

## Later: vault reads (about 1 minute each)

At a registered read point, the orchestrator asks you to run, on this laptop:

```bash
python3 -m arcforge vault read r04 --branch N
```

It asks for your vault key, hidden as you paste it. Before R10 it releases only one rounded number:
how much the hybrid model beats B2 on your sealed queries. A read at any other point, a fourth
read, or a read on any machine but this laptop is refused. Every attempt here, refusals included,
is logged in `~/arc-owner/vault/read-log.jsonl`, and `python3 -m arcforge vault status` shows the
reads so far.

If the key is ever lost from both your password manager and your offline copy, run
`vault read <run> --branch <B> --key-lost` instead. It records the read as "unavailable", as the
pre-registration requires.

## What not to do

- **Never paste the vault key into chat**, Claude, any agent, an issue, the repo, the VM, GCS or
  HF. Only `arcforge vault read`, run by you on this laptop, ever asks for it.
- **Never run `vault keygen` through an agent.** Run it yourself in Terminal.
- **Never paste a token into chat or the repo.** If `arcforge doctor` reports a missing secret, add
  it yourself in the GCP console's Secret Manager.
- Don't look anything up while writing queries, and don't try to steer which ones get sealed.
- Don't copy your queries into the Voices tab.
- Don't edit or delete files in `~/arc-owner/` by hand. In particular, never touch
  `vault/read-log.jsonl`: an edited log blocks every later read until it is restored.

## Where things live

| Path | What |
|---|---|
| `~/arc-owner/queries.json`, `voices.json`, `settings.json` | your writing |
| `~/arc-owner/people-review.json`, `registers-review.json` | your People and Registers decisions |
| `~/arc-owner/audit-labels.json`, `adjudicate-labels.json` | your grades |
| `~/arc-owner/launch.json` | your Launch go-ahead |
| `~/arc-owner/desk-token` | the page's private key to the desk server (not a secret you handle) |
| `~/arc-owner/history/` | the last 50 versions of each file, in case you need to undo by hand |
| `~/arc-owner/prep/` | what the pipeline hands you: `people.json`, `registers.json`, `audit-pairs.json`, `adjudicate-pairs.json` |
| `~/arc-owner/s0-lock.json` | written at S0; freezes Queries and Settings |
| `~/arc-owner/vault/` | the S0 split, the sealed vault, the read log and the released numbers |
| `research/arcforge/configs/vault.recipient` | your public key (safe to commit) |

## If something goes wrong

- **"The desk server is not answering"**: the Terminal window running the desk was closed or
  stopped. Start it again. Edits you made meanwhile are kept in the open tab and saved as soon as
  it is back.
- **"Changed in another window"**: you have the desk open in two tabs. The desk reloaded the
  newer version, so use just one tab.
- **A tab says a prep file is unreadable**: tell the orchestrator. Nothing you saved is affected.
- **You need an older version of something**: every save keeps the previous version in
  `~/arc-owner/history/<tab>/`.

---

### For the pipeline (file contracts)

The desk reads these files from `~/arc-owner/prep/` and reduces each to the fields it shows (see
`arcforge/owner/prep.py`):

- `people.json`, `arc-people-proposal/1`: `{names: [{name_id, name, mentions, clusters:
  [{cluster_id, label, records: [{slug, role, mention_id?}]}], variants?: [{name_id, reason}]}]}`.
  A record that appears twice under one name needs a `mention_id`.
- `registers.json`, `arc-registers-proposal/1`: `{registers: [{id, label}], records: [{slug,
  register, why?}]}`.
- `audit-pairs.json`, `arc-audit-pairs/1`, and `adjudicate-pairs.json`, `arc-adjudicate-pairs/1`
  (at most 30): `{pairs: [{pair_id, query, record: {slug, title?, date?, description?},
  passages: [≤ 2]}]}`. Any other field, judge grades included, is dropped before display.

The owner's answers are the documents listed above. Each has `schema`, `rev` and `updated_utc`,
and is written atomically. `arcforge vault split` (S0) reads `queries.json`, refuses anything short
of 100 + 4 + 4 clean queries, and writes `~/arc-owner/vault/s0/`. `arcforge vault seal` encrypts
the vault queries (and their `arc-vault-qrels/1` qrels) to `configs/vault.recipient`, writes
`vault-commitments.json` (`sealed_sha256`, `queries_commitment_sha256`) for the bench card, and
shreds the plaintext. `arcforge vault read` takes its scorer from
`arcforge.models.vault_scorer:score` by default, which ships with the model code.
