# Retrievability, honest grading, and the fluency strand

A deep-research review of the app against the spaced-repetition, vocabulary and ASR
literature produced a ranked list of recommendations. Most of the structural ones
describe work this app has already done. Five things in it are real, and this is the
design for those five.

## What the review got wrong, recorded so it isn't re-litigated

The document is credible — every constant it quotes matches the source, so it plainly
read the code. Four of its recommendations are already built, and two of its structural
criticisms are false. Writing that down here because the same review will be run again
one day and should start from the answer.

- **"Generalise `bankServable` into a coverage budget"** — that *is* the `carry` rule.
  It permits exactly one not-ready content word and requires every other one to be
  `strong`, which is stricter and better reasoned than the ≤1-non-ready rule proposed.
- **"Build a generate-then-validate pipeline"** — plan → draft → native-speaker review
  that rejects unnatural items and grades them 1–5, plus `bankNearDuplicate`,
  `bankFrameFull` and the servable gate. The one genuine hole is Token Miss Rate, which
  is Phase 3 below.
- **"Add a learning phase before spacing"** — the soft-launch word card and the
  first-meeting exemption in `srsApply`.
- **"The app only schedules single words"** — its headline critique, and wrong. Chunks
  are first-class: their own SRS key (the whole phrase), their own card kind, and that
  card deliberately refuses to break into per-word chips because assembling word by word
  is the habit chunking replaces. The narrower true version is Phase 4.
- **"Grading takes ASR as ground truth"** — it does not. The recogniser pre-fills marks
  and every one is a tap from being corrected. Silence is not a wrong answer. The
  "contest a grade" affordance called UX-critical is already the primary interaction.
  What is true is narrower and is Phase 2.
- **"The level system does not share a scale with item difficulty"** — false.
  `levelRecord` scores his pass rate against each item's own `lvl`, from the same
  five-band rubric the reviewer applies. It is already a crude IRT. Elo would refine it,
  not repair it, and is deferred.

Two small factual slips: a forgiven miss costs 40% of stability, not 50%; and
`SRS_STEPS` is a dead migration constant, not the live ladder.

---

## Phase 1 — Retrievability, and the log that checks it

### The problem

`last` is written on every answer and read for exactly one purpose: a boolean asking
whether this is the same day. The scheduler has never asked how much time has passed.
So a word answered forty days late earns the same stability bump as one answered on its
due date, the same-day guard needs a special case *and* an escape hatch to undo its own
side effects, and there is no quantity anywhere in the app that can be checked against
what actually happened.

### The change

```
t    = days between `last` and today
R    = 0.9 ^ (t / stab)
mult = min(3.5, 1 + 16·(1 − R)·(1 − (diff − 1)·0.075))
```

`R` is the probability he still has the word. The exponential form rather than FSRS's
power form because it is one line and `R(stab) = 0.9` exactly — which is the property
that makes this a retrofit rather than a migration.

**This is provably identical to the current ladder for a word answered on its due
date, at every difficulty.** At `R = 0.9` the multiplier reduces to
`1 + 1.6·(1 − (diff−1)·0.075)`, which equals `2.6 − (diff−1)·0.12` term for term:
2.6 at diff 1, 2.12 at diff 5, 1.52 at diff 10. It is not a new curve. It is the same
curve with lateness added as an axis it never had.

Because `due = last + stab` and `R(stab) = 0.9`, every existing record's due date is
reproduced unchanged. Nothing is rescheduled behind him. There is no migration.

### What falls out rather than being coded

- **A same-day repeat gives `t = 0`, `R = 1`, multiplier exactly 1.** Stability cannot
  compound. The `repeat` guard and the escape hatch that undoes its side effect both
  delete: `due` is now written unconditionally on any non-miss answer, because
  stability did not move so due cannot move backwards.
- **The cap is one legible constant.** Uncapped, a word answered three times overdue
  jumps 4×, and one answered after a long absence 5.5×. `3.5` states the ceiling where
  it can be read and tested rather than leaving it emergent.

### Difficulty weighted by R

A miss at high retrievability means he should have known it; a miss at low
retrievability is ordinary forgetting. The miss term becomes `1.1·(R/0.9)`, normalised
so that — again — an on-time miss is exactly unchanged. Clamped to `[0, 1.25]`.

Only the miss term. Errors are the diagnostic signal; making the clean answer's −0.6
R-dependent as well would be inventing a mechanism the literature does not claim.

### What is deliberately not changed

The lapse branch (×0.3, shrink never zero), the one-shot forgiveness at streak ≥ 3, the
back-off on repeated lapses capped at 7 days, the ±15% fuzz, the 365-day cap, the
decaying miss count, and the first-meeting exemption. The review is right that all of
them are sound. Forgiveness is better *reframed* — post-lapse stability as a function of
prior stability — than replaced, and it already is that.

`grade === 1` ("nearly") keeps its ×0.9 penalty, applied only when `t > 0`. Nearly is
not a success, so there is no gain for (1 − R) to scale; the guard survives here alone,
now expressed in elapsed days like everything else rather than as a date comparison.

### The log

