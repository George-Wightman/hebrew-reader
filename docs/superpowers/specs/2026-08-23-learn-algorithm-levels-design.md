# Levels, soft launches and a bank that keeps moving

**Date:** 2026-08-23
**Scope:** the Learn session builder and the sentence generator. Balanced shape
first; the other shapes inherit the same machinery.

## The complaint

George, after a few weeks of real use:

> "it isnt introducing new words often enough and its looking quite basic
> sentences a lot 'this is a big house' 'this is a new house' which are fine but
> once Ive dont it once or twice, that should be enough to call it done. I also
> feel that we should introduce some more abstract/ higher level difficulty
> categorisation but I feel the level is stuck at basic ... it should be trying
> ot push me."

Three symptoms, and the audit found a specific cause behind each. None of them is
a tuning problem; all three are structural.

### Why new words never arrive

`bankServable` requires every content word of a sentence to be `progressing` or
`strong`, so a sentence can never carry a word he has not already drilled. That
is correct and stays. The bug is that the ONLY other route in — a solo `word`
card — has no room. Count the Balanced slices as they stand: 2 shadow + 7 bank +
3 chunk + 2 note = 14, plus the reply = 15. `room = size - cards.length - 1` is
therefore **zero**. A healthy bank silently eliminates every word card, which
closes the only door new vocabulary had.

Two smaller contributors. `learnTopUp` returns early at `unseen >= 6`, roughly
one session's worth, so generation almost never fires. And `FAM_SEED_BONUS` of
1000, against a realistic maximum of ~220 from exposure and age, freezes the
top-25 "words he can already say" list on the original xlsx seed forever.

### Why the sentences are trivial

The bank is served `sort(diff ASC)` — easiest first — where
`bankDifficulty = worstWordBand * 10 + wordCount`. That is a ratchet pointing
downward: the shortest sentence made of the strongest words always wins. It was
a deliberate choice ("reach beats relevance") made when the problem was
impossible cards, and it has over-corrected.

Nothing dedupes by shape. `learnIngest` compares exact `he` strings, so
`זה בית גדול` and `זה בית חדש` are different items and both live in the bank
permanently. And nothing retires: `bankSave` evicts by age via `slice(-400)`,
never by exhaustion, so easy items accumulate and are then permanently preferred.

### Why the level is stuck

There is no level model anywhere in the app. `bankDifficulty` — word band plus
length — is the entire notion of difficulty, and it knows nothing about tense,
clause structure or register. The generation prompt's "HIS LEVEL: NEAR-BEGINNER
... Present tense only. No future, no past" is a hard-coded constant written in
response to one bad session in August and never revisited. It cannot move
because nothing measures him.

## The design

Six changes. The first is the keystone — everything else reads the field it
adds.

### 1. Every sentence gets a level, assigned by the reviewer we already pay for

`learnReviewItems` already makes a second, independent Flash-Lite call on every
generated batch and reads each item as a native speaker. It returns
`{"keep":[0,2,5]}`. Extend that to `{"keep":[{"i":0,"lvl":2}, ...]}` and store
`lvl` on the bank item. **This costs no additional request** — it is the same
call, doing the same reading, reporting one more number.

The rubric goes in the prompt and is the app's single definition of difficulty:

| Level | What it means |
|---|---|
| 1 | Identification or a bare adjective. No verb. 2-4 words. `זה בית גדול`, `אני עייף` |
| 2 | One simple present-tense verb. 3-5 words. `אני הולך הביתה` |
| 3 | A verb with an object or preposition, or a question word. 5-7 words. Simple past or future allowed |
| 4 | Two clauses joined by ש/כי/אבל, or an infinitive chained to a verb, or an inflected preposition |
| 5 | Idiomatic, register-marked, or the natural spoken shortcut a native would actually use |

