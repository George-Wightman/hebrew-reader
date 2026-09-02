# The writer has 123 words. Duolingo already taught him 415.

**Date:** 2026-09-02
**Scope:** `DICT`/`CAT`, the library import path, `srsBandRecord` seeding, `wordFamiliarity`,
`campWarmNeeded`, `campBuild`, `campPickCarry`, `BANK_MAX`, `syncPull`, and
`content/nodes.json`.

## Where this came from

Three flags, and a conversation that joined them up.

Eighteen hours before this was written:

> Want to find a way to better bring over the words I have in duo into the app

Sixteen minutes before, sitting on the **Who people are** node, having just watched a
commission return nothing:

> Why is the API trying to write sentences? Thought you did that now?

And four days earlier, before the pre-baked pipeline existed:

> I feel like the API key should be constantly preloading new sentences, we should have
> like 2-3 lessons in advance worth of content for each node.

Then, on where he actually is:

> I am currently working on "Ask Questions" which here is 20, 9 in section 1, 30 in Section 2.

On how the imported words should be scheduled:

> I dont want them to start as "never seen" as a lot of htem are strong. I think we should
> do the first 10 units as "strong" like max these are in the bank , then the rest as at
> like 50% and exposure to them shape what the true level is

On the bank ceiling:

> why is there a seemingly arbitrary Bank_Max? why not set it to 3000 and have a mechanist
> to remove sentences that are seen?

On how the app is now actually used — the fact that reshapes everything below:

> in my actual use the node practice is my main point of contact now, and has seen in real
> usage a phase out of hte general daily practice for practice on a node

> as long as a node is themed arpund the node with the added learning material
> supplementing as this is replacing the daily practice

And the architectural question that settled the last open seam:

> You can prebake me a millionsentences for each node but incorporating the node words with
> never seen/ weak words would have to be on the spot right?

## What the measurements said

**The writer is starving, and that one fact sits behind two complaints.**

```
prod bands across the 270-word library:
  strong 70 · progressing 53 · weak 46 · new 101

wordReady:  123 of 270
```

`wordReady` returns true only for `progressing` or `strong`, on the **production** side
only, and `bankServable`, `bankUnknowns` and `commissionAcceptable` all descend from it.
Every sentence in the app is built from those 123 words. That is why a commission "banked
nothing — nothing survived review and ingest, 3 passed the gate, 1 came back from review":
Gemini was asked for natural Hebrew on a node's topic, out of 123 words, under review, at
five requests a minute.

**The pre-baked pipeline works and was never filled.** `content/nodes.json` v2 shipped 77
items and all 77 landed — the live bank carries 77 items with `src: "claude"`. But they
went almost entirely to one node:

```
מרגיש 8 · חולה 6 · ראש 5 · קצת 5 · בריא 4 · בטן 3 · נחמד 3 · (43 untargeted)
```

That is **How you feel**, and a little of **Liking & wanting**. One node of twelve. Every
other node sits below `CONTENT_AMPLE_ITEMS`, so `campWarmNeeded` returns true and Gemini
fires by policy. The mechanism is not missing. The shelf is empty.

**A node draws on nine words.** `campBuild` keeps only material touching the node, and every
node in the campaign ships `carry: []` — the code says so itself in the `CAMP_SESSION_CARDS`
note: *"every node in the app ships with `carry: []` and always has."* So a node session is
built from six node words, three debt words and STOPLIST filler. `campPickCarry` exists, is
written, and is never called for a live chapter. That, not the strength gate, is why node
sessions repeat.

**Sync is 94% full, and the existing `BANK_MAX` is enough to break it.**

```
base64 content in progress.json : 944,380 bytes
GitHub Contents API read cap    : 1,000,000 bytes
```

`syncPull` does `GET /contents/progress.json` and reads `j.content`. Above 1MB GitHub
returns `content: ""` with `encoding: "none"`, so `JSON.parse(b64decodeUtf8(""))` throws and
the app reports *"the synced file couldn't be read"*. At 346 bytes per bank item:

| bank | base64 payload | |
|---|---|---|
| 200 — today | 944 KB | 94% full |
| **400 — the current `BANK_MAX`** | 1,037 KB | **sync breaks** |
| 800 | 1,222 KB | breaks |

This is a live latent bug with no relation to this feature. It simply has to be fixed before
anything here makes the payload bigger.

## The document

`Duolingo Hebrew Vocab.pdf`, 77 pages, in Duolingo's own teaching order. Parsed: **3,496
rows across 84 units**, of which 82 carry a recoverable unit label. Sixteen rows are
malformed — 0.45%.

It is not two kinds of content but three:

