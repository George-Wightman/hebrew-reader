# The walk home listens, and it stops being easy

**Date:** 2026-09-03
**Scope:** `SPEED_PER_WORD`, `SPEED_FLOOR`, `learnSpeedAttempt`, `learnSpeedJudge`,
`learnSpeedNext`, the `lSpeed` markup, and one new setting in **Practice and scheduling**.

## Where this came from

A flag raised mid-run on **Going places**, on the walk-home screen itself:

> These times are too easy and it could record me just tgive me to option to end it too.

And, when we picked it up:

> Lets address the speed rounds being too easy the timings are too slow its easy. I also
> think htat it would be fine to have it as a mic setting so it does detect my words and I
> can stop it just like other cards for hat end screen

Three asks in one sentence: the clock is too generous, the mic should come back, and there
should be a way off the screen.

The first was invited. `SPEED_PER_WORD` and `SPEED_FLOOR` carry a comment saying so:

> Guesses, and deliberately so: they want tuning against a real walk home in a real
> street, not deriving.

He has now done that walk. This is the tuning.

The second reverses a deliberate decision, and that is the part worth being careful about.
`learnSpeedAttempt` says:

> NO RECOGNISER ON THIS SCREEN, and that is the fix rather than a simplification.

The mic came off because of an earlier report of his — *"its just relying on the auto cut
off for the mic if it's noisy it doesn't work"* — and because the version that answered
that report left the recogniser able to hand back a half-heard phrase and **fail him on
the transcription rather than on the speed**. That reasoning is still correct. What
follows does not undo it; it puts the mic back in a role where the failure mode cannot
occur.

## Phase 1 — the clock

`SPEED_PER_WORD` becomes `[0.9, 0.7, 0.55]` and `SPEED_FLOOR` becomes `[2.2, 1.8, 1.5]`,
from `[1.5, 1.2, 0.95]` and `[3.0, 2.5, 2.1]`. About forty per cent off the window.

| words | round 1 | round 2 | round 3 |
|---|---|---|---|
| 4 | 3.6s | 2.8s | 2.2s |
| 5 | 4.5s | 3.5s | 2.75s |
| 8 | 7.2s | 5.6s | 4.4s |

The floors still never bind at four words or more, which `SPEED_MIN_WORDS` already
guarantees is the only case that reaches this screen — so the per-word budget does all the
work and the existing winnability test (`deadline > FLOOR` across 4–8 words, every round)
holds unchanged rather than needing its expectation rewritten.

Chosen from three options against a learner pace of roughly two words a second: round one
stays comfortable-but-moving, round three needs genuine automaticity. The old round one
gave a five-word sentence 7.5 seconds, which is more than double the time it takes to say.

## Phase 2 — the mic, as a second way to land and never a way to fail

**The rule, and everything else follows from it: the recogniser can only ever END A TURN
EARLY AND SUCCESSFULLY.** It cannot mark a miss. Running out of time remains the only way
to lose a round, exactly as today.

That is the same asymmetry the whole ASR path already runs on — *nothing in it can mark a
word wrong; every layer only ever softens a miss* — and it is what makes the noisy street
structurally unable to come back. A garbled transcript, a passing bus, silence: all of
them do nothing at all, and the thumb and the bar are left deciding the turn between them
just as they do now.

Tapping **Say it** starts the bar *and* the recogniser, and the button becomes **⏹ Stop**,
which is the control every other speaking card in the app already has. Three endings:

- **It hears the phrase** — lands immediately, bar freezes where it is. Judged off the
  live interim transcript, not the final one, so it lands as the last word arrives rather
  than when the recogniser decides he has stopped talking. Endpointing latency would
  otherwise eat most of a 2.2-second round.
- **He taps ⏹ Stop** — lands, precisely as "Said it" does today. His thumb still works and
  still wins.
- **The bar runs out** — "Out of time", precisely as today.

Recognition reuses what is already there rather than adding a second way of comparing
Hebrew: `heWords` to tokenise, `alignSpoken` to align the interim against the expected
phrase, and a turn counts as heard when no expected word is still `missed` — `near`
counts, because `nearEnough` exists for exactly the vowel-level differences a recogniser
invents on non-native speech. `micHeardIn` over the alternatives softens it one step
further. None of this can produce a miss, so being generous costs nothing.

## Phase 3 — the setting

**Listen on the walk home**, in **Practice and scheduling**, On by default, backed by
`hvr_speedmic` (`!== "0"`, so absent means on). Off gives exactly today's screen, thumb
and bar and no microphone.

Default-on because the mic is now strictly additive and he asked for it; a setting at all
because a microphone running in a pocket on the way home is a real cost even when it is
only ever helping, and because he asked for it as a setting. It is an `hvr_` key, so
`exportKeys()` syncs it to his phone with everything else and no sync change is needed.

A browser with no recogniser falls back to the thumb whatever the setting says.

## Phase 4 — a way off the screen

**Finish here**, beside **Skip this one**, going straight to `learnFinish()` — the end
screen, with the score and what the scheduler did.

Deliberately not `lRun`'s **End session**, which calls `learnRenderStart()` and drops him
back on the map. By the time the walk home is running, the graded work is finished,
`sessionClear()` has already been called and the day's marks are written; there is nothing
left to abandon, and the end screen is the thing he is being kept from rather than the
thing he is escaping. "Skip this one" advances a single turn and stays as it is.

## Deferred, with reasons

- **The walk home still writes no schedule.** Keeping it off the drill's rails is what
  makes *"this never writes a schedule"* a structural fact rather than a flag every branch
  has to remember, and a mic that detects his words is not a reason to start counting
  them — he answered these cards cleanly ten minutes earlier, which is how they got here.
- **No accuracy judgement, ever.** Not "you said it but you said it wrong". That is a
  different exercise from the one this screen runs, it needs a grading pass this screen
  has no budget for mid-round, and it is the exact door the noisy street came through.
- **No per-round timing feedback** ("2.8s"). The bar already says it, and a number invites
  optimising a stopwatch rather than speaking fluently. Revisit if he asks for it.
- **`SPEED_PHRASES` stays at 1 and `SPEED_PASSES` at 3.** He cut this screen down to
  three turns himself and has not complained about the shape since — only the clock.
