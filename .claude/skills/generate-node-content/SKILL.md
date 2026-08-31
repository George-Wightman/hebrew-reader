---
name: generate-node-content
description: Use when George says it is time to write node content — "it's time", "the app says you need to write some sentences", "top up the nodes", "generate content" — or when he asks for practice sentences for the Hebrew Reader's map nodes. Reads his live synced state, writes sentences, verifies them through the app's own gates, and pushes content/nodes.json.
---

# Writing node content ahead of time

## What this is

The Hebrew Reader's map nodes need 15–30 practice sentences each, across levels. That work
used to be three chained Gemini calls per node — plan, write, review — on the weakest model
in the pool, under a 5/min limit, against a hard vocabulary constraint. It failed badly
enough to be worth moving: on 2026-08-30 two commissions in a row banked nothing ("10
written, 10 rejected", "12 written, 12 rejected") and one write took 137 seconds.

So breadth is written here instead, in batches, with his whole library in context.

**What is NOT moved:** the rescue writer. A sentence for the word he failed *yesterday*
depends on state that does not exist at generation time, so `sentenceCommission` stays in
the app and stays the fallback. Do not try to replace it.

Design: `docs/superpowers/specs/2026-08-31-prebaked-node-content-design.md`.

## The one rule that makes this worth doing

**Verify against the app's own gates before committing.** `commissionAcceptable`,
`bankUnknowns`, `bankNearDuplicate` and `bankServable` are functions in
`hebrew-reader.html`. Run the candidates through them in a browser holding his real state,
and only ship what passes. Gemini writes blind and discovers the rejection afterwards —
that is the failure being replaced, and skipping this step reproduces it.

## Steps

### 1. Read his live state

Same read-only token and repo as `check-hebrew-flags` — see that skill for the token path
and the `progress.json` fetch. Decode `keys` and take `hvr_library`, `hvr_srs`,
`hvr_campaign`, `hvr_bank`.

**Write his data to the session scratchpad, never into this repo.** It is a public
repository and his library and SRS must not land in it. Delete it when finished.

### 2. Work out what is short

Load his data into a browser running the app, served **from the scratchpad** so the data
sits beside the app on one origin and nothing touches the repo:

- copy `hebrew-reader.html` into the scratchpad next to the data
- add a temporary `fixture` entry to `.claude/launch.json` running
  `python -m http.server 8779 -d <scratchpad>`, `preview_start` it, and **revert
  launch.json afterwards** (`git checkout .claude/launch.json`)
- in the page: write every key into `localStorage`, then reload

Then ask the app directly:

```js
contentThinNow()                     // live-chapter nodes short of servable material
campNodes(campAll()).map(n => ({ name: n.name, words: n.words, carry: n.carry,
  stock: contentNodeStock(n, bankPrune(bankAll(), libAll()), libAll(), srsAll()) }))
```

Target the thin ones. `CONTENT_AMPLE_ITEMS` (12) is roughly "two sessions without
repeats" — aim past it.

### 3. Write the sentences

For each node, 15–30 items spread across levels, using `LEVEL_RUBRIC` (in the file) as the
scale. What matters:

- **Vocabulary.** Every content word must be in his library, or the gate drops the item.
  `Object.keys(libAll())` is the list — all of it, not a 40-word slice.
- **Register.** He replies to WhatsApp voice notes from his partner's grandfather. Warm,
  everyday, spoken. Not textbook.
- **The node's own words** should appear — that is what makes an item count for that node
  (`campBuild` matches on `uses`).
- **Spread the levels.** About half at his measured level (`learnerLevel()`), a third one
  above, a couple two above. All-easy content is the ratchet `pickByLevel` exists to stop.
- **Types.** Mostly `sentence`; a few `listen`; at most a couple of `reply`.
- **Variety.** If two items could be satisfied by the same sentence, rewrite one.

Item shape is exactly what `learnIngest` accepts:

```json
{ "he": "", "tr": "", "en": "", "type": "sentence", "lvl": 3, "for": "" }
```

`for` is the stuck word an item was written to rescue, or `""`.

### 4. Verify — do not skip this

In the browser holding his state, run the candidates through the real gates:

```js
const lib = libAll(), srs = srsAll();
cands.map(it => ({ he: it.he,
  unknown: bankUnknowns(it.he, lib),          // must be []
  uses: bankUses(it.he, lib),                 // must be non-empty
  dupe: bankNearDuplicate(it.he, it.type || "sentence", bankAll()) }))
```

Fix or drop anything that fails, and re-run until clean. `unknown` non-empty is the single
most common failure and the one that killed the Gemini batches.

`learnReviewItems({items: cands})` — the app's existing Gemini reviewer — would be a
genuine second opinion rather than the same model marking its own work. **It is not
available from a fixture browser:** the API keys deliberately never sync (`SYNC_NEVER_SET`
holds `GEMINI_KEY`), so a browser loaded from `progress.json` has no key and
`geminiRequest` throws "no key configured". Either skip it, or ask George to run the batch
past it on his own device. Do not treat its absence as a reason to skip the gates above —
those are local and mandatory.

Expect the gates to reject some of what you write, and expect most of those to be
`bankNearDuplicate` against sentences already in his bank rather than mistakes. On the
first batch (2026-08-31) 50 candidates produced 49 banked items across two passes, and
almost every rejection was a near-duplicate. Note also that the guards apply **within** a
batch as it grows, so an item can pass in isolation and be refused once its neighbours are
in — check against a bank you extend as you go, not a static snapshot.

### 5. Ship

- Write `content/nodes.json` with `version` **incremented by one** from whatever is there.
  The app skips a file at or below `hvr_content_v`, so a version that does not move is a
  batch that never arrives.
- `generated` is today's date.
- Commit and push. GitHub Pages serves it next to the app and the app ingests it on the
  next load. Verify live per `CLAUDE.md` — the service worker deliberately does **not**
  cache `/content/`, so a fresh push should be visible immediately.
- Delete his data from the scratchpad and revert `.claude/launch.json`.

## Common mistakes

- **Shipping without running the gates.** The entire advantage over the Gemini path.
- **Not incrementing `version`.** The app silently ignores the file.
- **Putting his synced data in the repo.** It is public. Scratchpad only.
- **Leaving the `fixture` entry in `.claude/launch.json`.** Revert it.
- **Trying to replace the rescue writer.** It cannot be pre-baked; that is the point.
- **All-easy sentences.** Spread the levels or the measured level ratchets down.