| kind | rows | destination |
|---|---|---|
| **Lemmas** | 2,575 | `DICT` + `CAT`, then the library |
| **Inflections** | 921 | `lib[lemma].forms[tag]`, `state: "verified"` → `FORM_INDEX` |
| **Plurals** (inside lemma rows) | ~1,400 | `forms.pl`, `PLURAL_TO_SINGULAR` |

The inflection rows are not vocabulary and must not become library entries. The app already
holds that opinion: `STOPLIST` contains אותו, אותה, לי, לך, שלי and the rest of exactly
these rows. `FORM_TAGS.prep` already defines the tag set (`1s 2ms 2fs 3ms 3fs 1p 2p 3p`)
they belong in.

### The gap, at his actual position

Unit 20, "Questions", in progress; 1–19 behind him.

| | unique headwords | in `DICT` | **in the library** |
|---|---|---|---|
| Units 1–20 | 415 | 181 | **93** |
| Whole document | 2,178 | 454 | 160 |

**322 words he has met on Duolingo are not in the library.** The 2026-08-15 `DUO_WORDS`
batch was assembled from guessed unit topics — its own comment says so — and this document
is better evidence than what that batch was built on.

## The seam: who writes what

George's question is the right one, but the line is not node-word vs outside-word. It is
**anticipatable vs yesterday**.

| source of an "outside" word | knowable when content is written? |
|---|---|
| **Debt** — `campDebtWords`, drawn only from *earlier nodes* | the pool is a closed set; which three surface is live |
| **Stretch** — units 21+ in Duolingo order | fully, because this spec chooses them |
| **Rescue** — the word he failed *yesterday*, uncovered | no |

Two of three are pre-bakeable. The third is precisely what the 2026-08-31 spec kept live,
and it stays live. The batch does not need every *pairing* — each outside word needs a
couple of sentences that also touch the node, which is linear, not quadratic.

The outside-word sentences are **not additional** to a node's stock: a sentence pairing a
node word with a debt word is itself one of that node's servable items, and the composition
mirrors the session slices in Phase 7.

```
per node, per session:  5 carrying + 4 consolidation + 3 wider = 12 bank items
                        (the 2 solo cards are not bank items)

per node:  ~15 carrying a stuck node word
         + ~12 consolidation on node words
         + ~2 × 18 outside words, each also carrying a node word
         ≈ 50 items      × 12 nodes ≈ 600
```

Regeneration covers most of the residue: each batch is written against his live SRS, so it
targets what is weak *that week*. What genuinely cannot be pre-baked is a word that went
weak **yesterday** with nothing already written for it.

## Phases

### Phase 0 — the sync ceiling

Must land first. `syncPull` falls back to `GET /repos/:o/:r/git/blobs/:sha` with the raw
media type when `content` comes back empty. Removes the cliff to 100MB.

The test is the one that would have caught it: a `content: ""` / `encoding: "none"` response
must produce a correct blob, not "the synced file couldn't be read".

### Phase 1 — the dictionary learns the whole document

All 84 units' lemma rows into `DICT` and `CAT`: **1,724 new entries, ~62KB** on a 1.64MB
file. Category comes from the unit name (`Food 1` → Food & drink, `Clothing` → Clothing,
`Animals` → Animals & nature) through an explicit `DUO_CAT` map, **not** positional
`@N|Category` sentinels — `CAT_FIX` exists to clean up after those and there is no reason to
inherit the problem.

Inline rather than fetched: `DICT` is read synchronously at startup by `libHarvest`, the
lens and the pad.

**The quality gate.** A wrong dictionary entry does not degrade gracefully — `libHarvest`
builds real library entries from grandad's voice notes using `DICT`'s gloss, so a bad row
propagates into generation. The transliteration column independently encodes the Hebrew
consonants (`khultzah` ↔ `חולצה`), so every row is cross-checked mechanically and failures
are **dropped, not guessed**.

### Phase 2 — the library takes units 1–20, staged and graded

`DUO_UNITS` maps every headword in the document to its unit — the whole document, so later
bands are a setting change rather than another import. `libAddDuoUnits(upTo)` adds words
from units ≤ `upTo` with `src: "duo"`, `duo: <unit>`, `shelf: "reserve"`, skipping anything
already present.

```
units  1–10   →  prod: strong        recv: strong      (~136 words)
units 11–20   →  prod: progressing   recv: strong      (~186 words)
already his   →  untouched                             (93 words)
```

Three things the naive version gets wrong:

- **It must land on `prod`.** Duolingo trains recognition; `wordReady` reads production.
  Seed only `recv` and all 322 words stay invisible to every gate, unlocking nothing.
