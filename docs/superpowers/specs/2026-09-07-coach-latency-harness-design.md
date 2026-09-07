# Measuring what the coach turn actually spends — a latency harness

## Where this came from

George, mid-flag, at the end of a coach lesson on 2026-09-07 (`lEnd`, node
`c2-0-1qt5` "Family & home"):

> "Okay so on that lesson the loading times were like 9+s for each call. That
> ain't it. Maybe we should switch the models used to flashlite for the first
> call to get a quick response then the evaluation is with rh stronger model?"

And, when asked what to optimise for:

> "Measure first, decide after."

And on scope:

> "Run the split arm, but only on flashlite. Ive somehow used 13 or 20 for flash
> on this API key. do a test real time using it but jsut bear that in mind when
> testing. Also where yo ucan try to replicate the exact conversation I did
> before when I sent the flag."

And on the fixtures:

> "make sure these are accurate conversation to what I would have with errors
> sprincled in you know."

## What the flag already settles

The proposal in the flag describes an architecture that already exists, arranged
the other way round.

- `composeTurn` ([`hebrew-reader.html:21940`]) is the **only** call on the
  critical path, and it runs `aiModelsFor("coach")` — Flash, degrading to Lite
  when the strong pool is spent.
- `composeAudit` (Flash Lite) already fires **after** `composeAdvance` renders
  the card, and is deliberately not awaited (`hebrew-reader.html:26671`). It
  costs him no waiting at all.

So "lite first, strong evaluation behind it" is the shape that ships today, with
the tiers the other way up. Inverting them would put Flash Lite on the line he
reads and hears aloud — which is what it was before 2026-09-03, and is what
"the coach speaks gibberish sometimes" described.

The flag's own AI log, however, contains the real evidence:

| label | model | ms |
|---|---|---|
| Checking what the coach said | flash-lite | 434 |
| Reading your sentence | **flash** | **4506** |
| Checking what the coach said | flash-lite | 678 |

`ms` is wall-clock across the whole model walk and the entry is `ok: true` with
`model: gemini-flash-latest`, so no fallback ran. 4.5s is what Flash cost for
that one prompt.

## The hypothesis worth testing

Gemini's latency scales with **output** tokens far more than input. The turn asks
for one JSON object with ten fields, and the response to the flagged turn was:

```json
{"lvl":3,"ok":"clean","bad":[],"fix":"","why":"",
 "best":{"he":"כן, השולחן יותר נוח מהמיטה.",
         "tr":"Ken, ha-shulchan yoter no'ach me-ha-mita.",
         "en":"Yes, the table is more comfortable than the bed."},
 "say":{"he":"אז תישן טוב על השולחן! ...
```

Two things follow.

**`best` was generated and rendered nowhere.** `learnRenderCard` only prints it
when `normHe(best.he) === normHe(out.fix)` (`hebrew-reader.html:26565`), and
`fix` was empty because the turn was clean. That block is roughly 30% of the
payload, and clean turns are most turns.

**`say.he` is generated sixth.** The eight tokens he is actually waiting to hear
come out after `lvl`, `ok`, `bad`, `fix`, `why` and all of `best`.

If that is where the time goes, the fix is neither the model tier nor the split —
it is what the model is asked to emit, in what order, and whether we wait for all
of it. That is a claim about milliseconds, so it gets measured rather than
argued. Precedent: `tools/writer-bakeoff.html`, built for exactly this reason
after George said "we might need to do a ttest ... give it to me as a test and
ill run it htrouh the api to give you some real data".

## What this spec covers

`tools/coach-latency.html` — a standalone measuring instrument. It changes
nothing in `hebrew-reader.html`. The fix ships separately, once the numbers pick
one.

Same rules as the bake-off: keys are typed into the page, used from the browser,
and never stored — no localStorage, no network except Google's own endpoint.
Close the tab and they are gone.

## The fixtures

Five turns, all at level 3 in node `c2-0-1qt5` (`חדר, דלת, שולחן, מיטה, דירה`
+ carry `בוקר, שומע, דקות`), built from what the log and `hvr_coachlanded` show
he actually did. Errors are the ones he actually makes, not clean textbook input.

**F1 — opening turn, agreement error.** No coach line to answer, no history.
`יש לי חדר גדול ודלת קטן` — `דלת` is feminine, so `קטן` should be `קטנה`.
Exercises `ok: "minor"`, `fix`, `why`, and `best` on the one kind of turn where
`best` is actually rendered.

**F2 — mid-session, clean, history present.** `אני שומע את הדלת בבוקר`. Uses two
carry words, answers a coach question, and carries two turns of history so the
prompt is at its realistic mid-session size.

