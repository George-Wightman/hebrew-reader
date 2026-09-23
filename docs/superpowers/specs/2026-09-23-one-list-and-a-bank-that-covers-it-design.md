# One list, and a bank that covers it

**Date:** 2026-09-23
**Scope:** `learnBuild`, `learnTopUp`, a new `practiceNeeds` / `learnPickBank` pair,
`srsUnproven`, `contentIngest` review, `BANK_MAX`, and `content/nodes.json` v5.

## Where this came from

> Something I have noticed is that the algorythm for picking what words will be in hte
> daily practice seems to keep selecting hte same words day after day

Then, once the first diagnosis was in front of him:

> I feel like these systems should almost be one, why is it making sentences for
> somehting hte app hasnt been using?

> A while ago I got a version of claude to prebake a load of sentences, I asked him to try
> and use as many different combinations of words so that the sentences in those daily
> sessions can have veriety and hit any word alongside other words too. I want you to
> review that work, see what went well and what didnt. I then want you to meticulously
> design a large bank of sentences using a variety of words. ... how can we give that
> variety while keeping hte quality and difficulty gated, scafholding my learning.

Three decisions he made on the way:

- The ~240 Duolingo words the app marked half-known on 2 Sept without him ever answering
  them are **tested gently** — through sentences, a few a session, beside words he has
  actually answered. Nothing is reset.
- The new batch covers **every ready word, weighted by use**: everyday words several times
  with different partners, rare ones once or twice somewhere they would really come up.
  Nothing forced into an unnatural sentence.
- In a Quick session **the phrase slot flexes**: a stuck due word takes it when one needs
  rescuing, otherwise the phrase stays.

## What the measurements said

Everything below was measured by running the app's own functions against his synced
state (decoded `progress.json`, `content/nodes.json` rehydrated into the bank the way his
phone holds it), not by reading the code and reasoning.

**The session aims at words it then cannot serve.** Today's `learnTargets` leads with
seven overdue words — month, week, more, tall, recently, "what's this called", short —
due since late August. Not one reaches a card, in Quick or Full:

```
target month     [weak]        in 0 sentences
target week      [weak]        in 0 sentences
target tall      [progressing] in 1 sentence, servable 0
...
```

A sentence can only reach him if every content word is ready, and none exist for these.
A word card could reach him, but word cards are the *fill* slice and the bank now takes
the residual — `room` is zero. So a due word with no sentence is never shown, never
rescheduled, and leads the target list again tomorrow. In a 14-day simulation of either
shape, answering everything right, none of the seven was practised once.

**Three lists decide "what matters today", and none of them agree.**

| decides | aims at |
|---|---|
| `learnTargets` — the session | overdue, then never-met |
| `rescueWords` — the rescue writer | the 3 highest miss-rate weak words |
| `learnTopUp` breadth — the background writer | the 25 highest-*stability* ready words |

The breadth writer is literally told "WORDS HE CAN ALREADY SAY" = his 25 most solid words
(today, coffee, cold, dad...). Every item it writes is built from them, arrives with
`seen: 0`, and — because the bank sort falls back to `seen` then `diff` when nothing hits a
target — jumps the queue. That loop is the repetition he is describing.

**The bank covers a quarter of what he is ready for.**

```
library bands (prod): strong 155 · progressing 242 · new 96 · weak 44   (ready 397)
bank: 516 items; servable in daily practice today: 304
distinct words across servable sentences: 116
ready words in NO servable sentence: 281 of 397
due words (330) in NO servable sentence: 284
"today" is in 94 of 516 items; grandpa 46; house 38; tired 38; want 37
```

**The earlier prebaked batch** (`content/nodes.json` v3/v4, 2026-09-02/03):

- *Went well:* every item verified through the app's own gates against his real state
  (zero unknown words); every node lifted above `CONTENT_AMPLE_ITEMS`; the `retired`
  mechanism built; one transliteration scheme.