- **Due dates are staggered** in unit order across the following weeks.
  `srsBandRecord("progressing")` sets `due: today`, and 186 words landing on a pile that
  already holds 106 due would leave a badge reading ~290 that never visibly moves.
  `OVERDUE_SHARE` protects the session; it does not protect the honesty of the badge.
- **Existing SRS history is never overwritten.** Real evidence from real drilling outranks
  an assumption from a PDF. A word he keeps missing must not be reset to strong because
  Duolingo taught it in unit 3.

"50%" reads as `progressing`: the bands are categorical (`SRS_BANDS`), and `srsBandRecord`
already builds a record landing squarely in a requested one.

A Settings row — *"Duolingo — you're on unit 20, Questions"* — moves the line.

### Phase 3 — the paradigms become verified forms

The 921 inflection rows attach to their lemma as `forms[tag] = {he, tr}` with
`formsMeta.state[tag] = "verified"` and `src: "duo"`, using the existing `FORM_TAGS` sets.
Applies both to arriving words and to the 227 he already holds, filling **337 unverified
forms and 43 words with none** from a printed table rather than the `FORMS_DAILY_CAP = 200`
Gemini job's guesses.

Words not yet in the library keep their paradigm in a `DUO_FORMS` seed, consulted when the
word later joins, so a word arrives with its forms already verified.

### Phase 4 — new words arrive in Duolingo's order

`wordFamiliarity` gains a unit-derived term, replacing `FAM_BATCH_BONUS` for `src: "duo"`
words. The existing comment already records what a flat +150 did across ~120 batch words —
*"a never-touched batch word would lead the queue forever"* — and 322 would be worse.
Folding the unit into familiarity means real exposure evidence still competes with it rather
than being overridden, and reuses the one ranking instead of adding a second.

### Phase 5 — the API writes rescue only, never breadth

`campWarmNeeded` commissions only for an uncovered stuck word. Thin nodes route to
`contentThinNodes` and the start-screen line, both of which already exist. This is the
policy George assumed had shipped on 2026-08-31; only the arithmetic did.

### Phase 6 — the node vocabulary widens

- **`node.carry` gets filled.** `campPickCarry` is written and never called for a live
  chapter. Filling it turns a six-word node into a twelve-to-fourteen-word one with no gate
  change at all.
- **A rotating stretch slot.** One or two words per session drawn from units 21+ in Duolingo
  order, entering the session's carry set so `bankServable` admits them — one never-met word
  per sentence, the rule intact. Rotating, so each session teaches something different
  rather than the same six words reshuffled.
- **Newly planned nodes hold 8–10 words** rather than 6, which 445 ready words makes
  affordable. **Existing nodes keep their `words` exactly as they are** and gain their
  breadth through `carry` instead. `node.words` is what `campNodeProgress` counts and what
  gold is measured against, so editing it on a live node would silently move the finish
  line of work he has already partly done.

After Phase 2 almost nothing in units 1–20 is `new` on production, so the genuinely
never-met words are units 21+ — which he has not done on Duolingo either. The stretch slot
therefore runs the app deliberately a little ahead of his Duolingo position, and makes
"variety" and "match my Duolingo progress" the same mechanism instead of competing ones.

**`bankServable` is not loosened.** It already permits two not-ready words per node sentence
under `CAMP_SERVE`, one of which may be never-met. The absolute — never two never-met words
in one sentence — stays: a new word is learnable when the frame around it is solid, because
the frame carries the meaning, and the comments record what happened without it
(*"impossible cards are what made the page unusable"*).

### Phase 7 — the session gets longer without getting diluted

Node practice has replaced daily practice, so `CAMP_SESSION_CARDS` goes 10 → **14**.

The danger is structural rather than hypothetical. `campBuild` slices 2 solo cards, then
`CAMP_CARRY_CARDS = 5`, then **consolidation takes everything left** — unbounded, and
exactly where widened vocabulary lands. At 10 that is 2+5+3; at 14 it becomes 2+5+**7**, so
lengthening the session and widening the vocabulary together would hand half of it to words
the node is not about. So the third slice splits and the wider half is bounded:

```
14 cards:  2 solo  +  5 carrying a stuck word
         + 4 consolidation on the node's OWN words
         + 3 wider material (carry / stretch)
```

Eleven of fourteen stay the node's. The whole increase goes into sentence cards, none into
solo ones — slice 1 is capped at two because *"isolated recall is the drill that already
failed him"*.

**The `debt` hole.** `campBuild` keeps an item if `x.hits > 0 || x.carry || x.debt`.
`x.carry` is safe, because carry is built from `campWeakWords(node)` and so always implies a
node word. **`x.debt` does not** — a sentence about a left-behind word from three nodes ago,
containing nothing from this node, is servable today. That contradicts "themed around the
node" and is live now; it is merely invisible while the bank is small. The wider slice
requires at least one node word.

