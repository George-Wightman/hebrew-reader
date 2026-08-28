# One hard sentence on the walk home, a node that writes new material, and an AI you can see

## Where this came from

George, on the walk home:

> Can we remove the "walk home" feature, as it is its just not working at all. And I
> dont really see the point of it.

> I dont mind having a couple at hte end but 9 is too much and I jsut skip over since
> ive finidhed the lesson already. So either delete or significantly change

Then, on being shown 4/3/2 and asked where to spend a smaller budget, he chose one
phrase over three passes and added:

> But can we make sure its a complex sentence not just a simple 3 worder, something
> hard.

And three more, in the same message:

> I notived that hte nodes arent generating new content for every session I launch. I
> did 2 back to back and htey were hte same content in a different order, can you look
> into that please, I want at most 1 or 2 repeating. For context I jsut moved to the
> second chapter so not sure if thats why.

> If there is an error with hte API key I would like ot know that as a pop up on the
> main screen maybe next to settings a little icon.

> For htat matter It owould be good ot have an indicator whenever the API is being
> called, telling me what is being called and what for.

On seeing the first draft of Phase 3, he replaced the pill with something better and
said what it is actually for:

> Im happy with a little like star (like hte gemini star/ any ai star these days) next
> to hte settings icon. That I can click on an it shows the last call and when it was
> (plus any other cool info that we get back/ send to the call, maybe thats behind a
> "more details" button). When there are calls out hte icon is blue like pulsing a
> little, when its innacctive its just gray like the settings colour. I want to know
> what and when the API was called if it failed and basically be able to see what is
> oging wrong when its going wrong so I can better feedback to you so we can better
> imrpove things in hte future.

Four items, reported together, specced together. Phases 2, 3 and 4 turn out to be one
symptom seen from three sides — that is the finding below, and it is why they ship in
one batch rather than separately. Each phase still stands alone and can be reverted
alone.

## What the code actually said

**The walk home is nine turns, and the short ones are unwinnable.** `SPEED_PHRASES = 3`
and `SPEED_PASSES = 3`. `learnSpeedStart` takes `items.slice(0, SPEED_PHRASES)` —
insertion order, so the phrases are whatever was answered first, which in a normal
session is single-word cards. `learnSpeedDeadline` is
`max(SPEED_FLOOR[pass], words * SPEED_PER_WORD[pass])`, and round 3 floors at 2.1s.
That 2.1s has to contain the recogniser starting, the utterance, and a thumb reaching
"Done". A three-word phrase gets 2.85s for the same. The result is a screen that reads
"Just over" almost every time, on material that was already answered cleanly minutes
earlier — which is a good description of a screen you skip.

**A node stops writing material the moment its words go ready.** `campWarm` opens:

```js
const weak = campWeakWords(node, srs).filter(k => lib[k]);
if (!weak.length) return Promise.resolve(0);
```

`campWeakWords` filters to `!wordReady(k, srs)`. `srsApply`'s first-meeting branch parks
a new word at `progressing`, and `progressing` is already `wordReady` — the comment
inside `campWeakWords` says so itself: *"A new word clears in a single meeting."* So one
session through a fresh node empties `weak`, and every later `campWarm(n, true)` returns
before it commissions anything. It is called correctly on every session; it just does
nothing. `campBuild` then re-serves the same narrow bank and `shuffleArr` hands it back
in a different order. Moving to a new chapter is exactly when this shows, because a
brand-new node's bank is at its thinnest.

**Nothing repeats-proofs the session either.** `bankCooldownSplit` sorts recently-served
items to the back, but `campBuild` does `pool = split.fresh.concat(split.recent)` and
takes in order, so on a thin pool it silently refills from material served last session.
The comment above it is honest that this is *"a preference rather than a filter"*. With
supply fixed, that preference is no longer enough to guarantee what George asked for.

**A failed commission is completely silent.** `campWarm` ends `.catch(() => 0)`. There is
no surface anywhere that says a Gemini call failed. A dead key and a `weak`-empty node
produce identical symptoms — the same ten cards, no explanation — which is why items 2,
3 and 4 are one finding. The `busyRing` covers only the handful of interactive callers
that wrap themselves in `busy(true)`; every background commission runs invisibly.

---

## Phase 1 — One hard sentence, three times over

`SPEED_PHRASES` 3 -> 1. `SPEED_PASSES` stays 3. Three turns, about twelve seconds, still
fired automatically before the end screen.

