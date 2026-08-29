# The writer was throttled onto the weakest model and handed an impossible job

## Where this came from

The instrumentation shipped hours earlier (see
`2026-08-29-stale-uses-and-silent-commissions-design.md`) did its job on the first try.
George, having confirmed the other half of that work landed:

> So htere was a new sentence in hte node thats fo sure so that block was fixed. though
> htere was a nerror in hte API building. I set aflag so you can see the ap state when I
> flagged it, it said hte writer returned no items. Is it possible we are putting requests
> in too fast, like should we pause before resending? jsut an idea see what you think here

## What the flag actually carried

One log entry, and every part of it matters:

```
Writing practice sentences for your home, the rooms in it, who lives there
  ok: true    model: gemini-flash-lite-latest    ms: 46193
  REQ: 24 briefs sent          RES: {"items":[]}
→ banked nothing — the writer returned no items
```

**It succeeded.** No 429, no timeout, no throw — a well-formed reply containing an empty
array. That rules out the simplest reading of George's hypothesis: a rate-limited call
throws, is swallowed by `campWarm`'s `.catch(() => 0)`, and would have produced no log
line at all. What killed this batch was a model that answered and declined.

But his instinct is right one layer up, and the evidence is the model name.

### Fault one: the background writers never got the pacing that already exists

`geminiSend` can already sit out a per-minute 429 rather than move on — `opts.waitOnRateLimit`.
It is off by default for a stated reason:

> waiting is right for the background form queue (no latency budget to protect) and wrong
> for anything George is sitting in front of

Grepped across the file, **exactly one caller passes it**: `formsAsk`. Its own comment
calls itself "the ONE caller that should sit out a per-minute 429" — true when written,
because the forms queue was then the only background queue. It no longer is.
`sentencePlan`, `sentenceWrite` and `learnReviewItems` are reached from `campWarm` and
`learnTopUp(quiet)`, both explicitly fire-and-forget with no one waiting. They match the
comment's own test exactly and were simply never given the flag.

So a commission fires plan → write → review back to back into `gemini-flash`'s 5/min
limit. The second or third call is throttled, and because waiting is off, a *per-minute*
throttle is treated as a reason to give up on the model — demoting the heaviest call in
the app to `gemini-flash-lite`. That is the `model:` field above. This is George's
"should we pause before resending", and the answer is yes.

### Fault two: 24 fully-glossed items in one call, with permission to return none

`PLAN_ITEMS = 24`, raised from 10 deliberately ("overgeneration is the right trade at one
learner"). That reasoning holds for the PLAN — briefs are one line each. It was never
re-examined for the WRITE, where each item carries `he`, `tr`, `en`, `for`, and a gloss
entry per word. Twenty-four of those is a very large structured document, and `ms: 46193`
is within a second of `GEN_TIMEOUT_MS` (45s). It barely returned at all.

And the prompt licenses the outcome:

> RETURN FEWER IF A BRIEF CANNOT BE DONE WELL. Skipping a brief is a success; padding it
> with something awkward is a failure.

That instruction is right and measured — it exists because forcing a stuck word into
every sentence produced "grandpa eats milk in opposites". But it has **no floor**. For a
weak model facing 24 briefs and a hard vocabulary gate, returning nothing is a locally
reasonable reading of it. Worse, because the write is one call, an empty answer loses the
whole commission — plan included. There is no partial credit anywhere in the path.

## The fix

**1. Pace the background writers.** Pass `waitOnRateLimit: true` from `sentencePlan`,
`sentenceWrite` and `learnReviewItems`. Nothing is waiting on these; a few seconds of
sleep to keep `gemini-flash` is strictly better than an instant demotion to flash-lite.
The interactive callers are untouched and keep failing fast, which is what the existing
comment protects.

**2. Write in chunks of 8.** Keep planning 24 — the overgeneration argument is sound and
unchanged. Split the writing across three calls of `WRITE_CHUNK = 8`, each well inside the
timeout. Results concatenate. The real win is not size but independence: one empty chunk
now costs a third of a batch instead of all of it. Two extra calls against a 500/day pool
running at a fraction of capacity, and George's standing instruction is to spend it —
"remember we have 500 API calls so burning some ... is worth it."

Chunks run **sequentially, not in parallel** — the same reasoning `audioFarmRun` recorded
before it was deleted, and the reason fault one exists: three concurrent writes would put
three requests into a 5/min window instantly and re-create the throttle this is fixing.

**3. Give the writer a floor.** Keep "skipping a brief is a success"; add that returning
nothing at all is a failure, and that if most briefs are hard it should write the ones it
can. Targets the observed `{"items":[]}` directly.

## Testing

The chunker is the part with arithmetic, so it gets the test: `sentenceWriteChunks(briefs, n)`
splits 24 into 3×8, handles a remainder (10 → 8 + 2), never loses or duplicates a brief,
and preserves order — because `sentenceWrite` maps results back to briefs **by `it.i`**,
and a chunk's indices must stay meaningful against the original list or every item is
re-labelled with the wrong brief. Pure, plain arrays.

Verification: suite green, duplicate-function grep clean. The live proof is a real
commission — which needs George, since the API key is not in synced data. The AI log will
show three `Writing practice sentences` entries on `gemini-flash-latest` rather than one
on flash-lite.

## Deferred, with reasons

- **Retrying an empty chunk.** Once chunks are independent, a retry is cheap and obvious —
  but it should be built on evidence that empty chunks still happen after this, not
  guessed at now. The instrumentation will say.
- **Preloading 2-3 lessons ahead.** Still George's actual request, and still waiting on
  generation being reliable first. Closer after this.
- **Whether the ASR-verification pass earns its call.** Untouched, separate flag,
  answerable offline from `hvr_srslog`.