A ring buffer of the last 2,000 attempts: timestamp, key, side, grade, the R that was
predicted, stability and difficulty before the answer, and card kind. Roughly 240KB.

This is the review's real prerequisite and Phase 1 is where it becomes possible, because
R is the first quantity this app has ever predicted that can be wrong. It pays for
itself immediately rather than only enabling future work: a Brier score and a
reliability table in the stats panel say whether the scheduler is lying.

Phases 2 and 3 add fields to the same record rather than growing a second store.

---

## Phase 2 — The signals already captured and thrown away

`micListen` returns `confidence`. Nothing reads it. `maxAlternatives` is 1, so there is
no n-best to check a missed word against. Both are cheap, and both reduce the failure
that actually hurts: not a wrong mark, but a wrong mark he does not notice and taps past.

### Three layers, cheapest first

1. **n-best.** `maxAlternatives = 5`. A word about to be marked `missed` that appears in
   any alternative is downgraded to `near` instead.
2. **Confidence floor.** Below ~0.55 (and above 0, since some browsers return 0 for
   "no opinion"), nothing is pre-filled as missed at all. The card says the mic was not
   sure. This is the app talking, so interface register, and it is transient rather than
   standing instruction.
3. **Adjudication.** When the local alignment still says a word was missed, one
   Flash-Lite call gets the target, the transcript, and the alternatives, and rules on
   whether he actually said it — allowing for the recogniser's known weakness on
   non-native Hebrew. This is the LLM post-correction the review cites, and it is
   strictly better than n-best because it knows what the word was supposed to be.

   **It must never block the card.** The reveal happens immediately from the local
   alignment; the call runs concurrently; if it returns before he commits, the marks
   correct themselves visibly. If he has already committed, the result is dropped.
   Budget is not a constraint — `AI_POOL_CAPS.fast` is 500 a day against about one
   being used, and a session with five imperfect cards spends five.

### Latency

Same code path, so the same change. Time from card shown to grade pressed, kept as a
decaying average on the record (`ms`) and raw in the log. Not used for grading — the
review is explicit that response time is a validated proficiency signal, not a validated
*grading* signal, and this app has no data of its own yet to say otherwise. It is a
fluency metric, and it is what Phase 5 draws.

---

## Phase 3 — Close the out-of-vocabulary hole

`bankUses` keeps only tokens that resolve to a library key. Every other Hebrew token is
**silently dropped**. So `bankContentWords` never sees a word he has never met,
`bankServable` cannot count it, and a generated sentence containing one passes the gate
as fully within reach. The one-new-word rule is enforced against words the app knows
about and blind to the ones it does not.

`bankUnknowns(he, lib)` returns the Hebrew tokens that resolve to nothing, STOPLIST
excluded. Any item carrying one is rejected at ingest, and the rejection rate is
counted — which is Token Miss Rate, measured locally, with no extra call. Words the
model *deliberately* introduces keep their existing road through `newWords` → Pending;
this closes the undeclared case only.

Strict rather than budgeted, because the gate's whole character is "absolute except for
the one explicitly permitted carry", and an undeclared unknown is by definition not
permitted. Rejections are cheap to replace.

---

## Phase 4 — Chunks from his own material

The chunk inventory is a fixed table of about sixty phrases that never grows. The review
is wrong that the app cannot schedule chunks and right that the chunks worth having are
not a fixed table — they are the ones his grandfather actually says.

The transcription call already returns transcript, translation and per-word gloss in one
request. It gains a `chunks` field: the formulaic multi-word expressions in the note.
Those bank into a store `learnChunkTargets` reads alongside `PHRASES`, so everything
downstream — scheduling, the card, grading — is unchanged.

A one-off backfill pass over the notes already stored seeds the store immediately rather
than waiting for the next note to arrive. Notes arrive a few times a month; without the
backfill this phase does nothing for weeks.

---

## Phase 5 — The closing speed pass

Nation's fourth strand — fluency development, known material only, speed-focused — is
the one genuinely absent thing in the review's pedagogy section.

After the last card, up to four things answered clean *this session* come back for a
timed re-say. No reveal, no hints, no SRS write. Latency recorded, and shown: the point
is watching the same sentence get faster.

It reuses the card machinery whole rather than adding a mode. The two shapes deleted in
August were deleted for being modes nobody picked, and a fluency strand that has to be
chosen is a fluency strand that never runs.

World register per the style guide: serif, gold for a faster second time, no emoji.

---

## Deferred, with reasons

- **Elo joint ability/difficulty.** Refines a level system that already shares a scale
  with item difficulty. Worth doing after the Phase 1 log has run long enough to
  calibrate against.
- **Coupling prod and recv through a shared `diff`.** Real, and the review's argument is
  sound. It changes two schedules at once, which is not a thing to do in the same pass
  that changes the scheduler.
- **Hierarchical Bayesian fitting.** Needs the log, and needs it to have run.

## Verification

`hebrew-reader.html?selftest` — 386 passing at the start of this work.

Phase 1 must add tests asserting the on-time equivalence directly: for each of diff 1,
5 and 10, a record answered exactly on its due date lands on the same stability the old
ladder gave. That equivalence is the entire safety argument for the change and it should
be a test rather than a paragraph.
