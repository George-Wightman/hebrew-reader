# A session that says what it did

## Where this came from

One flag, raised minutes after the session it describes:

> Why when I got them all correct didn't it increase my core? I improved? I get it was my
> second lesson but I don't think I shouldn't improve anything maybe the first time of the
> day get s bonus, straight after is less and third time is less still, but nothing on
> second try? Especially when I got some that I didn't before without using the practice?
> Feels like this is a bug/ the way we have built it with the R- or whatever punished me
> for sitting down and having a go. I was also getting a lot of just the words and not
> sentences why is that?

And, on why it kept happening:

> I feel like I keep having similar issues with the presentation the algorithm etc. Like
> we need to think outside the box to overcome whatever it is that makes the issues keep
> reoccuring.

This is the second time in one day. `2026-08-31-a-perfect-session-that-moved-nothing-design.md`
answered the morning's version of it, fixed a real rescue bug, declared the scheduler
correct, and **deferred the reporting** as "a reporting feature rather than a fix". The
complaint came back the same afternoon. The deferred item was the fix.

His `progress.json` was pulled and the 14:21 session rebuilt from `hvr_srslog`, which
records each answer's `before` state. Numbers below are his, not illustrations.

## What the session actually did

Session A (14:21:29–14:22:44, 9 cards) graded 2,2,2,2,1,1,2,2,2,0. Session B
(14:24:30–14:25:24, 7 cards) — the "second lesson" — was **every card correct**.

Two words crossed the weak threshold (`srsStrength` calls anything `diff >= 6.5` weak):

| word | diff before | diff after | band |
|---|---|---|---|
| `חדר` | 7.70 | 5.61 | weak → progressing |
| `מיטה` | 6.70 | 5.80 | weak → progressing |

That flipped the node's whole vocabulary gate:

```
campNodeWordsReady("Family & home")   false -> TRUE
```

All five words became his, and `hvr_pathcontent` already holds a written graduation
conversation for that node. The button at line 18389 went from `disabled` to live at
14:25:24. **It was the most productive session he has had on that node.**

What the end screen showed him:

| word | knowledge component | **bar drawn** | band |
|---|---|---|---|
| `חדר` | 46 → 88 | 9 → 13 (**+4**) | weak → progressing |
| `מיטה` | 66 → 84 | 5 → 5 (**+0**) | weak → progressing |
| `דלת` | 78 → 90 | 5 → 5 (**+0**) | — |
| `שולחן` | 100 → 100 | 11 → 18 (+7) | — |
| `דירה` | 100 → 100 | 8 → 15 (+7) | — |

`מיטה` crossed a band and its bar moved by **exactly zero**. He read the screen
correctly; the screen was wrong.

### Why the bar cannot move

`srsReach` is `Math.min(byStab, byDiff)`, and `srsDaysSince` works on date strings — so
any same-day answer gives `t = 0`, `R = 1`, `srsGain` of exactly `1`, and stability is
multiplied by one. `byStab` is therefore **frozen for the whole of a same-day session**,
and `min()` makes the frozen half cap the bar however far the other half travels.

Across his entire log: **196 clean answers, 140 of them (71%) at `R = 1`.** Nothing the
bar can show.

`srsReach` is not at fault. It means *distance to strong* and the style guide's rule — "a
metric must never contradict its own caption" — is the reason it takes the minimum. The
fault is asking one number to be both a distance and a progress report.

### Why the session was mostly bare words

His second question, and a separate cause. The bank holds 160 items; **13** touch Family &
home; **9** are production-side; **3 of those are `reply` items, which node sessions can
never serve** (`replyPick = null`, line 18962, and both `take` filters exclude the type).
That leaves **six sentences**, already seen 5, 4, 3, 3, 1 and 1 times, for a ~16-card
session. `campBuild` step 4 then tops the session up with the node's own words as solo
cards. That is exactly what he got.

`content/nodes.json`, committed the same day as "fifty sentences for the four live nodes",
contains **zero** items for Family & home — 15 Going places, 14 Liking, 21 health. Every
item passed `bankUnknowns`, `bankUses`, `bankNearDuplicate` and `bankServable`, because
**all four gates are per-item and nothing asked whether each live node got material.**