Also here: **`BANK_MAX` → 900**, and **`src: "claude"` items stop riding the sync**. They
come from a public URL; pushing them through the private repo pays to move content that is
already free to fetch. Sync `{id, seen}` for those and rehydrate from `content/nodes.json` —
~180KB back at 550 items.

The answer to "why not 3000" is that the bank is a **working set**, not a library. The
durable library is `content/nodes.json`, a static file in a public repo with no practical
size limit. Sentences do not need to be in localStorage to exist. Eviction is already his
own instinct: `bankValue = level*100 − min(99, seen)`.

### Phase 8 — the content itself

`content/nodes.json` v3: **~600 sentences**, twelve nodes, written against a 445-word ready
vocabulary and the Duolingo provenance, verified per node in a browser holding his real
state through `commissionAcceptable`, `bankUnknowns`, `bankNearDuplicate` and `bankServable`.

The sizing is forced rather than chosen. `CAMP_MAX_REPEATS = 2` means a session takes every
fresh item plus at most two recent ones and then **runs short rather than padding**, so a
14-card session needs ~12 fresh bank items each time; with `BANK_COOLDOWN_SESSIONS = 3` that
is 36 items to hold full length across three sessions back to back, and ~50 to still be
holding it once outside-word coverage and ordinary attrition are counted.

That leaves `BANK_MAX = 900` with real headroom above the ~600 written here plus the ~200
already banked — room for rescue commissions, daily material and voice notes, rather than
sitting exactly full on the day it ships.

`bankNearDuplicate` and `bankFrameFull` will fight template-filling, correctly. Both are
windowed to the newest 80 items so a large batch does not progressively choke, but 600
sentences have to be 600 sentences rather than 50 frames with the nouns swapped.

The acceptance test is per node, not per item — the lesson of the 2026-08-31 batch. No live
node may finish below `CONTENT_AMPLE_ITEMS`.

## Testing

- **Phase 0:** a `content: ""` / `encoding: "none"` pull produces a correct blob.
- **Phase 1:** a row whose transliteration disagrees with its Hebrew is dropped, not
  imported. `CAT` for an imported word comes from `DUO_CAT`, not from sentinel position.
- **Phase 2:** a word already in the library keeps its SRS record untouched; a unit-3 word
  arrives `prod: strong`; a unit-15 word arrives `prod: progressing`; due dates within a
  band are not all equal.
- **Phase 3:** an imported form reaches `FORM_INDEX` (so it must be `verified`); an existing
  verified form is not overwritten by an imported one.
- **Phase 4:** a unit-3 duo word outranks a unit-19 one in `wordFamiliarity`; a word with
  real exposure evidence outranks both.
- **Phase 5:** ample stock with an uncovered stuck word still commissions; ample stock with
  every stuck word covered does not; thin stock with nothing stuck does **not** commission.
- **Phase 6:** `campPickCarry` returns ready words the node does not already own; the
  stretch pick rotates between sessions.
- **Phase 7:** a 14-card session gives the node's own words at least 11 slots; an item whose
  only claim is `debt` and which contains no node word is refused.
- **Phase 8:** every live node ≥ `CONTENT_AMPLE_ITEMS` after ingest, asserted per node.

## Deferred, with reasons

**Loosening `bankServable` to allow sentences of mostly-unknown words.** Asked for directly,
and declined with reasons above: the gate already admits two not-ready words per node
sentence, and the "never two never-met" rule is what stops a lesson becoming a wall. The
real constraint was an empty `carry` field, which Phase 6 fills.

**Gzipping the sync blob.** Would buy ~4× and is available if the payload ever needs it
again, but it would make `progress.json` unreadable by hand — which both
`check-hebrew-flags` and `generate-node-content` rely on. Not worth it while Phase 0 and the
`src: "claude"` exclusion give enough headroom.

**`BANK_MAX = 3000`.** The bank is a working set. Growing it past the live chapter's needs
costs sync payload and buys nothing a bigger `content/nodes.json` does not buy more cheaply.

**Deleting the Gemini commission path.** It is the rescue writer, it cannot be pre-baked,
and it is the fallback if nobody visits Claude for a fortnight.

**Importing the whole document into the library.** 2,178 headwords against a 2-per-day
introduction rate is three years of queue. The dictionary takes everything; the library
takes what he has actually met.

**Automatic scheduled generation.** Unchanged from 2026-08-31: a cron would remove the one
moment where a human looks at the output before it reaches the drill.

**Two items from the 2026-08-29 flag** — whether reviewing every audio clip through the API
is earning its keep, and the unused images — are untouched here and remain open. They are
not part of this work and should not be lost with it.