Backwards compatibility: items banked before this exists have no `lvl`. They are
treated as unknown and served as if level 2 (the modal case), and
`reviewExistingBank` — which already batches the whole bank through the same
reviewer — is extended to stamp levels while it runs, so one press of the
existing button backfills everything.

Parse defensively. The reviewer may still return the old bare-integer form, or a
mix; accept both and default a missing `lvl` to 2 rather than dropping the item.
A reviewer that returns nothing usable still falls back to keeping everything,
exactly as it does today.

### 2. A measured learner level, in `hvr_level`

Not a setting. A rolling measurement of what he actually gets right, so it moves
on its own in both directions.

Keep per-level counters `{lvl: {n, clean}}`. On each graded card that came from a
levelled bank item, increment `n`, and `clean` when it was answered without
hints or misses. Decay every counter by 0.9 at the start of each session, so the
measurement tracks the last handful of sessions rather than all of history — the
same reasoning that made `miss` a decaying ratio rather than a lifetime counter
in `srsApply`.

    level = the highest L where n_L >= 5 and clean_L / n_L >= 0.7
            floor 1, and never more than one above the previous reading

The one-step cap matters: a lucky run at level 4 should not skip him past 3.
Nothing about this is shown as a score — it is an input to card selection, and
the app has no business implying more precision than four SRS bands and a 1-5
rubric actually carry.

### 3. Serve a level MIX, not easiest-first

This is the direct fix for "this is a big house". The bank slice stops being
`sort(diff ASC).slice(0, 7)` and becomes a quota fill against the measured level
L: roughly 60% at L, 30% at L+1, 10% at L+2. On a 7-card bank slice that is 4 /
2 / 1.

