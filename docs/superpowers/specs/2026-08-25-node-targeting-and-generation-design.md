# Nodes that target the words you are missing

2026-08-25

## The complaint

> "I feel like its giving me the same lesson over and over. I am in the 'your day'
> node. I have 4/6 and its not even giving me the words that I dont have in the
> lessons."

Four separate mechanisms produce that, and every one of them is doing what it was
written to do.

## Why it happens

**1. A word you are weak at is barred from every sentence.** `bankServable` requires
every content word to be `wordReady` — `progressing` or `strong`. The two words at
4/6 are `weak` (`diff >= 6.5`, or a miss rate at or above 40%), so no sentence
containing them can ever be served. The only card that can carry them is a solo word
card — the exact drill that already is not working. Fail it, stay weak, get it again.

**2. Every node ships with `carry: []`.** All fourteen. The comment at
`campStartPractise` says carry words exist "so the bank has something servable to
build sentences from"; that list has never held a word. A servable "Your day"
sentence must therefore be built from at most six words plus stoplist filler — and
only four of those are ready. Nothing in the bank qualifies, `hits` is zero
everywhere, the coverage sort decides nothing, and a node session is the general
bank shuffled.

**3. Half a node session is not the node.** `learnBuild` pushes three chunk cards and
two voice notes regardless of `only`, then shuffles and truncates to the requested
size. A node asks for 10 from slices that sum to 14, so **four cards are discarded at
random**. (The daily path is safe: its slices sum to exactly 14 whatever happens.)

**4. Node practice never generates.** `campStartPractise` calls `learnBuild` and
returns. `learnTopUp` is global, is gated on `unseen >= BANK_MIN_UNSEEN`, and builds
its vocabulary from `readyWords` — which excludes the weak words by construction. It
could not write the needed sentence even if asked.

## What is being built

### The one-new-word rule

A bank item may carry **one** not-ready word when the session explicitly allows it,
and only if every other content word is `strong` — not merely ready. Carrying a weak
word is fair only when the scaffolding is solid; anything looser recreates the
impossible-card problem.

`bankServable(it, lib, srs, carry)` gains a fourth argument. Absent it, behaviour is
byte-for-byte what it is today.

Generated items record `for` — the word they were written to rescue.

### A node builder, not a node branch

`campBuild` replaces `learnBuild({only})` for node sessions. It shares every
*judgement* — `wordReady`, `srsApply`, `bankServable`, the level rubric, the card
renderer, the grading — and forks only the *menu*. Precedent: `campStartMeet` already
builds its own card list, and the conversation shape returns from `learnBuild` before
any of its logic runs.

Ten cards, built in priority order with no shuffle-and-trim:

| Cards | What |
|---|---|
| ~5 | sentences carrying a weak node word |
| ~2 | sentences using node words already held |
| ~2 | solo cards for the weak words |
| 1 | reply, if one is available |

Targets sort **weakest first** — the inverse of `learnTargets`, deliberately. That
inversion is a documented disaster globally ("its just looping those old words now,
the hard ones") and correct here, because the pool is six words and fixing exactly
those is the node's whole job.

No chunk cards. A voice note only if it genuinely uses a node word, and at most one.

### Planner, builder, evaluator

Fired on every node session. New material every time.

- **Planner** (Lite) — node, weak words, strongest vocabulary, level in; ~10 *briefs*
  out. No Hebrew: "one item for היום, level 3, making a plan". This is the variety
  device, and variety is the original complaint.
- **Builder** (Flash, falling back to Lite) — Hebrew and per-word glosses per brief.
  The target word must appear; every other content word must come from the strong
  list.
- **Evaluator** (Lite) — the existing `learnReviewItems`, extended to reject items
  where the target word is not doing real work. Vocabulary containment is checked in
  code: cheaper and exact.

Scaffolding is **computed, not authored** — the strongest N words at generation time,
rather than backfilling `carry` into fourteen nodes by hand. Self-maintaining.

Pre-warms when the node sheet opens, so Practise starts instantly. Blocks only when a
node has genuinely nothing for its weak words.

Cost: one Flash call (pool 20) and two Lite (pool 500, currently using about one).

### Shared fixes, landing in daily practice too

- **Sentences 4 to 8 per session.** shadow 2>1, word 3>2, chunk 3>2, note 2>1 and
  only when it uses a held word. Doubles the core exercise and doubles the evidence
  `levelRecord` runs on.
- **Function rotation restored.** `learnNextFunction` currently returns the live
  node's situation *instead of* rotating `LEARN_FUNCTIONS`, so every batch during a
  chapter shares one brief. It will do both: node as setting, rotating function as
  job.
- **Generation triggers on need.** "Is there material for what I am weak at" replaces
  "is the cupboard bare".
- **Frame guard windowed.** `bankFrameFull` checks every sentence ever banked and
  tightens as the bank grows. Scoped to recent material.
- **Coverage beats level.** Fill the level quota from target-hitting items first.

### On screen

A carried-word card says `New in this one: היום`. Per-word commit already lets that
one word be marked missed while the rest bank clean, which is the right outcome and
needs no SRS special-casing.

## Risks accepted

- **Two builders drifting.** Guarded by sharing every judgement and forking only the
  menu.
- **Carried sentences too hard.** Guarded by the strong-scaffold rule and by capping
  carried items at about half the session.
- **Aggressive generation banking mediocrity.** Guarded by existing retirement and by
  an evaluator told that returning fewer is a success.
