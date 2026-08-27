# The generator is told it has 241 words. It has 915.

**Date:** 2026-08-26
**Scope:** `libKeyFor` and everything built on it (`bankUses`, `bankUnknowns`,
`commissionAcceptable`, the servable gate), and the sentence-writing prompt.
Blocks `2026-08-26-node-targeting-and-debt-design.md`, whose Phase 1 assumes
generation works.

## Where this came from

George, on the sentence pipeline:

> "Why not, instead of giving hte initial prompt any constraints at all jsut give it the
> words we want the sentence made from ... This way we arent overloading hte prompt with
> loads of information, we are giving it an idea, its giving up content, we are then
> filtering the content output."

The idea was to loosen the prompt. Testing it against his real library with his own key
found something neither of us was looking for: the prompt was not the problem, and the
filter had been quietly rejecting correct Hebrew all along.

## What the measurements said

Four runs, on his live library.

| run | returned | past filter | reviewer kept |
|---|---|---|---|
| constrained, target forced into every sentence | 12 | 1 | — |
| unconstrained vocabulary | 12 | 1 | — |
| constrained + overgenerate 30 | 30 | 22 | — |
| all three above, reviewed together | — | 24 | **2** |
| inflection allowed + targets not forced | 30 | 13 today / **18 form-aware** | **14** |

**The filter is blind to Hebrew inflection.** His library holds 989 verified inflected
forms across 197 of its 241 words; `FORM_INDEX` already maps every one back to its
lemma. **674 of those forms cannot be resolved by `libKeyFor`**, which is what
`commissionAcceptable`, `bankUses`, `bankUnknowns` and the servable gate all call.

```
קטנה→קטן   קטנים→קטן   קטנות→קטן   גבוהה→גבוה   קרים→קר   נמוכות→נמוך
```

Hebrew agrees for gender and number on nearly every adjective and verb. So the pipeline
demanded natural Hebrew written **only in uninflected base forms** — not a hard
constraint but an impossible one, and it forced exactly two failure modes:

- Comply, and write ungrammatical Hebrew. Run three's survivors included `התחלה גדול`
  and `התחלה אדום` — masculine adjectives on a feminine noun. They are wrong *because*
  `גדולה` was forbidden. The reviewer then rejected them, correctly, and the prompt got
  the blame.
- Write real Hebrew, and be binned. Run two passed nothing.

**Forcing a target word into every sentence is the second fault.** `התחלה` produced
"beginning was red" when mandatory and `הכל בסדר בהתחלה` — "everything is okay at the
beginning" — when merely permitted.

A regression to own: `bankUnknowns`, shipped this morning, also calls `libKeyFor`. The
daily top-up path reaches `learnIngest` **without** running `commissionAcceptable`
first, so since this morning every daily sentence containing an inflected form has been
dropped at ingest. The same one-line fix repairs it.

## Phase 1 — Teach the filter what the app already knows

`libKeyFor` consults `FORM_INDEX` after its own lookups and before giving up: exact
match, prefix-stripped match, then form lookup, then prefix-stripped form lookup. It
returns the **lemma**, so everything downstream keeps working in lemmas — `uses` still
lists the word he is practising, `srsApply` still schedules one record per word, and a
sentence using `קטנה` correctly credits `קטן`.

Measured effect on a real batch: 13 of 30 accepted becomes 18 of 30, on identical items.

`FORM_INDEX` is rebuilt whenever the library changes and is empty before the first
build, so the lookup must degrade to today's behaviour rather than throwing when it is
not yet populated.

This is deliberately **not** a loosening of the gate. A form of a known word is a known
word; the gate was rejecting it by omission, not by design.

## Phase 2 — Stop asking for impossible Hebrew

Two prompt changes, both measured above:

- Say inflection is allowed — vary for gender, number and tense — while keeping "no new
  vocabulary". Without this the model keeps writing base-form-only Hebrew even once the
  filter would accept better, because it is still being told to.
- Ask that only about a third of a batch carry a target word, and that a target is used
  only where it fits. A natural sentence without the word beats an odd one with it.

`commissionAcceptable`'s `it.for` check must stop being mandatory per item, or items
deliberately written without a target are rejected for not carrying one.

Drop `LEVEL_RUBRIC` from `sentenceWrite`. It is sent twice across the pipeline and the
writer's attempt at a level is overwritten by the reviewer's grade, which is what gets
stored. Ten lines of prompt whose output is discarded.

## Phase 3 — Overgenerate

Raise the batch size and let both filters work. The budget is not the constraint:
`AI_POOL_CAPS.fast` is 500 a day against a handful in use, and a rejected batch costs
three lite calls while a bad card costs a session. Thirty candidates produced fourteen
usable sentences in one call.

## Deferred, with reasons

- **Removing the reviewer.** Considered by George and firmly rejected on evidence: the
  local filter passed 22 sentences the reviewer then killed, including "grandpa eats
  milk in opposites". The filter checks vocabulary; only the reviewer judges whether an
  Israeli would say it, and loosening the writer makes that job more important, not less.
- **Dropping the vocabulary list entirely.** Run two: 1 of 12 usable. His library covers
  72% of tokens in real messages, so unconstrained output is mostly unreadable to him.
- **Giving the prompt automaticity or word-class information.** The signal is not
  trustworthy yet — 68 of 79 "strong" words are hand-declared at identical values, so
  stability currently ranks bug-inflated leftovers above genuinely solid words. Revisit
  once response latency has accumulated.
- **Retiring target words that never yield.** Real, and probably wanted, but this spec
  already removes the forcing that made them fail. Judge it again with the forcing gone.

## Verification

`hebrew-reader.html?selftest` — 442 passing before this work.

Phase 1 needs `libKeyFor` tested on an inflected form resolving to its lemma, on a
prefixed inflected form, and on an unknown word still returning null — plus a test that
it degrades safely when `FORM_INDEX` is empty. Phase 2's prompt changes cannot be unit
tested and must be checked against a real call, comparing reviewer keep-rate against the
14-of-18 measured here.