Within each level bucket the existing ordering is kept exactly — the cooldown
split first, then `hits` (how many of today's target words it covers), then
`seen` ascending. `bankDifficulty` survives as the within-bucket tie-break; it
is a reasonable secondary signal, it is just no longer the primary one.

Degrade gracefully: if a bucket cannot be filled, borrow from the next level
down, then up. A thin bank must never produce a short session.

### 4. Word cards are the soft launch for new vocabulary

George's framing, and it is the right one:

> "use the word cards to introduce new words, for instance those in the library
> that are 'never seen' ... Once I know a word even weakly it makes more sense
> to me to practice it in a sentence/ context than in isolation."

This needs no change to `wordReady` or to the servable gate. Trace a word
through: never drilled means `srsStrength` returns `new`, so it is barred from
sentences. It gets a word card. `srsApply`'s first-meeting branch sets
`n=1, stab=1|2` and deliberately leaves `diff` at its blank value of 5. Run that
back through `srsStrength` — not `weak` (diff is 5, under 6.5; n is 1, so the
miss ratio cannot trigger), not `strong` (stab is 1 or 2, nowhere near 21) —
and it lands on `progressing`, which is precisely what `wordReady` accepts.

**One word card promotes a word into sentence eligibility by the next session.**
The pipeline George described is already what the scheduler wants to do. The
only thing preventing it was the zero-room arithmetic above.

So: reserve word-card slots FIRST, before the bank slice, and fill them only
with `new` (never-drilled) target words — up to 3. Take the room off the bank
allocation rather than off chunks or notes, floored so the bank never drops
below 4:

    newWordCards = min(3, count of never-drilled words among today's targets)
    bankRoom     = max(4, SESSION_BANK_MAX - newWordCards)

With three new words waiting: 3 word + 4 bank + 2 shadow + 3 chunk + 2 note + 1
reply = 15. With none: 0 + 7 + 2 + 3 + 2 + 1 = 15. Both land exactly, and the
session adapts to how much genuinely new material there is.

The existing "small library" fallback — repeating a covered word rather than
cutting the session short — is unchanged and still runs last.

Generation has to cooperate, or a freshly promoted word is eligible but never
actually written about. The prompt gains a FRESHLY LEARNED list: the ready words
with the lowest `n`, marked as the ones to prefer. And the serving quota gets a
small bonus for items using a recently promoted word, so a sentence that carries
last session's new vocabulary is preferred over an equivalent one that does not.

### 5. Generate every session, in the background, and retire what is spent

Three coupled changes; any one alone makes things worse.

**Preload.** `learnTopUp` currently blocks Start and only fires when the bank is
nearly empty. Move it to fire-and-forget shortly after the session begins,
writing material for NEXT time — exactly the pattern `convoTopUp` and
`pathWarmNext` already use. A synchronous attempt is kept only for the case
where the bank genuinely cannot fill a session at all, so a first run still
works. Raise `BANK_MIN_UNSEEN` from 6 to 18 so the top-up keeps firing rather
than sitting satisfied after one session's worth.

Budget: one Flash draft plus one Lite review per session. Flash allows 20/day
(40 across two keys) and falls back to Lite's 500 (1000). Comfortable.

**Retirement.** Generating every session without retiring anything just grows a
larger pile of the same rubbish. An item is spent when
`seen >= 3 && lvl <= L - 1` — he has done it three times and it is now below his
level. Drop it. And `bankSave`'s overflow eviction changes from "oldest first"
to "lowest level, then most seen", so pressure on the 400 cap removes the
material with least remaining value rather than the material that happens to be
old.

**Variety at the source.** The conversation generator solves this and the
sentence generator does not. `CORE_SCENES` exists because, in the words of the
comment above it, a scene "is a vocabulary selector before it's a story — which
is most of the cure for the 'a big wind' problem". Sentence generation gets no
scene at all, only a word list and a list of prohibitions. Give each top-up a
rotating **communicative function** drawn from a small fixed list (asking for
something, disagreeing politely, describing what happened yesterday, making a
plan, reacting to news), least-used first, counters in `hvr_fnrot`. Function is
what forces grammatical variety: "ask someone to do something later" cannot be
written in present tense in one clause.

The prompt's hard-coded NEAR-BEGINNER block is replaced by the rubric plus the
measured level, asking for a spread across L, L+1 and L+2. The natural-speech
rule, the concrete BAD/GOOD examples and the self-critique pass all stay
untouched — those are about meaning, not difficulty, and they are working.

### 6. Shape dedupe at ingest

Two rules, both cheap, both aimed squarely at the reported symptom.

**Near-duplicate.** Reject a new item if any banked item of the same type has the
same token count and differs in at most one token position. `זה בית גדול` versus
`זה בית חדש` is a Hamming distance of one and is refused. This is deliberately
narrower than a general similarity metric — it catches the exact "swap the
adjective" family George named, and nothing he would want to keep.

**Frame cap.** Refuse a new item when three banked items already share its first
two tokens. That kills a template family before it establishes itself, in the
case where the varying token is not in a fixed position.

### Also: the seed bonus

`FAM_SEED_BONUS` of 1000 makes the `working` list permanently the same 25 xlsx
words. `wordFamiliarity` stays as it is for `learnTargets`, where it is doing a
different and well-reasoned job. But the generator's `working` list stops using
it and sorts by demonstrated SRS strength instead — the honest measure of what
he can actually say, which is what that section of the prompt claims to be.

## Out of scope, tracked separately

Speech recognition returns "14" rather than `ארבעה עשר`, so a correct spoken
number grades as a miss. Nothing can change what the recogniser emits, but the
grader does not have to accept it: `DICT` already holds the Hebrew number words,
so normalising digits to their Hebrew forms inside the comparison fixes the
scoring. Small, self-contained, and independent of everything above.

## What must not break

- No sentence may ever be served containing a word he has not drilled.
  `bankServable` is unchanged and remains the gate.
- A session must always produce a full set of cards, on a thin bank, with no
  key, offline, and on a fresh library.
- Existing bank items without `lvl` must serve normally from the first run.
- A malformed or empty reviewer response must still fall back to keeping the
  batch, never to starving the bank.
- Every existing test in the file continues to pass.