## The shape behind the recurrence

The app measures progress on one axis and displays it on another. The SRS moves four
numbers per word per side; the map shows one binary per node. Every real gain that is not
"node turned gold" is invisible, and most gains are not. He does the work, the numbers
move, the screen does not, he flags it — and each investigation then finds a genuine
mechanical bug behind that instance, fixes it, and the class survives, because the missing
thing was never the mechanism.

The same shape produced the content miss: per-item checks all passed, nothing looked at the
whole picture.

## Phase 1 — the end screen says what happened

**1. `srsReach` is untouched.** A separate `srsKnown(rec)` returns the knowledge component
(the `byDiff` half) so nothing that reads reach changes meaning.

**2. One track, two fills.** The solid fill stays reach. A ghost fill, the same band colour
at low opacity, extends into the *empty* part of the track and shows knowledge. Same-day
work moves the ghost while the solid stands still, and the gap between them states the
true thing: he knows it, it needs a night before the interval lengthens. The ghost is painted
under the solid and only ever visible beyond it, so it cannot wash out the band colour —
which is why the earlier lighter-overlay attempt was rejected.

`learnMark` must therefore remember knowledge and band alongside reach. A session stashed
by an older build has neither; the report treats a missing ghost as absent rather than as
zero.

**3. The facts, computed locally.** `learnFacts(s, srs)` returns what crossed a band, what
node gate opened, how many clean answers were frozen as same-day repeats, and what held.
Always rendered, always correct, no network.

**4. The coach's note.** One `gemini-flash-lite` call at session end, in the coach persona
`composePrompt` already established — the same voice, not a second one. It is handed
**only the output of `learnFacts`**, never a store:

```
CROSSED:  mita weak->progressing, chadar weak->progressing
UNLOCKED: "Family & home" — all 5 words yours; the conversation is open
FROZEN:   9 clean answers earned no interval (same-day repeats)
HELD:     delet, shulchan, dira
```

The model phrases; it never decides. It cannot invent progress because it is never shown
anything to infer from — the discipline `campEvidence` already uses. It reports a session
that went badly as a session that went badly; the entire complaint is the app not being
straight with him.

**5. Never a gate.** The facts render immediately and the note slots in when it arrives.
AI down, slow or rate-limited leaves a complete and correct screen. `learnCoachPrompt` is
split out so its content is testable without spending a call.

## Phase 2 — feed the node

Content for Family & home, and a **per-node coverage floor** in the authoring process so a
batch cannot ship while a live node sits under it. The four existing gates stay; what is
added is the one question none of them asks.

## Testing

- `srsKnown` rises as difficulty falls and is independent of stability.
- A word whose stability is frozen but whose difficulty improved reports a moved ghost and
  an unmoved solid — driven with `מיטה`'s real before/after numbers.
- `learnFacts` names a band crossing, and names the node gate opening only on the session
  that flipped it.
- `learnFacts` counts a same-day clean answer as frozen and an on-time one as not.
- `learnCoachPrompt` contains the crossings and the unlock, and omits sections that are
  empty rather than asserting nothing happened.
- A report built from an old-shape `moved` entry renders without a ghost and does not throw.

## Deferred, with reasons

**Damping the same-day miss cut.** Chosen, and phase 2 of the wider work. A miss takes its
full `× 0.3` at `R = 1` while a clean answer takes `× 1.0`, so within a day stability is a
one-way ratchet — 24 of his 45 misses landed there. It is a scheduler change and wants its
own spec and its own failing test, not a ride-along.

**The general "what changed" surface.** The structural answer to the recurrence. The coach
note overlaps it deliberately, but this spec only changes how a session is *reported*;
where gains are *recorded* is the larger question.

**`replyPick = null`.** Three of this node's nine production items are permanently
unservable in node sessions. Worth revisiting once the node is fed, so the two changes are
not measured on top of each other.

**A same-day bonus ladder** ("first time of the day gets a bonus, straight after is less").
His suggestion, and the honest answer is that the ladder already exists as `(1 - R)` — it
is continuous rather than stepped. Once the ratchet is damped and the screen reports what
moved, the thing he was actually missing should be gone. Revisit only if it is not.
