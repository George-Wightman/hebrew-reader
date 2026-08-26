# Conversations written ahead of time, and a walk home that works in a noisy street

## Where this came from

George, four items in one message:

> Conversations in nodes not preloaded in background, presser the Hutton multiple
> times and it sent API requests multiple times. Ant I was spammed with different
> convos when the response came back. Convos should be pre generated after the nodes
> at emade. But locked behind mastering words.

> The end screen of a session shouldn't close automatically, should wait fore to
> close it

> Remove the "say your answer to this" question that is what the conversations do I
> feel like they don't fit in the normal practice sections

> The "walk home" is a bit mid, since it's just relying on the auto cut off for the
> mic if it's noisy it doesn't work. Plus it's not accurate since it's just when I
> click the button to end it. I get the vision jus needs work

Four independent problems in one file. They are specced together because they were
reported together, not because they share machinery — each phase below stands alone
and can be reverted alone.

## What the code actually said

Every one of the four turned out to have a specific, locatable cause rather than a
vague one. Worth writing down, because three of them are one-line conditions that
have been quietly wrong for weeks.

**The duplicate conversations.** `campStartConvo` has no in-flight guard. Each tap
calls `campNodeConversation`, which checks `pathContentAll()`, misses, and fires
`learnMakeConversation`. Three taps means three requests, three cache writes where
the last one wins, and three `campBegin` calls stacking three sessions. Compounding
it: `learnMakeConversation` pushes every result into the general `convoAll()` store,
so the duplicates also landed in the pool that ordinary Talk sessions draw from.

`campWarm` already does exactly the right thing for a node's practice sentences —
fires on sheet open, de-duplicated per node per page load, so Practise starts
instantly. Conversations never got the same treatment.

**The end screen.** `learnFinish` nulls `learnSession`, then 400ms later fires
`syncRun("session")`. When that sync pulls any remote change it calls
`syncAfterApply`, whose condition is `view === "learn" && !learnSession`. That was
written to mean "not mid-session" — but a *finished* session is also not
mid-session, so it calls `learnRenderStart()` and repaints the start screen straight
over the end screen. The walk home is exposed to the identical bug.

**"Say your answer to this."** That is the `reply` card kind. Both session builders
reserve exactly one, and it always closes the session. The bank generator asks for
`type:"reply"` items in two prompts.

**The walk home.** `learnSpeedAttempt` starts a clock at the button tap and stops it
when the recogniser's `onend` fires. The number therefore contains mic acquisition,
the pause before he starts speaking, the utterance, *and* the engine's end-of-speech
silence timeout — which in a noisy street never trips at all. It is also the only
mic surface in the app that disables its own button: `learnSpeakAttempt` and
`learnHearSpeakAttempt` both toggle to "⏹ Stop" and call `micStop()` on a second tap.

---

## Phase 1 — The end screen stays until it is dismissed

`syncAfterApply` says what it meant: repaint the Learn start screen only when the
start screen is the one on display, rather than inferring it from session state.
`!learnSession` was a proxy that is true in two different situations and correct in
only one of them.

This also protects `lSpeed`, which had the same exposure and would have acquired the
same bug the moment a sync landed mid-walk-home.

**Test:** the predicate is extracted as `learnStartVisible()` so a test can drive it
against stub elements, rather than trying to reach `syncAfterApply`'s DOM read.

## Phase 2 — "Answer them" leaves ordinary practice

`replyPick` becomes `null` in both `learnBuild` and `campBuild`. The size arithmetic
in both is already `size - (replyPick ? 1 : 0)`, so sessions refill to their full
length on their own — there is no card-count regression to correct.

`type:"reply"` comes out of the two generation prompts, so no new ones are written.

Existing reply items in the bank become fully inert and are **not** pruned. Every
other pool in both builders already filters with `it.type !== "reply"`, so they fall
out of every path without a migration. That is the whole reason this option was
chosen over deleting them: nothing irreversible happens to written material.

`LEARN_KINDS.reply` and its render and scoring branches all stay. A conversation
turn *is* a reply card with a thread above it — that reuse is deliberate and
load-bearing, and deleting the kind would take the conversation down with it.

**The loss, named:** the reply was the deliberate closer — *"the session ends on the
real moment rather than on a vocabulary card."* Sessions will now end on whatever the
shuffle leaves last. Left standing rather than replaced, because inventing a new
closer inside a removal change is how a small change becomes an argument.

## Phase 3 — Conversations written before they are wanted

### 3a. The double-fire, made impossible rather than unlikely

Two guards, at different levels.

`campNodeConversation` gets an in-flight promise cache keyed by node id — the same
shape as `campWarmed`. Concurrent callers *share* one promise rather than each
starting a request. This is the guard that matters: it holds even if a second caller
arrives from somewhere that is not the button.

`campStartConvo` disables the button for the duration. This is the guard that stops
three `campBegin` calls stacking three sessions on top of each other.

### 3b. A node's conversation is about the node

`learnMakeConversation` gains an options bag. Today its vocabulary is
`readyWords(lib, srs)` — the words he can say *right now* — regardless of which node
asked. So a node's graduation conversation can contain not one word from the node it
is graduating him out of.