**The phrase is the hardest one, not the first one.** `learnSpeedStart` sorts `s.fluent`
by word count and takes the longest, with a floor of `SPEED_MIN_WORDS = 4`. If nothing
answered cleanly today reaches four words, the walk home does not run — skipping it
beats drilling a one-word answer three times. `SPEED_MIN` (currently "at least two
items") is replaced by this test, which is the same guard expressed against the thing
that actually matters.

**This fixes the deadlines without tuning them.** The unwinnable case was short phrases
pinned to the floors. A six-word sentence gets 9.0s / 7.2s / 5.7s under the existing
`SPEED_PER_WORD`, which is tight and fair. `SPEED_FLOOR` stays as insurance and stops
binding in practice.

**No recogniser on this screen.** The mic comes out of the walk home entirely: the bar
drains, he says it out loud, he taps "Said it" before it empties. Landed = stopped in
time. `learnSpeedLanded`'s `alignSpoken` check goes with it, along with `micListen`,
`micAcquire`, "Didn't catch that" and the whole noisy-street failure mode.

The justification, stated plainly because it is the part that could look like a
regression: **accuracy has already been proven.** Being in `s.fluent` at all requires
`clean` on a graded card minutes earlier. Fluency development asks one question — was
retrieval automatic enough to finish inside the window — and a thumb answers that
precisely. A stopwatch reading needs the mic; a deadline does not.

`speechSupported()` is no longer a precondition for the screen.

**Test:** phrase selection is extracted as a pure `learnSpeedPick(fluent)` so the suite
can assert "the longest is chosen", "under four words returns null", and "an empty list
returns null" without a session or a DOM.

## Phase 2 — A node writes new material every session

### 2a. Supply: commission even when nothing is stuck

`campWarm`'s early return becomes a fallback rather than an exit. When
`campWeakWords` is empty, the commission still fires with the node's own gradable words
as `rescue`. Everything downstream is unchanged — `CAMP_MAX_CARRIED`, the scaffold, the
setting, `commissionAcceptable`, `learnReviewItems`.

"Write more sentences using these words" is the honest generalisation of "write rescue
sentences for these words", and it is what George's earlier *"new ones every session
there is no reason not too"* always meant. The distinction the current code draws —
stuck words deserve material, ready ones do not — is wrong for a node, whose entire
purpose is to keep working the same small vocabulary until it is gold.

It stays fire-and-forget behind the session that triggered it, so the material lands for
the *next* session. That is the existing design and it is correct; it simply never had
anything to land.

### 2b. Demand: at most two repeats, or a shorter session

`campBuild` stops concatenating `split.recent` wholesale. Recently-served items are
admitted up to `CAMP_MAX_REPEATS = 2`, and beyond that the session runs short.

This is George's "at most 1 or 2 repeating" made structural rather than emergent, and it
matches what the builder already claims about itself: *"if there is not enough, the
session is shorter and honest about it."* Step 4's top-up with the node's own words as
solo cards still runs, so a short session is padded with the node's vocabulary rather
than with last session's sentences.

**Test:** `campBuild` is driven with a stub bank where every item is recent, asserting
the card count falls rather than the repeats rising.

## Phase 3 — A star beside the gear, and a log behind it

### 3a. The star

A small four-point star sits immediately left of `⚙ Settings` in the top nav — an inline
SVG, not an emoji, so it matches the gear's flat sans register rather than sitting on it
as a sticker.

Three states, and the colour is the whole language:

- **Idle.** `var(--muted)` — exactly `.navgear`'s colour, so at rest it reads as another
  piece of nav furniture rather than as a status light demanding to be read.
- **Working.** `var(--accent)`, pulsing gently. Teal rather than a new blue, because
  `.navsync.syncing` already pulses `var(--accent)` for a network call in flight, and a
  second colour for the same idea would be a second language for one state. Reduced-motion
  drops the animation and keeps the colour, as `syncpulse` already does.
- **Trouble.** `var(--bad)`, steady, not pulsing. A pulse means *happening*; a fault is a
  standing condition.

**Trouble is sticky.** It persists until the next successful call rather than clearing on
a timer. The failure that matters is the one that happened while he was mid-session and
looking at a card — a message that has already gone by the time he looks is the same as no
message, which is the state the app is in today.

### 3b. The log behind it

Tapping the star opens an **AI activity** panel — a plain `.modal-backdrop` / `.modal`,
the same idiom as Settings and Word strength.

At the top, the last call in full: what it was for, how long ago, which model, how long it
took, and what came back. Beneath it, the calls before it, one line each. At the bottom,
`aiQSummary` — the day's quota, which already exists and has never had a home outside
Settings.

A **More details** toggle on each entry reveals what was actually sent and what actually
came back. That is the entire point of the feature, in his words: *"be able to see what is
oging wrong when its going wrong so I can better feedback to you"*. A failed call whose
error text he can read to me is worth more than any status colour.

`AI_LOG_KEY = "hvr_ailog"`, a ring of the last `AI_LOG_MAX = 20` calls. Each entry holds
timestamp, label, model, outcome, duration, HTTP status, error text, and previews of the
prompt and the reply.

**The previews are capped and text-only.** `AI_LOG_PREVIEW = 1200` characters a side, and
non-text parts (a voice note's base64 `inlineData`) are recorded as `[audio]` rather than
stored. A transcription prompt carries a megabyte of audio; logging it would blow the
localStorage budget on the first voice note and take the library down with it.

`campWarm`'s `.catch(() => 0)` keeps swallowing the error for control flow — nothing
should block on a failed commission — but it is recorded on the way past.

**Test:** the ring buffer and the state machine are both pure — `aiLogPush(log, entry)`
asserts the cap holds and the newest is first; `aiStatusOf(log, inflight)` asserts that a
failure survives an intervening quiet period and clears only on the next success.

## Phase 4 — Every call says what it is for

`geminiRequest` is already the single funnel — *"the one place every Gemini call goes
through"* — so this is one function. It gains `opts.label`, which the star shows while the
call is in flight and the log keeps afterwards. Reference-counted like `busy()`, for the
same reason: two overlapping calls must not have the first to finish blank the label of
the second.

Callers pass what the work is for, in George's terms rather than the code's: "Writing
practice sentences", "Writing the conversation for The Market", "Checking your answer",
"Reading your voice note". An unlabelled call still works and reads "Thinking…", so no
call site is obliged to change before it has something useful to say.

**`busyRing` is untouched.** It stays wrapped around interactive callers only. A
background commission pulsing the whole window edge mid-session would be worse than the
silence it replaces; the star is the right register for work he did not ask for and is not
waiting on.

---

## Deferred, with reasons

**Tuning `SPEED_PER_WORD` and `SPEED_FLOOR`.** Still shipped at the original guess. With
short phrases excluded the floors stop binding, so the values that were suspect are no
longer the ones in play. Tune against a real walk home, not against arithmetic.

**Moving the walk home after the end screen.** Considered: it would stop the screen
standing between him and his score, which is part of why it gets skipped. Rejected for
now — the code's own note is that *"the two session shapes deleted in August were deleted
for being modes nobody picked"*, and three turns is short enough that the placement
problem may simply dissolve. Revisit if he still skips it.

**Deleting `s.fluent` collection for non-sentence cards.** `learnSpeedFrom` still gathers
words and chunks even though `learnSpeedPick` will never choose one. Harmless, and
keeping the collection whole means changing `SPEED_MIN_WORDS` is a one-constant change
rather than a re-plumbing.

**Retiring node bank material.** `bankRetire` exists and handles the general case. Phase
2b caps repeats within a session; whether a node's oldest sentences should age out
entirely is a separate question about the bank, not about node sessions.

**Surfacing quota exhaustion differently from a hard failure.** `aiQNote` already
distinguishes `spent` from `ok`, and the Phase 3 pill could say "no AI until tomorrow"
rather than "AI unreachable". Worth doing, and not until the indicator exists and has
been looked at.

**In-app bug reporting.** George, in the same message:

> Maybe thats outside of hte scope for right now the... I find myself mid session beign
> like "this thing could use fixing/ changing" if htere was a way in app to like save a
> SS with a comment that was stored that you could see later that would be a game
> changer.

Deferred at his own suggestion — *"Maybe you want to wait ot deelop htis bug reporting
feature till after this section"* — and it is the right call, because Phase 3 builds the
half of it that is hard. A capture store, a list behind a nav control, and previews behind
a details toggle are exactly the shape a report log needs; once the AI log exists, the
reporter is that pattern pointed at a different kind of entry. Doing them together would
mean designing the store around two consumers before either has been used.

Worth naming the real question that phase has to answer, so it is not rediscovered: a
screenshot of the running app is `html2canvas`-shaped work in a codebase with no build
step and no dependencies, and the alternative — capturing app *state* rather than pixels
(which screen, which card, which session, the last few AI calls) — may be more useful to
me than an image, and is free.

**Per-call history beyond twenty.** The ring holds the last twenty calls, which covers a
session and a bit. A full day's log would want a place to live and a way to clear it.