- *Did not:* written for **nodes**, not daily — 118 of its 288 are blocked in daily
  practice (`notcarried`: they carry a node's stuck word). Narrow: 154 distinct words
  against 397 ready; **34 of 252** ready Duolingo words appear anywhere in it, though it was
  written after that import. Templated: "אני רוצה / מרגיש / נוסע..." openings, and 30 items
  now fail `bankNearDuplicate` against his bank. Unreviewed: `learnReviewItems` was skipped,
  and a native speaker retired or corrected ~1 in 6 — almost all from forcing a target word
  into a sentence (לבית for הביתה, "my head is full", "I took and gave"). Unused: after 20
  days, **282 of 337** prebaked items on his phone have `seen: 0`. The seen counts are
  trustworthy — the stub-deletion bug that reset them was fixed at 00:02 on 2026-09-03 and
  the batch landed that afternoon.

**What cannot be seen.** Prebaked items sync as `{id, src, seen}` and ids are per-device, so
which prebaked sentence he was shown cannot be recovered from here — only how many, and how
often.

## The one idea

**One list, read by everything.** `practiceNeeds` gives every word a need for today. The
sentence picker maximises need covered; the word cards take due words nothing can carry; the
background writer writes for those same words. Then a content batch fills the holes the list
exposes, so the word cards are a stopgap rather than the mechanism.

## Phase 1 — `srsUnproven` and `practiceNeeds`

**Unproven.** A record the app *assumed* rather than observed. Detected by fingerprint,
migration-free: no evidence fields at all (`lastAt`, `streak`, `rn`, `ms`), no misses, no
lapses, and `(stab, diff)` exactly one of the seeded shapes `srsBandRecord` and the older
batch importer wrote — `(3,7)`, `(8,4)`, `(30,2)`. Measured on his state it catches all 242
Duolingo imports and the batch/seed records written the same way, and does **not** catch
"month" (n 10, answered in August before `lastAt` existed) — a first draft keyed only on
`lastAt` would have. The first real answer writes `lastAt`, so a word stops being unproven
the moment he has said it once.

**Need**, per gradable word, from `srs` alone (pure; plain objects in, plain object out):

| state | need |
|---|---|
| due (prod `n > 0`, `due <= today`) | `NEED_DUE` 10 + `min(5, floor(daysOverdue / 7))` |
| not due, answered within `NEED_RECENT_DAYS` (2) | `NEED_RECENT` −4 |
| not due, answered within 7 days | −1 |
| anything else | 0 |

The penalty is the part that answers "the same words day after day": "today" is due in
December; answered yesterday, it now counts *against* a sentence rather than for it.

`practiceNeeds` also returns `due` — the due words in need order (most overdue first) — and
the `unproven` set. `learnTargets` is unchanged; it still decides the soft launch.

## Phase 2 — picking by coverage, and the flexible slot

**`learnPickBank(pool, room, level, needs, opts)`** replaces the hits sort + two-pool
`pickByLevel` in `learnBuild`. Pure. Greedy over the level quota `levelQuota(room, level)`:
for each wanted level, take the highest-scoring remaining candidate at that level (nearest
level on a miss, as `pickByLevel` does), then mark its words covered.

- **score** = Σ over content words of `need[w]`, except a word already covered this session
  counts −2 (twice in one session is thin practice, not zero practice).
- An item still inside `BANK_COOLDOWN_SESSIONS` scores −3 — rotation kept as a weight rather
  than a wall, so a recent sentence covering three due words can still beat a fresh one
  covering none.
- Ties: less `seen` first, then `bankDifficulty`.
- **Positive first.** Every slot is first offered only positive-score candidates; a slot that
  finds none anywhere is filled in a second pass from the best of the rest. So a sentence of
  nothing but recently-practised words appears only when there is genuinely nothing better —
  which also removes the "new item jumps the queue" effect, since being unseen no longer
  outranks covering something.
- **Tested gently.** A candidate with more than one unproven content word is not eligible in
  daily practice, and a session spends at most `UNPROVEN_PER_SESSION` (Quick 2, Full 5).
  Carried items keep their existing priority and `CARRY_CARDS` cap, ordered by score.

**The flexible slot.** `stuck` = due words, in need order, that no servable item in the pool
contains. Quick: if there is one, a word card for `stuck[0]` takes the phrase's place;
otherwise the phrase stays. Full: up to `FLEX_DUE_CARDS` (2) stuck words get word cards,
paid for out of the sentence share (they are placed before `learnBankRoom` runs, so the
arithmetic already charges them). Node sessions (`campBuild`) are untouched.

## Phase 3 — the writer reads the list

`learnTopUp`'s breadth pass stops asking "is the shelf low" alone and asks "is anything due
with nothing written for it":

- **Trigger:** stuck due words exist, or unseen servable stock is below `BANK_MIN_UNSEEN` (the
  old condition, kept). At most `BREADTH_RUNS_PER_DAY` (3) runs a day, counted in its own
  dated key, so a pile of 280 stuck words cannot turn every session start into two calls.
- **Prompt:** "WORDS HE CAN ALREADY SAY" becomes the support list with the ten most-used bank
  words removed, so the model cannot lean on today/coffee/cold. "JUST LEARNED" becomes
  "WRITE FOR THESE" — up to 8 stuck due words — and each returned item names its word in
  `for`. At most one unproven word per sentence, same rule as the picker.
- Rescue (weak words, carried) is unchanged — it is already the weak tier of the same `srs`.

## Phase 4 — the batch

`content/nodes.json` **v5**: roughly 450–550 new items written against his live state, aimed
at daily practice rather than any node.

**Coverage.** Every ready word at least once. Everyday words (verbs, food, time, family,
places, question words) 4–6 times, each time with different partners; rare nouns (camel,
bracelet, eagle) 1–2 times in a setting where they genuinely come up — a zoo trip, a present,
a menu. Hard caps across the batch on the words the bank already over-uses (today, grandpa,
house, tired, want, coffee, cold, tea, city, was).

**Scaffolding.** A word's first sentence is short and built from strong, answered words;
later ones go longer, change tense, ask, negate or join clauses. Levels spread around his
measured level (2): about half at 2, a third at 3, the rest split between 1 (first sightings)
and 4. At most one unproven word per sentence, so the first time a Duolingo word is tested
the frame around it is solid.

**Variety as a rule, not a hope.** No opening (first two words) more than 5 times in the
batch. Structures deliberately mixed: questions, negation, past, future, dative experiencer
(כואב לי, קר לי, יש לי), numbers with nouns, requests, two clauses joined by כי/אבל/ו/כש.

**Natural Hebrew first.** Where saying it properly needs a word he does not have, the item
declares it (the `pend` road built on 2026-09-03) rather than bending the Hebrew; the
retired list's failures are the checklist. Masculine first person, as the rest of his
content. Transliteration per `CLAUDE.md`, no exceptions.

**Verification before commit**, in a Node harness running the file's own functions against
his decoded state (the Browser-pane fixture route is refused for his synced data):
`bankUnknowns`, `bankNearDuplicate` and `bankFrameFull` against a bank extended as the batch
grows, `learnIngest` dry run, `whyBankServable` for daily practice. Acceptance is per word,
not per item: every ready word ≥ 1 servable sentence after ingest.

**Review on device, spread over days.** The ingest review already spends 4 × 12 on arrival.
Items beyond that are banked with `rv: 0`; a `contentReviewTick` reviews up to
`CONTENT_REVIEW_BATCHES` more of them per day (servable ones first) and removes what the
reviewer rejects, recording it as retired so it cannot come back. `rv` rides the sync slim
so two devices do not both pay. ~500 items clears in about ten days.

**Room.** `BANK_MAX` 900 → 1600. Prebaked items sync as ~40-byte stubs, so the sync payload
grows by ~20KB; localStorage by ~200KB.

**Native spot-check.** 15 items, shuffled and unlabelled, for her verdicts only — never a
list.

## Phase 5 — proof

Re-run the 14-day simulation on his real state with v5 ingested. Passes only if:

- every word stuck at the front of the queue today is practised within 3 days;
- no word that is not due appears on more than 4 of 14 days (today: "today" 14 of 14);
- distinct words practised roughly doubles (Quick 79, Full 143 before);
- the self-test suite passes.

## Testing

- `srsUnproven`: a `srsBandRecord("progressing")` record is unproven; the same after one
  `srsApply` is not; a record with n 10 and fractional stab and no `lastAt` is not.
- `practiceNeeds`: due outranks not-due; more overdue outranks less; answered yesterday and
  not due is negative; unproven words are reported.
- `learnPickBank`: a sentence covering a due word beats one of recently-practised words; the
  second slot does not re-cover the same due word when an alternative exists; a candidate
  with two unproven words is never picked; the unproven budget holds; recent items lose to
  fresh ones of equal coverage but can beat fresh ones of none; the level quota is honoured.
- Flexible slot: Quick with a stuck due word has a word card for it and no chunk; Quick
  without one keeps the chunk; Full holds at most two stuck cards and still 15 cards.
- Breadth: the prompt names the stuck words and omits the over-used ten; the daily cap holds.
- Review tick: rejected items are removed and stay retired; kept ones get `rv: 1`.

## Deferred, with reasons

**Node sessions.** `campBuild` has its own targeting (node words, carry, debt) and George has
not reported repetition there. Changing both at once would make any regression in either
undiagnosable.

**Recovering which prebaked sentences he saw.** The ids are per-device and do not sync. Making
them stable (a hash of `he`) would fix it for the future, but it touches ingest, retirement and
cooldown keys at once and is not needed for anything here.

**Loosening `bankServable`.** The gate stays exactly as it is. Variety comes from covering more
words, not from admitting harder sentences.

**Resetting the Duolingo import.** Declined by George in favour of testing gently.

**A second AI reviewer at authoring time.** The on-device reviewer, the gates and the native
spot-check are the three checks; a fourth from the same family of model as the writer would
share its blind spots.