**F3 — homophone mistranscription, runners-up present.** Transcript reads
`אני רוצה לישון במידה` where he said `במיטה`; `alts` carries the correct reading.
This is the rescue path CLAUDE.md records costing him three minutes on `אטי` /
`איתי`. The coach must not fault him and must answer the sentence he really said.

**F4 — the `unsure` branch.** Transcript `אני שם את הבגדים בארוחה` where he was
reaching for `ארון` (wardrobe), a word he does not have. `aron` and `aruḥa` sound
nothing alike, so this is the NO branch: the coach must say it did not follow
rather than answer a sentence he never said. This is the fixture that decides
whether a split call can keep the behaviour.

**F5 — the flagged turn itself.** `כן השולחן יותר נוח מהמיטה`, `lastTurn: true`,
`listDone: true`, with the real session history behind it — he described his
room, said he wanted to sleep on the table, then agreed the table was more
comfortable than the bed. **This fixture has a known real measurement — 4,506 ms
on Flash — so it is the calibration point for every arm.**

The prompt builder is lifted from `composePrompt` verbatim. If it drifts from the
app, the harness is measuring something else.

## The arms

| | arm | model | what it isolates |
|---|---|---|---|
| A | Baseline — current prompt, current schema | Flash | the number in the flag, reproduced |
| A′ | Same workload, cheaper tier | Lite | the tier delta, nothing else |
| B | `best` removed from the schema | Lite | the cost of a field rendered nowhere |
| C | `say` declared first | Lite | whether order alone moves total time |
| D | Streaming (`streamGenerateContent`) | Lite + one Flash | **time until `say.he` is complete** |
| E | Split: reply ‖ judgment, two keys, `unsure` rule kept in the reply | Lite | wall clock as `max`, not `sum` |
| E′ | Same split, `unsure` rule dropped | Lite | what that rule costs in tokens and ms |

D is the arm expected to decide this. If `say` comes first and the response is
streamed, `say.he` can be complete long before the rest of the JSON, with no tier
change, no split, and no behaviour lost.

## Quota discipline

This is a constraint, not a footnote. George is at **13 of 20 Flash** on the key
he will run this with, and CLAUDE.md is explicit that **per-minute is the limit
that actually bites** — Flash is 5/min, Lite 15/min.

- **Flash appears in two arms only, A (3 reps) and D (1 rep): four calls total.**
  Both sit behind an explicit opt-in with a live counter, so he can run the whole
  Lite sweep for free and spend Flash only when he chooses.
- **Every request is issued sequentially behind a throttle**, default 4s apart
  (≈15/min), with a visible countdown. The exception is arm E, whose two calls
  fire simultaneously by design — that is the arm — and which therefore wants the
  second key.
- **Key 2 is optional.** Without it, E still runs both calls in parallel on one
  key; the page says plainly that the result understates the two-key case and
  risks the per-minute limit.

## Measured per rep

TTFB, time-to-first-token (streaming arms), **time until `say.he` is complete**,
total wall clock, output characters, and the parsed JSON itself.

The JSON is shown, not just timed. A cheap arm that returns faster by returning
worse Hebrew has not won anything, and the bake-off's lesson was that an
instrument which cannot see quality will happily report a tie.

## A device panel

Part of the 9 seconds is not the API. `speechSynthesis` spin-up on the Hebrew
voice is measurable from a standalone page, so the harness times `speak()` →
`onstart` on his Pixel and reports it alongside.

## Deferred, with reasons

- **ASR finalise time is not measured here.** How long the recogniser takes to
  settle after he stops talking is real, and part of his 9s, but it cannot be
  measured from a standalone page — it needs the live app instrumented. Separate
  change.
- **The "Send to the coach" confirm tap is not measured.** It is a deliberate
  mitigation for mistranscription (`hebrew-reader.html:26496`), and it is human
  time, not machine time. Whether it stays is a product question, not a
  measurement one.
- **No quality judging in the harness.** If an arm wins on speed, its Hebrew goes
  to a native speaker — the same route the bake-off used.
- **The transliteration scheme is not fixed here.** The flagged turn returned
  `ha-shulchan` / `no'ach` / `me-ha-mita`, which violates CLAUDE.md's scheme
  (`kh` not `ch`, article joined, no hyphen — `hashulkhan`, `no'akh`,
  `mehamita`). `composePrompt` never states the scheme at all, so the coach has
  been teaching a second spelling for the same sound to the one person who reads
  the transliteration to speak from. This is a real bug and it is adjacent — the
  schema is being rewritten anyway — but it is a correctness fix, not a latency
  one, and folding it in would make the measurement harder to read. Flagged to
  George; his call whether it rides along.
- **No change to `hebrew-reader.html`.** Deliberately. The instrument ships
  first, alone, so that whatever it recommends is argued from its numbers.
