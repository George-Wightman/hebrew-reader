# Two judgements the app never checked

## Where this came from

Two standing questions of George's, both about machinery that makes a call a hundred times
a day and keeps no record of whether it was any good.

The first, raised on 2026-08-29 and never answered:

> I would also like you to review how useful having every audio clip reviewed by the API
> is. I feel the voice recognition on my phone is pretty accurate. Run a test for if that's
> even been useful

It was deferred once already, in
`2026-08-30-overloaded-model-and-unsynced-flag-design.md`, with the right reason:

> **Whether `learnAdjudicate` earns its calls.** Five adjudications across the two flags all
> returned `{"said":[]}`. That is George's standing question from the 28h flag and deserves
> a real count over the log rather than being folded into an unrelated fix.

The second is the half of 2026-08-31's flag that `a-session-that-says-what-it-did` reported
but did not fix:

> Feels like this is a bug/ the way we have built it with the R- or whatever punished me
> for sitting down and having a go ... maybe the first time of the day get s bonus,
> straight after is less and third time is less still, but nothing on second try?

## What the measurement showed

### The scheduler is overconfident, and it has been saying so on screen

`srsCalibration` was run over his 241 gradeable answers. Brier **0.175**, against 0.25 for
a coin flip:

| R the app predicted | it claimed | he actually got | n |
|---|---|---|---|
| `R = 1.0` (same-day repeat) | **100%** | **85%** | 172 |
| `0.95 – 0.999` | 99% | 85% | 40 |
| `< 0.95` | 86% | 52% | 29 |

`learnRenderCalib` already draws this, in the stats room, and has since the retrievability
work. Its own comment says *"this is the only place in the app that ever checks whether
that was true"* — and nothing had ever read it.

The `R = 1.0` row is the one that matters, and it is the largest. `srsApply`'s F1 comment
justifies zero same-day gain on the grounds that *"succeeding twice in one sitting is not
new evidence that a word has stuck — it is the same evidence, read twice."* **The data
refuses that.** He misses 15% of them. A same-day answer is genuinely informative, and the
model was treating it as certain while measuring 85%.

His own suggested ladder is closer to his measured behaviour than the shipped model is.

### The root of it is one unit

`srsDaysSince` returns **whole days**. Every answer inside one day is `t = 0`, so
`R = 0.9^0 = 1`, so `srsGain` returns exactly 1 and stability is multiplied by one. The
scheduler cannot tell twenty minutes from nine hours, so it treats both as the same event
and claims certainty about both.

That single unit produces all of it: the ratchet he felt, the 100%-vs-85% overconfidence,
and the flat evening sessions.

### The ASR call has three ways to be useless and they look identical

`learnAdjudicate` fires roughly once per imperfect spoken card. It can fail to earn itself
by declining (`{"said":[]}`, which is 5 of 5 observed), by **arriving stale** — it races his
own reveal, and `learnSession.i !== askedAt` discards the whole result — or by erroring.

Nothing records which. The stale case is entirely invisible and could be the dominant one,
which would mean the call is *correct* and simply always too late. That is a different
problem with a different fix, and no amount of reasoning separates them.

Relatedly, the recogniser's own confidence is not a usable signal: over 293 spoken answers,
`cf >= 0.9` was 52% clean and `cf < 0.9` was **57%** clean. It also never exceeds 0.91.
Low confidence does not predict a wrong answer.

`hvr_ailog` is in `SYNC_LOCAL_SET()` — device-local by design, and correctly so — so this
cannot be counted from the sync blob as things stand.

## Phase 1 — record whether the second opinion earns its call

Daily buckets in a synced store, the pattern `hvr_stats` already uses and for the same
reason: a few KB a year rather than an event log needing pruning later. Per day: calls,
words asked about, words actually rescued, results dropped as stale, and errors.

Written where the outcome is actually known — inside `learnAdjudicate`, on every exit path,
including the early returns that currently vanish silently.

Surfaced beside the calibration bars, because "is this machinery any good" already has a
home and a second one would be a second answer to one question.

This ships an instrument, not a verdict. A week of real use answers it, and unlike the AI
log it will reach me.

## Phase 2 — R measures the gap it actually had

`lastAt`, a timestamp, written alongside `last` and preferred by `srsR` when present.
Absent — every record on disk today — falls back to `last` and behaves exactly as it does
now. Migration-free, the same retrofit the original R work used, and for the same reason:
nothing already scheduled may move behind him.

At `stab = 1`, `diff = 5`:

| gap | R | gain | |
|---|---|---|---|
| 20 minutes | 0.999 | ×1.01 | cramming still earns nothing worth having |
| 9 hours | 0.961 | ×1.44 | his 2026-08-30 evening session, which earned zero |
| 1 day | 0.900 | ×2.12 | **the old ladder exactly — nothing reschedules** |

The ladder he asked for, derived from elapsed time rather than invented as steps. It is
self-limiting: as `stab` grows, `t/stab` shrinks and same-day gain returns toward 1, so no
new cramming cap is needed beyond `SRS_GAIN_MAX`.

It also subsumes the miss damping deferred yesterday. `missWeight` is `R/0.9`, so a miss
twenty minutes after a correct answer stops being charged at full weight, without a
special case for it.

## Testing

- `srsR` prefers `lastAt` and falls back to `last`, and a record with only `last` scores
  exactly what it scores today.
- A same-day repeat earns a gain strictly above 1 and strictly below the one-day gain.
- An answer one day later at baseline still produces the old ladder's 2.12, so the retrofit
  claim is enforced rather than asserted.
- Ten repeats twenty minutes apart do not compound stability meaningfully.
- The adjudication tally counts a decline, a rescue, and a stale drop separately, driven
  through `learnAdjudicate`'s real exit paths.
- The tally survives a day boundary as its own bucket.

## Deferred, with reasons

**Refitting the decay curve.** The low-R band predicts 86% and delivers 52%, which is a
real signal and probably means stability grows too fast. It rests on 29 answers. The `t = 0`
fault rests on 172 and is structural rather than a fitting question. Fix that, then let the
calibration bars — which work, and are now being read — judge the curve with more behind
them.

**Deleting `learnAdjudicate`.** The evidence points that way and is five samples deep. An
instrument costs one small store and settles it properly; deleting a working second opinion
on five observations is the kind of decision that gets reversed twice.

**Using response latency as a grading signal.** `ms` is already recorded and deliberately
ungraded. Now that calibration is being read, it is a real candidate for improving the
prediction — but it is a new claim about him, not a correction to an existing one.

**Grading the recogniser's confidence.** Measured and rejected here: `cf` does not separate
right answers from wrong ones at all, so there is nothing to build on.