George, on whether writing it early is safe given the node's words are not ready yet:

> Since Those conversations are for the node it will only be unlocked when the words
> are ready. So making the conversations based on the words that are there makes
> sense, its not like a different non node conversation, so Its safer to use hte
> words in the node despite them not being ready yet right?

Right, and it dissolves the timing problem entirely. For a node the vocabulary
becomes `readyWords ∪ node.words ∪ node.carry`, with the node's own words marked in
the prompt as ones the exchange must actually use. The `READY_MIN_FOR_SENTENCES`
floor is skipped for node conversations — the node's declared word list is the
authority there, not the live SRS state.

Because the vocabulary no longer depends on when the call fires, the call can fire
whenever it is cheapest to fire it. That is what makes 3d possible at all.

### 3c. A node conversation stops leaking into the general pool

`learnMakeConversation` pushes every result onto `convoAll()`. A node's graduation is
not general practice, and once its words go ready `convoPick` will happily serve it
as an ordinary Talk session. A `store: false` option for node generation.

The duplicates already generated are sitting in that store now. Not swept — they are
servable conversations, and throwing away written material to tidy a store is a worse
trade than leaving them. `CONVO_MAX` is 14 and `convoSave` slices to it, so they age
out on their own.

### 3d. The queue

A new store, `hvr_convoq`: node ids awaiting a conversation. Nodes are enqueued when
`campApplyPlan` creates them, ordered nearest-chapter-first, so the node he will
reach next is written before the node four chapters away.

A worker with the same shape as `convoTopUp` — fire-and-forget, a module-level busy
flag so it is never concurrent with itself, and a per-day cap held in a date-keyed
store. The cap is the whole point: `campWarmNext` plans up to three chapters in one
map visit, at 4–6 nodes each, so eager generation is up to 18 Flash calls against a
daily allowance of 20.

It ticks on map render and after a session finishes. A failure leaves the node in the
queue rather than burning a retry, so a dead quota costs one attempt, not the queue.

### 3e. The gate does not move

`campNodeWordsReady` still decides when the button lights, and the copy under it is
unchanged. Everything here changes *when a conversation is written*. Nothing here
changes *when it opens*.

## Phase 4 — The walk home

The code cites Nation's fluency strand and then implements a stopwatch. Nation's own
technique is 4/3/2: the same material, repeated, against a shrinking deadline. The
repetition is the mechanism, not a side effect.

**Shape.** Up to three phrases he got clean this session, run three times over.

**The deadline scales with the phrase.** One word and an eight-word sentence cannot
share a bar. `words × budget`, budget tightening across the three passes, with a
floor so a one-word phrase stays winnable. Starting values are to be tuned by feel
after he has used it, not derived.

**The mic toggles, like every other card in the app.** Tap to start the bar draining;
the button becomes "⏹ Done"; tap to stop. Or the recogniser auto-ends first —
whichever comes first wins. This is the fix for the noisy street: nothing waits on
end-of-speech detection any more, so noise cannot strand a turn.

George's own instinct, on being asked what to measure:

> On second thought maybe it would be better to have the toggle mic option, like I
> can tell hte mic when to stop like other session cards.

The accuracy worry that made him hedge only bites if the number is a stopwatch
reading. Under a deadline it is not: the question is whether he was *done before the
bar ran out*, and a Stop tap is exactly that signal. A thumb being a few hundred
milliseconds generous at each end does not turn a pass into a fail.

**Landed** = stopped before the bar ran out, *and* `alignSpoken` found every content
word matched or near. Missing either simply does not count. Nothing is marked.

**No schedule write.** Unchanged, and still structural rather than a flag: the walk
home is not a card kind and does not run on the drill's rails, which is what makes
"this never feeds the scheduler" a fact about the architecture instead of a promise
every branch has to keep.

**The display** becomes the bar and a per-pass tally rather than a seconds readout.
Per the style guide's *the arrangement carries the meaning*: a bar draining is the
deadline, and does not need a caption saying so.

---

## Deferred, with reasons

**A replacement session closer.** Removing the reply leaves sessions ending on
whatever the shuffle produces. Real, small, and a separate decision — see Phase 2.

**Sweeping the duplicate conversations already in `convoAll()`.** They are servable
and they age out under `CONVO_MAX`. See 3c.

**Pruning `type:"reply"` bank items.** Considered and rejected: they go inert with no
migration, and a one-way delete of written material buys only tidiness.

**Deleting the `reply` card kind outright.** Cannot be done without taking
conversations with it. See Phase 2.

**Audio-level onset/offset detection through an `AnalyserNode`.** The most accurate
way to know when he started and stopped speaking, and unnecessary once the deadline
replaces the stopwatch — there is no longer a duration to measure precisely.

**Retrievability timing (prompt shown → speech onset).** A genuinely interesting
fluency number, and the one a stopwatch *should* have measured. Not built, because
under 4/3/2 the pass/fail against a tightening bar already carries the signal, and
two competing measurements on one screen is the "four weak signals" mistake the
style guide warns about.

**Tuning the deadline budgets.** Deliberately shipped at a guess, per the style
guide: *ship something lookable-at early, then iterate against what he photographs.*
